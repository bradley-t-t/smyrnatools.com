import APIUtility from './APIUtility'

const USER_UTILITY_FUNCTION = '/user-utility'

const userUtility = {
    async generateUUID() {
        const {res, json} = await APIUtility.post(`${USER_UTILITY_FUNCTION}/generate-uuid`)
        return res.ok && json.uuid ? json.uuid : ''
    },
    async isValidUUID(uuid) {
        const {res, json} = await APIUtility.post(`${USER_UTILITY_FUNCTION}/validate-uuid`, {uuid})
        return res.ok && typeof json.isValid === 'boolean' ? json.isValid : false
    },
    async safeUUID(uuid) {
        const {res, json} = await APIUtility.post(`${USER_UTILITY_FUNCTION}/safe-uuid`, {uuid})
        return res.ok ? json.safeUuid : null
    }
}

export const generateUUID = userUtility.generateUUID
export const isValidUUID = userUtility.isValidUUID
export default userUtility
