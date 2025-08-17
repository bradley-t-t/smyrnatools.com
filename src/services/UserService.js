import {supabase} from './DatabaseService';

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
            try {
                const {data} = await supabase
                    .from(USERS_TABLE)
                    .select('id')
                    .eq('id', userId)
                    .single();
                if (data && data.id) return {id: userId};
                sessionStorage.removeItem('userId');
            } catch {
            }
        }
        try {
            const {data} = await supabase.auth.getUser();
            if (!data?.user) return null;
            if (data.user.id) sessionStorage.setItem('userId', data.user.id);
            return data.user;
        } catch {
            return null;
        }
    }

    async getUserById(userId) {
        if (!userId) return {id: 'unknown', name: 'Unknown User'};
        if (this.userProfileCache.has(userId)) {
            const cachedUser = this.userProfileCache.get(userId);
            return {
                id: userId,
                name: cachedUser.displayName || cachedUser.name || `User ${userId.slice(0, 8)}`,
                email: cachedUser.email
            };
        }
        const {data} = await supabase
            .from(USERS_TABLE)
            .select('id, name, email')
            .eq('id', userId)
            .single();
        if (!data) {
            const basicUser = {id: userId, name: `User ${userId.slice(0, 8)}`};
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
        const {data: profileData} = await supabase
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
    const {data} = await supabase
        .from(ROLES_TABLE)
        .select('*')
        .order('weight', {ascending: false});
    return data ?? [];
};

UserService.getRoleById = async function (roleId) {
    if (!roleId) throw new Error('Role ID is required');
    const {data} = await supabase
        .from(ROLES_TABLE)
        .select('*')
        .eq('id', roleId)
        .single();
    return data;
};

UserService.getRoleByName = async function (roleName) {
    if (!roleName) throw new Error('Role name is required');
    const {data} = await supabase
        .from(ROLES_TABLE)
        .select('*')
        .eq('name', roleName)
        .single();
    return data;
};

UserService.getUserRoles = async function (userId) {
    if (!userId) throw new Error('User ID is required');
    const id = typeof userId === 'object' && userId.id ? userId.id : userId;
    if (this.userRolesCache.has(id)) return this.userRolesCache.get(id);
    const {data} = await supabase
        .from(PERMISSIONS_TABLE)
        .select('role_id, users_roles(id, name, permissions, weight)')
        .eq('user_id', id);
    const roles = data?.map(item => item.users_roles) ?? [];
    this.userRolesCache.set(id, roles);
    return roles;
};

UserService.getUserPermissions = async function (userId) {
    if (!userId) throw new Error('User ID is required');
    const id = typeof userId === 'object' && userId.id ? userId.id : userId;
    const roles = await this.getUserRoles(id);
    const permissions = new Set();
    roles.forEach(role => role?.permissions?.forEach(perm => permissions.add(perm)));
    return Array.from(permissions);
};

UserService.hasPermission = async function (userId, permission) {
    if (!userId || !permission) return false;
    if (permission === 'my_account.view') return true;
    const id = typeof userId === 'object' && userId.id ? userId.id : userId;
    const permissions = await this.getUserPermissions(id);
    return permissions.includes(permission);
};

UserService.hasAnyPermission = async function (userId, permissions) {
    if (!userId || !permissions?.length) return false;
    const id = typeof userId === 'object' && userId.id ? userId.id : userId;
    const userPermissions = await this.getUserPermissions(id);
    return permissions.some(perm => userPermissions.includes(perm));
};

UserService.hasAllPermissions = async function (userId, permissions) {
    if (!userId || !permissions?.length) return false;
    const id = typeof userId === 'object' && userId.id ? userId.id : userId;
    const userPermissions = await this.getUserPermissions(id);
    return permissions.every(perm => userPermissions.includes(perm));
};

UserService.getMenuVisibility = async function (userId, requiredPermissions = {}) {
    if (!userId) return {};
    const id = typeof userId === 'object' && userId.id ? userId.id : userId;
    const userPermissions = await this.getUserPermissions(id);
    return Object.fromEntries(
        Object.entries(requiredPermissions).map(([menuItem, permission]) => [
            menuItem,
            !permission || userPermissions.includes(permission)
        ])
    );
};

UserService.getHighestRole = async function (userId) {
    if (!userId) return null;
    const id = typeof userId === 'object' && userId.id ? userId.id : userId;
    const roles = await this.getUserRoles(id);
    return roles.length ? roles.sort((a, b) => b.weight - a.weight)[0] : null;
};

UserService.assignRole = async function (userId, roleId) {
    if (!userId || !roleId) throw new Error('User ID and role ID are required');
    const id = typeof userId === 'object' && userId.id ? userId.id : userId;
    const {data: existing} = await supabase
        .from(PERMISSIONS_TABLE)
        .select('id')
        .eq('user_id', id)
        .eq('role_id', roleId);
    if (existing?.length) return true;
    await supabase
        .from(PERMISSIONS_TABLE)
        .insert({
            user_id: id,
            role_id: roleId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    this.userRolesCache.delete(id);
    return true;
};

UserService.removeRole = async function (userId, roleId) {
    if (!userId || !roleId) throw new Error('User ID and role ID are required');
    const id = typeof userId === 'object' && userId.id ? userId.id : userId;
    await supabase
        .from(PERMISSIONS_TABLE)
        .delete()
        .eq('user_id', id)
        .eq('role_id', roleId);
    this.userRolesCache.delete(id);
    return true;
};

UserService.createRole = async function (name, permissions = [], weight = 0) {
    if (!name) throw new Error('Role name is required');
    const {data} = await supabase
        .from(ROLES_TABLE)
        .insert({name, permissions, weight, created_at: new Date().toISOString(), updated_at: new Date().toISOString()})
        .select()
        .single();
    this.clearCache();
    return data;
};

UserService.updateRole = async function (roleId, updates) {
    if (!roleId || !updates) throw new Error('Role ID and updates are required');
    await supabase
        .from(ROLES_TABLE)
        .update({...updates, updated_at: new Date().toISOString()})
        .eq('id', roleId);
    this.clearCache();
    return true;
};

UserService.deleteRole = async function (roleId) {
    if (!roleId) throw new Error('Role ID is required');
    await supabase
        .from(ROLES_TABLE)
        .delete()
        .eq('id', roleId);
    this.clearCache();
    return true;
};

UserService.getUserPlant = async function (userId) {
    if (!userId) return null;
    const id = typeof userId === 'object' && userId.id ? userId.id : userId;
    const {data} = await supabase
        .from(PROFILES_TABLE)
        .select('plant_code')
        .eq('id', id)
        .single();
    if (!data?.plant_code) return null;
    return data.plant_code;
};
