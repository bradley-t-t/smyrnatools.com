import React, {useEffect, useRef, useState} from 'react';
import {usePresence} from '../../app/hooks/usePresence';
import './styles/OnlineUsersOverlay.css';

function OnlineUsersOverlay() {
    const {onlineUsers, loading, error} = usePresence();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMinimized, setIsMinimized] = useState(true);
    const [animateCount, setAnimateCount] = useState(false);
    const prevCountRef = useRef(onlineUsers.length);
    const isLoggedIn = true;

    useEffect(() => {
        if (!loading && onlineUsers.length !== prevCountRef.current) {
            setAnimateCount(true);
            const timer = setTimeout(() => setAnimateCount(false), 500);
            prevCountRef.current = onlineUsers.length;
            return () => clearTimeout(timer);
        }
    }, [onlineUsers.length, loading]);

    const getRelativeTime = () => {
        return 'Online';
    };
    const toggleExpand = () => setIsExpanded(!isExpanded);
    const toggleMinimize = () => setIsMinimized(!isMinimized);

    if (!isLoggedIn || loading || error || onlineUsers.length === 0) return null;

    return (
        <div className={`online-users-overlay ${isExpanded ? 'expanded' : ''} ${isMinimized ? 'minimized' : ''}`}>
            {isMinimized ? (
                <div className="online-users-minimized-compact" onClick={toggleMinimize}>
                    <span className="user-count">{onlineUsers.length}</span>
                    <button className="action-button icon-only">
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
