import React, {useEffect, useRef, useState} from 'react'
import './styles/ListView.css'
import '../../styles/FilterStyles.css'
import {ListService} from '../../services/ListService'
import LoadingScreen from '../common/LoadingScreen'
import {UserService} from '../../services/UserService'
import {usePreferences} from '../../app/context/PreferencesContext'
import ListAddView from './ListAddView'
import ListDetailView from './ListDetailView'
import {supabase} from '../../services/DatabaseService'
import {RegionService} from '../../services/RegionService'

function ListView({title = 'Tasks List', onSelectItem, onStatusFilterChange}) {
    const {updateListFilter, resetListFilters, preferences} = usePreferences()
    const headerRef = useRef(null)
    const [plants, setPlants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState('')
    const [selectedPlant, setSelectedPlant] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [showDetailView, setShowDetailView] = useState(false)
    const [selectedItem, setSelectedItem] = useState(null)
    const [userPlantCode, setUserPlantCode] = useState(null)
    const [canBypassPlantRestriction, setCanBypassPlantRestriction] = useState(false)
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)

    useEffect(() => {
        async function fetchCurrentUser() {
            const user = await UserService.getCurrentUser()
            if (user) {
                const hasPermission = await UserService.hasPermission(user.id, 'list.bypass.plantrestriction')
                setCanBypassPlantRestriction(hasPermission)
                if (!hasPermission) {
                    const {data: profileData} = await supabase
                        .from('users_profiles')
                        .select('plant_code')
                        .eq('id', user.id)
                        .single()
                    if (profileData?.plant_code) setUserPlantCode(profileData.plant_code)
                }
            }
        }

        fetchCurrentUser()
    }, [])

    useEffect(() => {
        if (!canBypassPlantRestriction && userPlantCode) {
            setSelectedPlant(prev => prev || userPlantCode)
            updateListFilter?.('selectedPlant', userPlantCode)
        }
    }, [canBypassPlantRestriction, userPlantCode, updateListFilter])

    useEffect(() => {
        fetchAllData()
    }, [])

    useEffect(() => {
        let cancelled = false

        async function loadRegionPlants() {
            let regionCode = preferences?.selectedRegion?.code || ''
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
                    if (!cancelled) setRegionPlantCodes(null)
                    return
                }
                const regionPlants = await RegionService.fetchRegionPlants(regionCode)
                if (cancelled) return
                const codes = new Set(regionPlants.map(p => String(p.plantCode || p.plant_code || '').trim().toUpperCase()).filter(Boolean))
                setRegionPlantCodes(codes)
                const sel = String(selectedPlant || '').trim().toUpperCase()
                if (sel && !codes.has(sel)) {
                    setSelectedPlant('')
                    updateListFilter?.('selectedPlant', '')
                }
            } catch {
                if (!cancelled) setRegionPlantCodes(null)
            }
        }

        loadRegionPlants()
        return () => {
            cancelled = true
        }
    }, [preferences?.selectedRegion?.code])

    useEffect(() => {
        if (!selectedPlant) return
        if (!regionPlantCodes || regionPlantCodes.size === 0) return
        const sel = String(selectedPlant || '').trim().toUpperCase()
        if (sel && !regionPlantCodes.has(sel)) {
            setSelectedPlant('')
            updateListFilter?.('selectedPlant', '')
        }
    }, [regionPlantCodes, selectedPlant, updateListFilter])

    async function fetchAllData() {
        setIsLoading(true)
        try {
            await Promise.all([
                ListService.fetchListItems(),
                ListService.fetchPlants()
            ])
            setPlants(ListService.plants)
        } finally {
            setIsLoading(false)
        }
    }

    const baseFilteredItems = ListService.getFilteredItems({
        filterType: '',
        plantCode: selectedPlant,
        searchTerm: searchText,
        showCompleted: statusFilter === 'completed',
        statusFilter
    })

    const filteredItems = regionPlantCodes && regionPlantCodes.size > 0
        ? baseFilteredItems.filter(item => regionPlantCodes.has(String(item.plant_code || '').trim().toUpperCase()))
        : baseFilteredItems

    const getPlantName = plantCode => ListService.getPlantName(plantCode)
    const truncateText = (text, maxLength, byWords = false) => ListService.truncateText(text, maxLength, byWords)

    const handleSelectItem = item => {
        setSelectedItem(item)
        onSelectItem ? onSelectItem(item.id) : setShowDetailView(true)
    }


    const headerColumns = statusFilter === 'completed'
        ? ['38%', '14%', '12%', '12%', '16%', '8%']
        : ['44%', '16%', '14%', '16%', '10%']

    useEffect(() => {
        function updateStickyCoverHeight() {
            const el = headerRef.current
            const h = el ? Math.ceil(el.getBoundingClientRect().height) : 0
            const root = document.querySelector('.dashboard-container.list-view')
            if (root && h) root.style.setProperty('--sticky-cover-height', h + 'px')
        }

        updateStickyCoverHeight()
        window.addEventListener('resize', updateStickyCoverHeight)
        return () => window.removeEventListener('resize', updateStickyCoverHeight)
    }, [searchText, selectedPlant, statusFilter])

    return (
        <div className="dashboard-container list-view">
            <div className="list-sticky-header" ref={headerRef}>
                <div className="dashboard-header">
                    <h1>{title}</h1>
                    <div className="dashboard-actions">
                        <button
                            className="action-button primary rectangular-button"
                            onClick={() => setShowAddSheet(true)}
                            style={{height: '44px', lineHeight: '1'}}
                        >
                            <i className="fas fa-plus" style={{marginRight: '8px'}}></i> Add Item
                        </button>
                    </div>
                </div>
                <div className="search-filters">
                    <div className="search-bar">
                        <input
                            type="text"
                            className="ios-search-input"
                            placeholder="Search by description or comments..."
                            value={searchText}
                            onChange={e => {
                                setSearchText(e.target.value)
                                updateListFilter?.('searchText', e.target.value)
                            }}
                        />
                        {searchText && (
                            <button className="clear" onClick={() => {
                                setSearchText('')
                                updateListFilter?.('searchText', '')
                            }}>
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>
                    <div className="filters">
                        <div className="filter-wrapper">
                            <select
                                className="ios-select"
                                value={selectedPlant}
                                onChange={e => {
                                    setSelectedPlant(e.target.value)
                                    updateListFilter?.('selectedPlant', e.target.value)
                                }}
                                aria-label="Filter by plant"
                                style={{
                                    '--select-active-border': 'var(--accent)',
                                    '--select-focus-border': 'var(--accent)'
                                }}
                            >
                                <option value="" disabled={!canBypassPlantRestriction && userPlantCode}>All Plants
                                </option>
                                {plants.sort((a, b) => parseInt(a.plant_code?.replace(/\D/g, '') || '0') - parseInt(b.plant_code?.replace(/\D/g, '') || '0')).map(plant => (
                                    <option
                                        key={plant.plant_code}
                                        value={plant.plant_code}
                                        disabled={!canBypassPlantRestriction && userPlantCode && plant.plant_code !== userPlantCode}
                                    >
                                        ({plant.plant_code}) {plant.plant_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="filter-wrapper">
                            <select
                                className="ios-select"
                                value={statusFilter}
                                onChange={e => {
                                    const newValue = e.target.value
                                    setStatusFilter(newValue)
                                    updateListFilter?.('statusFilter', newValue)
                                    window.dispatchEvent(new CustomEvent('list-status-filter-change', {
                                        detail: {statusFilter: newValue}
                                    }))
                                    if (newValue === 'completed' && window.updateActiveMenuHighlight) {
                                        window.updateActiveMenuHighlight('Archive')
                                    } else if (newValue !== 'completed' && window.updateActiveMenuHighlight) {
                                        window.updateActiveMenuHighlight('List')
                                    }
                                    if (onStatusFilterChange) {
                                        onStatusFilterChange(newValue)
                                    }
                                }}
                                aria-label="Filter by status"
                                style={{
                                    '--select-active-border': 'var(--accent)',
                                    '--select-focus-border': 'var(--accent)'
                                }}
                            >
                                <option value="">All Status</option>
                                <option value="overdue">Overdue</option>
                                <option value="pending">Pending</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                        {(searchText || selectedPlant || statusFilter) && (
                            <button
                                className="filter-reset-button"
                                onClick={() => {
                                    setSearchText('')
                                    if (canBypassPlantRestriction) setSelectedPlant('')
                                    else if (userPlantCode) setSelectedPlant(userPlantCode)
                                    setStatusFilter('')
                                    resetListFilters?.()
                                    if (!canBypassPlantRestriction && userPlantCode) updateListFilter?.('selectedPlant', userPlantCode)
                                    if (window.updateActiveMenuHighlight) {
                                        window.updateActiveMenuHighlight('List')
                                    }
                                    if (onStatusFilterChange) {
                                        onStatusFilterChange('')
                                    }
                                }}
                            >
                                <i className="fas fa-undo"></i>
                            </button>
                        )}
                    </div>
                </div>
                <div
                    className={`list-list-header-row${statusFilter === 'completed' ? ' completed' : ''}`}
                    style={{gridTemplateColumns: headerColumns.join(' ')}}
                >
                    <div>Description</div>
                    <div>Plant</div>
                    <div>Deadline</div>
                    {statusFilter === 'completed' && <div>Completed</div>}
                    <div>Created By</div>
                    <div>Status</div>
                </div>
            </div>
            <div className="content-container">
                {isLoading ? (
                    <div className="loading-container">
                        <LoadingScreen message="Loading list items..." inline={true}/>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="no-results-container">
                        <div className="no-results-icon">
                            <i className="fas fa-clipboard-list"></i>
                        </div>
                        <h3>{statusFilter === 'completed' ? 'No Completed Items Found' : 'No List Items Found'}</h3>
                        <p>
                            {searchText || selectedPlant ? "No items match your search criteria." :
                                statusFilter === 'completed' ? "There are no completed items to show." :
                                    "There are no items in the list yet."}
                        </p>
                        <button className="primary-button" onClick={() => setShowAddSheet(true)}>
                            Add Item
                        </button>
                    </div>
                ) : (
                    <div className="mixers-list-table-container">
                        <table className="mixers-list-table">
                            <colgroup>
                                {headerColumns.map((w, i) => (
                                    <col key={i} style={{width: w}}/>
                                ))}
                            </colgroup>
                            <tbody>
                            {filteredItems.map(item => (
                                <tr
                                    key={item.id}
                                    className={item.completed ? 'completed' : ''}
                                    onClick={() => handleSelectItem(item)}
                                    style={{cursor: 'pointer'}}
                                >
                                    <td title={item.description}>
                                            <span
                                                className="item-status-dot"
                                                style={{
                                                    display: 'inline-block',
                                                    verticalAlign: 'middle',
                                                    marginRight: '8px',
                                                    width: '10px',
                                                    height: '10px',
                                                    borderRadius: '50%',
                                                    backgroundColor: item.completed
                                                        ? 'var(--success)'
                                                        : ListService.isOverdue(item)
                                                            ? 'var(--error)'
                                                            : 'var(--info)'
                                                }}
                                            ></span>
                                        {truncateText(item.description, 60)}
                                    </td>
                                    <td title={getPlantName(item.plant_code)}>
                                        {truncateText(getPlantName(item.plant_code), 20)}
                                    </td>
                                    <td>
                                            <span
                                                className={ListService.isOverdue(item) && !item.completed ? 'deadline-overdue' : ''}>
                                                {new Date(item.deadline).toLocaleDateString()}
                                            </span>
                                    </td>
                                    {statusFilter === 'completed' && (
                                        <td>
                                            {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : 'N/A'}
                                        </td>
                                    )}
                                    <td title={ListService.getCreatorName(item.user_id)}>
                                        {truncateText(ListService.getCreatorName(item.user_id), 20)}
                                    </td>
                                    <td>
                                        {item.completed ? (
                                            <span className="status-badge completed">Completed</span>
                                        ) : ListService.isOverdue(item) ? (
                                            <span className="status-badge overdue">Overdue</span>
                                        ) : (
                                            <span className="status-badge pending">Pending</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showAddSheet && (
                <ListAddView
                    onClose={() => setShowAddSheet(false)}
                    onItemAdded={() => fetchAllData()}
                    plants={plants}
                />
            )}

            {showDetailView && (
                <ListDetailView
                    itemId={selectedItem?.id}
                    onClose={() => setShowDetailView(false)}
                />
            )}
        </div>
    )
}

export default ListView

