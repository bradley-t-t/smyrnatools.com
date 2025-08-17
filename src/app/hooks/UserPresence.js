import { useState, useEffect } from 'react';
import { UserPresenceService } from '../../services/UserPresenceService';

export function useUserPresence() {
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        UserPresenceService.setup().then(success => {
            if (!isMounted) return;
            if (!success) {
                setError('Failed to initialize presence service');
                setLoading(false);
                return;
            }
            UserPresenceService.getOnlineUsers().then(users => {
                if (!isMounted) return;
                setOnlineUsers(users);
                setLoading(false);
            }).catch(err => {
                if (!isMounted) return;
                setError(err.message || 'Failed to get online users');
                setLoading(false);
            });
            const handlePresenceChange = users => {
                if (!isMounted) return;
                setOnlineUsers(users);
            };
            UserPresenceService.addListener(handlePresenceChange);
            return () => {
                UserPresenceService.removeListener(handlePresenceChange);
            };
        }).catch(err => {
            if (!isMounted) return;
            setError(err.message || 'Failed to initialize presence service');
            setLoading(false);
        });
        return () => {
            isMounted = false;
        };
    }, []);

    return { onlineUsers, loading, error };
}
