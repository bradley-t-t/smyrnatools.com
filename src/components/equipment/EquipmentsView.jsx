import React, {useEffect, useState, useMemo, useCallback} from 'react';
import EquipmentAddView from './EquipmentAddView';
import EquipmentUtility from '../../utils/EquipmentUtility';
import {EquipmentService} from '../../services/EquipmentService';
import {PlantService} from '../../services/PlantService';
import LoadingScreen from '../common/LoadingScreen';
import {usePreferences} from '../../app/context/PreferencesContext';
import EquipmentCard from './EquipmentCard';
import EquipmentOverview from './EquipmentOverview';
import EquipmentDetailView from './EquipmentDetailView';
import '../../styles/FilterStyles.css';
import './styles/EquipmentsView.css';
import EquipmentIssueModal from './EquipmentIssueModal'
import EquipmentCommentModal from './EquipmentCommentModal'
import {RegionService} from '../../services/RegionService'

function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

function EquipmentsView({title = 'Equipment Fleet', onSelectEquipment}) {
    const {preferences, updateEquipmentFilter, resetEquipmentFilters, saveLastViewedFilters} = usePreferences();
    const safeUpdateEquipmentFilter = typeof updateEquipmentFilter === 'function' ? updateEquipmentFilter : () => {};
    const [equipments, setEquipments] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchText, setSearchText] = useState(preferences.equipmentFilters?.searchText || '');
    const [selectedPlant, setSelectedPlant] = useState(preferences.equipmentFilters?.selectedPlant || '');
    const [statusFilter, setStatusFilter] = useState(preferences.equipmentFilters?.statusFilter || '');
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [showOverview, setShowOverview] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [viewMode, setViewMode] = useState(() => {
        if (preferences.equipmentFilters?.viewMode !== undefined && preferences.equipmentFilters?.viewMode !== null) return preferences.equipmentFilters.viewMode
        if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) return preferences.defaultViewMode
        const lastUsed = localStorage.getItem('equipments_last_view_mode')
        return lastUsed || 'grid'
    });
    const [showIssueModal, setShowIssueModal] = useState(false)
    const [showCommentModal, setShowCommentModal] = useState(false)
    const [modalEquipmentId, setModalEquipmentId] = useState(null)
    const [modalEquipmentNumber, setModalEquipmentNumber] = useState('')
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)
    const filterOptions = ['All Statuses', 'Active', 'Spare', 'In Shop', 'Retired', 'Past Due Service', 'Open Issues'];

    useEffect(() => {
        async function fetchAllData() {
            setIsLoading(true);
            try {
                await Promise.all([fetchEquipments(), fetchPlants()]);
            } finally {
                setIsLoading(false);
            }
        }
        fetchAllData();
        if (preferences?.equipmentFilters) {
            setSearchText(preferences.equipmentFilters.searchText || '');
            setSelectedPlant(preferences.equipmentFilters.selectedPlant || '');
            setStatusFilter(preferences.equipmentFilters.statusFilter || '');
            setViewMode(preferences.equipmentFilters.viewMode || preferences.defaultViewMode || 'grid');
        }
        if (preferences?.autoOverview) setShowOverview(true);
    }, [preferences]);

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
                    safeUpdateEquipmentFilter('selectedPlant', '')
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

    async function fetchEquipments() {
        try {
            const data = await EquipmentService.fetchEquipments();
            setEquipments(Array.isArray(data) ? data : []);
        } catch {
            setEquipments([]);
        }
    }

    async function fetchPlants() {
        try {
            const data = await PlantService.fetchPlants();
            setPlants(data);
        } catch {}
    }

    function getPlantName(plantCode) {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode || 'No Plant';
    }

    function handleSelectEquipment(equipmentId) {
        const equipment = equipments.find(e => e.id === equipmentId);
        if (!equipment || !equipment.id) return;
        saveLastViewedFilters();
        setSelectedEquipment(equipment);
        if (onSelectEquipment) onSelectEquipment(equipmentId);
    }

    function handleStatusClick(status) {
        if (status === 'All Statuses') {
            setStatusFilter('');
            safeUpdateEquipmentFilter('statusFilter', '');
        } else {
            setStatusFilter(status);
            safeUpdateEquipmentFilter('statusFilter', status);
        }
        setShowOverview(false);
    }

    const debouncedSetSearchText = useCallback(debounce((value) => {
        setSearchText(value);
        safeUpdateEquipmentFilter('searchText', value);
    }, 300), [safeUpdateEquipmentFilter]);

    const filteredEquipments = useMemo(() => {
        return equipments
            .filter(equipment => {
                const matchesSearch = !searchText.trim() ||
                    equipment.identifyingNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
                    equipment.equipmentType?.toLowerCase().includes(searchText.toLowerCase());
                const matchesPlant = !selectedPlant || equipment.assignedPlant === selectedPlant;
                const matchesRegion = !preferences.selectedRegion?.code || !regionPlantCodes || regionPlantCodes.has(equipment.assignedPlant);
                let matchesStatus = true;
                if (statusFilter && statusFilter !== 'All Statuses') {
                    matchesStatus = ['Active', 'Spare', 'In Shop', 'Retired'].includes(statusFilter)
                        ? equipment.status === statusFilter
                        : statusFilter === 'Past Due Service'
                            ? EquipmentUtility.isServiceOverdue(equipment.lastServiceDate)
                            : statusFilter === 'Open Issues'
                                ? Number(equipment.openIssuesCount || 0) > 0
                                : false;
                }
                return matchesSearch && matchesPlant && matchesRegion && matchesStatus;
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
                const aNum = parseInt(a.identifyingNumber?.replace(/\D/g, '') || '0');
                const bNum = parseInt(b.identifyingNumber?.replace(/\D/g, '') || '0');
                return !isNaN(aNum) && !isNaN(bNum) ? aNum - bNum : (a.identifyingNumber || '').localeCompare(b.identifyingNumber || '');
            });
    }, [equipments, selectedPlant, searchText, statusFilter, preferences.selectedRegion?.code, regionPlantCodes]);

    const OverviewPopup = () => (
        <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Equipment Overview</h2>
                    <button className="close-button" onClick={() => setShowOverview(false)}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <EquipmentOverview
                        filteredEquipments={filteredEquipments}
                        selectedPlant={selectedPlant}
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
        if (preferences.equipmentFilters?.viewMode !== undefined && preferences.equipmentFilters?.viewMode !== null) {
            setViewMode(preferences.equipmentFilters.viewMode)
        } else if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) {
            setViewMode(preferences.defaultViewMode)
        } else {
            const lastUsed = localStorage.getItem('equipments_last_view_mode')
            if (lastUsed) setViewMode(lastUsed)
        }
    }, [preferences])

    function handleViewModeChange(mode) {
        if (viewMode === mode) {
            setViewMode(null)
            updateEquipmentFilter('viewMode', null)
            localStorage.removeItem('equipments_last_view_mode')
        } else {
            setViewMode(mode)
            updateEquipmentFilter('viewMode', mode)
            localStorage.setItem('equipments_last_view_mode', mode)
        }
    }

    return (
        <div className="dashboard-container equipments-view">
            {selectedEquipment ? (
                <EquipmentDetailView
                    equipmentId={selectedEquipment.id}
                    onClose={() => setSelectedEquipment(null)}
                />
            ) : (
                <>
                    <div className="equipments-sticky-header">
                        <div className="dashboard-header">
                            <h1>{title}</h1>
                            <div className="dashboard-actions">
                                <button
                                    className="action-button primary rectangular-button"
                                    onClick={() => setShowAddSheet(true)}
                                    style={{height: '44px', lineHeight: '1'}}
                                >
                                    <i className="fas fa-plus" style={{marginRight: '8px'}}></i> Add Equipment
                                </button>
                            </div>
                        </div>
                        <div className="search-filters">
                            <div className="search-bar">
                                <input
                                    type="text"
                                    className="ios-search-input"
                                    placeholder="Search by identifying number or equipment type..."
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
                                            setSelectedPlant(e.target.value);
                                            safeUpdateEquipmentFilter('selectedPlant', e.target.value);
                                        }}
                                        aria-label="Filter by plant"
                                        style={{
                                            '--select-active-border': 'var(--accent)',
                                            '--select-focus-border': 'var(--accent)'
                                        }}
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
                                            setStatusFilter(e.target.value);
                                            safeUpdateEquipmentFilter('statusFilter', e.target.value);
                                        }}
                                        style={{
                                            '--select-active-border': 'var(--accent)',
                                            '--select-focus-border': 'var(--accent)'
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
                                        setSelectedPlant('')
                                        setStatusFilter('')
                                        resetEquipmentFilters({keepViewMode: true, currentViewMode: viewMode})
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
                            <div className="equipments-list-header-row">
                                <div>Plant</div>
                                <div>Identifying #</div>
                                <div>Status</div>
                                <div>Type</div>
                                <div>Cleanliness</div>
                                <div>Condition</div>
                                <div>More</div>
                            </div>
                        )}
                    </div>
                    <div className="content-container">
                        {isLoading ? (
                            <div className="loading-container">
                                <LoadingScreen message="Loading equipment..." inline={true}/>
                            </div>
                        ) : filteredEquipments.length === 0 ? (
                            <div className="no-results-container">
                                <div className="no-results-icon">
                                    <i className="fas fa-truck-loading"></i>
                                </div>
                                <h3>No Equipment Found</h3>
                                <p>{searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses') ? "No equipment matches your search criteria." : "There is no equipment in the system yet."}</p>
                                <button className="primary-button" onClick={() => setShowAddSheet(true)}>Add Equipment
                                </button>
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className={`equipments-grid ${searchText ? 'search-results' : ''}`}>
                                {filteredEquipments.map(equipment => (
                                    <EquipmentCard
                                        key={equipment.id}
                                        equipment={equipment}
                                        plantName={getPlantName(equipment.assignedPlant)}
                                        onSelect={() => handleSelectEquipment(equipment.id)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="equipments-list-table-container">
                                <table className="equipments-list-table">
                                    <tbody>
                                    {filteredEquipments.map(equipment => {
                                        const issuesCount = Number(equipment.openIssuesCount || 0)
                                        const commentsCount = Number(equipment.commentsCount || 0)
                                        return (
                                            <tr key={equipment.id} onClick={() => handleSelectEquipment(equipment.id)}
                                                style={{cursor: 'pointer'}}>
                                                <td>{equipment.assignedPlant ? equipment.assignedPlant : "---"}</td>
                                                <td>{equipment.identifyingNumber ? equipment.identifyingNumber : "---"}</td>
                                                <td>
                                                        <span
                                                            className="item-status-dot"
                                                            style={{
                                                                display: 'inline-block',
                                                                verticalAlign: 'middle',
                                                                marginRight: '8px',
                                                                backgroundColor:
                                                                    equipment.status === 'Active' ? 'var(--status-active)' :
                                                                        equipment.status === 'Spare' ? 'var(--status-spare)' :
                                                                            equipment.status === 'In Shop' ? 'var(--status-inshop)' :
                                                                                equipment.status === 'Retired' ? 'var(--status-retired)' :
                                                                                    'var(--accent)',
                                                            }}
                                                        ></span>
                                                    {equipment.status ? equipment.status : "---"}
                                                </td>
                                                <td>{equipment.equipmentType ? equipment.equipmentType : "---"}</td>
                                                <td>
                                                    {(() => {
                                                        const rating = Math.round(equipment.cleanlinessRating || 0)
                                                        const stars = rating > 0 ? rating : 1
                                                        return Array.from({length: stars}).map((_, i) => (
                                                            <i key={i} className="fas fa-star"
                                                               style={{color: 'var(--accent)'}}></i>
                                                        ))
                                                    })()}
                                                </td>
                                                <td>
                                                    {(() => {
                                                        const rating = Math.round(equipment.conditionRating || 0)
                                                        const stars = rating > 0 ? rating : 1
                                                        return Array.from({length: stars}).map((_, i) => (
                                                            <i key={i} className="fas fa-star"
                                                               style={{color: 'var(--accent)'}}></i>
                                                        ))
                                                    })()}
                                                </td>
                                                <td>
                                                    <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setModalEquipmentId(equipment.id)
                                                                setModalEquipmentNumber(equipment.identifyingNumber || '')
                                                                setShowIssueModal(true)
                                                            }}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                padding: 0,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                cursor: 'pointer'
                                                            }}
                                                            title="View issues"
                                                        >
                                                            <i className="fas fa-tools"
                                                               style={{color: 'var(--accent)', marginRight: 4}}></i>
                                                            <span>{issuesCount}</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setModalEquipmentId(equipment.id)
                                                                setModalEquipmentNumber(equipment.identifyingNumber || '')
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
                                                            <i className="fas fa-comment"
                                                               style={{color: 'var(--accent)', marginRight: 4}}></i>
                                                            <span>{commentsCount}</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    {showAddSheet && (
                        <EquipmentAddView
                            plants={plants}
                            onClose={() => setShowAddSheet(false)}
                            onEquipmentAdded={newEquipment => setEquipments([...equipments, newEquipment])}
                        />
                    )}
                    {showOverview && <OverviewPopup/>}
                    {showCommentModal && (
                        <EquipmentCommentModal
                            equipmentId={modalEquipmentId}
                            equipmentNumber={modalEquipmentNumber}
                            onClose={() => setShowCommentModal(false)}
                        />
                    )}
                    {showIssueModal && (
                        <EquipmentIssueModal
                            equipmentId={modalEquipmentId}
                            equipmentNumber={modalEquipmentNumber}
                            onClose={() => setShowIssueModal(false)}
                        />
                    )}
                </>
            )}
        </div>
    );
}

export default EquipmentsView;
