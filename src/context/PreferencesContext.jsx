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

    useEffect(() => {
        localStorage.setItem('userPreferences', JSON.stringify(preferences));
    }, [preferences]);

    const updateOperatorFilter = (key, value) => {
        setPreferences(prev => ({
            ...prev,
            operatorFilters: {
                ...prev.operatorFilters,
                [key]: value
            }
        }));
    };

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

    const updateManagerFilter = (key, value) => {
        setPreferences(prev => ({
            ...prev,
            managerFilters: {
                ...prev.managerFilters,
                [key]: value
            }
        }));
    };

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