import React, {useEffect, useState} from 'react';
import {UserService} from '../services/auth/UserService';
import './UserLabel.css';

function UserLabel({userId, showInitials = false, showIcon = false, size = 'medium'}) {
    const [userName, setUserName] = useState('');
    const [initials, setInitials] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;

        async function fetchUserData() {
            console.log(`[UserLabel] Fetching data for userId: ${userId}`);
            if (!userId) {
                if (isMounted) {
                    setUserName('Unknown');
                    setInitials('?');
                    setIsLoading(false);
                }
                return;
            }

            try {
                // Use the enhanced getUserDisplayName method which prioritizes full name
                console.log(`[UserLabel] Calling UserService.getUserDisplayName(${userId})`);
                const displayName = await UserService.getUserDisplayName(userId);
                console.log(`[UserLabel] Got display name:`, displayName);

                if (!isMounted) return;

                setUserName(displayName);

                // Generate initials from the display name
                const nameParts = displayName.trim().split(' ').filter(part => part);
                if (nameParts.length > 1) {
                    // If we have multiple parts (first and last name), use first letter of first and last
                    setInitials(`${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase());
                } else if (displayName.includes('@')) {
                    // If it's an email address
                    setInitials(displayName.substring(0, 2).toUpperCase());
                } else if (displayName.startsWith('User ')) {
                    // If it's a fallback user ID format
                    setInitials(userId.substring(0, 2).toUpperCase());
                } else {
                    // Otherwise use first two letters
                    setInitials(displayName.substring(0, 2).toUpperCase());
                }
            } catch (error) {
                console.error('[UserLabel] Error fetching user:', error);
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