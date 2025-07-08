import React, { createContext, useContext, useState, useEffect } from 'react';

// Create the context
const MixerFilterContext = createContext(null);

// Export the provider component
export const MixerFilterProvider = ({ children }) => {
  // State for the filters
  const [filters, setFilters] = useState({
    searchText: '',
    selectedPlant: '',
    statusFilter: ''
  });

  // Method to update a single filter
  const updateFilter = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  // Method to reset all filters
  const resetFilters = () => {
    setFilters({
      searchText: '',
      selectedPlant: '',
      statusFilter: ''
    });
  };

  // Debug log when filters change
  useEffect(() => {
    console.log('Filter context updated:', filters);
  }, [filters]);

  // Provide the filter state and methods to update it
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

// Custom hook to use the filter context
export const useMixerFilters = () => {
  const context = useContext(MixerFilterContext);

  if (context === null) {
    throw new Error('useMixerFilters must be used within a MixerFilterProvider');
  }

  return context;
};
