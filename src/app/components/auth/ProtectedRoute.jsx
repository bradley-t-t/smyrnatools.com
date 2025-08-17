import React, {useEffect, useState} from 'react'
import {Navigate, useLocation} from 'react-router-dom'
import {useAuth} from '../../context/AuthContext'
import {UserService} from '../../../services/UserService'

function ProtectedRoute({children}) {
    const {user, loading, isAuthenticated} = useAuth()
    const location = useLocation()
    const [roles, setRoles] = useState(null)

    useEffect(() => {
        let active = true
        async function loadRoles() {
            if (!user) return
            try {
                const r = await UserService.getUserRoles(user.id)
                if (active) setRoles(r || [])
            } catch {
                if (active) setRoles([])
            }
        }
        if (user && roles === null) loadRoles()
        return () => { active = false }
    }, [user, roles])

    if (loading) return null
    if (!isAuthenticated || !user) return <Navigate to="/login" replace state={{from: location.pathname}}/>
    if (roles === null) return null
    const guestOnly = roles.length > 0 && roles.every(r => (r?.name || '').toLowerCase() === 'guest')
    const onGuestRoute = location.pathname === '/guest'
    if (guestOnly && !onGuestRoute) return <Navigate to="/guest" replace/>
    if (!guestOnly && onGuestRoute) return <Navigate to="/" replace/>
    return children
}

export default ProtectedRoute
