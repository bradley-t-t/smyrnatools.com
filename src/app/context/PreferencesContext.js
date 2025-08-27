import React, {createContext, useContext, useEffect, useState} from 'react'
import {logSupabaseError, supabase} from '../../services/DatabaseService'
import {UserPreferencesService} from '../../services/UserPreferencesService'

const PreferencesContext = createContext()

export function usePreferences() {
    const context = useContext(PreferencesContext)
    if (!context) throw new Error('usePreferences must be used within a PreferencesProvider')
    return context
}

const defaultPreferences = {
    navbarMinimized: false,
    themeMode: 'light',
    accentColor: 'red',
    showTips: true,
    showOnlineOverlay: true,
    autoOverview: false,
    defaultViewMode: null,
    mixerFilters: {
        searchText: '',
        selectedPlant: '',
        statusFilter: '',
        viewMode: 'grid'
    },
    operatorFilters: {
        searchText: '',
        selectedPlant: '',
        statusFilter: '',
        viewMode: 'grid'
    },
    managerFilters: {
        searchText: '',
        selectedPlant: '',
        roleFilter: '',
        viewMode: 'grid'
    },
    tractorFilters: {
        searchText: '',
        selectedPlant: '',
        statusFilter: '',
        viewMode: 'grid'
    },
    trailerFilters: {
        searchText: '',
        selectedPlant: '',
        typeFilter: '',
        viewMode: 'grid'
    },
    equipmentFilters: {
        searchText: '',
        selectedPlant: '',
        statusFilter: '',
        viewMode: 'grid'
    },
    lastViewedFilters: null,
    selectedRegion: {code: '', name: ''},
    regionOverlayMinimized: true
}

