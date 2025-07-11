import supabase, {logSupabaseError} from '../Supabase';

/**
 * AccountManager utility to handle user accounts and permissions
 */
export class AccountManager {
    // Cache for user roles and permissions
    static #userRolesCache = new Map();
    static #rolesPermissionsCache = new Map();

    /**
     * Clear all cached data
     */
    static clearCache() {
        this.#userRolesCache.clear();
        this.#rolesPermissionsCache.clear();
    }

    /**
     * Get all available roles
     * @returns {Promise<Array>} - Array of role objects
     */
    static async getAllRoles() {
        try {
            const {data, error} = await supabase
                .from('accounts_roles')
                .select('*')
                .order('weight', {ascending: false});

            if (error) throw error;
            return data || [];
        } catch (error) {
            logSupabaseError('getAllRoles', error);
            return [];
        }
    }

    /**
     * Get role by ID
     * @param {string} roleId - The UUID of the role
     * @returns {Promise<Object|null>} - Role object or null if not found
     */
    static async getRoleById(roleId) {
        if (!roleId) return null;

        try {
            const {data, error} = await supabase
                .from('accounts_roles')
                .select('*')
                .eq('id', roleId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            logSupabaseError(`getRoleById(${roleId})`, error);
            return null;
        }
    }

    /**
     * Get role by name
     * @param {string} roleName - The name of the role
     * @returns {Promise<Object|null>} - Role object or null if not found
     */
    static async getRoleByName(roleName) {
        if (!roleName) return null;

        try {
            const {data, error} = await supabase
                .from('accounts_roles')
                .select('*')
                .eq('name', roleName)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            logSupabaseError(`getRoleByName(${roleName})`, error);
            return null;
        }
    }

    /**
     * Get all roles assigned to a user
     * @param {string} userId - The UUID of the user
     * @returns {Promise<Array>} - Array of role objects
     */
    static async getUserRoles(userId) {
        if (!userId) return [];

        // Check cache first
        if (this.#userRolesCache.has(userId)) {
            return this.#userRolesCache.get(userId);
        }

        try {
            const {data, error} = await supabase
                .from('accounts_permissions')
                .select(`
          role_id,
          accounts_roles(id, name, permissions, weight)
        `)
                .eq('user_id', userId);

            if (error) throw error;

            // Transform the data to a more usable format
            const roles = (data || []).map(item => item.accounts_roles);

            // Cache the result
            this.#userRolesCache.set(userId, roles);

            return roles;
        } catch (error) {
            logSupabaseError(`getUserRoles(${userId})`, error);
            return [];
        }
    }

    /**
     * Get all permissions for a user across all their roles
     * @param {string} userId - The UUID of the user
     * @returns {Promise<Array<string>>} - Array of permission strings
     */
    static async getUserPermissions(userId) {
        if (!userId) return [];

        try {
            const roles = await this.getUserRoles(userId);

            // Combine all permissions from all roles
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
    }

    /**
     * Check if a user has a specific permission
     * @param {string} userId - The UUID of the user
     * @param {string} permission - The permission to check
     * @returns {Promise<boolean>} - True if the user has the permission, false otherwise
     */
    static async hasPermission(userId, permission) {
        if (!userId || !permission) return false;

        // Always allow access to personal account
        if (permission === 'my_account.view') return true;

        try {
            const permissions = await this.getUserPermissions(userId);
            return permissions.includes(permission);
        } catch (error) {
            logSupabaseError(`hasPermission(${userId}, ${permission})`, error);
            return false;
        }
    }

    /**
     * Check if a user has any of the specified permissions
     * @param {string} userId - The UUID of the user
     * @param {Array<string>} permissions - Array of permissions to check
     * @returns {Promise<boolean>} - True if the user has any of the permissions, false otherwise
     */
    static async hasAnyPermission(userId, permissions) {
        if (!userId || !permissions || !permissions.length) return false;

        try {
            const userPermissions = await this.getUserPermissions(userId);

            // Check if any of the requested permissions match the user's permissions
            return permissions.some(perm => userPermissions.includes(perm));
        } catch (error) {
            logSupabaseError(`hasAnyPermission(${userId}, [${permissions.join(', ')}])`, error);
            return false;
        }
    }

    /**
     * Check if a user has all of the specified permissions
     * @param {string} userId - The UUID of the user
     * @param {Array<string>} permissions - Array of permissions to check
     * @returns {Promise<boolean>} - True if the user has all of the permissions, false otherwise
     */
    static async hasAllPermissions(userId, permissions) {
        if (!userId || !permissions || !permissions.length) return false;

        try {
            const userPermissions = await this.getUserPermissions(userId);

            // Check if all of the requested permissions are included in the user's permissions
            return permissions.every(perm => userPermissions.includes(perm));
        } catch (error) {
            logSupabaseError(`hasAllPermissions(${userId}, [${permissions.join(', ')}])`, error);
            return false;
        }
    }

    /**
     * Check if user has required permissions for menu visibility
     * @param {string} userId - The UUID of the user
     * @param {Array<string>} requiredPermissions - List of required permission nodes
     * @returns {Promise<Object>} - Object mapping menu items to visibility status
     */
    static async getMenuVisibility(userId, requiredPermissions = {}) {
        if (!userId) return {};

        try {
            const userPermissions = await this.getUserPermissions(userId);
            const result = {};

            // Check each menu item permission
            Object.entries(requiredPermissions).forEach(([menuItem, permission]) => {
                // If permission is null or empty, always visible
                if (!permission) {
                    result[menuItem] = true;
                    return;
                }

                // Otherwise check if user has the required permission
                result[menuItem] = userPermissions.includes(permission);
            });

            return result;
        } catch (error) {
            logSupabaseError(`getMenuVisibility(${userId})`, error);
            return {};
        }
    }

    /**
     * Get the highest weighted role for a user
     * @param {string} userId - The UUID of the user
     * @returns {Promise<Object|null>} - The highest weighted role or null if none found
     */
    static async getHighestRole(userId) {
        if (!userId) return null;

        try {
            const roles = await this.getUserRoles(userId);
            if (!roles.length) return null;

            // Sort by weight in descending order and take the first one
            return roles.sort((a, b) => b.weight - a.weight)[0];
        } catch (error) {
            logSupabaseError(`getHighestRole(${userId})`, error);
            return null;
        }
    }

    /**
     * Assign a role to a user
     * @param {string} userId - The UUID of the user
     * @param {string} roleId - The UUID of the role
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    static async assignRole(userId, roleId) {
        if (!userId || !roleId) return false;

        try {
            // Check if the assignment already exists
            const {data: existing, error: checkError} = await supabase
                .from('accounts_permissions')
                .select('id')
                .eq('user_id', userId)
                .eq('role_id', roleId);

            if (checkError) throw checkError;

            // If it already exists, we're done
            if (existing && existing.length > 0) return true;

            // Otherwise create the assignment
            const {error} = await supabase
                .from('accounts_permissions')
                .insert([{user_id: userId, role_id: roleId}]);

            if (error) throw error;

            // Clear the cache for this user
            this.#userRolesCache.delete(userId);

            return true;
        } catch (error) {
            logSupabaseError(`assignRole(${userId}, ${roleId})`, error);
            return false;
        }
    }

    /**
     * Remove a role from a user
     * @param {string} userId - The UUID of the user
     * @param {string} roleId - The UUID of the role
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    static async removeRole(userId, roleId) {
        if (!userId || !roleId) return false;

        try {
            const {error} = await supabase
                .from('accounts_permissions')
                .delete()
                .eq('user_id', userId)
                .eq('role_id', roleId);

            if (error) throw error;

            // Clear the cache for this user
            this.#userRolesCache.delete(userId);

            return true;
        } catch (error) {
            logSupabaseError(`removeRole(${userId}, ${roleId})`, error);
            return false;
        }
    }

    /**
     * Create a new role
     * @param {string} name - The name of the role
     * @param {Array<string>} permissions - Array of permissions for the role
     * @param {number} weight - The weight of the role (higher = more important)
     * @returns {Promise<Object|null>} - The created role object or null if failed
     */
    static async createRole(name, permissions = [], weight = 0) {
        if (!name) return null;

        try {
            const {data, error} = await supabase
                .from('accounts_roles')
                .insert([{name, permissions, weight}])
                .select()
                .single();

            if (error) throw error;

            // Clear the roles cache
            this.#rolesPermissionsCache.clear();

            return data;
        } catch (error) {
            logSupabaseError(`createRole(${name})`, error);
            return null;
        }
    }

    /**
     * Update an existing role
     * @param {string} roleId - The UUID of the role
     * @param {Object} updates - The fields to update (name, permissions, weight)
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    static async updateRole(roleId, updates) {
        if (!roleId || !updates) return false;

        try {
            const {error} = await supabase
                .from('accounts_roles')
                .update(updates)
                .eq('id', roleId);

            if (error) throw error;

            // Clear all caches since role definitions changed
            this.clearCache();

            return true;
        } catch (error) {
            logSupabaseError(`updateRole(${roleId})`, error);
            return false;
        }
    }

    /**
     * Delete a role
     * @param {string} roleId - The UUID of the role
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    static async deleteRole(roleId) {
        if (!roleId) return false;

        try {
            // The foreign key constraint with CASCADE will handle removing permissions
            const {error} = await supabase
                .from('accounts_roles')
                .delete()
                .eq('id', roleId);

            if (error) throw error;

            // Clear all caches
            this.clearCache();

            return true;
        } catch (error) {
            logSupabaseError(`deleteRole(${roleId})`, error);
            return false;
        }
    }
}
