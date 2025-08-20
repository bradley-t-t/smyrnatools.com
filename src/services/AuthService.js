import APIUtility from '../utils/APIUtility'

const AUTH_SERVICE_FUNCTION = '/auth-service'

class AuthServiceImpl {
    currentUser = null
    isAuthenticated = false
    observers = []

    async signIn(email, password) {
        const {res, json} = await APIUtility.post(`${AUTH_SERVICE_FUNCTION}/sign-in`, { email, password })
        if (!res.ok) throw new Error(json.error || 'Sign in failed')
        this.currentUser = { userId: json.userId, email: json.email }
        this.isAuthenticated = true
        sessionStorage.setItem('userId', json.userId)
        this._notifyObservers()
        return this.currentUser
    }

    async signUp(email, password, firstName, lastName) {
        const {res, json} = await APIUtility.post(`${AUTH_SERVICE_FUNCTION}/sign-up`, { email, password, firstName, lastName })
        if (!res.ok) throw new Error(json.error || 'Sign up failed')
        this.currentUser = { userId: json.userId, email: json.email }
        this.isAuthenticated = true
        sessionStorage.setItem('userId', json.userId)
        this._notifyObservers()
        return this.currentUser
    }

    async signOut() {
        await APIUtility.post(`${AUTH_SERVICE_FUNCTION}/sign-out`)
        this.currentUser = null
        this.isAuthenticated = false
        sessionStorage.removeItem('userId')
        localStorage.removeItem('cachedPlants')
        this._notifyObservers()
    }

    async updateEmail(newEmail) {
        if (!this.currentUser) throw new Error('No authenticated user')
        const {res, json} = await APIUtility.post(`${AUTH_SERVICE_FUNCTION}/update-email`, { email: newEmail, userId: this.currentUser.userId })
        if (!res.ok) throw new Error(json.error || 'Update email failed')
        this.currentUser.email = newEmail.trim().toLowerCase()
        this._notifyObservers()
        return true
    }

    async updatePassword(newPassword) {
        if (!this.currentUser) throw new Error('No authenticated user')
        const {res, json} = await APIUtility.post(`${AUTH_SERVICE_FUNCTION}/update-password`, { password: newPassword, userId: this.currentUser.userId })
        if (!res.ok) throw new Error(json.error || 'Update password failed')
        return true
    }

    async restoreSession() {
        const userId = sessionStorage.getItem('userId')
        if (!userId) return false
        const {json} = await APIUtility.post(`${AUTH_SERVICE_FUNCTION}/restore-session`, { userId })
        if (!json.success) {
            sessionStorage.removeItem('userId')
            this.isAuthenticated = false
            return false
        }
        this.currentUser = { userId: json.user.userId, email: json.user.email }
        this.isAuthenticated = true
        this._notifyObservers()
        return true
    }

    addObserver(callback) {
        this.observers.push(callback)
    }

    removeObserver(callback) {
        this.observers = this.observers.filter(cb => cb !== callback)
    }

    _notifyObservers() {
        this.observers.forEach(callback =>
            callback({
                isAuthenticated: this.isAuthenticated,
                currentUser: this.currentUser
            })
        )
    }
}

export const AuthService = new AuthServiceImpl()