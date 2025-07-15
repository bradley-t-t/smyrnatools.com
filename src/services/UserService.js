/* eslint-disable no-unused-vars */
import supabase, {logSupabaseError} from '../core/clients/SupabaseClient';

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

// Role and permission management methods
UserService.userRolesCache = new Map();
UserService.rolesPermissionsCache = new Map();

UserService.clearCache = function() {
    this.userRolesCache.clear();
    this.rolesPermissionsCache.clear();
};

UserService.getAllRoles = async function() {
    try {
        const {data, error} = await supabase
            .from('users_roles')
            .select('*')
            .order('weight', {ascending: false});

        if (error) throw error;
        return data || [];
    } catch (error) {
        logSupabaseError('getAllRoles', error);
        return [];
    }
};

UserService.getRoleById = async function(roleId) {
    if (!roleId) return null;

    try {
        const {data, error} = await supabase
            .from('users_roles')
            .select('*')
            .eq('id', roleId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        logSupabaseError(`getRoleById(${roleId})`, error);
        return null;
    }
};

UserService.getRoleByName = async function(roleName) {
    if (!roleName) return null;

    try {
        const {data, error} = await supabase
            .from('users_roles')
            .select('*')
            .eq('name', roleName)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        logSupabaseError(`getRoleByName(${roleName})`, error);
        return null;
    }
};

UserService.getUserRoles = async function(userId) {
    if (!userId) return [];

    if (this.userRolesCache.has(userId)) {
        return this.userRolesCache.get(userId);
    }

    try {
        const {data, error} = await supabase
            .from('users_permissions')
            .select(`
          role_id,
          users_roles(id, name, permissions, weight)
        `)
            .eq('user_id', userId);

        if (error) throw error;

        const roles = (data || []).map(item => item.users_roles);

        this.userRolesCache.set(userId, roles);

        return roles;
    } catch (error) {
        logSupabaseError(`getUserRoles(${userId})`, error);
        return [];
    }
};

UserService.getUserPermissions = async function(userId) {
    if (!userId) return [];

    try {
        const roles = await this.getUserRoles(userId);

        const permissions = new Set();
        roles.forEach(role => {
            if (role && role.permissions) {
                role.permissions.forEach(perm => permissions.add(perm));
            }
        });

        return Array.from(permissions);
    } catch (error) {
        logSupabaseError(`getUserPermissions(${userId})`, error);
        return [];
    }
};

UserService.hasPermission = async function(userId, permission) {
    if (!userId || !permission) return false;

    if (permission === 'my_account.view') return true;

    try {
        const permissions = await this.getUserPermissions(userId);
        return permissions.includes(permission);
    } catch (error) {
        logSupabaseError(`hasPermission(${userId}, ${permission})`, error);
        return false;
    }
};

UserService.hasAnyPermission = async function(userId, permissions) {
    if (!userId || !permissions || !permissions.length) return false;

    try {
        const userPermissions = await this.getUserPermissions(userId);

        return permissions.some(perm => userPermissions.includes(perm));
    } catch (error) {
        logSupabaseError(`hasAnyPermission(${userId}, [${permissions.join(', ')}])`, error);
        return false;
    }
};

UserService.hasAllPermissions = async function(userId, permissions) {
    if (!userId || !permissions || !permissions.length) return false;

    try {
        const userPermissions = await this.getUserPermissions(userId);

        return permissions.every(perm => userPermissions.includes(perm));
    } catch (error) {
        logSupabaseError(`hasAllPermissions(${userId}, [${permissions.join(', ')}])`, error);
        return false;
    }
};

UserService.getMenuVisibility = async function(userId, requiredPermissions = {}) {
    if (!userId) return {};

    try {
        const userPermissions = await this.getUserPermissions(userId);
        const result = {};

        Object.entries(requiredPermissions).forEach(([menuItem, permission]) => {
            if (!permission) {
                result[menuItem] = true;
                return;
            }

            result[menuItem] = userPermissions.includes(permission);
        });

        return result;
    } catch (error) {
        logSupabaseError(`getMenuVisibility(${userId})`, error);
        return {};
    }
};

UserService.getHighestRole = async function(userId) {
    if (!userId) return null;

    try {
        const roles = await this.getUserRoles(userId);
        if (!roles.length) return null;

        return roles.sort((a, b) => b.weight - a.weight)[0];
    } catch (error) {
        logSupabaseError(`getHighestRole(${userId})`, error);
        return null;
    }
};

UserService.assignRole = async function(userId, roleId) {
    if (!userId || !roleId) return false;

    try {
        const {data: existing, error: checkError} = await supabase
            .from('users_permissions')
            .select('id')
            .eq('user_id', userId)
            .eq('role_id', roleId);

        if (checkError) throw checkError;

        if (existing && existing.length > 0) return true;

        const {error} = await supabase
            .from('users_permissions')
            .insert([{user_id: userId, role_id: roleId}]);

        if (error) throw error;

        this.userRolesCache.delete(userId);

        return true;
    } catch (error) {
        logSupabaseError(`assignRole(${userId}, ${roleId})`, error);
        return false;
    }
};

UserService.removeRole = async function(userId, roleId) {
    if (!userId || !roleId) return false;

    try {
        const {error} = await supabase
            .from('users_permissions')
            .delete()
            .eq('user_id', userId)
            .eq('role_id', roleId);

        if (error) throw error;

        this.userRolesCache.delete(userId);

        return true;
    } catch (error) {
        logSupabaseError(`removeRole(${userId}, ${roleId})`, error);
        return false;
    }
};

UserService.createRole = async function(name, permissions = [], weight = 0) {
    if (!name) return null;

    try {
        const {data, error} = await supabase
            .from('users_roles')
            .insert([{name, permissions, weight}])
            .select()
            .single();

        if (error) throw error;

        this.rolesPermissionsCache.clear();

        return data;
    } catch (error) {
        logSupabaseError(`createRole(${name})`, error);
        return null;
    }
};

UserService.updateRole = async function(roleId, updates) {
    if (!roleId || !updates) return false;

    try {
        const {error} = await supabase
            .from('users_roles')
            .update(updates)
            .eq('id', roleId);

        if (error) throw error;

        this.clearCache();

        return true;
    } catch (error) {
        logSupabaseError(`updateRole(${roleId})`, error);
        return false;
    }
};

UserService.deleteRole = async function(roleId) {
    if (!roleId) return false;

    try {
        const {error} = await supabase
            .from('users_roles')
            .delete()
            .eq('id', roleId);

        if (error) throw error;

        this.clearCache();

        return true;
    } catch (error) {
        logSupabaseError(`deleteRole(${roleId})`, error);
        return false;
    }
};