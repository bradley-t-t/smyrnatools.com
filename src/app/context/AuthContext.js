import React, {createContext, useContext, useEffect, useState} from 'react'
import APIUtility from '../../utils/APIUtility'
import {supabase} from '../../services/DatabaseService'

const AUTH_CONTEXT_FUNCTION = '/auth-context'

const AuthContext = createContext()

export function useAuth() {
    return useContext(AuthContext)
}

function normalizeName(name) {
    let n = name.replace(/\s+/g, '')
    if (!n) return ''
    return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
}

export function AuthProvider({children}) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        setLoading(true)
        restoreSession().finally(() => setLoading(false))
    }, [])

    async function restoreSession() {
        setLoading(true)
        setError(null)
        const userId = sessionStorage.getItem('userId')
        if (!userId) {
            setUser(null)
            setLoading(false)
            return false
        }
        try {
            const {json} = await APIUtility.post(`${AUTH_CONTEXT_FUNCTION}/restore-session`, {userId})
            if (json.success && json.user) {
                setUser(json.user)
                setLoading(false)
                return true
            } else {
                sessionStorage.removeItem('userId')
                setUser(null)
                setLoading(false)
                return false
            }
        } catch (e) {
            sessionStorage.removeItem('userId')
            setUser(null)
            setLoading(false)
            return false
        }
    }

    async function signIn(email, password) {
        setError(null)
        setLoading(true)
        try {
            const {res, json} = await APIUtility.post(`${AUTH_CONTEXT_FUNCTION}/sign-in`, {email, password})
            if (!res.ok) {
                setError(json.error || 'Invalid email or password')
                setLoading(false)
                throw new Error(json.error || 'Invalid email or password')
            }
            setUser(json)
            sessionStorage.setItem('userId', json.id)
            setLoading(false)
            window.dispatchEvent(new CustomEvent('authSuccess', {detail: {userId: json.id}}))
            setTimeout(() => loadUserProfile(json.id).catch(() => {
            }), 100)
            return json
        } catch (e) {
            setError(e.message || 'An unknown error occurred')
            setLoading(false)
            throw e
        }
    }

    async function loadUserProfile(userId) {
        if (!userId) return
        try {
            const {json} = await APIUtility.post(`${AUTH_CONTEXT_FUNCTION}/load-profile`, {userId})
            if (json.profile) {
                setUser(cu => ({...cu, profile: json.profile}))
            }
        } catch {
        }
    }

    async function createDefaultPreferencesRow(userId) {
        if (!userId) return
        try {
            const now = new Date().toISOString()
            const baseFilters = {searchText: '', selectedPlant: '', statusFilter: '', viewMode: 'grid'}
            const roleFilters = {searchText: '', selectedPlant: '', roleFilter: '', viewMode: 'grid'}
            await supabase
                .from('users_preferences')
                .upsert({
                    user_id: userId,
                    navbar_minimized: false,
                    theme_mode: 'light',
                    accent_color: 'red',
                    show_tips: true,
                    show_online_overlay: true,
                    auto_overview: false,
                    default_view_mode: null,
                    mixer_filters: baseFilters,
                    operator_filters: baseFilters,
                    manager_filters: roleFilters,
                    tractor_filters: baseFilters,
                    trailer_filters: baseFilters,
                    equipment_filters: baseFilters,
                    last_viewed_filters: null,
                    created_at: now,
                    updated_at: now
                }, {onConflict: 'user_id'})
        } catch {
        }
    }

    async function signUp(email, password, firstName, lastName) {
        setError(null)
        setLoading(true)
        try {
            const {res, json} = await APIUtility.post(`${AUTH_CONTEXT_FUNCTION}/sign-up`, {
                email,
                password,
                firstName,
                lastName
            })
            if (!res.ok) {
                setError(json.error || 'Sign up failed')
                setLoading(false)
                throw new Error(json.error || 'Sign up failed')
            }
            setUser(json)
            sessionStorage.setItem('userId', json.id)
            await createDefaultPreferencesRow(json.id)
            setLoading(false)
            return json
        } catch (e) {
            setError(e.message)
            setLoading(false)
            throw e
        }
    }

    async function signOut() {
        await APIUtility.post(`${AUTH_CONTEXT_FUNCTION}/sign-out`)
        sessionStorage.removeItem('userId')
        localStorage.removeItem('cachedPlants')
        localStorage.removeItem('userRole')
        setUser(null)
        window.dispatchEvent(new CustomEvent('authSignOut'))
        return true
    }

    async function updateProfile(userId, firstName, lastName, plantCode) {
        setError(null)
        setLoading(true)
        try {
            const {res, json} = await APIUtility.post(`${AUTH_CONTEXT_FUNCTION}/update-profile`, {
                userId,
                firstName,
                lastName,
                plantCode
            })
            if (!res.ok || !json.success) {
                setError(json.error || 'Update profile failed')
                setLoading(false)
                throw new Error(json.error || 'Update profile failed')
            }
            setUser(cu => ({...cu, profile: json.profile}))
            setLoading(false)
            return true
        } catch (e) {
            setError(e.message)
            setLoading(false)
            throw e
        }
    }

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            error,
            signIn,
            signUp,
            signOut,
            restoreSession,
            loadUserProfile,
            updateProfile,
            isAuthenticated: !!user
        }}>
            {children}
        </AuthContext.Provider>
    )
}