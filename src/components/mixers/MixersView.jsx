import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import MixerAddView from './MixerAddView';
import MixerUtility from '../../utils/MixerUtility';
import {MixerService} from '../../services/MixerService';
import {PlantService} from '../../services/PlantService';
import {OperatorService} from '../../services/OperatorService';
import LoadingScreen from '../common/LoadingScreen';
import {usePreferences} from '../../app/context/PreferencesContext';
import MixerCard from './MixerCard';
import MixerOverview from './MixerOverview';
import OperatorsView from '../operators/OperatorsView'
import '../../styles/FilterStyles.css';
import './styles/MixersView.css';
import MixerDetailView from './MixerDetailView'
import MixerIssueModal from './MixerIssueModal'
import MixerCommentModal from './MixerCommentModal'
import {RegionService} from '../../services/RegionService'
import {UserService} from '../../services/UserService'
import AsyncUtility from '../../utils/AsyncUtility'
import LookupUtility from '../../utils/LookupUtility'
import FleetUtility from '../../utils/FleetUtility'

function MixersView({title = 'Mixer Fleet', showSidebar, setShowSidebar, onSelectMixer}) {
    const {preferences, updateMixerFilter, resetMixerFilters, saveLastViewedFilters} = usePreferences();
    const headerRef = useRef(null)
    const [mixers, setMixers] = useState([]);
    const [allMixers, setAllMixers] = useState([]);
    const [operators, setOperators] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchText, setSearchText] = useState(preferences.mixerFilters?.searchText || '');
    const [searchInput, setSearchInput] = useState(preferences.mixerFilters?.searchText || '');
    const [selectedPlant, setSelectedPlant] = useState(preferences.mixerFilters?.selectedPlant || '');
    const [statusFilter, setStatusFilter] = useState(preferences.mixerFilters?.statusFilter || '');
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [showOverview, setShowOverview] = useState(false);
    const [selectedMixer, setSelectedMixer] = useState(null);
    const [showOperatorsView, setShowOperatorsView] = useState(false)
    const [operatorStatusFilter, setOperatorStatusFilter] = useState('')
    const [viewMode, setViewMode] = useState(() => {
        if (preferences.mixerFilters?.viewMode !== undefined && preferences.mixerFilters?.viewMode !== null) return preferences.mixerFilters.viewMode
        if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) return preferences.defaultViewMode
        const lastUsed = localStorage.getItem('mixers_last_view_mode')
        return lastUsed || 'grid'
    })
    const [showIssueModal, setShowIssueModal] = useState(false)
    const [showCommentModal, setShowCommentModal] = useState(false)
    const [modalMixerId, setModalMixerId] = useState(null)
    const [modalMixerNumber, setModalMixerNumber] = useState('')
    const [regionPlantCodes, setRegionPlantCodes] = useState(new Set())
    const [mixersLoaded, setMixersLoaded] = useState(false)
    const [operatorsLoaded, setOperatorsLoaded] = useState(false)
    const filterOptions = ['All Statuses', 'Active', 'Spare', 'In Shop', 'Retired', 'Past Due Service', 'Verified', 'Not Verified', 'Open Issues'];

    const unassignedActiveOperatorsCount = useMemo(() => FleetUtility.countUnassignedActiveOperators(mixers, operators, searchText, {
        position: 'Mixer Operator',
        selectedPlant,
        operatorIdField: 'employeeId',
        assignedOperatorField: 'assignedOperator',
        assignedPlantField: 'assignedPlant'
    }), [operators, mixers, selectedPlant, searchText])

    useEffect(() => {
        async function fetchAllData() {
            setIsLoading(true);
            try {
                await Promise.all([fetchMixersWithDetails(), fetchOperators(), fetchPlants()]);
            } finally {
                setIsLoading(false);
            }
        }

        fetchAllData();
        if (preferences?.mixerFilters) {
            setSearchText(preferences.mixerFilters.searchText || '');
            setSearchInput(preferences.mixerFilters.searchText || '');
            setSelectedPlant(preferences.mixerFilters.selectedPlant || '');
            setStatusFilter(preferences.mixerFilters.statusFilter || '');
        }
        if (preferences.mixerFilters?.viewMode !== undefined && preferences.mixerFilters?.viewMode !== null) {
            setViewMode(preferences.mixerFilters.viewMode)
        } else if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) {
            setViewMode(preferences.defaultViewMode)
        } else {
            const lastUsed = localStorage.getItem('mixers_last_view_mode')
            if (lastUsed) setViewMode(lastUsed)
        }
        if (preferences?.autoOverview) {
            setShowOverview(true);
        }
    }, [preferences]);

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
                    setRegionPlantCodes(new Set())
                    return
                }
                const regionPlants = await RegionService.fetchRegionPlants(regionCode)
                if (cancelled) return
                const codes = new Set(regionPlants.map(p => String(p.plantCode || p.plant_code || '').trim().toUpperCase()).filter(Boolean))
                setRegionPlantCodes(codes)
                const sel = String(selectedPlant || '').trim().toUpperCase()
                if (sel && !codes.has(sel)) {
                    setSelectedPlant('')
                    updateMixerFilter('selectedPlant', '')
                }
            } catch {
                if (!cancelled) setRegionPlantCodes(new Set())
            }
        }

        loadAllowedPlants()
        return () => {
            cancelled = true
        }
    }, [preferences.selectedRegion?.code])


    async function fetchOperators() {
        try {
            const data = await OperatorService.fetchOperators();
            setOperators(Array.isArray(data) ? data : []);
            setOperatorsLoaded(true)
        } catch (error) {
            setOperators([]);
        }
    }

    async function fetchPlants() {
        try {
            const data = await PlantService.fetchPlants();
            setPlants(data);
        } catch (error) {
        }
    }

    async function fetchMixersWithDetails() {
        try {
            const mixersWithDetails = await MixerService.fetchMixersWithDetails()
            const processed = (Array.isArray(mixersWithDetails) ? mixersWithDetails : []).map(m => {
                const mixer = {...m}
                mixer.isVerified = () => MixerUtility.isVerified(mixer.updatedLast, mixer.updatedAt, mixer.updatedBy, mixer.latestHistoryDate)
                return mixer
            })
            setMixers(processed);
            setAllMixers(processed);
            setMixersLoaded(true)
            setTimeout(() => {
                MixerService.ensureSpareIfNoOperator(processed).catch(() => {
                })
            }, 0)
        } catch (error) {
        }
    }

    function handleSelectMixer(mixerId) {
        const mixer = mixers.find(m => m.id === mixerId);
        if (mixer) {
            saveLastViewedFilters();
            setSelectedMixer(mixer);
            onSelectMixer?.(mixerId);
        }
    }

    function handleStatusClick(status) {
        if (status === 'All Statuses') {
            setStatusFilter('');
            updateMixerFilter('statusFilter', '');
        } else {
            setStatusFilter(status);
            updateMixerFilter('statusFilter', status);
        }
        setShowOverview(false);
    }

    function handleOperatorStatusClick(status) {
        setOperatorStatusFilter(status)
        setShowOperatorsView(true)
    }

    function handleViewModeChange(mode) {
        if (viewMode === mode) {
            setViewMode(null)
            updateMixerFilter('viewMode', null)
            localStorage.removeItem('mixers_last_view_mode')
        } else {
            setViewMode(mode)
            updateMixerFilter('viewMode', mode)
            localStorage.setItem('mixers_last_view_mode', mode)
        }
    }

    useEffect(() => {
        async function searchByVin() {
            const normalizedSearch = searchText.trim().toLowerCase().replace(/\s+/g, '');
            if (normalizedSearch.length >= 17 && /^[a-z0-9]+$/i.test(normalizedSearch)) {
                setIsLoading(true);
                try {
                    const vinMixers = await MixerService.searchMixersByVin(normalizedSearch);
                    const processed = vinMixers.map(m => {
                        m.isVerified = () => MixerUtility.isVerified(m.updatedLast, m.updatedAt, m.updatedBy, m.latestHistoryDate)
                        return m
                    })
                    setMixers(processed);
                    setMixersLoaded(true)
                } catch {
                }
                setIsLoading(false);
            } else {
                setMixers(allMixers);
            }
        }

        if (searchText.trim().length >= 1) {
            searchByVin();
        } else {
            setMixers(allMixers);
        }
    }, [searchText, allMixers]);

    const filteredMixers = useMemo(() => {
        return mixers
            .filter(mixer => {
                const normalizedSearch = searchText.trim().toLowerCase().replace(/\s+/g, '')
                const truckMatch = (mixer.truckNumber || '').toLowerCase().includes(normalizedSearch)
                const operatorMatch = mixer.assignedOperator && operators.find(op => op.employeeId === mixer.assignedOperator)?.name.toLowerCase().includes(normalizedSearch)
                const vinRaw = (mixer.vinNumber || mixer.vin || '').toLowerCase()
                const vinNoSpaces = vinRaw.replace(/\s+/g, '')
                const vinMatch = vinRaw.includes(searchText.trim().toLowerCase()) || vinNoSpaces.includes(normalizedSearch)
                const matchesSearch = !normalizedSearch || truckMatch || operatorMatch || vinMatch
                const matchesPlant = !selectedPlant || mixer.assignedPlant === selectedPlant
                const matchesRegion = !regionPlantCodes || regionPlantCodes.has(String(mixer.assignedPlant || '').trim().toUpperCase())
                let matchesStatus = true
                if (statusFilter && statusFilter !== 'All Statuses') {
                    matchesStatus = ['Active', 'Spare', 'In Shop', 'Retired'].includes(statusFilter) ? mixer.status === statusFilter :
                        statusFilter === 'Past Due Service' ? MixerUtility.isServiceOverdue(mixer.lastServiceDate) :
                            statusFilter === 'Verified' ? mixer.isVerified() :
                                statusFilter === 'Not Verified' ? !mixer.isVerified() :
                                    statusFilter === 'Open Issues' ? (Number(mixer.openIssuesCount || 0) > 0) : false
                }
                return matchesSearch && matchesPlant && matchesRegion && matchesStatus
            })
            .sort((a, b) => FleetUtility.compareByStatusThenNumber(a, b, 'status', 'truckNumber'))
    }, [mixers, operators, selectedPlant, searchText, statusFilter, regionPlantCodes])

    const unverifiedCount = mixers.filter(m => !m.isVerified()).length
    const neverVerifiedCount = mixers.filter(m => !m.updatedLast || !m.updatedBy).length

    const OverviewPopup = () => (
        <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Mixers Overview</h2>
                    <button className="close-button" onClick={() => setShowOverview(false)}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <MixerOverview
                        filteredMixers={filteredMixers}
                        selectedPlant={selectedPlant}
                        unverifiedCount={unverifiedCount}
                        neverVerifiedCount={neverVerifiedCount}
                        onStatusClick={handleStatusClick}
                        onOperatorStatusClick={handleOperatorStatusClick}
                    />
                </div>
                <div className="modal-footer">
                    <button className="primary-button" onClick={() => setShowOverview(false)}>Close</button>
                </div>
            </div>
        </div>
    );

    useEffect(() => {
        function updateStickyCoverHeight() {
            const el = headerRef.current
            const h = el ? Math.ceil(el.getBoundingClientRect().height) : 0
            const root = document.querySelector('.dashboard-container.mixers-view')
            if (root && h) root.style.setProperty('--sticky-cover-height', h + 'px')
        }

        updateStickyCoverHeight()
        window.addEventListener('resize', updateStickyCoverHeight)
        return () => window.removeEventListener('resize', updateStickyCoverHeight)
    }, [viewMode, selectedPlant, statusFilter, searchText])

    const debouncedSetSearchText = useCallback(AsyncUtility.debounce((value) => {
        setSearchText(value);
        updateMixerFilter('searchText', value);
    }, 300), []);

    const canShowUnassignedOverlay = mixersLoaded && operatorsLoaded && !isLoading && unassignedActiveOperatorsCount > 0

    const content = useMemo(() => {
        if (isLoading) {
            return (
                <div className="loading-container">
                    <LoadingScreen message="Loading mixers..." inline={true}/>
                </div>
            )
        }
        if (filteredMixers.length === 0) {
            return (
                <div className="no-results-container">
                    <div className="no-results-icon">
                        <i className="fas fa-truck-loading"></i>
                    </div>
                    <h3>No Mixers Found</h3>
                    <p>{searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses') ? "No mixers match your search criteria." : "There are no mixers in the system yet."}</p>
                    <button className="primary-button" onClick={() => setShowAddSheet(true)}>Add Mixer</button>
                </div>
            )
        }
        if (viewMode === 'grid') {
            return (
                <div className={`mixers-grid ${searchText ? 'search-results' : ''}`}>
                    {filteredMixers.map(mixer => (
                        <MixerCard
                            key={mixer.id}
                            mixer={{
                                ...mixer,
                                operatorSmyrnaId: LookupUtility.getOperatorSmyrnaId(operators, mixer.assignedOperator),
                                openIssuesCount: Array.isArray(mixer.issues) ? mixer.issues.filter(issue => !issue.time_completed).length : 0,
                                commentsCount: Array.isArray(mixer.comments) ? mixer.comments.length : 0
                            }}
                            operatorName={LookupUtility.getOperatorName(operators, mixer.assignedOperator)}
                            plantName={LookupUtility.getPlantName(plants, mixer.assignedPlant)}
                            showOperatorWarning={LookupUtility.isIdAssignedToMultiple(mixers, 'assignedOperator', mixer.assignedOperator)}
                            onSelect={() => handleSelectMixer(mixer.id)}
                        />
                    ))}
                </div>
            )
        }
        return (
            <div className="mixers-list-table-container">
                <table className="mixers-list-table">
                    <colgroup>
                        <col style={{width: '10%'}}/>
                        <col style={{width: '12%'}}/>
                        <col style={{width: '12%'}}/>
                        <col style={{width: '18%'}}/>
                        <col style={{width: '12%'}}/>
                        <col style={{width: '18%'}}/>
                        <col style={{width: '10%'}}/>
                        <col style={{width: '8%'}}/>
                    </colgroup>
                    <tbody>
                    {filteredMixers.map(mixer => {
                        const commentsCount = Array.isArray(mixer.comments) ? mixer.comments.length : 0
                        const issuesCount = Array.isArray(mixer.issues) ? mixer.issues.filter(issue => !issue.time_completed).length : 0
                        return (
                            <tr key={mixer.id} style={{cursor: 'pointer'}} onClick={() => handleSelectMixer(mixer.id)}>
                                <td>{mixer.assignedPlant ? mixer.assignedPlant : "---"}</td>
                                <td>{mixer.truckNumber ? mixer.truckNumber : "---"}</td>
                                <td>
                                    <span className="item-status-dot" style={{
                                        display: 'inline-block',
                                        verticalAlign: 'middle',
                                        marginRight: '8px',
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        backgroundColor: mixer.status === 'Active' ? 'var(--status-active)' : mixer.status === 'Spare' ? 'var(--status-spare)' : mixer.status === 'In Shop' ? 'var(--status-inshop)' : mixer.status === 'Retired' ? 'var(--status-retired)' : 'var(--accent)'
                                    }}></span>
                                    {mixer.status ? mixer.status : "---"}
                                </td>
                                <td>
                                    {LookupUtility.getOperatorName(operators, mixer.assignedOperator) ? LookupUtility.getOperatorName(operators, mixer.assignedOperator) : "---"}
                                    {LookupUtility.isIdAssignedToMultiple(mixers, 'assignedOperator', mixer.assignedOperator) && (
                                        <span className="warning-badge">
                                            <i className="fas fa-exclamation-triangle"></i>
                                        </span>
                                    )}
                                </td>
                                <td>
                                    {(() => {
                                        const rating = Math.round(mixer.cleanlinessRating || 0)
                                        const stars = rating > 0 ? rating : 1
                                        return Array.from({length: stars}).map((_, i) => (
                                            <i key={i} className="fas fa-star" style={{color: 'var(--accent)'}}></i>
                                        ))
                                    })()}
                                </td>
                                <td>{mixer.vinNumber ? mixer.vinNumber : (mixer.vin ? mixer.vin : "---")}</td>
                                <td>
                                    {mixer.isVerified() ? (
                                        <span style={{display: 'inline-flex', alignItems: 'center'}}>
                                            <i className="fas fa-check-circle"
                                               style={{color: 'var(--success)', marginRight: 6}}></i>
                                            Verified
                                        </span>
                                    ) : (
                                        <span style={{display: 'inline-flex', alignItems: 'center'}}>
                                            <i className="fas fa-flag"
                                               style={{color: 'var(--error)', marginRight: 6}}></i>
                                            Not Verified
                                        </span>
                                    )}
                                </td>
                                <td>
                                    <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                                        <button type="button" onClick={(e) => {
                                            e.stopPropagation();
                                            setModalMixerId(mixer.id);
                                            setModalMixerNumber(mixer.truckNumber || '');
                                            setShowCommentModal(true)
                                        }} style={{
                                            background: 'transparent',
                                            border: 'none',
                                            padding: 0,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            cursor: 'pointer'
                                        }} title="View comments">
                                            <i className="fas fa-comments"
                                               style={{color: 'var(--accent)', marginRight: 4}}></i>
                                            <span>{commentsCount}</span>
                                        </button>
                                        <button type="button" onClick={(e) => {
                                            e.stopPropagation();
                                            setModalMixerId(mixer.id);
                                            setModalMixerNumber(mixer.truckNumber || '');
                                            setShowIssueModal(true)
                                        }} style={{
                                            background: 'transparent',
                                            border: 'none',
                                            padding: 0,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            marginLeft: 12
                                        }} title="View issues">
                                            <i className="fas fa-tools"
                                               style={{color: 'var(--accent)', marginRight: 4}}></i>
                                            <span>{issuesCount}</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                    </tbody>
                </table>
            </div>
        )
    }, [isLoading, filteredMixers, viewMode, searchText, selectedPlant, statusFilter, operators, plants, mixers])

    return (
        <div className="dashboard-container mixers-view">
            {canShowUnassignedOverlay && (
                <div className="operators-availability-overlay">
                    {unassignedActiveOperatorsCount} active
                    operator{unassignedActiveOperatorsCount !== 1 ? 's' : ''} unassigned
                </div>
            )}
            {selectedMixer ? (
                <MixerDetailView
                    mixerId={selectedMixer.id}
                    onClose={() => setSelectedMixer(null)}
                />
            ) : (
                <>
                    <div className="mixers-sticky-header" ref={headerRef}>
                        <div className="dashboard-header">
                            <h1>{title}</h1>
                            <div className="dashboard-actions">
                                {setShowSidebar && (
                                    <button className="action-button" onClick={() => setShowSidebar(!showSidebar)}>
                                        <i className="fas fa-bars"></i> Menu
                                    </button>
                                )}
                                <button
                                    className="action-button primary rectangular-button"
                                    onClick={() => setShowAddSheet(true)}
                                    style={{height: '44px', lineHeight: '1'}}
                                >
                                    <i className="fas fa-plus" style={{marginRight: '8px'}}></i> Add Mixer
                                </button>
                            </div>
                        </div>
                        <div className="search-filters">
                            <div className="search-bar">
                                <input
                                    type="text"
                                    className="ios-search-input"
                                    placeholder="Search by truck, operator, or VIN..."
                                    value={searchInput}
                                    onChange={e => {
                                        setSearchInput(e.target.value);
                                        debouncedSetSearchText(e.target.value);
                                    }}
                                />
                                {searchInput && (
                                    <button className="clear" onClick={() => {
                                        setSearchInput('');
                                        debouncedSetSearchText('');
                                    }}>
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
                                        onChange={e => {
                                            setSelectedPlant(e.target.value);
                                            updateMixerFilter('selectedPlant', e.target.value);
                                        }}
                                        aria-label="Filter by plant"
                                    >
                                        <option value="">All Plants</option>
                                        {plants
                                            .filter(p => {
                                                const code = String(p.plantCode || p.plant_code || '').trim().toUpperCase()
                                                return regionPlantCodes && regionPlantCodes.size > 0 ? regionPlantCodes.has(code) : false
                                            })
                                            .sort((a, b) => parseInt((a.plantCode || a.plant_code || '').replace(/\D/g, '') || '0') - parseInt((b.plantCode || b.plant_code || '').replace(/\D/g, '') || '0'))
                                            .map(plant => (
                                                <option key={plant.plantCode || plant.plant_code}
                                                        value={plant.plantCode || plant.plant_code}>
                                                    ({plant.plantCode || plant.plant_code}) {plant.plantName || plant.plant_name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                <div className="filter-wrapper">
                                    <select
                                        className="ios-select"
                                        value={statusFilter}
                                        onChange={e => {
                                            setStatusFilter(e.target.value);
                                            updateMixerFilter('statusFilter', e.target.value);
                                        }}
                                    >
                                        {filterOptions.map(option => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </div>
                                {(searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses')) && (
                                    <button className="filter-reset-button" onClick={() => {
                                        setSearchText('')
                                        setSearchInput('')
                                        setSelectedPlant('')
                                        setStatusFilter('')
                                        resetMixerFilters({keepViewMode: true, currentViewMode: viewMode})
                                    }}>
                                        <i className="fas fa-undo"></i>
                                    </button>
                                )}
                                <button className="ios-button" onClick={() => setShowOverview(true)}>
                                    <i className="fas fa-chart-bar"></i> Overview
                                </button>
                            </div>
                        </div>
                        {viewMode !== 'grid' && (
                            <div className="mixers-list-header-row">
                                <div>Plant</div>
                                <div>Truck #</div>
                                <div>Status</div>
                                <div>Operator</div>
                                <div>Cleanliness</div>
                                <div>VIN</div>
                                <div>Verified</div>
                                <div>More</div>
                            </div>
                        )}
                    </div>
                    <div className="content-container">{content}</div>
                    {showAddSheet && (
                        <MixerAddView
                            plants={plants}
                            operators={operators}
                            onClose={() => setShowAddSheet(false)}
                            onMixerAdded={newMixer => setMixers([...mixers, newMixer])}
                        />
                    )}
                    {showOverview && <OverviewPopup/>}
                    {showOperatorsView && (
                        <div className="modal-backdrop" onClick={() => setShowOperatorsView(false)}>
                            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h2>Operators</h2>
                                    <button className="close-button" onClick={() => setShowOperatorsView(false)}>
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                                <div className="modal-body">
                                    <OperatorsView
                                        title="Operator Roster"
                                        showSidebar={false}
                                        setShowSidebar={() => {
                                        }}
                                        onSelectOperator={() => {
                                        }}
                                        initialStatusFilter={operatorStatusFilter}
                                    />
                                </div>
                                <div className="modal-footer">
                                    <button className="primary-button"
                                            onClick={() => setShowOperatorsView(false)}>Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {showCommentModal && (
                        <MixerCommentModal
                            mixerId={modalMixerId}
                            mixerNumber={modalMixerNumber}
                            onClose={() => setShowCommentModal(false)}
                        />
                    )}
                    {showIssueModal && (
                        <MixerIssueModal
                            mixerId={modalMixerId}
                            mixerNumber={modalMixerNumber}
                            onClose={() => setShowIssueModal(false)}
                        />
                    )}
                </>
            )}
        </div>
    );
}

export default MixersView;
