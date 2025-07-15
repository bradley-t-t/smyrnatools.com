import { supabase } from '../core/clients/SupabaseClient';
import { ErrorLogger } from '../utils/loggers/ErrorLogger';

export class RoleService {
    /**
     * Fetch all available roles from the database
     * @returns {Promise<Array>} Array of role objects
     */
    static async getAllRoles() {
        try {
            const { data, error } = await supabase
                .from('users_roles')
                .select('*')
                .order('weight', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            ErrorLogger.logError('RoleService.getAllRoles', error);
            throw error;
        }
    }

    /**
     * Get a user's role
     * @param {string} userId - UUID of the user
     * @returns {Promise<Object|null>} Role object or null if not found
     */
    static async getUserRole(userId) {
        try {
            // Get the user's role ID from permissions
            const { data: permData, error: permError } = await supabase
                .from('users_permissions')
                .select('role_id')
                .eq('user_id', userId)
                .single();

            if (permError) {
                // No role assigned is a valid state
                if (permError.code === 'PGRST116') return null;
                throw permError;
            }

            if (!permData?.role_id) return null;

            // Get the role details
            const { data: roleData, error: roleError } = await supabase
                .from('users_roles')
                .select('*')
                .eq('id', permData.role_id)
                .single();

            if (roleError) throw roleError;
            return roleData;
        } catch (error) {
            ErrorLogger.logError(`RoleService.getUserRole(${userId})`, error);
            throw error;
        }
    }

    /**
     * Assign a role to a user
     * @param {string} userId - UUID of the user
     * @param {string} roleId - UUID of the role
     * @returns {Promise<boolean>} Success status
     */
    static async assignRoleToUser(userId, roleId) {
        try {
            // Check if user already has a role
            const { data: existingRole, error: checkError } = await supabase
                .from('users_permissions')
                .select('id')
                .eq('user_id', userId);

            if (checkError) throw checkError;

            if (existingRole && existingRole.length > 0) {
                // Update existing role
                const { error: updateError } = await supabase
                    .from('users_permissions')
                    .update({
                        role_id: roleId,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId);

                if (updateError) throw updateError;
            } else {
                // Create new role assignment
                const { error: insertError } = await supabase
                    .from('users_permissions')
                    .insert({
                        user_id: userId,
                        role_id: roleId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });

                if (insertError) throw insertError;
            }

            return true;
        } catch (error) {
            ErrorLogger.logError(`RoleService.assignRoleToUser(${userId}, ${roleId})`, error);
            throw error;
        }
    }
}
