import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import '../../styles/FilterStyles.css'
import '../mixers/styles/MixersView.css'
import LoadingScreen from '../common/LoadingScreen'
import PickupTrucksCard from './PickupTrucksCard'
import PickupTrucksDetailView from './PickupTrucksDetailView'
import PickupTrucksAddView from './PickupTrucksAddView'
import PickupTrucksOverview from './PickupTrucksOverview'
import {PickupTruckService} from '../../services/PickupTruckService'
import AsyncUtility from '../../utils/AsyncUtility'
import {PlantService} from '../../services/PlantService'
import FleetUtility from '../../utils/FleetUtility'

function PickupTrucksView({title = 'Pickup Trucks'}) {
    const headerRef = useRef(null)
    const [pickups, setPickups] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [viewMode, setViewMode] = useState(localStorage.getItem('pickup_trucks_last_view_mode') || 'grid')
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [showOverview, setShowOverview] = useState(false)
    const [selectedId, setSelectedId] = useState(null)
    const [plants, setPlants] = useState([])
    const [selectedPlant, setSelectedPlant] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const fetchAllPickups = useCallback(async () => {
        setIsLoading(true)
        try {
            const data = await PickupTruckService.fetchAll()
            setPickups(Array.isArray(data) ? data : [])
        } catch {
            setPickups([])
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchAllPickups()
    }, [fetchAllPickups])

    useEffect(() => {
        async function loadPlants() {
            try {
                const data = await PlantService.fetchPlants()
                setPlants(Array.isArray(data) ? data : [])
            } catch {
                setPlants([])
            }
        }
        loadPlants()
    }, [])

    function handleViewModeChange(mode) {
        if (viewMode === mode) {
            setViewMode(null)
            localStorage.removeItem('pickup_trucks_last_view_mode')
        } else {
            setViewMode(mode)
            localStorage.setItem('pickup_trucks_last_view_mode', mode)
        }
    }

    useEffect(() => {
        function updateStickyCoverHeight() {
            const el = headerRef.current
            const h = el ? Math.ceil(el.getBoundingClientRect().height) : 0
            const root = document.querySelector('.dashboard-container.pickup-trucks-view')
            if (root && h) root.style.setProperty('--sticky-cover-height', h + 'px')
        }
        updateStickyCoverHeight()
        window.addEventListener('resize', updateStickyCoverHeight)
        return () => window.removeEventListener('resize', updateStickyCoverHeight)
    }, [viewMode, searchText, selectedPlant, statusFilter])

    const debouncedSetSearchText = useCallback(AsyncUtility.debounce((value) => {
        setSearchText(value)
    }, 300), [])

    const filtered = useMemo(() => {
        const q = searchText.trim().toLowerCase()
        const list = pickups.filter(p => {
            const vin = String(p.vin || '').toLowerCase()
            const make = String(p.make || '').toLowerCase()
            const model = String(p.model || '').toLowerCase()
            const year = String(p.year || '').toLowerCase()
            const assigned = String(p.assigned || '').toLowerCase()
            const matchesSearch = !q || vin.includes(q) || make.includes(q) || model.includes(q) || year.includes(q) || assigned.includes(q)
            const matchesPlant = !selectedPlant || String(p.assignedPlant || '').trim() === selectedPlant
            const matchesStatus = !statusFilter || String(p.status || '').trim() === statusFilter
            return matchesSearch && matchesPlant && matchesStatus
        })
        return list.sort((a, b) => FleetUtility.compareByStatusThenNumber(a, b, 'status', 'assigned'))
    }, [pickups, searchText, selectedPlant, statusFilter])

    const content = useMemo(() => {
        if (isLoading) {
            return (
                <div className="loading-container">
                    <LoadingScreen message="Loading pickup trucks..." inline={true}/>
                </div>
            )
        }
        if (filtered.length === 0) {
            return (
                <div className="no-results-container">
                    <div className="no-results-icon">
                        <i className="fas fa-truck-pickup"></i>
                    </div>
                    <h3>No Pickup Trucks Found</h3>
                    <p>{searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses') ? 'No pickups match your search criteria.' : 'There are no pickup trucks in the system yet.'}</p>
                    <button className="primary-button" onClick={() => setShowAddSheet(true)}>Add Pickup Truck</button>
                </div>
            )
        }
        if (viewMode === 'grid') {
            return (
                <div className={`mixers-grid ${searchText ? 'search-results' : ''}`}>
                    {filtered.map(p => (
                        <PickupTrucksCard key={p.id} pickup={p} onSelect={() => setSelectedId(p.id)}/>
                    ))}
                </div>
            )
        }
        return (
            <div className="mixers-list-table-container">
                <table className="mixers-list-table">
                    <colgroup>
                        <col style={{width: '14%'}}/>
                        <col style={{width: '14%'}}/>
                        <col style={{width: '20%'}}/>
                        <col style={{width: '10%'}}/>
                        <col style={{width: '14%'}}/>
                        <col style={{width: '14%'}}/>
                        <col style={{width: '14%'}}/>
                    </colgroup>
                    <tbody>
                    {filtered.map(p => (
                        <tr key={p.id} style={{cursor: 'pointer'}} onClick={() => setSelectedId(p.id)}>
                            <td>{p.assignedPlant || '—'}</td>
                            <td>{p.status || '—'}</td>
                            <td>{p.assigned || '—'}</td>
                            <td>{p.year || '—'}</td>
                            <td>{`${p.make || ''} ${p.model || ''}`.trim() || '—'}</td>
                            <td>{p.vin || '—'}</td>
                            <td>{typeof p.mileage === 'number' ? p.mileage.toLocaleString() : '—'}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        )
    }, [isLoading, filtered, viewMode, searchText, selectedPlant, statusFilter])

    return (
        <div className={`dashboard-container pickup-trucks-view${selectedId ? ' detail-open' : ''}`}>
            {selectedId ? (
                <PickupTrucksDetailView pickupId={selectedId} onClose={() => { setSelectedId(null); fetchAllPickups() }}/>
            ) : (
                <>
                    <div className="mixers-sticky-header" ref={headerRef}>
                        <div className="dashboard-header">
                            <h1>{title}</h1>
                            <div className="dashboard-actions">
                                <button
                                    className="action-button primary rectangular-button"
                                    onClick={() => setShowAddSheet(true)}
                                    style={{height: '44px', lineHeight: '1'}}
                                >
                                    <i className="fas fa-plus" style={{marginRight: '8px'}}></i> Add Pickup
                                </button>
                            </div>
                        </div>
                        <div className="search-filters">
                            <div className="search-bar">
                                <input
                                    type="text"
                                    className="ios-search-input"
                                    placeholder="Search by VIN, make, model, year, or name..."
                                    value={searchInput}
                                    onChange={e => { setSearchInput(e.target.value); debouncedSetSearchText(e.target.value) }}
                                />
                                {searchInput && (
                                    <button className="clear" onClick={() => { setSearchInput(''); debouncedSetSearchText('') }}>
                                        <i className="fas fa-times"></i>
                                    </button>
                                )}
                            </div>
                            <div className="filters">
                                <div className="view-toggle-icons">
                                    <button
                                        className={`view-toggle-btn${viewMode === 'grid' ? ' active' : ''}`}
                                        onClick={() => handleViewModeChange('grid')}
                                        aria-label="Grid view"
                                        type="button"
                                    >
                                        <i className="fas fa-th-large"></i>
                                    </button>
                                    <button
                                        className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
                                        onClick={() => handleViewModeChange('list')}
                                        aria-label="List view"
                                        type="button"
                                    >
                                        <i className="fas fa-list"></i>
                                    </button>
                                </div>
                                <div className="filter-wrapper">
                                    <select
                                        className="ios-select"
                                        value={selectedPlant}
                                        onChange={e => setSelectedPlant(e.target.value)}
                                        aria-label="Filter by plant"
                                    >
                                        <option value="">All Plants</option>
                                        {plants.sort((a, b) => String(a.plantCode || '').localeCompare(String(b.plantCode || ''))).map(plant => (
                                            <option key={plant.plantCode || plant.plant_code} value={plant.plantCode || plant.plant_code}>
                                                {(plant.plantCode || plant.plant_code) + ' ' + (plant.plantName || plant.plant_name)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="filter-wrapper">
                                    <select
                                        className="ios-select"
                                        value={statusFilter}
                                        onChange={e => setStatusFilter(e.target.value)}
                                    >
                                        {['All Statuses', 'Active', 'Spare', 'In Shop', 'Retired'].map(s => (
                                            <option key={s} value={s === 'All Statuses' ? '' : s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                {(searchText || selectedPlant || statusFilter) && (
                                    <button className="filter-reset-button" onClick={() => { setSearchText(''); setSearchInput(''); setSelectedPlant(''); setStatusFilter('') }}>
                                        <i className="fas fa-undo"></i>
                                    </button>
                                )}
                                <button className="ios-button" onClick={() => setShowOverview(true)}>
                                    <i className="fas fa-chart-bar"></i> Overview
                                </button>
                            </div>
                        </div>
                        {viewMode !== 'grid' && (
                            <div className="mixers-list-header-row" style={{gridTemplateColumns: '14% 14% 20% 10% 14% 14% 14%'}}>
                                <div>Plant</div>
                                <div>Status</div>
                                <div>Assigned</div>
                                <div>Year</div>
                                <div>Make & Model</div>
                                <div>VIN</div>
                                <div>Mileage</div>
                            </div>
                        )}
                    </div>
                    <div className="content-container">{content}</div>
                    {showAddSheet && (
                        <PickupTrucksAddView
                            onClose={() => setShowAddSheet(false)}
                            onAdded={newItem => setPickups([...pickups, newItem])}
                        />
                    )}
                    {showOverview && (
                        <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
                            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h2>Pickup Trucks Overview</h2>
                                    <button className="close-button" onClick={() => setShowOverview(false)}>
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                                <div className="modal-body">
                                    <PickupTrucksOverview pickups={filtered}/>
                                </div>
                                <div className="modal-footer">
                                    <button className="primary-button" onClick={() => setShowOverview(false)}>Close</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default PickupTrucksView
