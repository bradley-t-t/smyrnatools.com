import {useEffect, useState} from 'react';
import {UserPresenceService} from '../../services/UserPresenceService';

export function usePresence() {
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        UserPresenceService.setup().then(success => {
            if (!active) return;
            if (!success) {
                setError('Failed to initialize presence service');
                setLoading(false);
                return;
            }
            UserPresenceService.getOnlineUsers().then(users => {
                if (!active) return;
                setOnlineUsers(users);
                setLoading(false);
            }).catch(err => {
                if (!active) return;
                setError(err.message || 'Failed to get online users');
                setLoading(false);
            });
            const handlePresenceChange = users => {
                if (!active) return;
                setOnlineUsers(users);
            };
            UserPresenceService.addListener(handlePresenceChange);
            return () => {
                UserPresenceService.removeListener(handlePresenceChange);
            };
        }).catch(err => {
            if (!active) return;
            setError(err.message || 'Failed to initialize presence service');
            setLoading(false);
        });
        return () => {
            active = false;
        };
    }, []);

    return {onlineUsers, loading, error};
}

export default usePresence;
