import React from 'react'
import './TopSection.css'

function TopSection({
    title,
    onToggleSidebar,
    addButtonLabel,
    onAddClick,
    searchInput,
    onSearchInputChange,
    onClearSearch,
    searchPlaceholder,
    viewMode,
    onViewModeChange,
    plants,
    regionPlantCodes,
    selectedPlant,
    onSelectedPlantChange,
    statusFilter,
    statusOptions,
    onStatusFilterChange,
    freightFilter,
    freightOptions,
    onFreightFilterChange,
    showReset,
    onReset,
    listHeaderLabels,
    showListHeader,
    listHeaderClassName,
    forwardedRef,
    sticky = true
}) {
    const safePlants = Array.isArray(plants) ? plants : []
    const safeStatusOptions = Array.isArray(statusOptions) ? statusOptions : []
    const safeListLabels = Array.isArray(listHeaderLabels) ? listHeaderLabels : []
    const wrapperClass = sticky ? 'top-section-sticky-header' : ''
    return (
        <div className={wrapperClass} ref={forwardedRef}>
            <div className="dashboard-header">
                <h1 style={{color: 'var(--text-primary)'}}>{title}</h1>
                <div className="dashboard-actions">
                    {onToggleSidebar && (
                        <button className="action-button" onClick={onToggleSidebar}>
                            <i className="fas fa-bars"></i> Menu
                        </button>
                    )}
                    {onAddClick && (
                        <button className="action-button primary rectangular-button" onClick={onAddClick} style={{height: '44px', lineHeight: '1'}}>
                            <i className="fas fa-plus" style={{marginRight: '8px'}}></i> {addButtonLabel}
                        </button>
                    )}
                </div>
            </div>
            <div className="search-filters">
                <div className="search-bar">
                    <input type="text" className="ios-search-input" placeholder={searchPlaceholder} value={searchInput || ''} onChange={e => onSearchInputChange && onSearchInputChange(e.target.value)}/>
                    {searchInput && onClearSearch && (
                        <button className="clear" onClick={onClearSearch}>
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>
                <div className="filters">
                    <div className="view-toggle-icons">
                        <button className={`view-toggle-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => onViewModeChange && onViewModeChange('grid')} aria-label="Grid view" type="button">
                            <i className="fas fa-th-large"></i>
                        </button>
                        <button className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => onViewModeChange && onViewModeChange('list')} aria-label="List view" type="button">
                            <i className="fas fa-list"></i>
                        </button>
                    </div>
                    <div className="filter-wrapper">
                        <select className="ios-select" value={selectedPlant || ''} onChange={e => onSelectedPlantChange && onSelectedPlantChange(e.target.value)} aria-label="Filter by plant">
                            <option value="">All Plants</option>
                            {safePlants
                                .filter(p => {
                                    const code = String(p.plantCode || p.plant_code || '').trim().toUpperCase()
                                    return regionPlantCodes && regionPlantCodes.size > 0 ? regionPlantCodes.has(code) : true
                                })
                                .sort((a, b) => parseInt((a.plantCode || a.plant_code || '').replace(/\D/g, '') || '0') - parseInt((b.plantCode || b.plant_code || '').replace(/\D/g, '') || '0'))
                                .map(plant => (
                                    <option key={plant.plantCode || plant.plant_code} value={plant.plantCode || plant.plant_code}>
                                        ({plant.plantCode || plant.plant_code}) {plant.plantName || plant.plant_name}
                                    </option>
                                ))}
                        </select>
                    </div>
                    {safeStatusOptions.length > 0 && (
                        <div className="filter-wrapper">
                            <select className="ios-select" value={statusFilter || ''} onChange={e => onStatusFilterChange && onStatusFilterChange(e.target.value)}>
                                {safeStatusOptions.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {Array.isArray(freightOptions) && freightOptions.length > 0 && (
                        <div className="filter-wrapper freight-filter">
                            <select className="ios-select freight-select" value={freightFilter || ''} onChange={e => onFreightFilterChange && onFreightFilterChange(e.target.value)} aria-label="Filter by freight" style={{width: 110, minWidth: 110}}>
                                {freightOptions.map(opt => (
                                    <option key={opt} value={opt === 'All Freight' ? '' : opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {showReset && onReset && (
                        <button className="filter-reset-button" onClick={onReset}>
                            <i className="fas fa-undo"></i>
                        </button>
                    )}
                </div>
            </div>
            {showListHeader && safeListLabels.length > 0 && (
                <div className={listHeaderClassName}>
                    {safeListLabels.map(l => <div key={l}>{l}</div>)}
                </div>
            )}
        </div>
    )
}

export default TopSection
