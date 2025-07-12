import React, {createContext, useContext, useState, useEffect} from "react";

const PreferencesContext = createContext();

export function usePreferences() {
    const context = useContext(PreferencesContext);
    if (!context) {
        throw new Error('usePreferences must be used within a PreferencesProvider');
    }
    return context;
}

export function PreferencesProvider({children}) {
    const [preferences, setPreferences] = useState(() => {
        const savedPrefs = localStorage.getItem('userPreferences');
        return savedPrefs ? JSON.parse(savedPrefs) : {
            accentColor: 'blue',
            operatorFilters: {
                searchText: '',
                selectedPlant: '',
                statusFilter: ''
            },
            managerFilters: {
                searchText: '',
                selectedPlant: '',
                roleFilter: ''
            },
        };
    });

    // Save preferences to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('userPreferences', JSON.stringify(preferences));
    }, [preferences]);

    // Update a specific operator filter
    const updateOperatorFilter = (key, value) => {
        setPreferences(prev => ({
            ...prev,
            operatorFilters: {
                ...prev.operatorFilters,
                [key]: value
            }
        }));
    };

    // Reset all operator filters
    const resetOperatorFilters = () => {
        setPreferences(prev => ({
            ...prev,
            operatorFilters: {
                searchText: '',
                selectedPlant: '',
                statusFilter: ''
            }
        }));
    };

    // Update a specific manager filter
    const updateManagerFilter = (key, value) => {
        setPreferences(prev => ({
            ...prev,
            managerFilters: {
                ...prev.managerFilters,
                [key]: value
            }
        }));
    };

    // Reset all manager filters
    const resetManagerFilters = () => {
        setPreferences(prev => ({
            ...prev,
            managerFilters: {
                searchText: '',
                selectedPlant: '',
                roleFilter: ''
            }
        }));
    };

    // Update theme color
    const updateAccentColor = (color) => {
        setPreferences(prev => ({
            ...prev,
            accentColor: color
        }));
    };

    const value = {
        preferences,
        updateOperatorFilter,
        resetOperatorFilters,
        updateManagerFilter,
        resetManagerFilters,
        updateAccentColor
    };

    return (
        <PreferencesContext.Provider value={value}>
            {children}
        </PreferencesContext.Provider>
    );
}

export default PreferencesProvider;
