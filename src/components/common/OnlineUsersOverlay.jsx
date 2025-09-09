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

    const toggleExpand = () => setIsExpanded(!isExpanded);
    const toggleMinimize = () => setIsMinimized(!isMinimized);

    if (!isLoggedIn || loading || error || onlineUsers.length === 0) return null;

    return (
        <div className={`online-users-overlay${isExpanded ? ' expanded' : ''}${isMinimized ? ' minimized' : ''}`}>
            {isMinimized ? (
                <div className="online-users-minimized-compact" onClick={toggleMinimize} tabIndex={0}
                     aria-label="Show online users" role="button">
                    <span className="user-count">{onlineUsers.length}</span>
                    <button className="action-button icon-only" tabIndex={-1} aria-hidden="true">
                        <i className="fas fa-user"></i>
                    </button>
                </div>
            ) : (
                <>
                    <div className="online-users-header">
                        <div className="header-title">
                            <i className="fas fa-users"></i>
                            <span>Online Users</span>
                            <div className={`user-count${animateCount ? ' pulse' : ''}`}>{onlineUsers.length}</div>
                        </div>
                        <div className="header-actions">
                            <button className="action-button circle" onClick={toggleExpand}
                                    title={isExpanded ? 'Show less' : 'Show more'}
                                    aria-label={isExpanded ? 'Show less users' : 'Show more users'}>
                                <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                            </button>
                            <button className="action-button circle" onClick={toggleMinimize} title="Minimize"
                                    aria-label="Minimize online users overlay">
                                <i className="fas fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                    <div className="online-users-list">
                        {onlineUsers.slice(0, isExpanded ? onlineUsers.length : 3).map(user => {
                            let displayName = typeof user.name === 'string' ? user.name : '';
                            let avatarChar = displayName.length > 0 ? displayName.charAt(0).toUpperCase() : 'U';
                            return (
                                <div key={user.id} className="online-user">
                                    <div className="user-avatar">{avatarChar}</div>
                                    <div className="user-info">
                                        <div className="user-status">
                                            <span className="status-indicator"></span>
                                        </div>
                                        <div className="user-name">{displayName || 'Unknown User'}</div>
                                    </div>
                                </div>
                            );
                        })}
                        {!isExpanded && onlineUsers.length > 3 && (
                            <div className="more-users">
                                <span>+{onlineUsers.length - 3} more</span>
                                <button className="action-button circle icon-only" title="Show more"
                                        aria-label="Show more users" onClick={toggleExpand}>
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
