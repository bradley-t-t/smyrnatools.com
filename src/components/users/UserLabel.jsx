import React, {useEffect, useState} from 'react';
import {UserService} from '../../services/UserService';
import './UserLabel.css';

function UserLabel({userId, showInitials = false, showIcon = false, size = 'medium'}) {
    const [userName, setUserName] = useState('');
    const [initials, setInitials] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;

        async function fetchUserData() {
            if (!userId) {
                if (isMounted) {
                    setUserName('Unknown');
                    setInitials('?');
                    setIsLoading(false);
                }
                return;
            }

            try {
                const displayName = await UserService.getUserDisplayName(userId);

                if (!isMounted) return;

                setUserName(displayName);

                const nameParts = displayName.trim().split(' ').filter(part => part);
                if (nameParts.length > 1) {
                    setInitials(`${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase());
                } else if (displayName.includes('@')) {
                    setInitials(displayName.substring(0, 2).toUpperCase());
                } else if (displayName.startsWith('User ')) {
                    setInitials(userId.substring(0, 2).toUpperCase());
                } else {
                    setInitials(displayName.substring(0, 2).toUpperCase());
                }
            } catch (error) {
                if (isMounted) {
                    setError(error.message);
                    setUserName(`User ${userId ? userId.substring(0, 8) : 'Unknown'}`);
                    setInitials('!');
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        fetchUserData();

        return () => {
            isMounted = false;
        };
    }, [userId]);

    if (isLoading) {
        return (
            <span className={`user-label size-${size} loading`}>
                {showIcon && <i className="fas fa-user"></i>}
                {showInitials && <span className="user-initials loading">?</span>}
                <span className="user-name loading"></span>
            </span>
        );
    }

    if (error) {
        return (
            <span className={`user-label size-${size} error`} title={`Error: ${error}`}>
        {showIcon ? (
            <i className="fas fa-exclamation-triangle"></i>
        ) : showInitials ? (
            <span className="user-initials error">!</span>
        ) : null}
                <span className="user-name">Error: {error.substring(0, 15)}...</span>
      </span>
        );
    }

    return (
        <span className={`user-label size-${size}`} data-testid={`user-label-${userId}`}>
      {showIcon ? (
          <i className="fas fa-user"></i>
      ) : showInitials ? (
          <span className="user-initials">{initials}</span>
      ) : null}
            <span className="user-name">{userName}</span>
    </span>
    );
}

export default UserLabel;