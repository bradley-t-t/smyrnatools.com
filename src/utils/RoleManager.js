/**
 * Role types matching the Swift app
 */
export const UserRoleType = {
    admin: 'Admin',
    manager: 'Manager',
    operator: 'Operator',
    guest: 'Guest'
};

/**
 * RoleManager utility to handle permissions
 */
export class RoleManager {
    /**
     * Check if a role has a specific permission
     */
    static hasPermission(permission, forRole = UserRoleType.guest) {
        // Basic permissions mapping
        const permissionsMap = {
            [UserRoleType.admin]: [
                'mixers.view', 'mixers.edit', 'mixers.delete', 'mixers.add',
                'tractors.view', 'tractors.edit', 'tractors.delete', 'tractors.add',
                'trailers.view', 'trailers.edit', 'trailers.delete', 'trailers.add',
                'heavy_equipment.view', 'heavy_equipment.edit', 'heavy_equipment.delete', 'heavy_equipment.add',
                'operators.view', 'operators.edit', 'operators.delete', 'operators.add',
                'managers.view', 'managers.edit', 'managers.delete', 'managers.add',
                'plants.view', 'plants.edit', 'plants.delete', 'plants.add',
                'regions.view', 'regions.edit', 'regions.delete', 'regions.add',
                'list.view', 'list.edit', 'list.delete', 'list.add',
                'archive.view', 'archive.edit', 'archive.delete', 'archive.add',
                'messages.view', 'messages.send', 'itaccess.view'
            ],
            [UserRoleType.manager]: [
                'mixers.view', 'mixers.edit', 'mixers.add',
                'tractors.view', 'tractors.edit', 'tractors.add',
                'trailers.view', 'trailers.edit', 'trailers.add',
                'heavy_equipment.view', 'heavy_equipment.edit',
                'operators.view', 'operators.edit',
                'plants.view',
                'regions.view',
                'list.view', 'list.edit',
                'archive.view',
                'messages.view', 'messages.send', 'itaccess.view'
            ],
            [UserRoleType.operator]: [
                'mixers.view',
                'tractors.view',
                'trailers.view',
                'heavy_equipment.view',
                'operators.view',
                'plants.view',
                'list.view',
                'messages.view', 'messages.send', 'itaccess.view'
            ],
            [UserRoleType.guest]: [
                'itaccess.view'
            ]
        };

        // All users can access their own account
        if (permission === 'my_account.view') {
            return true;
        }

        // Check if the role has the specific permission
        const rolePermissions = permissionsMap[forRole] || [];
        return rolePermissions.includes(permission);
    }

    /**
     * Get the current user role from local storage
     */
    static getCurrentUserRole() {
        return localStorage.getItem('userRole') || UserRoleType.guest;
    }

    /**
     * Set the current user role in local storage
     */
    static setCurrentUserRole(role) {
        localStorage.setItem('userRole', role);
    }
}
