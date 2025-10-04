import React from 'react'
import './styles/TopSection.css'

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
    sticky = true,
    flush = true,
    tightTop = false,
    flushTop,
    showCoverOverlay: _showCoverOverlay
}) {
    const safePlants = Array.isArray(plants) ? plants : []
    const safeStatusOptions = Array.isArray(statusOptions) ? statusOptions : []
    const safeListLabels = Array.isArray(listHeaderLabels) ? listHeaderLabels : []
    const effectiveFlush = typeof flushTop === 'boolean' ? flushTop : flush
    const classes = ['top-section']
    if (sticky) classes.push('top-section-sticky-header')
    if (effectiveFlush) classes.push('top-section-flush')
    if (tightTop) classes.push('top-section-tight')
    const className = classes.join(' ')
    return (
        <div className={className} ref={forwardedRef} data-section="top" aria-label="Page controls">
            <div className="top-section-inner">
                <div className="top-row primary-row">
                    <h1 className="top-title">{title}</h1>
                    <div className="action-cluster" role="group" aria-label="Primary actions">
                        {onToggleSidebar && (
                            <button className="action-button subtle" onClick={onToggleSidebar} type="button" aria-label="Toggle menu">
                                <i className="fas fa-bars" aria-hidden="true"></i>
                                <span className="action-label">Menu</span>
                            </button>
                        )}
                        {onAddClick && (
                            <button className="action-button primary add-main" onClick={onAddClick} type="button">
                                <i className="fas fa-plus" aria-hidden="true"></i>
                                <span className="action-label">{addButtonLabel}</span>
                            </button>
                        )}
                    </div>
                </div>
                <div className="top-row controls-row" role="region" aria-label="Search and filters">
                    <div className="search-bar" role="search">
                        <input
                            type="text"
                            className="ios-search-input"
                            placeholder={searchPlaceholder}
                            value={searchInput || ''}
                            onChange={e => onSearchInputChange && onSearchInputChange(e.target.value)}
                            aria-label="Search"
                        />
                        {searchInput && onClearSearch && (
                            <button className="clear" onClick={onClearSearch} type="button" aria-label="Clear search">
                                <i className="fas fa-times" aria-hidden="true"></i>
                            </button>
                        )}
                    </div>
                    <div className="filters" role="group" aria-label="Filters and view options">
                        <div className="view-toggle-icons" role="group" aria-label="View mode">
                            <button
                                className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
                                onClick={() => onViewModeChange && onViewModeChange('list')}
                                aria-label="List view"
                                aria-pressed={viewMode === 'list'}
                                type="button"
                            >
                                <i className="fas fa-list" aria-hidden="true"></i>
                            </button>
                            <button
                                className={`view-toggle-btn${viewMode === 'grid' ? ' active' : ''}`}
                                onClick={() => onViewModeChange && onViewModeChange('grid')}
                                aria-label="Grid view"
                                aria-pressed={viewMode === 'grid'}
                                type="button"
                            >
                                <i className="fas fa-th-large" aria-hidden="true"></i>
                            </button>
                        </div>
                        <div className="filter-wrapper">
                            <select
                                className="ios-select"
                                value={selectedPlant || ''}
                                onChange={e => onSelectedPlantChange && onSelectedPlantChange(e.target.value)}
                                aria-label="Filter by plant"
                            >
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
                                <select
                                    className="ios-select"
                                    value={statusFilter || ''}
                                    onChange={e => onStatusFilterChange && onStatusFilterChange(e.target.value)}
                                    aria-label="Status filter"
                                >
                                    {safeStatusOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {Array.isArray(freightOptions) && freightOptions.length > 0 && (
                            <div className="filter-wrapper freight-filter">
                                <select
                                    className="ios-select freight-select"
                                    value={freightFilter || ''}
                                    onChange={e => onFreightFilterChange && onFreightFilterChange(e.target.value)}
                                    aria-label="Freight filter"
                                >
                                    {freightOptions.map(opt => (
                                        <option key={opt} value={opt === 'All Freight' ? '' : opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {showReset && onReset && (
                            <button className="filter-reset-button" onClick={onReset} type="button" aria-label="Reset filters">
                                <i className="fas fa-undo" aria-hidden="true"></i>
                            </button>
                        )}
                    </div>
                </div>
                {showListHeader && safeListLabels.length > 0 && (
                    <div className={`list-headers header-row ${listHeaderClassName || ''}`} role="row" aria-label="List headers">
                        {safeListLabels.map(l => <div key={l} role="columnheader">{l}</div>)}
                    </div>
                )}
            </div>
        </div>
    )
}

export default TopSection
