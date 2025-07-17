import { supabase } from './DatabaseService';
import { UserService } from './UserService';

class PresenceServiceImpl {
    constructor() {
        this.onlineUsers = new Map();
        this.subscriptions = [];
        this.listeners = [];
        this.isSetup = false;
        this.currentUserId = null;
        this.heartbeatInterval = null;
        this.cleanupInterval = null;
    }

    async setup() {
        if (this.isSetup) return;

        try {
            const user = await UserService.getCurrentUser();
            if (!user?.id) return false;

            this.currentUserId = user.id;

            const subscription = supabase
                .channel('presence_changes')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'users_presence'
                }, this.handlePresenceChange.bind(this))
                .subscribe();

            this.subscriptions.push(subscription);

            await this.setUserOnline(this.currentUserId);

            this.startHeartbeat();

            this.startCleanup();

            window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
            window.addEventListener('online', this.handleOnlineStatusChange.bind(this, true));
            window.addEventListener('offline', this.handleOnlineStatusChange.bind(this, false));

            this.isSetup = true;
            return true;
        } catch (error) {
            console.error('Error setting up presence service:', error);
            return false;
        }
    }

    async setUserOnline(userId) {
        if (!userId) return false;

        try {
            const now = new Date().toISOString();
            const { error } = await supabase
                .from('users_presence')
                .upsert({
                    user_id: userId,
                    is_online: true,
                    last_seen: now,
                    updated_at: now
                }, {
                    onConflict: 'user_id'
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error setting user online:', error);
            return false;
        }
    }

    async setUserOffline(userId) {
        if (!userId) return false;

        try {
            const now = new Date().toISOString();
            const { error } = await supabase
                .from('users_presence')
                .update({
                    is_online: false,
                    last_seen: now,
                    updated_at: now
                })
                .eq('user_id', userId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error setting user offline:', error);
            return false;
        }
    }

    async updateHeartbeat() {
        if (!this.currentUserId) return false;

        try {
            const now = new Date().toISOString();
            const { error } = await supabase
                .from('users_presence')
                .update({
                    last_seen: now,
                    updated_at: now
                })
                .eq('user_id', this.currentUserId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error updating heartbeat:', error);
            return false;
        }
    }

    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            this.updateHeartbeat();
        }, 30000);
    }

    startCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(async () => {
            try {
                const staleTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
                await supabase
                    .from('users_presence')
                    .update({
                        is_online: false,
                        updated_at: new Date().toISOString()
                    })
                    .eq('is_online', true)
                    .lt('last_seen', staleTime);
            } catch (error) {
                console.error('Error cleaning up stale presence records:', error);
            }
        }, 60000);
    }

    handlePresenceChange(payload) {
        this.notifyListeners();
    }

    handleBeforeUnload() {
        if (this.currentUserId) {
            const data = new FormData();
            data.append('user_id', this.currentUserId);
            navigator.sendBeacon('/api/set-offline', data);

            this.setUserOffline(this.currentUserId).catch(console.error);
        }
    }

    handleOnlineStatusChange(isOnline) {
        if (!this.currentUserId) return;

        if (isOnline) {
            this.setUserOnline(this.currentUserId).catch(console.error);
            this.startHeartbeat();
        } else {
            this.setUserOffline(this.currentUserId).catch(console.error);
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
            }
        }
    }

    async getOnlineUsers() {
        try {
            const { data, error } = await supabase
                .from('users_presence')
                .select('user_id, last_seen')
                .eq('is_online', true)
                .order('last_seen', { ascending: false });

            if (error) throw error;

            const onlineUsers = [];
            for (const presence of data) {
                try {
                    const userProfile = await UserService.getUserDisplayName(presence.user_id);
                    onlineUsers.push({
                        id: presence.user_id,
                        name: userProfile,
                        lastSeen: presence.last_seen
                    });
                } catch (e) {
                    console.error(`Error fetching details for user ${presence.user_id}:`, e);
                }
            }

            return onlineUsers;
        } catch (error) {
            console.error('Error fetching online users:', error);
            return [];
        }
    }

    addListener(callback) {
        if (typeof callback !== 'function') return;
        this.listeners.push(callback);
    }

    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }

    notifyListeners() {
        this.getOnlineUsers().then(users => {
            this.listeners.forEach(listener => {
                try {
                    listener(users);
                } catch (error) {
                    console.error('Error in presence listener:', error);
                }
            });
        });
    }

    cleanup() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        window.removeEventListener('online', this.handleOnlineStatusChange.bind(this, true));
        window.removeEventListener('offline', this.handleOnlineStatusChange.bind(this, false));

        this.subscriptions.forEach(subscription => {
            if (subscription && subscription.unsubscribe) {
                subscription.unsubscribe();
            }
        });

        this.subscriptions = [];
        this.listeners = [];

        if (this.currentUserId) {
            this.setUserOffline(this.currentUserId).catch(console.error);
            this.currentUserId = null;
        }

        this.isSetup = false;
    }
}

export const PresenceService = new PresenceServiceImpl();
