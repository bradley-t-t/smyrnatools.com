import supabase, {logSupabaseError} from '../database/Supabase';

export class AccountManager {
    static #userRolesCache = new Map();
    static #rolesPermissionsCache = new Map();

    static clearCache() {
        this.#userRolesCache.clear();
        this.#rolesPermissionsCache.clear();
    }

    static async getAllRoles() {
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
    }

    static async getRoleById(roleId) {
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
    }

    static async getRoleByName(roleName) {
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
    }

    static async getUserRoles(userId) {
        if (!userId) return [];

        if (this.#userRolesCache.has(userId)) {
            return this.#userRolesCache.get(userId);
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

            this.#userRolesCache.set(userId, roles);

            return roles;
        } catch (error) {
            logSupabaseError(`getUserRoles(${userId})`, error);
            return [];
        }
    }

    static async getUserPermissions(userId) {
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
    }

    static async hasPermission(userId, permission) {
        if (!userId || !permission) return false;

        if (permission === 'my_account.view') return true;

        try {
            const permissions = await this.getUserPermissions(userId);
            return permissions.includes(permission);
        } catch (error) {
            logSupabaseError(`hasPermission(${userId}, ${permission})`, error);
            return false;
        }
    }

    static async hasAnyPermission(userId, permissions) {
        if (!userId || !permissions || !permissions.length) return false;

        try {
            const userPermissions = await this.getUserPermissions(userId);

            return permissions.some(perm => userPermissions.includes(perm));
        } catch (error) {
            logSupabaseError(`hasAnyPermission(${userId}, [${permissions.join(', ')}])`, error);
            return false;
        }
    }

    static async hasAllPermissions(userId, permissions) {
        if (!userId || !permissions || !permissions.length) return false;

        try {
            const userPermissions = await this.getUserPermissions(userId);

            return permissions.every(perm => userPermissions.includes(perm));
        } catch (error) {
            logSupabaseError(`hasAllPermissions(${userId}, [${permissions.join(', ')}])`, error);
            return false;
        }
    }

    static async getMenuVisibility(userId, requiredPermissions = {}) {
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
    }

    static async getHighestRole(userId) {
        if (!userId) return null;

        try {
            const roles = await this.getUserRoles(userId);
            if (!roles.length) return null;

            return roles.sort((a, b) => b.weight - a.weight)[0];
        } catch (error) {
            logSupabaseError(`getHighestRole(${userId})`, error);
            return null;
        }
    }

    static async assignRole(userId, roleId) {
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

            this.#userRolesCache.delete(userId);

            return true;
        } catch (error) {
            logSupabaseError(`assignRole(${userId}, ${roleId})`, error);
            return false;
        }
    }

    static async removeRole(userId, roleId) {
        if (!userId || !roleId) return false;

        try {
            const {error} = await supabase
                .from('users_permissions')
                .delete()
                .eq('user_id', userId)
                .eq('role_id', roleId);

            if (error) throw error;

            this.#userRolesCache.delete(userId);

            return true;
        } catch (error) {
            logSupabaseError(`removeRole(${userId}, ${roleId})`, error);
            return false;
        }
    }

    static async createRole(name, permissions = [], weight = 0) {
        if (!name) return null;

        try {
            const {data, error} = await supabase
                .from('users_roles')
                .insert([{name, permissions, weight}])
                .select()
                .single();

            if (error) throw error;

            this.#rolesPermissionsCache.clear();

            return data;
        } catch (error) {
            logSupabaseError(`createRole(${name})`, error);
            return null;
        }
    }

    static async updateRole(roleId, updates) {
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
    }

    static async deleteRole(roleId) {
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
    }
}