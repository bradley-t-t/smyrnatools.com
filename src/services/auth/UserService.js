/* eslint-disable no-unused-vars */
import supabase from '../../core/SupabaseClient';

/**
 * Service for user-related operations with robust error handling
 */
class UserServiceImpl {
    constructor() {
        // Cache for user profiles to avoid repeated requests
        this.userProfileCache = {};

        console.log('[UserService] Initialized');
    }

    /**
     * Get the current authenticated user
     */
    async getCurrentUser() {
        try {
            console.log('[UserService] Getting current user');

            // For web app, get user ID from session storage
            const userId = sessionStorage.getItem('userId');
            if (userId) {
                console.log('[UserService] Got authenticated user from session:', userId);
                return {id: userId};
            }

            // Check supabase auth as fallback
            const {data, error} = await supabase.auth.getUser();
            if (!error && data && data.user) {
                console.log('[UserService] Got authenticated user:', data.user.id);
                return data.user;
            }

            console.warn('[UserService] No authenticated user found');
            return null;

        } catch (error) {
            console.error('[UserService] Error getting current user:', error);
            return null;
        }
    }

    /**
     * Get a user by ID from the database
     */
    async getUserById(userId) {
        if (!userId) return {id: 'unknown', name: 'Unknown User'};

        try {
            console.log(`[UserService] Getting user by ID: ${userId}`);

            // First check the cache
            if (this.userProfileCache[userId]) {
                console.log(`[UserService] Cache hit for user ${userId}`);
                const cachedUser = this.userProfileCache[userId];
                return {
                    id: userId,
                    name: cachedUser.displayName || cachedUser.name || `User ${userId.substring(0, 8)}`,
                    email: cachedUser.email
                };
            }

            // Get from the users table
            const {data, error} = await supabase
                .from('users')
                .select('id, name, email')
                .eq('id', userId)
                .single();

            if (!error && data) {
                // Cache the result
                this.userProfileCache[userId] = data;
                return {
                    id: data.id,
                    name: data.name || data.email?.split('@')[0] || `User ${userId.substring(0, 8)}`,
                    email: data.email
                };
            }

            // If no user is found, return a basic user object
            const basicUser = {id: userId, name: `User ${userId.substring(0, 8)}`};
            this.userProfileCache[userId] = basicUser;
            return basicUser;

        } catch (error) {
            console.error(`[UserService] Error fetching user with ID ${userId}:`, error);
            // Return a basic user object if there's an error
            return {id: userId, name: `User ${userId.substring(0, 8)}`};
        }
    }

    /**
     * Simplified method that always returns a valid result
     */
    async getUserDisplayName(userId) {
        if (!userId) return 'System';
        if (userId === 'anonymous') return 'Anonymous';

        try {
            const user = await this.getUserById(userId);
            return user.name || `User ${userId.substring(0, 8)}`;
        } catch (error) {
            console.error(`[UserService] Error getting display name for ${userId}:`, error);
            return `User ${userId.substring(0, 8)}`;
        }
    }
}

// Create singleton instance
const singleton = new UserServiceImpl();
export const UserService = singleton;