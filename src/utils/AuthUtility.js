import APIUtility from './APIUtility'

const AUTH_UTILITY_FUNCTION = 'auth-utility'

const AuthUtility = {
    async passwordStrength(password) {
        const {res, json} = await APIUtility.post(`/${AUTH_UTILITY_FUNCTION}/password-strength`, { password })
        return res.ok ? json.value || 'weak' : 'weak'
    },
    async emailIsValid(email) {
        const {res, json} = await APIUtility.post(`/${AUTH_UTILITY_FUNCTION}/email-is-valid`, { email })
        return res.ok ? json.isValid === true : false
    },
    async normalizeName(name) {
        const {res, json} = await APIUtility.post(`/${AUTH_UTILITY_FUNCTION}/normalize-name`, { name })
        return res.ok ? json.normalizedName || '' : ''
    },
    async generateSalt() {
        const {res, json} = await APIUtility.post(`/${AUTH_UTILITY_FUNCTION}/generate-salt`)
        return res.ok ? json.salt || '' : ''
    },
    async hashPassword(password, salt) {
        const {res, json} = await APIUtility.post(`/${AUTH_UTILITY_FUNCTION}/hash-password`, { password, salt })
        return res.ok ? json.hash || '' : ''
    },
    async getUserId() {
        const {res, json} = await APIUtility.post(`/${AUTH_UTILITY_FUNCTION}/get-user-id`)
        return res.ok ? json.userId || null : null
    }
}

export default AuthUtility
export { AuthUtility }
