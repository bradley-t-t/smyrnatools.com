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
import TopSection from '../sections/TopSection'

function ListView({title = 'Tasks List', onSelectItem, onStatusFilterChange}) {
    const {updateListFilter, resetListFilters, preferences} = usePreferences()
    const headerRef = useRef(null)
    const searchInputRef = useRef(null)
    const [plants, setPlants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [selectedPlant, setSelectedPlant] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [showDetailView, setShowDetailView] = useState(false)
    const [selectedItem, setSelectedItem] = useState(null)
    const [userPlantCode, setUserPlantCode] = useState(null)
    const [canBypassPlantRestriction, setCanBypassPlantRestriction] = useState(false)
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [sortKey, setSortKey] = useState('')
    const [sortDir, setSortDir] = useState('asc')
    const [viewMode, setViewMode] = useState('list')

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

    const sortedItems = (() => {
        if (!sortKey) return filteredItems
        const items = [...filteredItems]
        const dir = sortDir === 'desc' ? -1 : 1
        if (sortKey === 'description') items.sort((a, b) => ((a.description || '').localeCompare(b.description || '')) * dir)
        else if (sortKey === 'plant') items.sort((a, b) => ((String(a.plant_code || '')).localeCompare(String(b.plant_code || ''))) * dir)
        else if (sortKey === 'deadline') items.sort((a, b) => ((new Date(a.deadline).getTime() || 0) - (new Date(b.deadline).getTime() || 0)) * dir)
        else if (sortKey === 'completed_at') items.sort((a, b) => ((new Date(a.completed_at).getTime() || 0) - (new Date(b.completed_at).getTime() || 0)) * dir)
        else if (sortKey === 'creator') items.sort((a, b) => (ListService.getCreatorName(a.user_id).localeCompare(ListService.getCreatorName(b.user_id))) * dir)
        else if (sortKey === 'status') items.sort((a, b) => ((a.completed === b.completed) ? 0 : a.completed ? 1 : -1) * dir)
        return items
    })()

    const getPlantName = plantCode => ListService.getPlantName(plantCode)
    const truncateText = (text, maxLength, byWords = false) => ListService.truncateText(text, maxLength, byWords)

    const handleSelectItem = item => {
        setSelectedItem(item)
        onSelectItem ? onSelectItem(item.id) : setShowDetailView(true)
    }

    function toggleSort(key) {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortKey(key)
            setSortDir('asc')
        }
        updateListFilter?.('sortKey', key)
        updateListFilter?.('sortDir', sortKey === key ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc')
    }

    function isAllSelected() {
        if (sortedItems.length === 0) return false
        for (const it of sortedItems) if (!selectedIds.has(it.id)) return false
        return true
    }

    function toggleSelectAll() {
        if (isAllSelected()) {
            setSelectedIds(new Set())
        } else {
            const next = new Set(selectedIds)
            sortedItems.forEach(it => next.add(it.id))
            setSelectedIds(next)
        }
    }

    function toggleSelect(id) {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    async function bulkToggleCompletion(markComplete) {
        if (selectedIds.size === 0) return
        const user = await UserService.getCurrentUser()
        const userId = user?.id
        if (!userId) return
        const itemsById = new Map(ListService.listItems.map(i => [i.id, i]))
        for (const id of selectedIds) {
            const it = itemsById.get(id)
            if (!it) continue
            const needs = markComplete ? !it.completed : it.completed
            if (!needs) continue
            try {
                await ListService.toggleCompletion(it, userId)
            } catch {
            }
        }
        setSelectedIds(new Set())
    }

    async function bulkDelete() {
        if (selectedIds.size === 0) return
        const ok = window.confirm('Delete selected items?')
        if (!ok) return
        for (const id of selectedIds) {
            try {
                await ListService.deleteListItem(id)
            } catch {
            }
        }
        setSelectedIds(new Set())
    }

    useEffect(() => {
        function onKeyDown(e) {
            if (e.metaKey && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                searchInputRef.current?.focus()
            }
            if (e.metaKey && e.key.toLowerCase() === 'n') {
                e.preventDefault()
                setShowAddSheet(true)
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    const headerColumns = statusFilter === 'completed'
        ? ['5%', '34%', '14%', '12%', '16%', '11%', '8%']
        : ['5%', '39%', '16%', '14%', '16%', '10%']


    const visiblePlants = (regionPlantCodes && regionPlantCodes.size > 0)
        ? plants.filter(p => regionPlantCodes.has(String(p.plant_code || '').trim().toUpperCase()))
        : plants

    const statusOptions = ['All Status','Overdue','Pending','Completed']
    const statusValueForTop = statusFilter ? (statusFilter === 'overdue' ? 'Overdue' : statusFilter === 'pending' ? 'Pending' : statusFilter === 'completed' ? 'Completed' : 'All Status') : 'All Status'
    const showReset = !!(searchText || selectedPlant || statusFilter)

    return (
        <div className={`dashboard-container list-view${showDetailView && selectedItem ? ' detail-open' : ''}`}>
            {showDetailView && selectedItem ? (
                <ListDetailView itemId={selectedItem?.id} onClose={() => setShowDetailView(false)}/>
            ) : (
                <>
                    <TopSection
                        title={title}
                        addButtonLabel="Add Item"
                        onAddClick={() => setShowAddSheet(true)}
                        searchInput={searchInput}
                        onSearchInputChange={v => { setSearchInput(v); setSearchText(v); updateListFilter?.('searchText', v) }}
                        onClearSearch={() => { setSearchInput(''); setSearchText(''); updateListFilter?.('searchText', '') }}
                        searchPlaceholder="Search by description or comments..."
                        viewMode={viewMode}
                        onViewModeChange={m => setViewMode(m || 'list')}
                        plants={visiblePlants.map(p => ({plantCode: p.plant_code, plantName: p.plant_name}))}
                        regionPlantCodes={regionPlantCodes}
                        selectedPlant={selectedPlant}
                        onSelectedPlantChange={v => { setSelectedPlant(v); updateListFilter?.('selectedPlant', v) }}
                        statusFilter={statusValueForTop}
                        statusOptions={statusOptions}
                        onStatusFilterChange={v => { const mapped = v === 'All Status' ? '' : v.toLowerCase(); setStatusFilter(mapped); updateListFilter?.('statusFilter', mapped); if (onStatusFilterChange) onStatusFilterChange(mapped) }}
                        showReset={showReset}
                        onReset={() => { setSearchText(''); setSearchInput(''); if (canBypassPlantRestriction) setSelectedPlant(''); else if (userPlantCode) setSelectedPlant(userPlantCode); setStatusFilter(''); resetListFilters?.(); if (!canBypassPlantRestriction && userPlantCode) updateListFilter?.('selectedPlant', userPlantCode); if (onStatusFilterChange) onStatusFilterChange('') }}
                        showListHeader={false}
                        forwardedRef={headerRef}
                    />
                    {selectedIds.size > 0 && (
                        <div className="bulk-actions-bar">
                            <div className="bulk-count"><i className="fas fa-check-square"></i> {selectedIds.size} selected</div>
                            <div className="bulk-actions">
                                <button className="bulk-btn" onClick={() => bulkToggleCompletion(true)}><i className="fas fa-check"></i> Complete</button>
                                <button className="bulk-btn danger" onClick={bulkDelete}><i className="fas fa-trash"></i> Delete</button>
                            </div>
                        </div>
                    )}
                    {viewMode === 'list' && (
                        <div className={`list-list-header-row${statusFilter === 'completed' ? ' completed' : ''}${selectedIds.size > 0 ? ' stacked' : ''}`} style={{gridTemplateColumns: headerColumns.join(' ')}}>
                            <div><input type="checkbox" aria-label="Select all" checked={isAllSelected()} onChange={toggleSelectAll}/></div>
                            <div role="button" onClick={() => toggleSort('description')}>Description {sortKey === 'description' && (<i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'}`}></i>)}</div>
                            <div role="button" onClick={() => toggleSort('plant')}>Plant {sortKey === 'plant' && (<i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'}`}></i>)}</div>
                            <div role="button" onClick={() => toggleSort('deadline')}>Deadline {sortKey === 'deadline' && (<i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'}`}></i>)}</div>
                            {statusFilter === 'completed' && <div role="button" onClick={() => toggleSort('completed_at')}>Completed {sortKey === 'completed_at' && (<i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'}`}></i>)}</div>}
                            <div role="button" onClick={() => toggleSort('creator')}>Created By {sortKey === 'creator' && (<i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'}`}></i>)}</div>
                            <div role="button" onClick={() => toggleSort('status')}>Status {sortKey === 'status' && (<i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'}`}></i>)}</div>
                        </div>
                    )}
                    <div className="content-container">
                        {isLoading ? (
                            <div className="loading-container"><LoadingScreen message="Loading list items..." inline={true}/></div>
                        ) : sortedItems.length === 0 ? (
                            <div className="no-results-container">
                                <div className="no-results-icon"><i className="fas fa-clipboard-list"></i></div>
                                <h3>{statusFilter === 'completed' ? 'No Completed Items Found' : 'No List Items Found'}</h3>
                                <p>{searchText || selectedPlant ? 'No items match your search criteria.' : statusFilter === 'completed' ? 'There are no completed items to show.' : 'There are no items in the list yet.'}</p>
                                <button className="primary-button" onClick={() => setShowAddSheet(true)}>Add Item</button>
                            </div>
                        ) : viewMode === 'list' ? (
                            <div className="mixers-list-table-container">
                                <table className="mixers-list-table">
                                    <colgroup>{headerColumns.map((w,i)=><col key={i} style={{width:w}}/>)}</colgroup>
                                    <tbody>
                                    {sortedItems.map(item => (
                                        <tr key={item.id} className={`${item.completed ? 'completed' : ''} ${selectedIds.has(item.id) ? 'is-selected' : ''}`} onClick={() => handleSelectItem(item)} style={{cursor:'pointer'}}>
                                            <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} aria-label="Select row"/></td>
                                            <td title={item.description}><span className="item-status-dot" style={{display:'inline-block',verticalAlign:'middle',marginRight:'8px',width:'10px',height:'10px',borderRadius:'50%',backgroundColor:item.completed ? 'var(--success)' : ListService.isOverdue(item) ? 'var(--error)' : 'var(--info)'}}></span>{truncateText(item.description,60)}</td>
                                            <td title={getPlantName(item.plant_code)}>{truncateText(getPlantName(item.plant_code),20)}</td>
                                            <td><span className={ListService.isOverdue(item)&&!item.completed?'deadline-overdue':''}>{new Date(item.deadline).toLocaleDateString()}</span></td>
                                            {statusFilter === 'completed' && <td>{item.completed_at ? new Date(item.completed_at).toLocaleDateString() : 'N/A'}</td>}
                                            <td title={ListService.getCreatorName(item.user_id)}>{truncateText(ListService.getCreatorName(item.user_id),20)}</td>
                                            <td>{item.completed ? <span className="status-badge completed">Completed</span> : ListService.isOverdue(item) ? <span className="status-badge overdue">Overdue</span> : <span className="status-badge pending">Pending</span>}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="list-items-grid">
                                {sortedItems.map(item => (
                                    <div key={item.id} className="list-view-row" onClick={() => handleSelectItem(item)} style={{cursor:'pointer'}}>
                                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                                            <span className="item-status-dot" style={{display:'inline-block',width:10,height:10,borderRadius:'50%',backgroundColor:item.completed ? 'var(--success)' : ListService.isOverdue(item) ? 'var(--error)' : 'var(--info)'}}></span>
                                            {truncateText(item.description,60)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {showAddSheet && <ListAddView onClose={() => setShowAddSheet(false)} onItemAdded={() => fetchAllData()} plants={visiblePlants}/>}
                </>
            )}
            {showDetailView && !selectedItem && null}
            {showDetailView && selectedItem && <ListDetailView itemId={selectedItem?.id} onClose={() => setShowDetailView(false)}/>}
        </div>
    )
}

export default ListView
