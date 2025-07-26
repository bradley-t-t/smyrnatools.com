import React, {createContext, useContext, useEffect, useState} from 'react';
import {logSupabaseError, supabase} from '../../services/DatabaseService';

const PreferencesContext = createContext();

const defaultPreferences = {
    navbarMinimized: false,
    themeMode: 'light',
    accentColor: 'red',
    showTips: true,
    showOnlineOverlay: true,
    mixerFilters: {
        searchText: '',
        selectedPlant: '',
        statusFilter: ''
    },
    operatorFilters: {
        searchText: '',
        selectedPlants: [],
        statusFilter: '',
        trainerFilter: '',
        positionFilter: ''
    },
    managerFilters: {
        searchText: '',
        selectedPlants: [],
        roleFilter: ''
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
                await createUserPreferences(uid);
                const {data: newData, error: newError} = await supabase
                    .from('users_preferences')
                    .select('*')
                    .eq('user_id', uid)
                    .single();
                if (newError) throw newError;
                setPreferencesFromData(newData);
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
            mixerFilters: data.mixer_filters ? {
                searchText: data.mixer_filters.searchText || '',
                selectedPlant: data.mixer_filters.selectedPlant || '',
                statusFilter: data.mixer_filters.statusFilter || ''
            } : {
                searchText: '',
                selectedPlant: '',
                statusFilter: ''
            },
            operatorFilters: data.operator_filters || {
                searchText: '',
                selectedPlant: '',
                statusFilter: '',
                trainerFilter: ''
            },
            managerFilters: data.manager_filters || {
                searchText: '',
                selectedPlant: '',
                roleFilter: ''
            },
            lastViewedFilters: data.last_viewed_filters
        };
        setPreferences(newPreferences);
        try {
            localStorage.setItem('userPreferences', JSON.stringify(newPreferences));
        } catch (error) {
        }
    };

    const updateOperatorFilters = async (filters) => {
        try {
            setPreferences(prev => {
                const newPrefs = {...prev, operatorFilters: filters};
                localStorage.setItem('userPreferences', JSON.stringify(newPrefs));
                return newPrefs;
            });

            const {data} = await supabase.auth.getUser();
            if (data?.user?.id) {
                const {data: existingPrefs} = await supabase
                    .from('users_preferences')
                    .select('id')
                    .eq('user_id', data.user.id);

                if (!existingPrefs || existingPrefs.length === 0) {
                    await supabase
                        .from('users_preferences')
                        .insert([{
                            user_id: data.user.id,
                            operator_filters: filters,
                            theme_mode: preferences.themeMode,
                            accent_color: preferences.accentColor,
                            navbar_minimized: preferences.navbarMinimized
                        }]);
                } else {
                    await supabase
                        .from('users_preferences')
                        .update({
                            operator_filters: filters,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', data.user.id);
                }
            }
        } catch (error) {
        }
    };

    const updateMixerFilters = async (filters) => {
        try {
            setPreferences(prev => {
                const newPrefs = {...prev, mixerFilters: filters};
                localStorage.setItem('userPreferences', JSON.stringify(newPrefs));
                return newPrefs;
            });

            const {data} = await supabase.auth.getUser();
            if (data?.user?.id) {
                const {data: existingPrefs} = await supabase
                    .from('users_preferences')
                    .select('id')
                    .eq('user_id', data.user.id);

                if (!existingPrefs || existingPrefs.length === 0) {
                    await supabase
                        .from('users_preferences')
                        .insert([{
                            user_id: data.user.id,
                            mixer_filters: filters,
                            theme_mode: preferences.themeMode,
                            accent_color: preferences.accentColor,
                            navbar_minimized: preferences.navbarMinimized
                        }]);
                } else {
                    await supabase
                        .from('users_preferences')
                        .update({
                            mixer_filters: filters,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', data.user.id);
                }
            }
        } catch (error) {
        }
    };

    const saveLastViewedFilters = async () => {
        try {
            const lastFilters = {...preferences.mixerFilters};

            setPreferences(prev => {
                const newPrefs = {...prev, lastViewedFilters: lastFilters};
                localStorage.setItem('userPreferences', JSON.stringify(newPrefs));
                return newPrefs;
            });

            const {data} = await supabase.auth.getUser();
            if (data?.user?.id) {
                const {data: existingPrefs} = await supabase
                    .from('users_preferences')
                    .select('id')
                    .eq('user_id', data.user.id);

                if (!existingPrefs || existingPrefs.length === 0) {
                    await supabase
                        .from('users_preferences')
                        .insert([{
                            user_id: data.user.id,
                            last_viewed_filters: lastFilters,
                            mixer_filters: preferences.mixerFilters,
                            theme_mode: preferences.themeMode,
                            accent_color: preferences.accentColor,
                            navbar_minimized: preferences.navbarMinimized
                        }]);
                } else {
                    await supabase
                        .from('users_preferences')
                        .update({
                            last_viewed_filters: lastFilters,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', data.user.id);
                }
            }
        } catch (error) {
        }
    };

    const toggleShowTips = async () => {
        setPreferences(prev => {
            const updated = {...prev, showTips: !prev.showTips};
            localStorage.setItem('userPreferences', JSON.stringify(updated));
            return updated;
        });

        await updateDatabasePreferences(userId, {
            ...preferences,
            showTips: !preferences.showTips
        });
    };

    const toggleShowOnlineOverlay = async () => {
        setPreferences(prev => {
            const updated = {...prev, showOnlineOverlay: !prev.showOnlineOverlay};
            localStorage.setItem('userPreferences', JSON.stringify(updated));
            return updated;
        });

        await updateDatabasePreferences(userId, {
            ...preferences,
            showOnlineOverlay: !preferences.showOnlineOverlay
        });
    };

    const updateOperatorFilter = async (key, value) => {
        try {
            const updatedFilters = {
                ...preferences.operatorFilters,
                [key]: value
            };

            await updateOperatorFilters(updatedFilters);
        } catch (error) {
        }
    };

    const updateMixerFilter = async (key, value) => {
        try {
            const updatedFilters = {
                ...preferences.mixerFilters,
                [key]: value
            };

            await updateMixerFilters(updatedFilters);
        } catch (error) {
        }
    };

    const resetOperatorFilters = async () => {
        const emptyFilters = {
            searchText: '',
            selectedPlant: '',
            statusFilter: '',
            trainerFilter: '',
            positionFilter: ''
        };

        await updateOperatorFilters(emptyFilters);
    };

    const resetMixerFilters = async () => {
        const emptyFilters = {
            searchText: '',
            selectedPlant: '',
            statusFilter: ''
        };

        await updateMixerFilters(emptyFilters);
    };

    const updateManagerFilters = async (filters) => {
        try {
            setPreferences(prev => {
                const newPrefs = {...prev, managerFilters: filters};
                localStorage.setItem('userPreferences', JSON.stringify(newPrefs));
                return newPrefs;
            });

            const {data} = await supabase.auth.getUser();
            if (data?.user?.id) {
                const {data: existingPrefs} = await supabase
                    .from('users_preferences')
                    .select('id')
                    .eq('user_id', data.user.id);

                if (!existingPrefs || existingPrefs.length === 0) {
                    await supabase
                        .from('users_preferences')
                        .insert([{
                            user_id: data.user.id,
                            manager_filters: filters,
                            theme_mode: preferences.themeMode,
                            accent_color: preferences.accentColor,
                            navbar_minimized: preferences.navbarMinimized
                        }]);
                } else {
                    await supabase
                        .from('users_preferences')
                        .update({
                            manager_filters: filters,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', data.user.id);
                }
            }
        } catch (error) {
        }
    };

    const updateManagerFilter = async (key, value) => {
        try {
            const updatedFilters = {
                ...preferences.managerFilters,
                [key]: value
            };

            await updateManagerFilters(updatedFilters);
        } catch (error) {
        }
    };

    const resetManagerFilters = async () => {
        const emptyFilters = {
            searchText: '',
            selectedPlant: '',
            roleFilter: ''
        };

        await updateManagerFilters(emptyFilters);
    };

    const createUserPreferences = async (uid) => {
        try {
            const {data: existingData, error: checkError} = await supabase
                .from('users_preferences')
                .select('id')
                .eq('user_id', uid);

            if (checkError) throw checkError;
            if (existingData?.length > 0) return await updateDatabasePreferences(uid, preferences);

            const {error} = await supabase
                .from('users_preferences')
                .insert([{
                    user_id: uid,
                    navbar_minimized: preferences.navbarMinimized,
                    theme_mode: preferences.themeMode,
                    accent_color: preferences.accentColor,
                    show_tips: preferences.showTips,
                    show_online_overlay: preferences.showOnlineOverlay,
                    mixer_filters: preferences.mixerFilters || {
                        searchText: '',
                        selectedPlant: '',
                        statusFilter: ''
                    },
                    operator_filters: preferences.operatorFilters || {
                        searchText: '',
                        selectedPlant: '',
                        statusFilter: '',
                        trainerFilter: ''
                    },
                    last_viewed_filters: preferences.lastViewedFilters
                }]);

            if (error) throw error;
            return true;
        } catch (error) {
            logSupabaseError('creating user preferences', error);
            return false;
        }
    };

    const updateDatabasePreferences = async (uid, prefsToUpdate) => {
        try {
            const updateData = {
                navbar_minimized: prefsToUpdate.navbarMinimized,
                theme_mode: prefsToUpdate.themeMode,
                accent_color: prefsToUpdate.accentColor,
                show_tips: prefsToUpdate.showTips,
                show_online_overlay: prefsToUpdate.showOnlineOverlay,
                mixer_filters: prefsToUpdate.mixerFilters,
                operator_filters: prefsToUpdate.operatorFilters,
                last_viewed_filters: prefsToUpdate.lastViewedFilters,
                updated_at: new Date().toISOString(),
            };

            const {error} = await supabase
                .from('users_preferences')
                .update(updateData)
                .eq('user_id', uid);

            if (error) throw error;
            return true;
        } catch (error) {
            logSupabaseError('updating user preferences', error);
            return false;
        }
    };

    const updatePreferences = async (keyOrObject, value) => {
        try {
            let updatedPreferences;
            if (typeof keyOrObject === 'string') {
                updatedPreferences = {...preferences, [keyOrObject]: value};
            } else {
                updatedPreferences = {...preferences, ...keyOrObject};
            }

            setPreferences(updatedPreferences);
            localStorage.setItem('userPreferences', JSON.stringify(updatedPreferences));

            if (userId) {
                const success = await updateDatabasePreferences(userId, updatedPreferences);
                if (!success) {
                    await createUserPreferences(userId);
                }
            }
        } catch (error) {
        }
    };

    const toggleNavbarMinimized = () => updatePreferences('navbarMinimized', !preferences.navbarMinimized);
    const setThemeMode = (mode) => (mode === 'light' || mode === 'dark') && updatePreferences('themeMode', mode);
    const setAccentColor = (color) => (color === 'red' || color === 'blue' || color === 'orange' || color === 'green' || color === 'darkgrey') && updatePreferences('accentColor', color);

    return (
        <PreferencesContext.Provider
            value={{
                preferences,
                loading,
                toggleNavbarMinimized,
                toggleShowTips,
                toggleShowOnlineOverlay,
                setThemeMode,
                setAccentColor,
                updatePreferences,
                updateMixerFilters,
                updateMixerFilter,
                resetMixerFilters,
                updateManagerFilters,
                updateManagerFilter,
                resetManagerFilters,
                updateOperatorFilters,
                updateOperatorFilter,
                resetOperatorFilters,
                saveLastViewedFilters,
            }}
        >
            {children}
        </PreferencesContext.Provider>
    );
};

export const debugForceCreatePreferences = async (userId) => {
    if (!userId) return false;
    try {
        const {error} = await supabase
            .from('users_preferences')
            .insert([{
                user_id: userId,
                navbar_minimized: false,
                theme_mode: 'light',
                accent_color: 'blue',
            }]);
        if (error) throw error;
        return true;
    } catch (error) {
        return false;
    }
};

export const usePreferences = () => {
    const context = useContext(PreferencesContext);
    if (!context) {
        throw new Error('usePreferences must be used within a PreferencesProvider');
    }
    return context;
};
