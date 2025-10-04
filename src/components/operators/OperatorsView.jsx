import React, {useEffect, useRef, useState} from 'react'
import './styles/OperatorsView.css'
import '../../styles/FilterStyles.css'
import {supabase} from '../../services/DatabaseService'
import {UserService} from '../../services/UserService'
import LoadingScreen from '../common/LoadingScreen'
import OperatorDetailView from './OperatorDetailView'
import OperatorCard from './OperatorCard'
import OperatorAddView from './OperatorAddView'
import {usePreferences} from '../../app/context/PreferencesContext'
import FormatUtility from '../../utils/FormatUtility'
import {RegionService} from '../../services/RegionService'
import TopSection from '../sections/TopSection'

function OperatorsView({
                           title = 'Operator Roster',
                           onSelectOperator,
                           initialStatusFilter
                       }) {
    const {preferences, updateOperatorFilter, resetOperatorFilters} = usePreferences()
    const headerRef = useRef(null)
    const [operators, setOperators] = useState([])
    const [plants, setPlants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState(preferences.operatorFilters?.searchText || '')
    const [selectedPlant, setSelectedPlant] = useState(preferences.operatorFilters?.selectedPlant || '')
    const [statusFilter, setStatusFilter] = useState(preferences.operatorFilters?.statusFilter || '')
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [showDetailView, setShowDetailView] = useState(false)
    const [selectedOperator, setSelectedOperator] = useState(null)
    const [, setCurrentUserId] = useState(null)
    const [trainers, setTrainers] = useState([])
    const [reloadFlag] = useState(false)
    const [viewMode, setViewMode] = useState(() => {
        if (preferences.operatorFilters?.viewMode !== undefined && preferences.operatorFilters?.viewMode !== null) return preferences.operatorFilters.viewMode
        if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) return preferences.defaultViewMode
        const lastUsed = localStorage.getItem('operators_last_view_mode')
        return lastUsed || 'grid'
    })
    const statuses = ['Active', 'Light Duty', 'Pending Start', 'Training', 'Terminated', 'No Hire']
    const filterOptions = [
        'All Statuses', 'Active', 'Light Duty', 'Pending Start', 'Training', 'Terminated', 'No Hire',
        'Trainer', 'Not Trainer'
    ]
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)

    useEffect(() => {
        const fetchCurrentUser = async () => {
            const user = await UserService.getCurrentUser()
            if (user) setCurrentUserId(user.id)
        }
        fetchCurrentUser()
    }, [])

    useEffect(() => { fetchAllData() }, [reloadFlag])

    useEffect(() => {
        if (preferences.operatorFilters) {
            setSearchText(preferences.operatorFilters.searchText || '')
            setSelectedPlant(preferences.operatorFilters.selectedPlant || '')
            setStatusFilter(preferences.operatorFilters.statusFilter || '')
            setViewMode(preferences.operatorFilters.viewMode || preferences.defaultViewMode || 'grid')
        }
    }, [preferences.operatorFilters, preferences.defaultViewMode])

    useEffect(() => { if (initialStatusFilter) setStatusFilter(initialStatusFilter) }, [initialStatusFilter])

    useEffect(() => {
        const prefCode = preferences.selectedRegion?.code || ''
        let cancelled = false
        async function loadRegionPlants() {
            let regionCode = prefCode
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
                if (!regionCode) { setRegionPlantCodes(null); return }
                const regionPlants = await RegionService.fetchRegionPlants(regionCode)
                if (cancelled) return
                const codes = new Set(regionPlants.map(p => String(p.plantCode || p.plant_code || '').trim().toUpperCase()).filter(Boolean))
                setRegionPlantCodes(codes)
                const sel = String(selectedPlant || '').trim().toUpperCase()
                if (sel && !codes.has(sel)) { setSelectedPlant(''); updateOperatorFilter('selectedPlant', '') }
            } catch { if (!cancelled) setRegionPlantCodes(null) }
        }
        loadRegionPlants()
        return () => { cancelled = true }
    }, [preferences.selectedRegion?.code])

    const fetchAllData = async () => {
        setIsLoading(true)
        try { await Promise.all([fetchOperators(), fetchPlants(), fetchTrainers()]) } catch {} finally { setIsLoading(false) }
    }

    const fetchOperators = async () => {
        try {
            const {data, error} = await supabase.from('operators').select('*')
            if (error) throw error
            const formattedOperators = data.map(op => {
                const rawPending = op.pending_start_date || ''
                const normalizedPending = (typeof rawPending === 'string' && rawPending.includes('T')) ? rawPending.slice(0,10) : rawPending
                return { employeeId: op.employee_id, smyrnaId: op.smyrna_id || '', name: op.name, plantCode: op.plant_code, status: op.status, isTrainer: op.is_trainer, assignedTrainer: op.assigned_trainer, position: op.position, pendingStartDate: normalizedPending, rating: typeof op.rating === 'number' ? op.rating : Number(op.rating) || 0, phone: op.phone || '' }
            })
            setOperators(formattedOperators)
            localStorage.setItem('cachedOperators', JSON.stringify(formattedOperators))
            localStorage.setItem('cachedOperatorsDate', new Date().toISOString())
        } catch {
            const cachedData = localStorage.getItem('cachedOperators')
            const cacheDate = localStorage.getItem('cachedOperatorsDate')
            if (cachedData && cacheDate) {
                const cachedTime = new Date(cacheDate).getTime()
                const hourAgo = new Date().getTime() - 3600000
                if (cachedTime > hourAgo) setOperators(JSON.parse(cachedData))
            }
        }
    }

    const fetchPlants = async () => {
        try { const {data, error} = await supabase.from('plants').select('*'); if (error) throw error; setPlants(data) } catch {}
    }

    const fetchTrainers = async () => {
        try { const {data, error} = await supabase.from('operators').select('employee_id, name').eq('is_trainer', true); if (error) throw error; setTrainers(data.map(t => ({ employeeId: t.employee_id, name: t.name }))) } catch { setTrainers([]) }
    }

    const reloadAll = async () => { await fetchAllData() }

    const duplicateNamesSet = React.useMemo(() => {
        const counts = new Map()
        operators.forEach(op => { const key = (op?.name || '').trim().toLowerCase(); if (!key) return; counts.set(key, (counts.get(key) || 0) + 1) })
        const dups = new Set(); counts.forEach((count, key) => { if (count > 1) dups.add(key) }); return dups
    }, [operators])

    const filteredOperators = operators.filter(operator => {
        const matchesSearch = searchText.trim() === '' || operator.name.toLowerCase().includes(searchText.toLowerCase()) || operator.employeeId.toLowerCase().includes(searchText.toLowerCase())
        const matchesPlant = selectedPlant === '' || operator.plantCode === selectedPlant
        const matchesRegion = !regionPlantCodes || regionPlantCodes.size === 0 || regionPlantCodes.has(String(operator.plantCode || '').trim().toUpperCase())
        let matchesStatus = true
        if (statusFilter && statusFilter !== 'All Statuses') {
            if (statuses.includes(statusFilter)) matchesStatus = operator.status === statusFilter
            else if (statusFilter === 'Trainer') matchesStatus = operator.isTrainer === true || String(operator.isTrainer).toLowerCase() === 'true'
            else if (statusFilter === 'Not Trainer') matchesStatus = operator.isTrainer !== true && String(operator.isTrainer).toLowerCase() !== 'true'
        }
        return matchesSearch && matchesPlant && matchesRegion && matchesStatus
    }).sort((a, b) => {
        if (a.status === 'Active' && b.status !== 'Active') return -1
        if (a.status !== 'Active' && b.status === 'Active') return 1
        if (a.status === 'Training' && b.status !== 'Training') return -1
        if (a.status !== 'Training' && b.status === 'Training') return 1
        if (a.status === 'Pending Start' && b.status !== 'Pending Start') return -1
        if (a.status !== 'Pending Start' && b.status === 'Pending Start') return 1
        if (a.status === 'Terminated' && b.status !== 'Terminated') return 1
        if (a.status !== 'Terminated' && b.status === 'Terminated') return -1
        if (a.status === 'No Hire' && b.status !== 'No Hire') return 1
        if (a.status !== 'No Hire' && b.status === 'No Hire') return -1
        if (a.status !== b.status) return a.status.localeCompare(b.status)
        const nameA = a.name.split(' ').pop().toLowerCase()
        const nameB = b.name.split(' ').pop().toLowerCase()
        return nameA.localeCompare(nameB)
    })

    const handleSelectOperator = (operator) => {
        setSelectedOperator(operator)
        if (onSelectOperator) {
            onSelectOperator(operator.employeeId)
        } else {
            setShowDetailView(true)
        }
    }

    function formatDate(dateStr) { return FormatUtility.formatDate(dateStr) }

    function handleViewModeChange(mode) {
        if (viewMode === mode) { setViewMode(null); updateOperatorFilter('viewMode', null); localStorage.removeItem('operators_last_view_mode') }
        else { setViewMode(mode); updateOperatorFilter('viewMode', mode); localStorage.setItem('operators_last_view_mode', mode) }
    }

    function handleResetFilters() {
        const currentViewMode = viewMode
        setSearchText('')
        setSelectedPlant('')
        setStatusFilter('')
        resetOperatorFilters({keepViewMode: true, currentViewMode})
    }

    useEffect(() => {
        function updateStickyCoverHeight() {
            const el = headerRef.current
            const h = el ? Math.ceil(el.getBoundingClientRect().height) : 0
            const root = document.querySelector('.global-dashboard-container.operators-view')
            if (root && h) root.style.setProperty('--sticky-cover-height', h + 'px')
        }
        updateStickyCoverHeight()
        window.addEventListener('resize', updateStickyCoverHeight)
        return () => window.removeEventListener('resize', updateStickyCoverHeight)
    }, [viewMode, searchText, selectedPlant, statusFilter])

    const showReset = (searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses'))

    return (
        <div className={`global-dashboard-container dashboard-container global-flush-top flush-top operators-view${showDetailView && selectedOperator ? ' detail-open' : ''}`}>
            {showDetailView && selectedOperator && (
                <OperatorDetailView
                    operatorId={selectedOperator.employeeId}
                    onClose={() => { setShowDetailView(false); fetchOperators() }}
                    onScheduledOffSaved={reloadAll}
                    allowedPlantCodes={regionPlantCodes}
                />
            )}
            {!showDetailView && (
                <>
                    <TopSection
                        title={title}
                        flushTop={true}
                        showCoverOverlay={true}
                        forwardedRef={headerRef}
                        addButtonLabel="Add Operator"
                        onAddClick={() => setShowAddSheet(true)}
                        searchInput={searchText}
                        onSearchInputChange={value => { setSearchText(value); updateOperatorFilter('searchText', value) }}
                        onClearSearch={() => { setSearchText(''); updateOperatorFilter('searchText', '') }}
                        searchPlaceholder="Search by name or ID..."
                        viewMode={viewMode}
                        onViewModeChange={handleViewModeChange}
                        plants={plants.map(p => ({...p, plantCode: p.plant_code, plantName: p.plant_name}))}
                        regionPlantCodes={regionPlantCodes}
                        selectedPlant={selectedPlant}
                        onSelectedPlantChange={value => { setSelectedPlant(value); updateOperatorFilter('selectedPlant', value) }}
                        statusFilter={statusFilter}
                        statusOptions={filterOptions}
                        onStatusFilterChange={value => { setStatusFilter(value); updateOperatorFilter('statusFilter', value) }}
                        showReset={showReset}
                        onReset={handleResetFilters}
                        listHeaderLabels={['Plant','Name','Phone','Status','Trainer']}
                        showListHeader={viewMode === 'list'}
                        listHeaderClassName={`operators-list-header-row${statusFilter === 'Pending Start' ? ' pending' : ''}`}
                        sticky={true}
                    />
                    <div className="global-content-container content-container">
                        {isLoading ? (
                            <div className="global-loading-container loading-container"><LoadingScreen message="Loading operators..." inline={true}/></div>
                        ) : filteredOperators.length === 0 ? (
                            <div className="global-no-results-container no-results-container">
                                <div className="no-results-icon"><i className="fas fa-user-hard-hat"></i></div>
                                <h3>No Operators Found</h3>
                                <p>{searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses') ? 'No operators match your search criteria.' : 'There are no operators in the system yet.'}</p>
                                <button className="global-primary-button primary-button" onClick={() => setShowAddSheet(true)}>Add Operator</button>
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className={`global-grid operators-grid ${searchText ? 'search-results' : ''}`}>
                                {filteredOperators.map(operator => {
                                    const duplicate = duplicateNamesSet.has((operator.name || '').trim().toLowerCase())
                                    const trainerObj = trainers.find(t => t.employeeId === operator.assignedTrainer)
                                    return (
                                        <OperatorCard
                                            key={operator.employeeId}
                                            operator={operator}
                                            trainerName={trainerObj ? trainerObj.name : ''}
                                            duplicateName={duplicate}
                                            onSelect={() => handleSelectOperator(operator)}
                                            formatDate={formatDate}
                                        />
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="operators-list-table-container">
                                <table className="operators-list-table">
                                    <colgroup>
                                        <col style={{width: '10%'}}/>
                                        <col style={{width: '30%'}}/>
                                        <col style={{width: '18%'}}/>
                                        <col style={{width: '18%'}}/>
                                        <col style={{width: '24%'}}/>
                                    </colgroup>
                                    <tbody>
                                    {filteredOperators.map(operator => {
                                        const duplicate = duplicateNamesSet.has((operator.name || '').trim().toLowerCase())
                                        const trainerObj = trainers.find(t => t.employeeId === operator.assignedTrainer)
                                        return (
                                            <tr key={operator.employeeId} onClick={() => handleSelectOperator(operator)} style={{cursor: 'pointer'}}>
                                                <td>{operator.plantCode || '\u2014'}</td>
                                                <td><span className={`name-cell${duplicate ? ' duplicate' : ''}`}>{operator.name}</span></td>
                                                <td>{operator.phone || '\u2014'}</td>
                                                <td>{operator.status || '\u2014'}</td>
                                                <td>{trainerObj ? trainerObj.name : '\u2014'}</td>
                                            </tr>
                                        )
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    {showAddSheet && (
                        <OperatorAddView
                            onClose={() => setShowAddSheet(false)}
                            onOperatorAdded={() => fetchOperators()}
                            trainers={trainers}
                            plants={plants}
                            operators={operators}
                            allowedPlantCodes={regionPlantCodes}
                        />
                    )}
                </>
            )}
        </div>
    )
}

export default OperatorsView
