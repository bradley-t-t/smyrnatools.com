import React, {createContext, useContext, useEffect, useState} from 'react';

const MixerFilterContext = createContext(null);

export const MixerFilterProvider = ({children}) => {
    const [filters, setFilters] = useState({
        searchText: '',
        selectedPlant: '',
        statusFilter: ''
    });

    const updateFilter = (filterName, value) => {
        setFilters(prev => ({
            ...prev,
            [filterName]: value
        }));
    };

    const resetFilters = () => {
        setFilters({
            searchText: '',
            selectedPlant: '',
            statusFilter: ''
        });
    };

    useEffect(() => {
    }, [filters]);

    return (
        <MixerFilterContext.Provider value={{
            filters,
            updateFilter,
            resetFilters,
            setFilters
        }}>
            {children}
        </MixerFilterContext.Provider>
    );
};

export const useMixerFilters = () => {
    const context = useContext(MixerFilterContext);

    if (context === null) {
        throw new Error('useMixerFilters must be used within a MixerFilterProvider');
    }

    return context;
};