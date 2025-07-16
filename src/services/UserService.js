import { supabase } from './DatabaseService';

const USERS_TABLE = 'users';
const PROFILES_TABLE = 'users_profiles';
const ROLES_TABLE = 'users_roles';
const PERMISSIONS_TABLE = 'users_permissions';

class UserServiceImpl {
    constructor() {
        this.userProfileCache = new Map();
    }

    async getCurrentUser() {
        const userId = sessionStorage.getItem('userId');
        if (userId) {
            console.log('Found user ID in session storage:', userId);

            try {
                const { data, error } = await supabase
                    .from(USERS_TABLE)
                    .select('id')
                    .eq('id', userId)
                    .single();

                if (data && data.id) {
                    return { id: userId };
                } else {
                    console.warn('User ID in session storage not found in database:', userId);
                    sessionStorage.removeItem('userId');
                }
            } catch (err) {
                console.error('Error verifying user from session storage:', err);
            }
        }

        try {
            const { data, error } = await supabase.auth.getUser();
            if (error || !data?.user) {
                console.warn('No authenticated user found');
                return null;
            }

            if (data.user.id) {
                sessionStorage.setItem('userId', data.user.id);
            }

            return data.user;
        } catch (err) {
            console.error('Error getting authenticated user:', err);
            return null;
        }
    }

    async getUserById(userId) {
        if (!userId) return { id: 'unknown', name: 'Unknown User' };

        if (this.userProfileCache.has(userId)) {
            const cachedUser = this.userProfileCache.get(userId);
            return {
                id: userId,
                name: cachedUser.displayName || cachedUser.name || `User ${userId.slice(0, 8)}`,
                email: cachedUser.email
            };
        }

        const { data, error } = await supabase
            .from(USERS_TABLE)
            .select('id, name, email')
            .eq('id', userId)
            .single();

        if (error || !data) {
            const basicUser = { id: userId, name: `User ${userId.slice(0, 8)}` };
            this.userProfileCache.set(userId, basicUser);
            return basicUser;
        }

        this.userProfileCache.set(userId, data);
        return {
            id: data.id,
            name: data.name || data.email?.split('@')[0] || `User ${userId.slice(0, 8)}`,
            email: data.email
        };
    }

    async getUserDisplayName(userId) {
        if (!userId) return 'System';
        if (userId === 'anonymous') return 'Anonymous';

        const { data: profileData } = await supabase
            .from(PROFILES_TABLE)
            .select('first_name, last_name')
            .eq('id', userId)
            .single();

        if (profileData) {
            const fullName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
            if (fullName) return fullName;
        }

        const user = await this.getUserById(userId);
        if (user.name) return user.name.replace(/^User\s+/i, '');
        if (user.email) {
            return user.email
                .split('@')[0]
                .replace(/\./g, ' ')
                .split(' ')
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
        }

        return userId.slice(0, 8);
    }
}

export const UserService = new UserServiceImpl();

UserService.userRolesCache = new Map();
UserService.rolesPermissionsCache = new Map();

UserService.clearCache = function () {
    this.userRolesCache.clear();
    this.rolesPermissionsCache.clear();
};

UserService.getAllRoles = async function () {
    const { data, error } = await supabase
        .from(ROLES_TABLE)
        .select('*')
        .order('weight', { ascending: false });

    if (error) {
        console.error('Error fetching all roles:', error);
        throw error;
    }

    return data ?? [];
};

UserService.getRoleById = async function (roleId) {
    if (!roleId) throw new Error('Role ID is required');

    const { data, error } = await supabase
        .from(ROLES_TABLE)
        .select('*')
        .eq('id', roleId)
        .single();

    if (error) {
        console.error(`Error fetching role ${roleId}:`, error);
        throw error;
    }

    return data;
};

UserService.getRoleByName = async function (roleName) {
    if (!roleName) throw new Error('Role name is required');

    const { data, error } = await supabase
        .from(ROLES_TABLE)
        .select('*')
        .eq('name', roleName)
        .single();

    if (error) {
        console.error(`Error fetching role ${roleName}:`, error);
        throw error;
    }

    return data;
};

