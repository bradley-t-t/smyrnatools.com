import React, {createContext, useContext, useEffect, useState} from 'react';
import {logSupabaseError, supabase} from '../../services/DatabaseService';

const PreferencesContext = createContext();

export function usePreferences() {
    const context = useContext(PreferencesContext);
    if (!context) {
        throw new Error('usePreferences must be used within a PreferencesProvider');
    }
    return context;
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
        trainerFilter: '',
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
    lastViewedFilters: null
};

export const PreferencesProvider = ({children}) => {
    const [preferences, setPreferences] = useState(defaultPreferences);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        const applyThemeFromStorage = () => {
            try {
                const savedPrefs = localStorage.getItem('userPreferences');
                if (savedPrefs) {
                    const parsedPrefs = JSON.parse(savedPrefs);
                    setPreferences(parsedPrefs);
                    document.documentElement.classList.toggle('dark-mode', parsedPrefs.themeMode === 'dark');
                    document.documentElement.classList.remove('accent-blue', 'accent-red', 'accent-orange', 'accent-green', 'accent-darkgrey');
                    document.documentElement.classList.add(`accent-${parsedPrefs.accentColor}`);
                }
            } catch (error) {
            }
        };

        applyThemeFromStorage();

        const handleStorageChange = (e) => {
            if (e.key === 'userPreferences') {
                applyThemeFromStorage();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    useEffect(() => {
        const initializeUser = async () => {
            try {
                const {data: {session}} = await supabase.auth.getSession();
                const sessionUserId = session?.user?.id || sessionStorage.getItem('userId');
                if (sessionUserId) {
                    setUserId(sessionUserId);
                    await fetchUserPreferences(sessionUserId);
                } else {
                    setLoading(false);
                }
            } catch (error) {
                setLoading(false);
            }
        };

        initializeUser();

        const {data: authListener} = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user?.id) {
                setUserId(session.user.id);
                setTimeout(() => fetchUserPreferences(session.user.id), 500);
            } else if (event === 'SIGNED_OUT') {
                setUserId(null);
                setPreferences(defaultPreferences);
                localStorage.removeItem('userPreferences');
                document.documentElement.classList.remove('dark-mode', 'accent-blue', 'accent-red', 'accent-orange', 'accent-green', 'accent-darkgrey');
            }
        });

        return () => authListener.subscription?.unsubscribe();
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle('dark-mode', preferences.themeMode === 'dark');
        document.documentElement.classList.remove('accent-blue', 'accent-red', 'accent-orange', 'accent-green', 'accent-darkgrey');
        document.documentElement.classList.add(`accent-${preferences.accentColor}`);
        try {
            localStorage.setItem('userPreferences', JSON.stringify(preferences));
        } catch (error) {
        }
    }, [preferences]);

    const fetchUserPreferences = async (uid) => {
        try {
            setLoading(true);
            const {data, error} = await supabase
                .from('users_preferences')
                .select('*')
                .eq('user_id', uid)
                .single();

            if (error && error.code === 'PGRST116') {
                setPreferences(defaultPreferences);
            } else if (error) {
                throw error;
            } else {
                setPreferencesFromData(data);
            }
        } catch (error) {
            logSupabaseError('fetching preferences', error);
        } finally {
            setLoading(false);
        }
    };

    const setPreferencesFromData = (data) => {
        const newPreferences = {
            navbarMinimized: data.navbar_minimized,
            themeMode: data.theme_mode,
            accentColor: data.accent_color,
            showTips: data.show_tips === undefined ? true : data.show_tips,
            showOnlineOverlay: data.show_online_overlay === undefined ? true : data.show_online_overlay,
            autoOverview: data.auto_overview === undefined ? false : data.auto_overview,
            defaultViewMode: data.default_view_mode === undefined ? null : data.default_view_mode,
            mixerFilters: data.mixer_filters ? {...data.mixer_filters, viewMode: data.mixer_filters.viewMode || 'grid'} : {...defaultPreferences.mixerFilters},
            operatorFilters: data.operator_filters ? {...data.operator_filters, viewMode: data.operator_filters.viewMode || 'grid'} : {...defaultPreferences.operatorFilters},
            managerFilters: data.manager_filters ? {...data.manager_filters, viewMode: data.manager_filters.viewMode || 'grid'} : {...defaultPreferences.managerFilters},
            tractorFilters: data.tractor_filters ? {...data.tractor_filters, viewMode: data.tractor_filters.viewMode || 'grid'} : {...defaultPreferences.tractorFilters},
            trailerFilters: data.trailer_filters ? {...data.trailer_filters, viewMode: data.trailer_filters.viewMode || 'grid'} : {...defaultPreferences.trailerFilters},
            equipmentFilters: data.equipment_filters ? {...data.equipment_filters, viewMode: data.equipment_filters.viewMode || 'grid'} : {...defaultPreferences.equipmentFilters},
            lastViewedFilters: data.last_viewed_filters
        };
        setPreferences(newPreferences);
        try {
            localStorage.setItem('userPreferences', JSON.stringify(newPreferences));
        } catch (error) {
        }
    };

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
            const updateData = {
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
                updated_at: new Date().toISOString(),
            };
            await supabase
                .from('users_preferences')
                .update(updateData)
                .eq('user_id', userId)
        }
    };

    const updateManagerFilter = (key, value) => {
        const newFilters = {...preferences.managerFilters, [key]: value};
        updatePreferences('managerFilters', newFilters);
    };

    const resetManagerFilters = () => {
        updatePreferences('managerFilters', {...defaultPreferences.managerFilters});
    };

    const updateTractorFilter = (key, value) => {
        const newFilters = {...preferences.tractorFilters, [key]: value};
        updatePreferences('tractorFilters', newFilters);
    };

    const resetTractorFilters = () => {
        updatePreferences('tractorFilters', {...defaultPreferences.tractorFilters});
    };

    const updateTrailerFilter = (key, value) => {
        const newFilters = {...preferences.trailerFilters, [key]: value};
        updatePreferences('trailerFilters', newFilters);
    };

    const resetTrailerFilters = () => {
        updatePreferences('trailerFilters', {...defaultPreferences.trailerFilters});
    };

    const updateEquipmentFilter = (key, value) => {
        const newFilters = {...preferences.equipmentFilters, [key]: value};
        updatePreferences('equipmentFilters', newFilters);
    };

    const resetEquipmentFilters = () => {
        updatePreferences('equipmentFilters', {...defaultPreferences.equipmentFilters});
    };

    const updateMixerFilter = (key, value) => {
        const newFilters = {...preferences.mixerFilters, [key]: value};
        updatePreferences('mixerFilters', newFilters);
    };

    const resetMixerFilters = () => {
        updatePreferences('mixerFilters', {...defaultPreferences.mixerFilters});
    };

    const updateOperatorFilter = (key, value) => {
        const newFilters = {...preferences.operatorFilters, [key]: value};
        updatePreferences('operatorFilters', newFilters);
    };

    const resetOperatorFilters = () => {
        updatePreferences('operatorFilters', {...defaultPreferences.operatorFilters});
    };

    const toggleNavbarMinimized = () => updatePreferences('navbarMinimized', !preferences.navbarMinimized);
    const toggleShowTips = () => updatePreferences('showTips', !preferences.showTips);
    const toggleShowOnlineOverlay = () => updatePreferences('showOnlineOverlay', !preferences.showOnlineOverlay);
    const toggleAutoOverview = () => updatePreferences('autoOverview', !preferences.autoOverview);
    const setThemeMode = (mode) => (mode === 'light' || mode === 'dark') && updatePreferences('themeMode', mode);
    const setAccentColor = (color) => (color === 'red' || color === 'blue') && updatePreferences('accentColor', color);

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
                resetOperatorFilters
            }}
        >
            {children}
        </PreferencesContext.Provider>
    );
};

export const debugForceCreatePreferences = async (userId) => {
    if (!userId) return false;
    try {
        await supabase
            .from('users_preferences')
            .insert([{
                user_id: userId,
                navbar_minimized: false,
                theme_mode: 'light',
                accent_color: 'blue',
                default_view_mode: 'grid'
            }]);
    } catch (error) {
        return false;
    }
    return true;
}
