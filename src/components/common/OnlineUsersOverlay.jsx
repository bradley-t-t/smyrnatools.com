import React, { useState, useEffect, useRef } from 'react';
import { usePresence } from '../../hooks/UsePresence';
import { usePreferences } from '../../context/PreferencesContext';
import './OnlineUsersOverlay.css';

function OnlineUsersOverlay() {
    const { onlineUsers, loading, error } = usePresence();
    const { preferences } = usePreferences();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [animateCount, setAnimateCount] = useState(false);
    const prevCountRef = useRef(onlineUsers.length);
    const accentColor = preferences.accentColor === 'red' ? '#b80017' : '#003896';

    useEffect(() => {
        if (!loading && onlineUsers.length !== prevCountRef.current) {
            setAnimateCount(true);
            const timer = setTimeout(() => setAnimateCount(false), 500);
            prevCountRef.current = onlineUsers.length;
            return () => clearTimeout(timer);
        }
    }, [onlineUsers.length, loading]);

    const getRelativeTime = (timestamp) => {
        if (!timestamp) return 'Now';

        const now = new Date();
        const lastSeen = new Date(timestamp);
        const diffMs = now - lastSeen;

        if (diffMs < 60000) {
            return 'Just now';
        } else if (diffMs < 3600000) {
            const minutes = Math.floor(diffMs / 60000);
            return `${minutes}m ago`;
        } else if (diffMs < 86400000) {
            const hours = Math.floor(diffMs / 3600000);
            return `${hours}h ago`;
        } else {
            const days = Math.floor(diffMs / 86400000);
            return `${days}d ago`;
        }
    };

    const toggleExpand = () => setIsExpanded(!isExpanded);
    const toggleMinimize = () => setIsMinimized(!isMinimized);

    if (loading) return null;
    if (error) return null;
    if (onlineUsers.length === 0) return null;
    if (!preferences.showOnlineOverlay) return null;

    return (
        <div className={`online-users-overlay ${isExpanded ? 'expanded' : ''} ${isMinimized ? 'minimized' : ''}`}
             style={{ backgroundColor: preferences.themeMode === 'dark' ? '#2a2a2a' : '#ffffff' }}>
            {isMinimized ? (
                <div className="online-users-minimized" onClick={toggleMinimize} style={{ backgroundColor: accentColor }}>
                    <div className="user-count">{onlineUsers.length}</div>
                    <i className="fas fa-users"></i>
                </div>
            ) : (
                <>
                    <div className="online-users-header" style={{ borderBottomColor: accentColor }}>
                        <div className="header-title">
                            <i className="fas fa-users" style={{ color: accentColor }}></i>
                            <span>Online Users</span>
                            <div className={`user-count ${animateCount ? 'pulse' : ''}`} style={{ backgroundColor: accentColor }}>
                                {onlineUsers.length}
                            </div>
                        </div>
                        <div className="header-actions">
                            <button className="action-button" onClick={toggleExpand} title={isExpanded ? 'Show less' : 'Show more'}>
                                <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                            </button>
                            <button className="action-button" onClick={toggleMinimize} title="Minimize">
                                <i className="fas fa-minus"></i>
                            </button>
                        </div>
                    </div>
                    <div className="online-users-list">
                        {onlineUsers.slice(0, isExpanded ? onlineUsers.length : 3).map(user => (
                            <div key={user.id} className="online-user">
                                <div className="user-avatar" style={{ backgroundColor: accentColor }}>
                                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div className="user-info">
                                    <div className="user-name">{user.name || 'Unknown User'}</div>
                                    <div className="user-status">
                                        <span className="status-indicator"></span>
                                        <span className="status-text">Online • {getRelativeTime(user.lastSeen)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {!isExpanded && onlineUsers.length > 3 && (
                            <div className="more-users" onClick={toggleExpand}>
                                <span>+{onlineUsers.length - 3} more</span>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default OnlineUsersOverlay;
