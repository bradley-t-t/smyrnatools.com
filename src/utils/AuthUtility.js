import cryptoUtility from './CryptoUtility'
import {supabase} from '../services/DatabaseService'

const PWD_HASH_TIMEOUT = 5000

const AuthUtility = {
    passwordStrength(password) {
        if (!password || password.length < 8) {
            return {value: 'weak'}
        }
        let score = 0
        if (password.length >= 8) score++
        if (password.length >= 12) score++
        if (/[A-Z]/.test(password)) score++
        if (/[a-z]/.test(password)) score++
        if (/[0-9]/.test(password)) score++
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++
        if (score < 3) return {value: 'weak'}
        if (score < 5) return {value: 'medium'}
        return {value: 'strong'}
    },
    emailIsValid(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    },
    generateSalt() {
        const randomBytes = new Uint8Array(16)
        crypto.getRandomValues(randomBytes)
        return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('')
    },
    async hashPassword(password, salt) {
        try {
            const data = password + salt
            const hashPromise = cryptoUtility.crypto(data)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Password hash timed out')), PWD_HASH_TIMEOUT))
            return await Promise.race([hashPromise, timeoutPromise])
        } catch (error) {
            return AuthUtility.hashPasswordSync(password, salt)
        }
    },
    hashPasswordSync(password, salt) {
        try {
            const data = password + salt
            let hash = 0
            for (let i = 0; i < data.length; i++) {
                const char = data.charCodeAt(i)
                hash = ((hash << 5) - hash) + char
                hash = hash & hash
            }
            return (hash >>> 0).toString(16)
        } catch (error) {
            throw error
        }
    },
    async verifyPassword(password, hash, salt) {
        const computedHash = await AuthUtility.hashPassword(password, salt)
        return computedHash === hash
    },
    async getUserId() {
        let userId = sessionStorage.getItem('userId')
        if (userId) return userId
        try {
            const {data} = await supabase.auth.getSession()
            if (data?.session?.user?.id) {
                sessionStorage.setItem('userId', data.session.user.id)
                return data.session.user.id
            }
        } catch {}
        return null
    }
}

export default AuthUtility
export {AuthUtility}
