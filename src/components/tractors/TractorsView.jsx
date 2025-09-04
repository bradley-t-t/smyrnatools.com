import React, {useEffect, useMemo, useState, useRef, useCallback} from 'react';
import PropTypes from 'prop-types';
import {usePreferences} from '../../app/context/PreferencesContext';
import LoadingScreen from '../common/LoadingScreen';
import TractorCard from './TractorCard';
import TractorOverview from './TractorOverview';
import '../../styles/FilterStyles.css';
import './styles/TractorsView.css';
import {TractorService} from '../../services/TractorService';
import {TractorUtility} from "../../utils/TractorUtility";
import {OperatorService} from "../../services/OperatorService";
import {PlantService} from "../../services/PlantService";
import TractorAddView from "./TractorAddView";
import TractorDetailView from "./TractorDetailView";
import TractorIssueModal from './TractorIssueModal'
import TractorCommentModal from './TractorCommentModal'
import {RegionService} from '../../services/RegionService'

function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

function TractorsView({title = 'Tractor Fleet', onSelectTractor}) {
    const {preferences, saveLastViewedFilters, updateTractorFilter, updatePreferences} = usePreferences()
    const [tractors, setTractors] = useState([])
    const [operators, setOperators] = useState([])
    const [plants, setPlants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState(preferences.tractorFilters?.searchText || '')
    const [selectedPlant, setSelectedPlant] = useState(preferences.tractorFilters?.selectedPlant || '')
    const [statusFilter, setStatusFilter] = useState(preferences.tractorFilters?.statusFilter || '')
    const [freightFilter, setFreightFilter] = useState(preferences.tractorFilters?.freightFilter || '')
    const [viewMode, setViewMode] = useState(() => {
        if (preferences.tractorFilters?.viewMode !== undefined && preferences.tractorFilters?.viewMode !== null) return preferences.tractorFilters.viewMode
        if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) return preferences.defaultViewMode
        const lastUsed = localStorage.getItem('tractors_last_view_mode')
        return lastUsed || 'grid'
    })
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [showOverview, setShowOverview] = useState(false)
    const [selectedTractor, setSelectedTractor] = useState(null)
    const [reloadTractors, setReloadTractors] = useState(false)
    const [showIssueModal, setShowIssueModal] = useState(false)
    const [showCommentModal, setShowCommentModal] = useState(false)
    const [modalTractorId, setModalTractorId] = useState(null)
    const [modalTractorNumber, setModalTractorNumber] = useState('')
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)
    const [tractorsLoaded, setTractorsLoaded] = useState(false)
    const [operatorsLoaded, setOperatorsLoaded] = useState(false)
    const filterOptions = ['All Statuses', 'Active', 'Spare', 'In Shop', 'Retired', 'Past Due Service', 'Verified', 'Not Verified', 'Open Issues']
    const freightOptions = ['All Freight', 'Cement', 'Aggregate']
    const headerRef = useRef(null)

    const unassignedActiveOperatorsCount = useMemo(() => {
        const normalized = searchText.trim().toLowerCase().replace(/\s+/g, '')
        const ops = operators.filter(op => {
            if (op.status !== 'Active') return false
            if (op.position !== 'Tractor Operator') return false
            if (selectedPlant && op.plantCode !== selectedPlant) return false
            if (!normalized) return true
            const nameNoSpace = (op.name || '').toLowerCase().replace(/\s+/g, '')
            const smyrna = (op.smyrnaId || '').toLowerCase()
            return nameNoSpace.includes(normalized) || smyrna.includes(normalized)
        })
        const activeTractors = tractors.filter(t => t.status === 'Active' && (!selectedPlant || t.assignedPlant === selectedPlant))
        let count = 0
        for (const op of ops) {
            const isAssigned = activeTractors.some(t => t.assignedOperator === op.employeeId)
            if (!isAssigned) count++
        }
        return count
    }, [operators, tractors, selectedPlant, searchText])

    useEffect(() => {
        async function fetchAllData() {
            setIsLoading(true)
            try {
                await Promise.all([fetchTractors(), fetchOperators(), fetchPlants()])
            } catch (error) {
                console.error('Error fetching data:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchAllData()
        if (preferences?.tractorFilters) {
            setSearchText(preferences.tractorFilters.searchText || '')
            setSelectedPlant(preferences.tractorFilters.selectedPlant || '')
            setStatusFilter(preferences.tractorFilters.statusFilter || '')
            setFreightFilter(preferences.tractorFilters.freightFilter || '')
            setViewMode(preferences.tractorFilters.viewMode !== undefined && preferences.tractorFilters.viewMode !== null ? preferences.tractorFilters.viewMode : preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null ? preferences.defaultViewMode : localStorage.getItem('tractors_last_view_mode') || 'grid')
        }
        if (preferences?.autoOverview) {
            setShowOverview(true)
        }
    }, [preferences, reloadTractors])

    useEffect(() => {
        if (preferences.tractorFilters?.viewMode !== undefined && preferences.tractorFilters?.viewMode !== null) {
            setViewMode(preferences.tractorFilters.viewMode)
        } else if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) {
            setViewMode(preferences.defaultViewMode)
        } else {
            const lastUsed = localStorage.getItem('tractors_last_view_mode')
            if (lastUsed) setViewMode(lastUsed)
        }
    }, [preferences.tractorFilters?.viewMode, preferences.defaultViewMode])

    useEffect(() => {
        const code = preferences.selectedRegion?.code || ''
        let cancelled = false
        async function loadRegionPlants() {
            if (!code) {
                setRegionPlantCodes(null)
                return
            }
            try {
                const regionPlants = await RegionService.fetchRegionPlants(code)
                if (cancelled) return
                const codes = new Set(regionPlants.map(p => p.plantCode))
                setRegionPlantCodes(codes)
                if (selectedPlant && !codes.has(selectedPlant)) {
                    setSelectedPlant('')
                    updateTractorFilter('selectedPlant', '')
                }
            } catch {
                setRegionPlantCodes(new Set())
            }
        }
        loadRegionPlants()
        return () => {
            cancelled = true
        }
    }, [preferences.selectedRegion?.code])

    function handleViewModeChange(mode) {
        if (viewMode === mode) {
            setViewMode(null)
            updateTractorFilter('viewMode', null)
            localStorage.removeItem('tractors_last_view_mode')
        } else {
            setViewMode(mode)
            updateTractorFilter('viewMode', mode)
            localStorage.setItem('tractors_last_view_mode', mode)
        }
    }

    async function fetchTractors() {
        try {
            const data = await TractorService.fetchTractors();
            const processedData = data.map(tractor => {
                const t = {...tractor}
                t.isVerified = () => TractorUtility.isVerified(t.updatedLast, t.updatedAt, t.updatedBy, t.latestHistoryDate)
                return t
            })
            setTractors(processedData)
            setTractorsLoaded(true)
            setTimeout(() => {
                fixActiveTractorsWithoutOperator(processedData).catch(() => {})
            }, 0)
        } catch (error) {
            console.error('Error fetching tractors:', error)
        }
    }

    async function fixActiveTractorsWithoutOperator(list) {
        const updates = list.filter(t => t.status === 'Active' && (!t.assignedOperator || t.assignedOperator === '0' || t.assignedOperator === '' || t.assignedOperator === null))
        for (const tractor of updates) {
            try {
                await TractorService.updateTractor(tractor.id, {...tractor, status: 'Spare'}, undefined, tractor)
                tractor.status = 'Spare'
            } catch (e) {}
        }
    }

    async function fetchOperators() {
        try {
            const data = await OperatorService.fetchOperators();
            setOperators(Array.isArray(data) ? data : []);
            setOperatorsLoaded(true)
        } catch (error) {
            console.error('Error fetching operators:', error);
            setOperators([]);
        }
    }

    async function fetchPlants() {
        try {
            const data = await PlantService.fetchPlants();
            setPlants(data);
        } catch (error) {
            console.error('Error fetching plants:', error);
        }
    }

    function getOperatorSmyrnaId(operatorId) {
        if (!operatorId || operatorId === '0') return '';
        const operator = operators.find(op => op.employeeId === operatorId);
        return operator?.smyrnaId || '';
    }

    function getOperatorName(operatorId) {
        if (!operatorId || operatorId === '0') return 'None';
        const operator = operators.find(op => op.employeeId === operatorId);
        return operator ? operator.name : 'Unknown';
    }

    function getPlantName(plantCode) {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode || 'No Plant';
    }

    function isOperatorAssignedToMultipleTractors(operatorId) {
        return operatorId && operatorId !== '0' && tractors.filter(m => m.assignedOperator === operatorId).length > 1;
    }

    function handleSelectTractor(tractorId) {
        const tractor = tractors.find(m => m.id === tractorId);
        if (tractor) {
            saveLastViewedFilters();
            setSelectedTractor(tractorId);
            onSelectTractor?.(tractorId);
        }
    }

    function handleStatusClick(status) {
        if (status === 'All Statuses') {
            setStatusFilter('')
            updatePreferences('tractorFilters', {
                ...preferences.tractorFilters,
                statusFilter: ''
            })
        } else {
            setStatusFilter(status)
            updatePreferences('tractorFilters', {
                ...preferences.tractorFilters,
                statusFilter: status
            })
        }
        setShowOverview(false)
    }

    function handleBackFromDetail() {
        setSelectedTractor(null)
        setReloadTractors(r => !r)
    }

    const filteredTractors = useMemo(() => {
        return tractors
            .filter(tractor => {
                const matchesSearch = !searchText.trim() ||
                    tractor.truckNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
                    (tractor.assignedOperator && operators.find(op => op.employeeId === tractor.assignedOperator)?.name.toLowerCase().includes(searchText.toLowerCase()));
                const matchesPlant = !selectedPlant || tractor.assignedPlant === selectedPlant;
                const matchesFreight = !freightFilter || tractor.freight === freightFilter;
                const matchesRegion = !preferences.selectedRegion?.code || !regionPlantCodes || regionPlantCodes.has(tractor.assignedPlant);
                let matchesStatus = true;
                if (statusFilter && statusFilter !== 'All Statuses') {
                    matchesStatus = ['Active', 'Spare', 'In Shop', 'Retired'].includes(statusFilter) ? tractor.status === statusFilter :
                        statusFilter === 'Past Due Service' ? TractorUtility.isServiceOverdue(tractor.lastServiceDate) :
                            statusFilter === 'Verified' ? tractor.isVerified() :
                                statusFilter === 'Not Verified' ? !tractor.isVerified() :
                                    statusFilter === 'Open Issues' ? (Number(tractor.openIssuesCount || 0) > 0) : false;
                }
                return matchesSearch && matchesPlant && matchesFreight && matchesRegion && matchesStatus;
            })
            .sort((a, b) => {
                if (a.status === 'Active' && b.status !== 'Active') return -1;
                if (a.status !== 'Active' && b.status === 'Active') return 1;
                if (a.status === 'Spare' && b.status !== 'Spare') return -1;
                if (a.status !== 'Spare' && b.status === 'Spare') return 1;
                if (a.status === 'In Shop' && b.status !== 'In Shop') return -1;
                if (a.status !== 'In Shop' && b.status === 'In Shop') return 1;
                if (a.status === 'Retired' && b.status !== 'Retired') return 1;
                if (a.status !== 'Retired' && b.status === 'Retired') return -1;
                if (a.status !== b.status) return a.status.localeCompare(b.status);
                const aNum = parseInt(a.truckNumber?.replace(/\D/g, '') || '0');
                const bNum = parseInt(b.truckNumber?.replace(/\D/g, '') || '0');
                return !isNaN(aNum) && !isNaN(bNum) ? aNum - bNum : (a.truckNumber || '').localeCompare(b.truckNumber || '');
            });
    }, [tractors, operators, selectedPlant, searchText, statusFilter, freightFilter, preferences.selectedRegion?.code, regionPlantCodes])

    const verifiedCount = tractors.filter(m => m.isVerified()).length;
    const unverifiedCount = tractors.length - verifiedCount;
    const neverVerifiedCount = tractors.filter(m => !m.updatedLast || !m.updatedBy).length;

    const OverviewPopup = () => (
        <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Tractors Overview</h2>
                    <button className="close-button" onClick={() => setShowOverview(false)}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <TractorOverview
                        filteredTractors={filteredTractors}
                        selectedPlant={selectedPlant}
                        unverifiedCount={unverifiedCount}
                        neverVerifiedCount={neverVerifiedCount}
                        onStatusClick={handleStatusClick}
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
            const root = document.querySelector('.dashboard-container.tractors-view')
            if (root && h) root.style.setProperty('--sticky-cover-height', h + 'px')
        }
        updateStickyCoverHeight()
        window.addEventListener('resize', updateStickyCoverHeight)
        return () => window.removeEventListener('resize', updateStickyCoverHeight)
    }, [viewMode, selectedPlant, statusFilter, freightFilter, searchText])

    if (selectedTractor) {
        return (
            <TractorDetailView
                tractorId={selectedTractor}
                onClose={handleBackFromDetail}
            />
        );
    }

    const debouncedSetSearchText = useCallback(debounce((value) => {
        setSearchText(value)
        updatePreferences('tractorFilters', {
            ...preferences.tractorFilters,
            searchText: value
        })
    }, 300), [preferences.tractorFilters, updatePreferences])

    const canShowUnassignedOverlay = tractorsLoaded && operatorsLoaded && !isLoading && unassignedActiveOperatorsCount > 0

    return (
        <div className="dashboard-container tractors-view">
            {canShowUnassignedOverlay && (
                <div className="operators-availability-overlay">
                    {unassignedActiveOperatorsCount} active
                    operator{unassignedActiveOperatorsCount !== 1 ? 's' : ''} unassigned
                </div>
            )}
            <div className="tractors-sticky-header" ref={headerRef}>
                <div className="dashboard-header">
                    <h1>{title}</h1>
                    <div className="dashboard-actions">
                        <button
                            className="action-button primary rectangular-button"
                            onClick={() => setShowAddSheet(true)}
                            style={{height: '44px', lineHeight: '1'}}
                        >
                            <i className="fas fa-plus" style={{marginRight: '8px'}}></i> Add Tractor
                        </button>
                    </div>
                </div>
                <div className="search-filters">
                    <div className="search-bar">
                        <input
                            type="text"
                            className="ios-search-input"
                            placeholder="Search by truck or operator..."
                            value={searchText}
                            onChange={e => debouncedSetSearchText(e.target.value)}
                        />
                        {searchText && (
                            <button className="clear" onClick={() => debouncedSetSearchText('')}>
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
                                    setSelectedPlant(e.target.value)
                                    updatePreferences('tractorFilters', {
                                        ...preferences.tractorFilters,
                                        selectedPlant: e.target.value
                                    })
                                }}
                                aria-label="Filter by plant"
                            >
                                <option value="">All Plants</option>
                                {plants
                                    .filter(p => !preferences.selectedRegion?.code || (regionPlantCodes && regionPlantCodes.has(p.plantCode)))
                                    .sort((a, b) => parseInt(a.plantCode?.replace(/\D/g, '') || '0') - parseInt(b.plantCode?.replace(/\D/g, '') || '0')).map(plant => (
                                    <option key={plant.plantCode} value={plant.plantCode}>
                                        ({plant.plantCode}) {plant.plantName}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="filter-wrapper">
                            <select
                                className="ios-select"
                                value={statusFilter}
                                onChange={e => {
                                    setStatusFilter(e.target.value)
                                    updatePreferences('tractorFilters', {
                                        ...preferences.tractorFilters,
                                        statusFilter: e.target.value
                                    })
                                }}
                            >
                                {filterOptions.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                        <div className="filter-wrapper freight-filter">
                            <select
                                className="ios-select freight-select"
                                value={freightFilter}
                                onChange={e => {
                                    setFreightFilter(e.target.value)
                                    updatePreferences('tractorFilters', {
                                        ...preferences.tractorFilters,
                                        freightFilter: e.target.value
                                    })
                                }}
                                aria-label="Filter by freight"
                                style={{width: 110, minWidth: 110}}
                            >
                                {freightOptions.map(opt => (
                                    <option key={opt} value={opt === 'All Freight' ? '' : opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                        {(searchText || selectedPlant || freightFilter || (statusFilter && statusFilter !== 'All Statuses')) && (
                            <button className="filter-reset-button" onClick={() => {
                                setSearchText('')
                                setSelectedPlant('')
                                setStatusFilter('')
                                setFreightFilter('')
                                updatePreferences('tractorFilters', {
                                    ...preferences.tractorFilters,
                                    searchText: '',
                                    selectedPlant: '',
                                    statusFilter: '',
                                    freightFilter: ''
                                })
                                setViewMode(viewMode)
                            }}>
                                <i className="fas fa-undo"></i>
                            </button>
                        )}
                        <button className="ios-button" onClick={() => setShowOverview(true)}>
                            <i className="fas fa-chart-bar"></i> Overview
                        </button>
                    </div>
                </div>
                {viewMode === 'list' && (
                    <div className="tractors-list-header-row">
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
            <div className="content-container">
                {isLoading ? (
                    <div className="loading-container">
                        <LoadingScreen message="Loading tractors..." inline={true}/>
                    </div>
                ) : filteredTractors.length === 0 ? (
                    <div className="no-results-container">
                        <div className="no-results-icon">
                            <i className="fas fa-truck"></i>
                        </div>
                        <h3>No Tractors Found</h3>
                        <p>{searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses') ? "No tractors match your search criteria." : "There are no tractors in the system yet."}</p>
                        <button className="primary-button" onClick={() => setShowAddSheet(true)}>Add Tractor</button>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className={`tractors-grid ${searchText ? 'search-results' : ''}`}>
                        {filteredTractors.map(tractor => (
                            <TractorCard
                                key={tractor.id}
                                tractor={{...tractor, operatorSmyrnaId: getOperatorSmyrnaId(tractor.assignedOperator)}}
                                operatorName={getOperatorName(tractor.assignedOperator)}
                                plantName={getPlantName(tractor.assignedPlant)}
                                showOperatorWarning={isOperatorAssignedToMultipleTractors(tractor.assignedOperator)}
                                onSelect={() => handleSelectTractor(tractor.id)}
                            />
                        ))}
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="tractors-list-table-container">
                        <table className="tractors-list-table">
                            <tbody>
                            {filteredTractors.map(tractor => {
                                const commentsCount = Number(tractor.commentsCount || 0)
                                const issuesCount = Number(tractor.openIssuesCount || 0)
                                return (
                                    <tr key={tractor.id} onClick={() => handleSelectTractor(tractor.id)}
                                        style={{cursor: 'pointer'}}>
                                        <td>{tractor.assignedPlant ? tractor.assignedPlant : "---"}</td>
                                        <td>{tractor.truckNumber ? tractor.truckNumber : "---"}</td>
                                        <td>
                                            <span
                                                className="item-status-dot"
                                                style={{
                                                    display: 'inline-block',
                                                    verticalAlign: 'middle',
                                                    marginRight: '8px',
                                                    backgroundColor:
                                                        tractor.status === 'Active' ? 'var(--status-active)' :
                                                            tractor.status === 'Spare' ? 'var(--status-spare)' :
                                                                tractor.status === 'In Shop' ? 'var(--status-inshop)' :
                                                                    tractor.status === 'Retired' ? 'var(--status-retired)' :
                                                                        'var(--accent)'
                                                }}
                                            ></span>
                                            {tractor.status ? tractor.status : "---"}
                                        </td>
                                        <td>
                                            {getOperatorName(tractor.assignedOperator) ? getOperatorName(tractor.assignedOperator) : "---"}
                                            {isOperatorAssignedToMultipleTractors(tractor.assignedOperator) && (
                                                <span className="warning-badge">
                                                    <i className="fas fa-exclamation-triangle"></i>
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {(() => {
                                                const rating = Math.round(tractor.cleanlinessRating || 0)
                                                const stars = rating > 0 ? rating : 1
                                                return Array.from({length: stars}).map((_, i) => (
                                                    <i key={i} className="fas fa-star" style={{color: 'var(--accent)'}}></i>
                                                ))
                                            })()}
                                        </td>
                                        <td>{tractor.vin ? tractor.vin : "---"}</td>
                                        <td>
                                            {tractor.isVerified() ? (
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
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setModalTractorId(tractor.id)
                                                        setModalTractorNumber(tractor.truckNumber || '')
                                                        setShowCommentModal(true)
                                                    }}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        padding: 0,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        cursor: 'pointer'
                                                    }}
                                                    title="View comments"
                                                >
                                                    <i className="fas fa-comments"
                                                       style={{color: 'var(--accent)', marginRight: 4}}></i>
                                                    <span>{commentsCount}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setModalTractorId(tractor.id)
                                                        setModalTractorNumber(tractor.truckNumber || '')
                                                        setShowIssueModal(true)
                                                    }}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        padding: 0,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        cursor: 'pointer',
                                                        marginLeft: 12
                                                    }}
                                                    title="View issues"
                                                >
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
                ) : (
                    <div className="no-results-container">
                        <div className="no-results-icon">
                            <i className="fas fa-truck"></i>
                        </div>
                        <h3>No Tractors Found</h3>
                        <p>{searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses') ? "No tractors match your search criteria." : "There are no tractors in the system yet."}</p>
                        <button className="primary-button" onClick={() => setShowAddSheet(true)}>Add Tractor</button>
                    </div>
                )}
            </div>
            {showAddSheet && (
                <TractorAddView
                    plants={plants}
                    operators={operators}
                    onClose={() => setShowAddSheet(false)}
                    onTractorAdded={newTractor => setTractors([...tractors, newTractor])}
                />
            )}
            {showOverview && <OverviewPopup/>}
            {showCommentModal && (
                <TractorCommentModal
                    tractorId={modalTractorId}
                    tractorNumber={modalTractorNumber}
                    onClose={() => setShowCommentModal(false)}
                />
            )}
            {showIssueModal && (
                <TractorIssueModal
                    tractorId={modalTractorId}
                    tractorNumber={modalTractorNumber}
                    onClose={() => setShowIssueModal(false)}
                />
            )}
        </div>
    )
}

TractorsView.propTypes = {title: PropTypes.string, onSelectTractor: PropTypes.func}

export default TractorsView
