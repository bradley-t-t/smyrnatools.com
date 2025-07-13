/* eslint-disable no-unused-vars */
import supabase from '../../core/clients/SupabaseClient';

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
            // First check if it's an operator ID
            const {data: opData} = await supabase
                .from('operators')
                .select('name')
                .eq('employee_id', userId)
                .single();

            if (opData && opData.name) {
                return opData.name;
            }

            // Next try to get user profiles that might have first/last name
            const {data: profileData} = await supabase
                .from('users_profiles')
                .select('first_name, last_name')
                .eq('id', userId)
                .single();

            if (profileData) {
                const firstName = profileData.first_name || '';
                const lastName = profileData.last_name || '';
                const fullName = `${firstName} ${lastName}`.trim();
                if (fullName) return fullName;
            }

            // If no profiles with name, try to get the user from auth
            const user = await this.getUserById(userId);

            // If user has name property, use it (but remove any 'User' prefix)
            if (user && user.name) {
                return user.name.replace(/^User\s+/i, '');
            }

            // If user has first_name/last_name properties
            if (user && (user.firstName || user.lastName)) {
                return `${user.firstName || ''} ${user.lastName || ''}`.trim();
            }

            // If user has email, extract name part before @ symbol
            if (user && user.email) {
                const emailName = user.email.split('@')[0];
                // Convert email username to title case (e.g., john.doe -> John Doe)
                return emailName
                    .replace(/\./g, ' ')
                    .split(' ')
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(' ');
            }

            // Last resort - just use the first part of ID without 'User' prefix
            return userId.substring(0, 8);
        } catch (error) {
            console.error(`[UserService] Error getting display name for ${userId}:`, error);
            return userId.substring(0, 8);
        }
    }
}

// Create singleton instance
const singleton = new UserServiceImpl();
export const UserService = singleton;