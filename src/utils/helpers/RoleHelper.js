/**
 * Utility class for role management
 */
export class RoleHelper {
    /**
     * Get default roles when database roles are unavailable
     * @returns {Array} Array of default role objects
     */
    static getDefaultRoles() {
        return [
            { id: 'user-role', name: 'User', weight: 1, permissions: ['my_account.view'] },
            { id: 'supervisor-role', name: 'Supervisor', weight: 2, permissions: ['my_account.view', 'operators.view'] },
            { id: 'manager-role', name: 'Manager', weight: 3, permissions: ['my_account.view', 'operators.view', 'operators.edit'] },
            { id: 'admin-role', name: 'Admin', weight: 4, permissions: ['my_account.view', 'operators.view', 'operators.edit', 'admin.access'] }
        ];
    }

    /**
     * Get the role label for display
     * @param {string} roleName - Name of the role
     * @returns {string} - Formatted role name for display
     */
    static getRoleLabel(roleName) {
        if (!roleName) return 'User';
        return roleName;
    }

    /**
     * Check if a role is a default role
     * @param {string} roleName - Name of the role to check
     * @returns {boolean} - True if it's a default role
     */
    static isDefaultRole(roleName) {
        const defaultRoles = this.getDefaultRoles().map(r => r.name);
        return defaultRoles.includes(roleName);
    }

    /**
     * Create accounts_roles records in the database if they don't exist
     * @param {Object} supabase - Supabase client
     * @returns {Promise<boolean>} - Success status
     */
    static async ensureDefaultRolesExist(supabase) {
        try {
            console.log('Checking if roles exist in database...');
            // Check if roles exist
            const { data, error } = await supabase
                .from('accounts_roles')
                .select('name')
                .limit(1);

            if (error) {
                console.error('Error checking roles:', error);
                throw error;
            }

            // If roles exist, return
            if (data && data.length > 0) {
                console.log('Roles exist in database:', data);
                return true;
            }

            console.log('No roles found in database, creating default roles...');
            // Otherwise create default roles
            const defaultRoles = this.getDefaultRoles();
            const { error: insertError, data: insertData } = await supabase
                .from('accounts_roles')
                .insert(defaultRoles.map(role => ({
                    name: role.name,
                    permissions: role.permissions,
                    weight: role.weight
                })))
                .select();

            if (insertError) {
                console.error('Error inserting default roles:', insertError);
                throw insertError;
            }

            console.log('Successfully created default roles:', insertData);

            return true;
        } catch (error) {
            console.error('Error ensuring default roles exist:', error);
            return false;
        }
    }
}
