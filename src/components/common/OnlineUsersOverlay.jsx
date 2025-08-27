import React, {useEffect, useRef, useState, useMemo} from 'react';
import {usePreferences} from '../../app/context/PreferencesContext';
import {usePresence} from '../../app/hooks/usePresence';
import {UserService} from '../../services/UserService';
import {RegionService} from '../../services/RegionService';
import './styles/OnlineUsersOverlay.css';

function OnlineUsersOverlay() {
    const {onlineUsers, loading, error} = usePresence();
    const {preferences, setSelectedRegion} = usePreferences();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMinimized, setIsMinimized] = useState(true);
    const [animateCount, setAnimateCount] = useState(false);
    const prevCountRef = useRef(onlineUsers.length);
    const isLoggedIn = true;

    const [userId, setUserId] = useState(sessionStorage.getItem('userId') || '');
    const [canSelectRegion, setCanSelectRegion] = useState(false);
    const [allRegions, setAllRegions] = useState([]);
    const [regionLoading, setRegionLoading] = useState(true);

    const currentRegionCode = preferences.selectedRegion?.code || '';
    const currentRegionName = preferences.selectedRegion?.name || '';
    const currentRegionDisplay = useMemo(() => {
        if (!currentRegionCode && !currentRegionName) return 'Select Region';
        if (currentRegionCode && currentRegionName) return `${currentRegionCode} • ${currentRegionName}`;
        return currentRegionName || currentRegionCode;
    }, [currentRegionCode, currentRegionName]);

    useEffect(() => {
        if (!loading && onlineUsers.length !== prevCountRef.current) {
            setAnimateCount(true);
            const timer = setTimeout(() => setAnimateCount(false), 500);
            prevCountRef.current = onlineUsers.length;
            return () => clearTimeout(timer);
        }
    }, [onlineUsers.length, loading]);

    useEffect(() => {
        let mounted = true;
        async function initRegion() {
            try {
                let uid = userId;
                if (!uid) {
                    try {
                        const user = await UserService.getCurrentUser();
                        uid = user?.id || '';
                        if (uid) setUserId(uid);
                    } catch {
                    }
                }
                if (!uid) {
                    setRegionLoading(false);
                    return;
                }
                try {
                    const hasPerm = await UserService.hasPermission(uid, 'region.select');
                    if (mounted) setCanSelectRegion(!!hasPerm);
                } catch {
                }
                let defaultRegion = {code: '', name: ''};
                try {
                    const plantCode = await UserService.getUserPlant(uid);
                    if (plantCode) {
                        try {
                            const regionsByPlant = await RegionService.fetchRegionsByPlantCode(plantCode);
                            if (Array.isArray(regionsByPlant) && regionsByPlant.length > 0) {
                                const r = regionsByPlant[0];
                                defaultRegion = {
                                    code: r.regionCode || r.region_code || '',
                                    name: r.regionName || r.region_name || ''
                                };
                            }
                        } catch {
                        }
                    }
                } catch {
                }
                if (!preferences.selectedRegion?.code && defaultRegion.code) {
                    setSelectedRegion(defaultRegion.code, defaultRegion.name);
                }
                try {
                    const regions = await RegionService.fetchRegions();
                    if (mounted) setAllRegions(regions);
                } catch {
                }
            } finally {
                if (mounted) setRegionLoading(false);
            }
        }
        initRegion();
        return () => {
            mounted = false;
        };
    }, []);

    const getRelativeTime = () => {
        return 'Online';
    };

    const toggleExpand = () => setIsExpanded(!isExpanded);
    const toggleMinimize = () => setIsMinimized(!isMinimized);

    const handleChangeRegion = e => {
        const code = e.target.value;
        if (!code) {
            setSelectedRegion('', '');
            return;
        }
        const r = allRegions.find(x => (x.region_code || x.regionCode) === code);
        const name = r ? (r.region_name || r.regionName || '') : '';
        setSelectedRegion(code, name);
    };

    if (!isLoggedIn || loading || error || onlineUsers.length === 0 || !preferences.showOnlineOverlay) return null;

    return (
        <div className={`online-users-overlay ${isExpanded ? 'expanded' : ''} ${isMinimized ? 'minimized' : ''}`}>
            {isMinimized ? (
                <div className="online-users-minimized-compact" onClick={toggleMinimize} title={currentRegionDisplay}>
                    <span className="user-count">{onlineUsers.length}</span>
                    <button className="action-button icon-only" title="Expand">
                        <i className="fas fa-user"></i>
                    </button>
                </div>
            ) : (
                <>
                    <div className="online-users-header">
                        <div className="header-title">
                            <i className="fas fa-users"></i>
                            <span>Online Users</span>
                            <div className={`user-count ${animateCount ? 'pulse' : ''}`}>
                                {onlineUsers.length}
                            </div>
                        </div>
                        <div className="header-actions">
                            <button className="action-button circle" onClick={toggleExpand}
                                    title={isExpanded ? 'Show less' : 'Show more'}>
                                <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                            </button>
                            <button className="action-button circle" onClick={toggleMinimize} title="Minimize">
                                <i className="fas fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                    {canSelectRegion && !regionLoading && (
                        <div className="overlay-region-controls">
                            <select className="region-select" value={currentRegionCode} onChange={handleChangeRegion}>
                                <option value="">Select a region</option>
                                {allRegions.map(r => {
                                    const code = r.region_code || r.regionCode;
                                    const name = r.region_name || r.regionName || '';
                                    return (
                                        <option key={code} value={code}>{code} • {name}</option>
                                    );
                                })}
                            </select>
                        </div>
                    )}
                    <div className="online-users-list">
                        {onlineUsers.slice(0, isExpanded ? onlineUsers.length : 3).map(user => (
                            <div key={user.id} className="online-user">
                                <div className="user-avatar">
                                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div className="user-info">
                                    <div className="user-name">{user.name || 'Unknown User'}</div>
                                    <div className="user-status">
                                        <span className="status-indicator"></span>
                                        <span className="status-text">{getRelativeTime()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {!isExpanded && onlineUsers.length > 3 && (
                            <div className="more-users">
                                <span>+{onlineUsers.length - 3} more</span>
                                <button className="action-button circle icon-only" title="Show more"
                                        onClick={toggleExpand}>
                                    <i className="fas fa-chevron-down"></i>
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default OnlineUsersOverlay;
