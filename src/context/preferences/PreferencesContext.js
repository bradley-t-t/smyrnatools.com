import React, {createContext, useContext, useEffect, useState} from 'react';
import {logSupabaseError, supabase} from '../../core/clients/SupabaseClient';

// Create context
const PreferencesContext = createContext();

// Default preferences
const defaultPreferences = {
    navbarMinimized: false,
    themeMode: 'light',
    accentColor: 'red',
    mixerFilters: {
        searchText: '',
        selectedPlant: '',
        statusFilter: ''
    },
    operatorFilters: {
        searchText: '',
        selectedPlant: '',
        statusFilter: '',
        trainerFilter: ''
    },
    lastViewedFilters: null
};

export const PreferencesProvider = ({children}) => {
    const [preferences, setPreferences] = useState(defaultPreferences);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);

    // Load preferences from localStorage and apply theme on mount
    useEffect(() => {
        const applyThemeFromStorage = () => {
            try {
                const savedPrefs = localStorage.getItem('userPreferences');
                if (savedPrefs) {
                    const parsedPrefs = JSON.parse(savedPrefs);
                    setPreferences(parsedPrefs);
                    document.documentElement.classList.toggle('dark-mode', parsedPrefs.themeMode === 'dark');
                    document.documentElement.classList.remove('accent-blue', 'accent-red');
                    document.documentElement.classList.add(`accent-${parsedPrefs.accentColor}`);
                }
            } catch (error) {
                console.error('Error loading preferences from localStorage:', error);
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

    // Handle auth state and fetch preferences
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
                console.error('Error initializing user:', error);
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
                document.documentElement.classList.remove('dark-mode', 'accent-blue', 'accent-red');
            }
        });

        return () => authListener.subscription?.unsubscribe();
    }, []);

    // Apply theme and save preferences
    useEffect(() => {
        document.documentElement.classList.toggle('dark-mode', preferences.themeMode === 'dark');
        document.documentElement.classList.remove('accent-blue', 'accent-red');
        document.documentElement.classList.add(`accent-${preferences.accentColor}`);
        try {
            localStorage.setItem('userPreferences', JSON.stringify(preferences));
        } catch (error) {
            console.error('Error saving preferences to localStorage:', error);
        }
    }, [preferences]);

    // Fetch user preferences from database
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

    // Set preferences from database data
    const setPreferencesFromData = (data) => {
        const newPreferences = {
            navbarMinimized: data.navbar_minimized,
            themeMode: data.theme_mode,
            accentColor: data.accent_color,
            mixerFilters: data.mixer_filters || {
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
            lastViewedFilters: data.last_viewed_filters
        };
        setPreferences(newPreferences);
        try {
            localStorage.setItem('userPreferences', JSON.stringify(newPreferences));
        } catch (error) {
            console.error('Error saving preferences to localStorage:', error);
        }
    };


    // Update operator filters and save to database
    const updateOperatorFilters = async (filters) => {
        try {
            setPreferences(prev => {
                const newPrefs = {...prev, operatorFilters: filters};
                localStorage.setItem('userPreferences', JSON.stringify(newPrefs));
                return newPrefs;
            });

            // If user is authenticated, save to database
            const {data} = await supabase.auth.getUser();
            if (data?.user?.id) {
                // Check if user preferences exist
                const {data: existingPrefs} = await supabase
                    .from('users_preferences')
                    .select('id')
                    .eq('user_id', data.user.id);

                if (!existingPrefs || existingPrefs.length === 0) {
                    // Create user preferences if they don't exist
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
                    // Update existing preferences
                    await supabase
                        .from('users_preferences')
                        .update({
                            operator_filters: filters,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', data.user.id);
                }

                console.log('Saved operator filters to database:', filters);
            }
        } catch (error) {
            console.error('Error updating operator filters:', error);
        }
    };

    // Update mixer filters and save to database
    const updateMixerFilters = async (filters) => {
        try {
            setPreferences(prev => {
                const newPrefs = {...prev, mixerFilters: filters};
                localStorage.setItem('userPreferences', JSON.stringify(newPrefs));
                return newPrefs;
            });

            // If user is authenticated, save to database
            const {data} = await supabase.auth.getUser();
            if (data?.user?.id) {
                // Check if user preferences exist
                const {data: existingPrefs} = await supabase
                    .from('users_preferences')
                    .select('id')
                    .eq('user_id', data.user.id);

                if (!existingPrefs || existingPrefs.length === 0) {
                    // Create user preferences if they don't exist
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
                    // Update existing preferences
                    await supabase
                        .from('users_preferences')
                        .update({
                            mixer_filters: filters,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', data.user.id);
                }

                console.log('Saved mixer filters to database:', filters);
            }
        } catch (error) {
            console.error('Error updating mixer filters:', error);
        }
    };

    // Save the current filters before navigating to detail view
    const saveLastViewedFilters = async () => {
        try {
            const lastFilters = {...preferences.mixerFilters};

            setPreferences(prev => {
                const newPrefs = {...prev, lastViewedFilters: lastFilters};
                localStorage.setItem('userPreferences', JSON.stringify(newPrefs));
                return newPrefs;
            });

            // If user is authenticated, save to database
            const {data} = await supabase.auth.getUser();
            if (data?.user?.id) {
                // Check if user preferences exist
                const {data: existingPrefs} = await supabase
                    .from('users_preferences')
                    .select('id')
                    .eq('user_id', data.user.id);

                if (!existingPrefs || existingPrefs.length === 0) {
                    // Create user preferences if they don't exist
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
                    // Update existing preferences
                    await supabase
                        .from('users_preferences')
                        .update({
                            last_viewed_filters: lastFilters,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', data.user.id);
                }

                console.log('Saved last viewed filters to database:', lastFilters);
            }
        } catch (error) {
            console.error('Error saving last viewed filters:', error);
        }
    };

    // Update a single operator filter field
    const updateOperatorFilter = async (key, value) => {
        try {
            const updatedFilters = {
                ...preferences.operatorFilters,
                [key]: value
            };

            await updateOperatorFilters(updatedFilters);
        } catch (error) {
            console.error(`Error updating operator filter ${key}:`, error);
        }
    };

    // Update a single mixer filter field
    const updateMixerFilter = async (key, value) => {
        try {
            const updatedFilters = {
                ...preferences.mixerFilters,
                [key]: value
            };

            await updateMixerFilters(updatedFilters);
        } catch (error) {
            console.error(`Error updating mixer filter ${key}:`, error);
        }
    };

    // Reset all operator filters
    const resetOperatorFilters = async () => {
        const emptyFilters = {
            searchText: '',
            selectedPlant: '',
            statusFilter: '',
            trainerFilter: ''
        };

        await updateOperatorFilters(emptyFilters);
    };

    // Reset all mixer filters
    const resetMixerFilters = async () => {
        const emptyFilters = {
            searchText: '',
            selectedPlant: '',
            statusFilter: ''
        };

        await updateMixerFilters(emptyFilters);
    };

    // Create default user preferences
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

    // Update preferences in database
    const updateDatabasePreferences = async (uid, prefsToUpdate) => {
        try {
            const updateData = {
                navbar_minimized: prefsToUpdate.navbarMinimized,
                theme_mode: prefsToUpdate.themeMode,
                accent_color: prefsToUpdate.accentColor,
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

    // Update preferences (for both single key-value and object updates)
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
            console.error('Error updating preferences:', error);
        }
    };

    // Toggle specific preference values
    const toggleNavbarMinimized = () => updatePreferences('navbarMinimized', !preferences.navbarMinimized);
    const setThemeMode = (mode) => (mode === 'light' || mode === 'dark') && updatePreferences('themeMode', mode);
    const setAccentColor = (color) => (color === 'red' || color === 'blue') && updatePreferences('accentColor', color);

    return (
        <PreferencesContext.Provider
            value={{
                preferences,
                loading,
                toggleNavbarMinimized,
                setThemeMode,
                setAccentColor,
                updatePreferences,
                updateMixerFilters,
                updateMixerFilter,
                resetMixerFilters,
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

// Debug function to force create preferences
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
        console.error('Error in debugForceCreatePreferences:', error);
        return false;
    }
};

// Custom hook to use preferences context
export const usePreferences = () => {
    const context = useContext(PreferencesContext);
    if (context === undefined) {
        throw new Error('usePreferences must be used within a PreferencesProvider');
    }
    return context;
};

export default PreferencesContext;