const STORAGE_KEY = 'smyrna_secure_credentials'

const KeychainUtility = {
    storeCredentials(email, password) {
        if (!email || !password) throw new Error('Email and password are required')
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                email,
                password: btoa(password),
                timestamp: new Date().toISOString()
            }))
            return true
        } catch (error) {
            throw error
        }
    },
    retrieveCredentials() {
        try {
            const storedData = localStorage.getItem(STORAGE_KEY)
            if (!storedData) return null
            const credentials = JSON.parse(storedData)
            return {
                email: credentials.email,
                password: atob(credentials.password)
            }
        } catch (error) {
            return null
        }
    },
    clearCredentials() {
        try {
            localStorage.removeItem(STORAGE_KEY)
        } catch (error) {}
    }
}

export default KeychainUtility
export { KeychainUtility }
