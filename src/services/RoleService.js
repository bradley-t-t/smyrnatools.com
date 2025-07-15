import { supabase } from './DatabaseService';
import { ErrorUtility } from '../utils/ErrorUtility';

const ROLES_TABLE = 'users_roles';
const PERMISSIONS_TABLE = 'users_permissions';

export class RoleService {
    static async getAllRoles() {
        const { data, error } = await supabase
            .from(ROLES_TABLE)
            .select('*')
            .order('weight', { ascending: false });

        if (error) {
            ErrorUtility.logError('RoleService.getAllRoles', error);
            throw error;
        }

        return data ?? [];
    }

    static async getUserRole(userId) {
        if (!userId) throw new Error('User ID is required');

        const { data: permData, error: permError } = await supabase
            .from(PERMISSIONS_TABLE)
            .select('role_id')
            .eq('user_id', userId)
            .single();

        if (permError?.code === 'PGRST116' || !permData?.role_id) return null;
        if (permError) {
            ErrorUtility.logError(`RoleService.getUserRole(${userId})`, permError);
            throw permError;
        }

        const { data: roleData, error: roleError } = await supabase
            .from(ROLES_TABLE)
            .select('*')
            .eq('id', permData.role_id)
            .single();

        if (roleError) {
            ErrorUtility.logError(`RoleService.getUserRole(${userId})`, roleError);
            throw roleError;
        }

        return roleData;
    }

    static async assignRoleToUser(userId, roleId) {
        if (!userId || !roleId) throw new Error('User ID and role ID are required');

        const { data: existingRole, error: checkError } = await supabase
            .from(PERMISSIONS_TABLE)
            .select('id')
            .eq('user_id', userId);

        if (checkError) {
            ErrorUtility.logError(`RoleService.assignRoleToUser(${userId}, ${roleId})`, checkError);
            throw checkError;
        }

        const now = new Date().toISOString();
        const { error } = existingRole?.length
            ? await supabase
                .from(PERMISSIONS_TABLE)
                .update({ role_id: roleId, updated_at: now })
                .eq('user_id', userId)
            : await supabase
                .from(PERMISSIONS_TABLE)
                .insert({ user_id: userId, role_id: roleId, created_at: now, updated_at: now });

        if (error) {
            ErrorUtility.logError(`RoleService.assignRoleToUser(${userId}, ${roleId})`, error);
            throw error;
        }

        return true;
    }
}