export const PreferencesProvider = ({children}) => {
    const [preferences, setPreferences] = useState(defaultPreferences)
    const [loading, setLoading] = useState(true)
    const [userId, setUserId] = useState(null)

    useEffect(() => {
        let themeTimeout
        const applyThemeFromStorage = () => {
            try {
                const savedPrefs = localStorage.getItem('userPreferences')
                if (savedPrefs) {
                    const parsedPrefs = JSON.parse(savedPrefs)
                    const merged = {...defaultPreferences, ...parsedPrefs}
                    themeTimeout = setTimeout(() => {
                        setPreferences(merged)
                        document.documentElement.classList.toggle('dark-mode', merged.themeMode === 'dark')
                        document.documentElement.classList.remove('accent-blue', 'accent-red', 'accent-orange', 'accent-green', 'accent-darkgrey')
                        document.documentElement.classList.add(`accent-${merged.accentColor}`)
                    }, 1000)
                }
            } catch {}
        }
        applyThemeFromStorage()
        const handleStorageChange = e => {
            if (e.key === 'userPreferences') applyThemeFromStorage()
        }
        window.addEventListener('storage', handleStorageChange)
        return () => {
            window.removeEventListener('storage', handleStorageChange)
            if (themeTimeout) clearTimeout(themeTimeout)
        }
    }, [])

    useEffect(() => {
        const initializeUser = async () => {
            try {
                const {data: {session}} = await supabase.auth.getSession()
                const sessionUserId = session?.user?.id || sessionStorage.getItem('userId')
                if (sessionUserId) {
                    setUserId(sessionUserId)
                    await fetchUserPreferences(sessionUserId)
                } else {
                    setLoading(false)
                }
            } catch {
                setLoading(false)
            }
        }
        initializeUser()
        const {data: authListener} = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user?.id) {
                setUserId(session.user.id)
                setTimeout(() => fetchUserPreferences(session.user.id), 500)
            } else if (event === 'SIGNED_OUT') {
                setUserId(null)
                setPreferences(defaultPreferences)
                localStorage.removeItem('userPreferences')
                document.documentElement.classList.remove('dark-mode', 'accent-blue', 'accent-red', 'accent-orange', 'accent-green', 'accent-darkgrey')
            }
        })
        return () => authListener.subscription?.unsubscribe()
    }, [])

    useEffect(() => {
        document.documentElement.classList.toggle('dark-mode', preferences.themeMode === 'dark')
        document.documentElement.classList.remove('accent-blue', 'accent-red', 'accent-orange', 'accent-green', 'accent-darkgrey')
        document.documentElement.classList.add(`accent-${preferences.accentColor}`)
        try {
            localStorage.setItem('userPreferences', JSON.stringify(preferences))
        } catch {}
    }, [preferences])

    const fetchUserPreferences = async uid => {
        try {
            setLoading(true)
            const {data, error} = await supabase
                .from('users_preferences')
                .select('*')
                .eq('user_id', uid)
                .single()
            if (error && error.code === 'PGRST116') {
                setTimeout(() => setPreferences(defaultPreferences), 1000)
            } else if (error) {
                throw error
            } else {
                setTimeout(() => setPreferencesFromData(data), 1000)
            }
        } catch (error) {
            logSupabaseError('fetching preferences', error)
        } finally {
            setLoading(false)
        }
    }

    const setPreferencesFromData = data => {
        const newPreferences = {
            navbarMinimized: data.navbar_minimized,
            themeMode: data.theme_mode,
            accentColor: data.accent_color,
            showTips: data.show_tips === undefined ? true : data.show_tips,
            showOnlineOverlay: data.show_online_overlay === undefined ? true : data.show_online_overlay,
            autoOverview: data.auto_overview === undefined ? false : data.auto_overview,
            defaultViewMode: data.default_view_mode === undefined ? null : data.default_view_mode,
            mixerFilters: data.mixer_filters ? {
                ...data.mixer_filters,
                viewMode: data.mixer_filters.viewMode || 'grid'
            } : {...defaultPreferences.mixerFilters},
            operatorFilters: data.operator_filters ? {
                ...data.operator_filters,
                viewMode: data.operator_filters.viewMode || 'grid'
            } : {...defaultPreferences.operatorFilters},
            managerFilters: data.manager_filters ? {
                ...data.manager_filters,
                viewMode: data.manager_filters.viewMode || 'grid'
            } : {...defaultPreferences.managerFilters},
            tractorFilters: data.tractor_filters ? {
                ...data.tractor_filters,
                viewMode: data.tractor_filters.viewMode || 'grid'
            } : {...defaultPreferences.tractorFilters},
            trailerFilters: data.trailer_filters ? {
                ...data.trailer_filters,
                viewMode: data.trailer_filters.viewMode || 'grid'
            } : {...defaultPreferences.trailerFilters},
            equipmentFilters: data.equipment_filters ? {
                ...data.equipment_filters,
                viewMode: data.equipment_filters.viewMode || 'grid'
            } : {...defaultPreferences.equipmentFilters},
            lastViewedFilters: data.last_viewed_filters
        }
        try {
            const savedPrefs = localStorage.getItem('userPreferences')
            const saved = savedPrefs ? JSON.parse(savedPrefs) : {}
            newPreferences.selectedRegion = saved.selectedRegion || defaultPreferences.selectedRegion
            newPreferences.regionOverlayMinimized = typeof saved.regionOverlayMinimized === 'boolean' ? saved.regionOverlayMinimized : defaultPreferences.regionOverlayMinimized
        } catch {
            newPreferences.selectedRegion = defaultPreferences.selectedRegion
            newPreferences.regionOverlayMinimized = defaultPreferences.regionOverlayMinimized
        }
        setPreferences(newPreferences)
        try {
            localStorage.setItem('userPreferences', JSON.stringify(newPreferences))
        } catch {}
    }

    const updatePreferences = async (keyOrObject, value) => {
        let updatedPreferences
        if (typeof keyOrObject === 'string') {
            updatedPreferences = {...preferences, [keyOrObject]: value}
        } else {
            updatedPreferences = {...preferences, ...keyOrObject}
        }
        setPreferences(updatedPreferences)
        localStorage.setItem('userPreferences', JSON.stringify(updatedPreferences))
        if (userId) {
            const now = new Date().toISOString()
            const upsertData = {
                user_id: userId,
                navbar_minimized: updatedPreferences.navbarMinimized,
                theme_mode: updatedPreferences.themeMode,
                accent_color: updatedPreferences.accentColor,
                show_tips: updatedPreferences.showTips,
                show_online_overlay: updatedPreferences.showOnlineOverlay,
                auto_overview: updatedPreferences.autoOverview,
                default_view_mode: updatedPreferences.defaultViewMode,
                mixer_filters: updatedPreferences.mixerFilters,
                operator_filters: updatedPreferences.operatorFilters,
                manager_filters: updatedPreferences.managerFilters,
                tractor_filters: updatedPreferences.tractorFilters,
                trailer_filters: updatedPreferences.trailerFilters,
                equipment_filters: updatedPreferences.equipmentFilters,
                last_viewed_filters: updatedPreferences.lastViewedFilters,
                updated_at: now,
                created_at: now
            }
            try {
                await supabase
                    .from('users_preferences')
                    .upsert(upsertData, {onConflict: 'user_id'})
            } catch (e) {
                logSupabaseError('upserting preferences', e)
            }
        }
    }

    const updateManagerFilter = (key, value) => {
        const newFilters = {...preferences.managerFilters, [key]: value}
        updatePreferences('managerFilters', newFilters)
    }

    const resetManagerFilters = (options = {}) => {
        let newFilters = {...defaultPreferences.managerFilters}
        if (options.keepViewMode && options.currentViewMode !== undefined) {
            newFilters.viewMode = options.currentViewMode
        }
        updatePreferences('managerFilters', newFilters)
    }

    const updateTractorFilter = (key, value) => {
        const newFilters = {...preferences.tractorFilters, [key]: value}
        updatePreferences('tractorFilters', newFilters)
    }

    const resetTractorFilters = () => {
        updatePreferences('tractorFilters', {...defaultPreferences.tractorFilters})
    }

    const updateTrailerFilter = (key, value) => {
        const newFilters = {...preferences.trailerFilters, [key]: value}
        updatePreferences('trailerFilters', newFilters)
    }

    const resetTrailerFilters = () => {
        updatePreferences('trailerFilters', {...defaultPreferences.trailerFilters})
    }

    const updateEquipmentFilter = (key, value) => {
        const newFilters = {...preferences.equipmentFilters, [key]: value}
        updatePreferences('equipmentFilters', newFilters)
    }

    const resetEquipmentFilters = (options = {}) => {
        let newFilters = {...defaultPreferences.equipmentFilters}
        if (options.keepViewMode && options.currentViewMode !== undefined) {
            newFilters.viewMode = options.currentViewMode
        }
        updatePreferences('equipmentFilters', newFilters)
    }

    const updateMixerFilter = (key, value) => {
        const newFilters = {...preferences.mixerFilters, [key]: value}
        updatePreferences('mixerFilters', newFilters)
    }

    const resetMixerFilters = (options = {}) => {
        let newFilters = {...defaultPreferences.mixerFilters}
        if (options.keepViewMode && options.currentViewMode !== undefined) {
            newFilters.viewMode = options.currentViewMode
        }
        updatePreferences('mixerFilters', newFilters)
    }

    const updateOperatorFilter = (key, value) => {
        const newFilters = {...preferences.operatorFilters, [key]: value}
        updatePreferences('operatorFilters', newFilters)
    }

    const resetOperatorFilters = (options = {}) => {
        let newFilters = {...defaultPreferences.operatorFilters}
        if (options.keepViewMode && options.currentViewMode !== undefined) {
            newFilters.viewMode = options.currentViewMode
        }
        updatePreferences('operatorFilters', newFilters)
    }

    const setSelectedRegion = (code, name = '') => {
        updatePreferences('selectedRegion', {code: code || '', name: name || ''})
    }

    const setRegionOverlayMinimized = minimized => {
        updatePreferences('regionOverlayMinimized', !!minimized)
    }

    const toggleNavbarMinimized = () => updatePreferences('navbarMinimized', !preferences.navbarMinimized)
    const toggleShowTips = () => updatePreferences('showTips', !preferences.showTips)
    const toggleShowOnlineOverlay = () => updatePreferences('showOnlineOverlay', !preferences.showOnlineOverlay)
    const toggleAutoOverview = () => updatePreferences('autoOverview', !preferences.autoOverview)
    const setThemeMode = mode => (mode === 'light' || mode === 'dark') && updatePreferences('themeMode', mode)
    const setAccentColor = color => (color === 'red' || color === 'blue') && updatePreferences('accentColor', color)
    const saveLastViewedFilters = async filters => {
        try {
            if (!userId) return
            const finalFilters = filters || {
                mixer: preferences.mixerFilters,
                tractor: preferences.tractorFilters,
                trailer: preferences.trailerFilters,
                equipment: preferences.equipmentFilters
            }
            await UserPreferencesService.saveLastViewedFilters(userId, finalFilters)
            setPreferences(prev => ({
                ...prev,
                lastViewedFilters: finalFilters
            }))
        } catch (error) {
            logSupabaseError('saving last viewed filters', error)
        }
    }

    return (
        <PreferencesContext.Provider
            value={{
                preferences,
                loading,
                toggleNavbarMinimized,
                toggleShowTips,
                toggleShowOnlineOverlay,
                toggleAutoOverview,
                setThemeMode,
                setAccentColor,
                updatePreferences,
                updateManagerFilter,
                resetManagerFilters,
                updateTractorFilter,
                resetTractorFilters,
                updateTrailerFilter,
                resetTrailerFilters,
                updateEquipmentFilter,
                resetEquipmentFilters,
                updateMixerFilter,
                resetMixerFilters,
                updateOperatorFilter,
                resetOperatorFilters,
                saveLastViewedFilters,
                setSelectedRegion,
                setRegionOverlayMinimized
            }}
        >
            {children}
        </PreferencesContext.Provider>
    )
}

export const debugForceCreatePreferences = async userId => {
    if (!userId) return false
    try {
        await supabase
            .from('users_preferences')
            .insert([{
                user_id: userId,
                navbar_minimized: false,
                theme_mode: 'light',
                accent_color: 'blue',
                default_view_mode: 'grid'
            }])
    } catch {
        return false
    }
    return true
}