UserService.getUserRoles = async function (userId) {
    if (!userId) throw new Error('User ID is required');

    if (this.userRolesCache.has(userId)) return this.userRolesCache.get(userId);

    const { data, error } = await supabase
        .from(PERMISSIONS_TABLE)
        .select('role_id, users_roles(id, name, permissions, weight)')
        .eq('user_id', userId);

    if (error) {
        console.error(`Error fetching roles for user ${userId}:`, error);
        throw error;
    }

    const roles = data?.map(item => item.users_roles) ?? [];
    this.userRolesCache.set(userId, roles);
    return roles;
};

UserService.getUserPermissions = async function (userId) {
    if (!userId) throw new Error('User ID is required');

    const roles = await this.getUserRoles(userId);
    const permissions = new Set();
    roles.forEach(role => role?.permissions?.forEach(perm => permissions.add(perm)));
    return Array.from(permissions);
};

UserService.hasPermission = async function (userId, permission) {
    if (!userId || !permission) return false;
    if (permission === 'my_account.view') return true;

    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
};

UserService.hasAnyPermission = async function (userId, permissions) {
    if (!userId || !permissions?.length) return false;

    const userPermissions = await this.getUserPermissions(userId);
    return permissions.some(perm => userPermissions.includes(perm));
};

UserService.hasAllPermissions = async function (userId, permissions) {
    if (!userId || !permissions?.length) return false;

    const userPermissions = await this.getUserPermissions(userId);
    return permissions.every(perm => userPermissions.includes(perm));
};

UserService.getMenuVisibility = async function (userId, requiredPermissions = {}) {
    if (!userId) return {};

    const userPermissions = await this.getUserPermissions(userId);
    return Object.fromEntries(
        Object.entries(requiredPermissions).map(([menuItem, permission]) => [
            menuItem,
            !permission || userPermissions.includes(permission)
        ])
    );
};

UserService.getHighestRole = async function (userId) {
    if (!userId) return null;

    const roles = await this.getUserRoles(userId);
    return roles.length ? roles.sort((a, b) => b.weight - a.weight)[0] : null;
};

UserService.assignRole = async function (userId, roleId) {
    if (!userId || !roleId) throw new Error('User ID and role ID are required');

    const { data: existing, error: checkError } = await supabase
        .from(PERMISSIONS_TABLE)
        .select('id')
        .eq('user_id', userId)
        .eq('role_id', roleId);

    if (checkError) {
        console.error(`Error checking role assignment for user ${userId}:`, checkError);
        throw checkError;
    }

    if (existing?.length) return true;

    const { error } = await supabase
        .from(PERMISSIONS_TABLE)
        .insert({ user_id: userId, role_id: roleId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });

    if (error) {
        console.error(`Error assigning role ${roleId} to user ${userId}:`, error);
        throw error;
    }

    this.userRolesCache.delete(userId);
    return true;
};

UserService.removeRole = async function (userId, roleId) {
    if (!userId || !roleId) throw new Error('User ID and role ID are required');

    const { error } = await supabase
        .from(PERMISSIONS_TABLE)
        .delete()
        .eq('user_id', userId)
        .eq('role_id', roleId);

    if (error) {
        console.error(`Error removing role ${roleId} from user ${userId}:`, error);
        throw error;
    }

    this.userRolesCache.delete(userId);
    return true;
};

UserService.createRole = async function (name, permissions = [], weight = 0) {
    if (!name) throw new Error('Role name is required');

    const { data, error } = await supabase
        .from(ROLES_TABLE)
        .insert({ name, permissions, weight, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .select()
        .single();

    if (error) {
        console.error(`Error creating role ${name}:`, error);
        throw error;
    }

    this.clearCache();
    return data;
};

UserService.updateRole = async function (roleId, updates) {
    if (!roleId || !updates) throw new Error('Role ID and updates are required');

    const { error } = await supabase
        .from(ROLES_TABLE)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', roleId);

    if (error) {
        console.error(`Error updating role ${roleId}:`, error);
        throw error;
    }

    this.clearCache();
    return true;
};

UserService.deleteRole = async function (roleId) {
    if (!roleId) throw new Error('Role ID is required');

    const { error } = await supabase
        .from(ROLES_TABLE)
        .delete()
        .eq('id', roleId);

    if (error) {
        console.error(`Error deleting role ${roleId}:`, error);
        throw error;
    }

    this.clearCache();
    return true;
};