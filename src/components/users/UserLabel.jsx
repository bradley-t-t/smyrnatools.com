import React, {useEffect, useState} from 'react';
import {UserService} from '../../services/auth/UserService';
import {MockDataService} from '../../services/MockDataService';
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
                console.log(`[UserLabel] Calling UserService.getUserById(${userId})`);
                const user = await UserService.getUserById(userId);
                console.log(`[UserLabel] Got user:`, user);

                if (!isMounted) return;

                if (user) {
                    const name = user.name || user.email || 'Unknown';
                    setUserName(name);

                    // Generate initials
                    if (user.name) {
                        const nameParts = user.name.trim().split(' ').filter(part => part);
                        if (nameParts.length > 1) {
                            setInitials(`${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase());
                        } else {
                            setInitials(user.name.substring(0, 2).toUpperCase());
                        }
                    } else if (user.email) {
                        setInitials(user.email.substring(0, 2).toUpperCase());
                    } else {
                        setInitials('?');
                    }
                } else {
                    // Fallback to mock data
                    const mockUser = MockDataService.getMockUser(userId);
                    setUserName(mockUser.name);

                    // Generate initials from mock user
                    const nameParts = mockUser.name.trim().split(' ').filter(part => part);
                    if (nameParts.length > 1) {
                        setInitials(`${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase());
                    } else {
                        setInitials(mockUser.name.substring(0, 2).toUpperCase());
                    }
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
                {showInitials && <span className="user-initials loading-placeholder">..</span>}
                <span className="user-name loading-placeholder">Loading...</span>
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
