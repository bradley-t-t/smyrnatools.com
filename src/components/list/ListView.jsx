import React, {useEffect, useState} from 'react'
import './styles/ListView.css'
import '../../styles/FilterStyles.css'
import {ListService} from '../../services/ListService'
import LoadingScreen from '../common/LoadingScreen'
import {UserService} from '../../services/UserService'
import ListOverview from './ListOverview'
import {usePreferences} from '../../app/context/PreferencesContext'
import ListAddView from './ListAddView'
import ListDetailView from './ListDetailView'
import {supabase} from '../../services/DatabaseService'
import {RegionService} from '../../services/RegionService'

function ListView({title = 'Tasks List', onSelectItem, onStatusFilterChange}) {
    const {updateListFilter, resetListFilters, preferences} = usePreferences()
    const [, setListItems] = useState([])
    const [plants, setPlants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState('')
    const [selectedPlant, setSelectedPlant] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [showOverview, setShowOverview] = useState(false)
    const [showDetailView, setShowDetailView] = useState(false)
    const [selectedItem, setSelectedItem] = useState(null)
    const [userPlantCode, setUserPlantCode] = useState(null)
    const [canBypassPlantRestriction, setCanBypassPlantRestriction] = useState(false)
    const [regionPlantCodes, setRegionPlantCodes] = useState([])

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
        const code = preferences?.selectedRegion?.code || ''
        let mounted = true
        async function loadRegionPlants() {
            if (!code) {
                if (mounted) setRegionPlantCodes([])
                return
            }
            try {
                const regionPlants = await RegionService.fetchRegionPlants(code)
                const codes = Array.isArray(regionPlants) ? regionPlants.map(p => p.plantCode).filter(Boolean) : []
                if (mounted) setRegionPlantCodes(codes)
            } catch {
                if (mounted) setRegionPlantCodes([])
            }
        }
        loadRegionPlants()
        return () => {
            mounted = false
        }
    }, [preferences?.selectedRegion?.code])

    useEffect(() => {
        if (!selectedPlant) return
        const code = preferences?.selectedRegion?.code || ''
        if (!code) return
        const allowed = new Set(regionPlantCodes)
        if (selectedPlant && !allowed.has(selectedPlant)) {
            setSelectedPlant('')
            updateListFilter?.('selectedPlant', '')
        }
    }, [regionPlantCodes, preferences?.selectedRegion?.code, selectedPlant, updateListFilter])

    async function fetchAllData() {
        setIsLoading(true)
        try {
            const [items, plantsData] = await Promise.all([
                ListService.fetchListItems(),
                ListService.fetchPlants()
            ])
            setListItems(items)
            setPlants(plantsData)
        } finally {
            setIsLoading(false)
        }
    }

    const regionCode = preferences?.selectedRegion?.code || ''
    const regionCodeSet = new Set(regionPlantCodes)

    const baseFilteredItems = ListService.getFilteredItems({
        filterType: '',
        plantCode: selectedPlant,
        searchTerm: searchText,
        showCompleted: statusFilter === 'completed',
        statusFilter
    })

    const filteredItems = regionCode ? baseFilteredItems.filter(item => regionCodeSet.has(item.plant_code)) : baseFilteredItems

    const getPlantName = plantCode => ListService.getPlantName(plantCode)
    const truncateText = (text, maxLength, byWords = false) => ListService.truncateText(text, maxLength, byWords)

    const handleSelectItem = item => {
        setSelectedItem(item)
        onSelectItem ? onSelectItem(item.id) : setShowDetailView(true)
    }

    const totalItems = filteredItems.length
    const overdueItems = filteredItems.filter(item => ListService.isOverdue(item) && !item.completed).length

    function formatDate(dateStr) {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return ''
        const pad = n => n.toString().padStart(2, '0')
        const yyyy = date.getFullYear()
        const mm = pad(date.getMonth() + 1)
        const dd = pad(date.getDate())
        const hh = pad(date.getHours())
        const min = pad(date.getMinutes())
        return `${mm}/${dd}/${yyyy} ${hh}:${min}`
    }

    function getFiltersAppliedString() {
        const filters = []
        if (searchText) filters.push(`Search: ${searchText}`)
        if (regionCode) filters.push(`Region: ${preferences?.selectedRegion?.name || regionCode}`)
        if (selectedPlant) {
            const plant = plants.find(p => p.plant_code === selectedPlant)
            filters.push(`Plant: ${plant ? plant.plant_name : selectedPlant}`)
        }
        if (statusFilter) filters.push(`Status: ${statusFilter}`)
        return filters.length ? filters.join(', ') : 'No Filters'
    }

    function exportListToCSV(itemsToExport) {
        if (!itemsToExport || itemsToExport.length === 0) return
        const now = new Date()
        const pad = n => n.toString().padStart(2, '0')
        const yyyy = now.getFullYear()
        const mm = pad(now.getMonth() + 1)
        const dd = pad(now.getDate())
        const hh = pad(now.getHours())
        const min = pad(now.getMinutes())
        const formattedNow = `${mm}-${dd}-${yyyy} ${hh}-${min}`
        const filtersApplied = getFiltersAppliedString()
        const fileName = `List Export - ${formattedNow} - ${filtersApplied}.csv`
        const topHeader = `List Export - ${formattedNow} - ${filtersApplied}`
        const headers = [
            'Description',
            'Plant',
            'Deadline',
            'Completed',
            'Completed Date',
            'Created By',
            'Status',
            'Comments'
        ]
        const rows = itemsToExport.map(item => [
            item.description || '',
            getPlantName(item.plant_code),
            formatDate(item.deadline),
            item.completed ? 'Yes' : 'No',
            item.completed_at ? formatDate(item.completed_at) : '',
            ListService.getCreatorName(item.user_id),
            item.completed ? 'Completed' : ListService.isOverdue(item) ? 'Overdue' : 'Pending',
            item.comments || ''
        ])
        const csvContent = [
            `"${topHeader}"`,
            headers.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','),
            ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        ].join('\n')
        const blob = new Blob([csvContent], {type: 'text/csv'})
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const OverviewPopup = () => (
        <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{statusFilter === 'completed' ? 'Completed Items Overview' : 'List Overview'}</h2>
                    <button className="close-button" onClick={() => setShowOverview(false)}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <ListOverview
                        totalItems={totalItems}
                        overdueItems={overdueItems}
                        listItems={filteredItems}
                        selectedPlant={selectedPlant}
                        isArchived={statusFilter === 'completed'}
                    />
                </div>
                <div className="modal-footer">
                    <button className="primary-button" onClick={() => setShowOverview(false)}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    )

    const visiblePlants = regionCode ? plants.filter(p => regionCodeSet.has(p.plant_code)) : plants

    return (
        <div className="dashboard-container list-view">
            <div className="dashboard-header">
                <h1>{title}</h1>
                <div className="dashboard-actions">
                    <button
                        className="action-button primary rectangular-button"
                        style={{marginRight: 8, minWidth: 210}}
                        onClick={() => exportListToCSV(filteredItems)}
                    >
                        <i className="fas fa-file-export" style={{marginRight: 8}}></i> Export
                    </button>
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
                            <option value="" disabled={!canBypassPlantRestriction && userPlantCode}>All Plants</option>
                            {visiblePlants.sort((a, b) => parseInt(a.plant_code?.replace(/\D/g, '') || '0') - parseInt(b.plant_code?.replace(/\D/g, '') || '0')).map(plant => (
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
                    <button className="ios-button" onClick={() => setShowOverview(true)}>
                        <i className="fas fa-chart-bar"></i> Overview
                    </button>
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
                            <thead>
                            <tr>
                                <th>Description</th>
                                <th>Plant</th>
                                <th>Deadline</th>
                                {statusFilter === 'completed' && (
                                    <th>Completed</th>
                                )}
                                <th>Created By</th>
                                <th>Status</th>
                            </tr>
                            </thead>
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
                    plants={visiblePlants}
                />
            )}

            {showDetailView && (
                <ListDetailView
                    itemId={selectedItem?.id}
                    onClose={() => setShowDetailView(false)}
                />
            )}

            {showOverview && <OverviewPopup/>}
        </div>
    )
}

export default ListView
