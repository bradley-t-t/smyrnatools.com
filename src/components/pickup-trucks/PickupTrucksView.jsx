import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import '../../styles/FilterStyles.css'
import '../mixers/styles/MixersView.css'
import './styles/PickupTrucksView.css'
import LoadingScreen from '../common/LoadingScreen'
import PickupTrucksCard from './PickupTrucksCard'
import PickupTrucksDetailView from './PickupTrucksDetailView'
import PickupTrucksAddView from './PickupTrucksAddView'
import {PickupTruckService} from '../../services/PickupTruckService'
import AsyncUtility from '../../utils/AsyncUtility'
import {PlantService} from '../../services/PlantService'
import FleetUtility from '../../utils/FleetUtility'
import {usePreferences} from '../../app/context/PreferencesContext'
import {RegionService} from '../../services/RegionService'
import {UserService} from '../../services/UserService'
import TopSection from '../sections/TopSection'

function PickupTrucksView({title = 'Pickup Trucks'}) {
    const {preferences} = usePreferences()
    const headerRef = useRef(null)
    const [pickups, setPickups] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [viewMode, setViewMode] = useState(localStorage.getItem('pickup_trucks_last_view_mode') || 'grid')
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [selectedId, setSelectedId] = useState(null)
    const [plants, setPlants] = useState([])
    const [selectedPlant, setSelectedPlant] = useState('')
    const [statusFilter, setStatusFilter] = useState('All Statuses')
    const [regionPlantCodes, setRegionPlantCodes] = useState(new Set())
    const statusOptions = ['All Statuses', 'Active', 'Stationary', 'Spare', 'In Shop', 'Retired', 'Sold', 'Over 300k Miles']

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

    useEffect(() => { fetchAllPickups() }, [fetchAllPickups])

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

    useEffect(() => {
        let cancelled = false
        async function loadAllowedPlants() {
            let regionCode = preferences.selectedRegion?.code || ''
            try {
                if (!regionCode) {
                    const user = await UserService.getCurrentUser()
                    const uid = user?.id || ''
                    if (uid) {
                        const profilePlant = await UserService.getUserPlant(uid)
                        const plantCode = typeof profilePlant === 'string' ? profilePlant : (profilePlant?.plant_code || profilePlant?.plantCode || '')
                        if (plantCode) {
                            const regions = await RegionService.fetchRegionsByPlantCode(plantCode)
                            const r = Array.isArray(regions) && regions.length ? regions[0] : null
                            regionCode = r ? (r.regionCode || r.region_code || '') : ''
                        }
                    }
                }
                if (!regionCode) {
                    if (!cancelled) setRegionPlantCodes(new Set())
                    return
                }
                const regionPlants = await RegionService.fetchRegionPlants(regionCode)
                if (cancelled) return
                const codes = new Set(regionPlants.map(p => String(p.plantCode || p.plant_code || '').trim().toUpperCase()).filter(Boolean))
                setRegionPlantCodes(codes)
                const sel = String(selectedPlant || '').trim().toUpperCase()
                if (sel && !codes.has(sel)) setSelectedPlant('')
            } catch {
                if (!cancelled) setRegionPlantCodes(new Set())
            }
        }
        loadAllowedPlants()
        return () => { cancelled = true }
    }, [preferences.selectedRegion?.code, selectedPlant])

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

    const debouncedSetSearchText = useCallback(AsyncUtility.debounce((value) => { setSearchText(value) }, 300), [])

    const filtered = useMemo(() => {
        const q = searchText.trim().toLowerCase()
        const list = pickups.filter(p => {
            const vin = String(p.vin || '').toLowerCase()
            const make = String(p.make || '').toLowerCase()
            const model = String(p.model || '').toLowerCase()
            const yearVal = String(p.year || '').toLowerCase()
            const assignedVal = String(p.assigned || '').toLowerCase()
            const matchesSearch = !q || vin.includes(q) || make.includes(q) || model.includes(q) || yearVal.includes(q) || assignedVal.includes(q)
            const matchesPlant = !selectedPlant || String(p.assignedPlant || '').trim().toUpperCase() === selectedPlant.toUpperCase()
            const matchesStatus = !statusFilter || statusFilter === 'All Statuses' || (statusFilter === 'Over 300k Miles' ? (typeof p.mileage === 'number' && p.mileage > 300000) : String(p.status || '').trim() === statusFilter)
            const inRegion = regionPlantCodes.size === 0 || regionPlantCodes.has(String(p.assignedPlant || '').trim().toUpperCase())
            return matchesSearch && matchesPlant && matchesStatus && inRegion
        })
        return list.sort((a, b) => FleetUtility.compareByStatusThenNumber(a, b, 'status', 'assigned'))
    }, [pickups, searchText, selectedPlant, statusFilter, regionPlantCodes])

    const duplicateVINs = useMemo(() => {
        const counts = new Map()
        for (const p of pickups) {
            const key = String(p.vin || '').trim().toUpperCase().replace(/\s+/g, '')
            if (!key) continue
            counts.set(key, (counts.get(key) || 0) + 1)
        }
        const dups = new Set()
        counts.forEach((count, key) => { if (count > 1) dups.add(key) })
        return dups
    }, [pickups])

    const duplicateAssigned = useMemo(() => {
        const counts = new Map()
        for (const p of pickups) {
            const key = String(p.assigned || '').trim().toLowerCase()
            if (!key) continue
            counts.set(key, (counts.get(key) || 0) + 1)
        }
        const dups = new Set()
        counts.forEach((count, key) => { if (count > 1) dups.add(key) })
        return dups
    }, [pickups])

    const content = useMemo(() => {
        if (isLoading) return <div className="loading-container"><LoadingScreen message="Loading pickup trucks..." inline={true}/></div>
        if (filtered.length === 0) return (
            <div className="no-results-container">
                <div className="no-results-icon"><i className="fas fa-truck-pickup"></i></div>
                <h3>No Pickup Trucks Found</h3>
                <p>{searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses') ? 'No pickups match your search criteria.' : 'There are no pickup trucks in the system yet.'}</p>
                <button className="primary-button" onClick={() => setShowAddSheet(true)}>Add Pickup Truck</button>
            </div>
        )
        if (viewMode === 'grid') return (
            <div className={`mixers-grid ${searchText ? 'search-results' : ''}`}>
                {filtered.map(p => {
                    const vinKey = String(p.vin || '').trim().toUpperCase().replace(/\s+/g, '')
                    const assignedKey = String(p.assigned || '').trim().toLowerCase()
                    const isHighMileage = typeof p.mileage === 'number' && p.mileage > 300000
                    return (
                        <PickupTrucksCard
                            key={p.id}
                            pickup={p}
                            onSelect={() => setSelectedId(p.id)}
                            isDuplicateVin={duplicateVINs.has(vinKey)}
                            isDuplicateAssigned={duplicateAssigned.has(assignedKey)}
                            isHighMileage={isHighMileage}
                        />
                    )
                })}
            </div>
        )
        return (
            <div className="mixers-list-table-container">
                <table className="mixers-list-table pickup-trucks-columns">
                    <colgroup><col/><col/><col/><col/><col/><col/><col/></colgroup>
                    <tbody>
                    {filtered.map(p => {
                        const statusClass = String(p.status || '').toLowerCase().replace(/\s+/g, '-')
                        const vinKey = String(p.vin || '').trim().toUpperCase().replace(/\s+/g, '')
                        const assignedKey = String(p.assigned || '').trim().toLowerCase()
                        return (
                            <tr key={p.id} className="clickable-row" onClick={() => setSelectedId(p.id)}>
                                <td>{p.assignedPlant || '\u2014'}</td>
                                <td><span className={`item-status-dot ${statusClass}`}></span>{p.status || '\u2014'}</td>
                                <td>{p.assigned ? <span className="cell-inline"><span>{p.assigned}</span>{duplicateAssigned.has(assignedKey) && <span className="warning-badge" title="Assigned to multiple pickups"><i className="fas fa-exclamation-triangle"></i></span>}</span> : '\u2014'}</td>
                                <td>{p.year || '\u2014'}</td>
                                <td>{`${p.make || ''} ${p.model || ''}`.trim() || '\u2014'}</td>
                                <td>{p.vin ? <span className="cell-inline"><span>{p.vin}</span>{duplicateVINs.has(vinKey) && <span className="warning-badge" title="Duplicate VIN"><i className="fas fa-exclamation-triangle"></i></span>}</span> : '\u2014'}</td>
                                <td>{typeof p.mileage === 'number' ? <span className="mileage-cell"><span>{p.mileage.toLocaleString()}</span>{p.mileage > 300000 && <span className="warning-badge" title="High mileage"><i className="fas fa-exclamation-triangle"></i></span>}</span> : '\u2014'}</td>
                            </tr>
                        )
                    })}
                    </tbody>
                </table>
            </div>
        )
    }, [isLoading, filtered, viewMode, searchText, selectedPlant, statusFilter, duplicateVINs, duplicateAssigned])

    const showReset = (searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses'))

    return (
        <div className={`dashboard-container pickup-trucks-view${selectedId ? ' detail-open' : ''}`}>
            {selectedId ? (
                <PickupTrucksDetailView pickupId={selectedId} onClose={() => { setSelectedId(null); fetchAllPickups() }}/>
            ) : (
                <>
                    <TopSection
                        title={title}
                        addButtonLabel="Add Pickup"
                        onAddClick={() => setShowAddSheet(true)}
                        searchInput={searchInput}
                        onSearchInputChange={v => { setSearchInput(v); debouncedSetSearchText(v) }}
                        onClearSearch={() => { setSearchInput(''); debouncedSetSearchText('') }}
                        searchPlaceholder="Search by VIN, make, model, year, or name..."
                        viewMode={viewMode}
                        onViewModeChange={handleViewModeChange}
                        plants={plants}
                        regionPlantCodes={regionPlantCodes}
                        selectedPlant={selectedPlant}
                        onSelectedPlantChange={v => setSelectedPlant(v)}
                        statusFilter={statusFilter}
                        statusOptions={statusOptions}
                        onStatusFilterChange={v => setStatusFilter(v)}
                        showReset={showReset}
                        onReset={() => { setSearchText(''); setSearchInput(''); setSelectedPlant(''); setStatusFilter('All Statuses') }}
                        listHeaderLabels={['Plant','Status','Assigned','Year','Make & Model','VIN','Mileage']}
                        showListHeader={viewMode === 'list'}
                        listHeaderClassName="mixers-list-header-row pickup-trucks-columns"
                        forwardedRef={headerRef}
                    />
                    <div className="content-container">{content}</div>
                    {showAddSheet && <PickupTrucksAddView onClose={() => setShowAddSheet(false)} onAdded={newItem => setPickups([...pickups, newItem])}/>}
                </>
            )}
        </div>
    )
}

export default PickupTrucksView