/**
 * Permission nodes in Spigot/Bukkit style
 */
export const PermissionNode = {
    ALL: [
        'mixers.view',
        'tractors.view',
        'trailers.view',
        'heavy_equipment.view',
        'operators.view',
        'managers.view',
        'plants.view',
        'regions.view',
        'list.view',
        'archive.view',
        'reports.view',
        'settings.view',
        'account.manage',
        'messages.view'
    ]
};

/**
 * User role types
 */
export const UserRoleType = {
    GENERAL_MANAGER: 'General Manager',
    DISTRICT_MANAGER: 'District Manager',
    PLANT_MANAGER: 'Plant Manager',
    CEMENT_DISPATCHER: 'Cement Dispatcher',
    CEMENT_DISPATCH_MANAGER: 'Cement Dispatch Manager',
    READY_MIX_INSTRUCTOR: 'Ready Mix Instructor',
    DISPATCH_MANAGER: 'Dispatch Manager',
    IT_ACCESS: 'IT Access',
    USER: 'User',
    GUEST: 'Guest'
};

/**
 * Role manager to handle permissions
 */
export class RoleManager {
    // Map of roles to their permissions
    static permissions = {
        [UserRoleType.GENERAL_MANAGER]: [
            'mixers.view',
            'tractors.view',
            'trailers.view',
            'heavy_equipment.view',
            'operators.view',
            'managers.view',
            'list.view',
            'archive.view',
            'settings.view',
            'account.manage',
            'messages.view'
        ],
        [UserRoleType.DISTRICT_MANAGER]: [
            'mixers.view',
            'tractors.view',
            'trailers.view',
            'heavy_equipment.view',
            'operators.view',
            'managers.view',
            'list.view',
            'archive.view',
            'settings.view',
            'account.manage',
            'messages.view'
        ],
        [UserRoleType.PLANT_MANAGER]: [
            'mixers.view',
            'operators.view',
            'list.view',
            'archive.view',
            'settings.view',
            'account.manage',
            'messages.view'
        ],
        [UserRoleType.CEMENT_DISPATCH_MANAGER]: [
            'mixers.view',
            'tractors.view',
            'trailers.view',
            'heavy_equipment.view',
            'operators.view',
            'settings.view',
            'messages.view'
        ],
        [UserRoleType.DISPATCH_MANAGER]: [
            'mixers.view',
            'tractors.view',
            'trailers.view',
            'heavy_equipment.view',
            'operators.view',
            'settings.view',
            'messages.view'
        ],
        [UserRoleType.CEMENT_DISPATCHER]: [
            'mixers.view',
            'tractors.view',
            'trailers.view',
            'heavy_equipment.view',
            'operators.view',
            'messages.view'
        ],
        [UserRoleType.READY_MIX_INSTRUCTOR]: [
            'mixers.view',
            'tractors.view',
            'trailers.view',
            'heavy_equipment.view',
            'operators.view',
            'messages.view'
        ],
        [UserRoleType.IT_ACCESS]: PermissionNode.ALL,
        [UserRoleType.GUEST]: [
            'account.manage'
        ]
    };

    /**
     * Check if a role has a specific permission
     */
    static hasPermission(node, role) {
        const rolePermissions = this.permissions[role] || [];
        return rolePermissions.includes(node);
    }

    /**
     * Get all permissions for a role
     */
    static getPermissions(role) {
        return this.permissions[role] || [];
    }
}
