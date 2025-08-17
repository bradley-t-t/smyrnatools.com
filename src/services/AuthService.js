import supabase from './DatabaseService'
import { AuthUtility } from '../utils/AuthUtility'
import { UserService } from './UserService'

const USERS_TABLE = 'users'
const PROFILES_TABLE = 'users_profiles'
const OPERATORS_TABLE = 'operators'

class AuthServiceImpl {
    currentUser = null
    isAuthenticated = false
    observers = []
    operatorCache = {}

    async getOperatorInfo(employeeId) {
        if (!employeeId) return null
        if (this.operatorCache[employeeId]) return this.operatorCache[employeeId]
        const { data, error } = await supabase
            .from(OPERATORS_TABLE)
            .select('*')
            .eq('employee_id', employeeId)
            .single()
        if (error || !data) return null
        this.operatorCache[employeeId] = data
        return data
    }

    async signIn(email, password) {
        const trimmedEmail = email?.trim().toLowerCase()
        if (!trimmedEmail || !password) throw new Error('Email and password are required')
        const { data, error } = await supabase
            .from(USERS_TABLE)
            .select('id, email, password_hash, salt')
            .eq('email', trimmedEmail)
            .single()
        if (error || !data) throw new Error('Invalid credentials')
        if (AuthUtility.hashPassword(password, data.salt) !== data.password_hash) throw new Error('Invalid credentials')
        await supabase.auth.signInWithPassword({ email: trimmedEmail, password }).catch(() => {})
        this.currentUser = { ...data, userId: data.id }
        this.isAuthenticated = true
        sessionStorage.setItem('userId', data.id)
        this._notifyObservers()
        return this.currentUser
    }

    async signUp(email, password, firstName, lastName) {
        if (!AuthUtility.emailIsValid(email)) throw new Error('Invalid email')
        if (AuthUtility.passwordStrength(password).value === 'weak') throw new Error('Weak password')
        if (!firstName?.trim() || !lastName?.trim()) throw new Error('First and last name are required')
        const trimmedEmail = email.trim().toLowerCase()
        const { data: existingUser } = await supabase
            .from(USERS_TABLE)
            .select('id')
            .eq('email', trimmedEmail)
            .single()
        if (existingUser) throw new Error('Email already registered')
        const userId = crypto.randomUUID()
        const now = new Date().toISOString()
        const salt = AuthUtility.generateSalt()
        const passwordHash = AuthUtility.hashPassword(password, salt)
        const user = {
            id: userId,
            email: trimmedEmail,
            password_hash: passwordHash,
            salt,
            created_at: now,
            updated_at: now
        }
        const { error: userError } = await supabase.from(USERS_TABLE).insert(user)
        if (userError) throw userError
        const { data: createdUser, error: verifyError } = await supabase
            .from(USERS_TABLE)
            .select('id')
            .eq('id', userId)
            .single()
        if (verifyError || !createdUser) throw new Error('User creation failed')
        const profile = {
            id: userId,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            plant_code: '',
            created_at: now,
            updated_at: now
        }
        const { error: profileError } = await supabase.from(PROFILES_TABLE).insert(profile)
        if (profileError) {
            await supabase.from(USERS_TABLE).delete().eq('id', userId)
            throw profileError
        }
        const guestRole = await UserService.getRoleByName('Guest')
        if (!guestRole) throw new Error('Guest role not found')
        const roleAssigned = await UserService.assignRole(userId, guestRole.id)
        if (!roleAssigned) throw new Error('Role assignment failed')
        this.currentUser = { ...user, userId }
        this.isAuthenticated = true
        sessionStorage.setItem('userId', userId)
        this._notifyObservers()
        return user
    }

    async signOut() {
        this.currentUser = null
        this.isAuthenticated = false
        sessionStorage.removeItem('userId')
        localStorage.removeItem('cachedPlants')
        await supabase.auth.signOut()
        this._notifyObservers()
    }

    async updateEmail(newEmail) {
        if (!this.currentUser) throw new Error('No authenticated user')
        if (!AuthUtility.emailIsValid(newEmail)) throw new Error('Invalid email')
        const trimmedEmail = newEmail.trim().toLowerCase()
        const { data: existingUser } = await supabase
            .from(USERS_TABLE)
            .select('id')
            .eq('email', trimmedEmail)
            .neq('id', this.currentUser.id)
            .single()
        if (existingUser) throw new Error('Email already registered')
        const { error } = await supabase
            .from(USERS_TABLE)
            .update({ email: trimmedEmail, updated_at: new Date().toISOString() })
            .eq('id', this.currentUser.id)
        if (error) throw error
        this.currentUser.email = trimmedEmail
        this._notifyObservers()
        return true
    }

    async updatePassword(newPassword) {
        if (!this.currentUser) throw new Error('No authenticated user')
        if (AuthUtility.passwordStrength(newPassword).value === 'weak') throw new Error('Weak password')
        const salt = AuthUtility.generateSalt()
        const passwordHash = AuthUtility.hashPassword(newPassword, salt)
        const { error } = await supabase
            .from(USERS_TABLE)
            .update({
                password_hash: passwordHash,
                salt,
                updated_at: new Date().toISOString()
            })
            .eq('id', this.currentUser.id)
        if (error) throw error
        return true
    }

    async restoreSession() {
        const userId = sessionStorage.getItem('userId')
        if (!userId) return false
        const { data, error } = await supabase
            .from(USERS_TABLE)
            .select('id, email')
            .eq('id', userId)
            .single()
            .abortSignal(AbortSignal.timeout(3000))
        if (error || !data) {
            sessionStorage.removeItem('userId')
            this.isAuthenticated = false
            return false
        }
        this.currentUser = { ...data, userId: data.id }
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
