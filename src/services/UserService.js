import APIUtility from '../utils/APIUtility'

const USER_FUNCTION = '/user-service'

class UserServiceImpl {
    constructor() {
        this.userProfileCache = new Map()
    }

    async getCurrentUser() {
        const userId = sessionStorage.getItem('userId')
        if (userId) {
            const {json} = await APIUtility.post(`${USER_FUNCTION}/current-user`, {userId})
            if (json && json.id) return {id: userId}
            sessionStorage.removeItem('userId')
        }
        const {json} = await APIUtility.post(`${USER_FUNCTION}/current-user`, {})
        if (!json) return null
        if (json.id) sessionStorage.setItem('userId', json.id)
        return json
    }

    async getUserById(userId) {
        if (!userId) return {id: 'unknown', name: 'Unknown User'}
        if (this.userProfileCache.has(userId)) {
            const cachedUser = this.userProfileCache.get(userId)
            return {
                id: userId,
                name: cachedUser.displayName || cachedUser.name || `User ${userId.slice(0, 8)}`,
                email: cachedUser.email
            }
        }
        const {json} = await APIUtility.post(`${USER_FUNCTION}/user-by-id`, {userId})
        if (!json || !json.id) {
            const basicUser = {id: userId, name: `User ${userId.slice(0, 8)}`}
            this.userProfileCache.set(userId, basicUser)
            return basicUser
        }
        this.userProfileCache.set(userId, json)
        return {
            id: json.id,
            name: json.name || json.email?.split('@')[0] || `User ${userId.slice(0, 8)}`,
            email: json.email
        }
    }

    async getUserDisplayName(userId) {
        if (!userId) return 'System'
        if (userId === 'anonymous') return 'Anonymous'
        const {json} = await APIUtility.post(`${USER_FUNCTION}/display-name`, {userId})
        return json
    }
}

export const UserService = new UserServiceImpl()

UserService.userRolesCache = new Map()
UserService.rolesPermissionsCache = new Map()

UserService.clearCache = function () {
    this.userRolesCache.clear()
    this.rolesPermissionsCache.clear()
}

UserService.getAllRoles = async function () {
    const {json} = await APIUtility.post(`${USER_FUNCTION}/all-roles`)
    return json ?? []
}

UserService.getRoleById = async function (roleId) {
    if (!roleId) throw new Error('Role ID is required')
    const {json} = await APIUtility.post(`${USER_FUNCTION}/role-by-id`, {roleId})
    return json
}

UserService.getRoleByName = async function (roleName) {
    if (!roleName) throw new Error('Role name is required')
    const {json} = await APIUtility.post(`${USER_FUNCTION}/role-by-name`, {roleName})
    return json
}

UserService.getUserRoles = async function (userId) {
    if (!userId) throw new Error('User ID is required')
    const id = typeof userId === 'object' && userId.id ? userId.id : userId
    if (this.userRolesCache.has(id)) return this.userRolesCache.get(id)
    const {json} = await APIUtility.post(`${USER_FUNCTION}/user-roles`, {userId: id})
    const roles = json ?? []
    this.userRolesCache.set(id, roles)
    return roles
}

UserService.getUserPermissions = async function (userId) {
    if (!userId) throw new Error('User ID is required')
    const id = typeof userId === 'object' && userId.id ? userId.id : userId
    const {json} = await APIUtility.post(`${USER_FUNCTION}/user-permissions`, {userId: id})
    return json ?? []
}

UserService.hasPermission = async function (userId, permission) {
    if (!userId || !permission) return false
    if (permission === 'my_account.view') return true
    const id = typeof userId === 'object' && userId.id ? userId.id : userId
    const {json} = await APIUtility.post(`${USER_FUNCTION}/has-permission`, {userId: id, permission})
    return !!json
}

UserService.hasAnyPermission = async function (userId, permissions) {
    if (!userId || !permissions?.length) return false
    const id = typeof userId === 'object' && userId.id ? userId.id : userId
    const {json} = await APIUtility.post(`${USER_FUNCTION}/has-any-permission`, {userId: id, permissions})
    return !!json
}

UserService.hasAllPermissions = async function (userId, permissions) {
    if (!userId || !permissions?.length) return false
    const id = typeof userId === 'object' && userId.id ? userId.id : userId
    const {json} = await APIUtility.post(`${USER_FUNCTION}/has-all-permissions`, {userId: id, permissions})
    return !!json
}

UserService.getMenuVisibility = async function (userId, requiredPermissions = {}) {
    if (!userId) return {}
    const id = typeof userId === 'object' && userId.id ? userId.id : userId
    const {json} = await APIUtility.post(`${USER_FUNCTION}/menu-visibility`, {userId: id, requiredPermissions})
    return json ?? {}
}

UserService.getHighestRole = async function (userId) {
    if (!userId) return null
    const id = typeof userId === 'object' && userId.id ? userId.id : userId
    const {json} = await APIUtility.post(`${USER_FUNCTION}/highest-role`, {userId: id})
    return json
}

UserService.assignRole = async function (userId, roleId) {
    if (!userId || !roleId) throw new Error('User ID and role ID are required')
    const id = typeof userId === 'object' && userId.id ? userId.id : userId
    const {json} = await APIUtility.post(`${USER_FUNCTION}/assign-role`, {userId: id, roleId})
    this.userRolesCache.delete(id)
    return !!json
}

UserService.removeRole = async function (userId, roleId) {
    if (!userId || !roleId) throw new Error('User ID and role ID are required')
    const id = typeof userId === 'object' && userId.id ? userId.id : userId
    await APIUtility.post(`${USER_FUNCTION}/remove-role`, {userId: id, roleId})
    this.userRolesCache.delete(id)
    return true
}

UserService.createRole = async function (name, permissions = [], weight = 0) {
    if (!name) throw new Error('Role name is required')
    const {json} = await APIUtility.post(`${USER_FUNCTION}/create-role`, {name, permissions, weight})
    this.clearCache()
    return json
}

UserService.updateRole = async function (roleId, updates) {
    if (!roleId || !updates) throw new Error('Role ID and updates are required')
    await APIUtility.post(`${USER_FUNCTION}/update-role`, {roleId, updates})
    this.clearCache()
    return true
}

UserService.deleteRole = async function (roleId) {
    if (!roleId) throw new Error('Role ID is required')
    await APIUtility.post(`${USER_FUNCTION}/delete-role`, {roleId})
    this.clearCache()
    return true
}

UserService.getUserPlant = async function (userId) {
    if (!userId) return null
    const id = typeof userId === 'object' && userId.id ? userId.id : userId
    const {json} = await APIUtility.post(`${USER_FUNCTION}/user-plant`, {userId: id})
    return json ?? null
}
