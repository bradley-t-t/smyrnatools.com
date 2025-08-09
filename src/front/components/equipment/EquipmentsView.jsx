import React, { useEffect, useState } from 'react';
import EquipmentAddView from './EquipmentAddView';
import EquipmentUtility from '../../../utils/EquipmentUtility';
import { EquipmentService } from '../../../services/EquipmentService';
import { PlantService } from '../../../services/PlantService';
import LoadingScreen from '../common/LoadingScreen';
import { usePreferences } from '../../../app/context/PreferencesContext';
import EquipmentCard from './EquipmentCard';
import EquipmentOverview from './EquipmentOverview';
import EquipmentDetailView from './EquipmentDetailView';
import '../../styles/FilterStyles.css';
import './styles/EquipmentsView.css';

function EquipmentsView({ title = 'Equipment Fleet', showSidebar, setShowSidebar, onSelectEquipment }) {
    const { preferences, updateEquipmentFilter, resetEquipmentFilters, saveLastViewedFilters } = usePreferences();
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
    const filterOptions = ['All Statuses', 'Active', 'Spare', 'In Shop', 'Retired', 'Past Due Service', 'Open Issues'];

    useEffect(() => {
        async function fetchAllData() {
            setIsLoading(true);
            try {
                await Promise.all([fetchEquipments(), fetchPlants()]);
            } catch (error) {
            } finally {
                setIsLoading(false);
            }
        }
        fetchAllData();
        if (preferences?.equipmentFilters) {
            setSearchText(preferences.equipmentFilters.searchText || '');
            setSelectedPlant(preferences.equipmentFilters.selectedPlant || '');
            setStatusFilter(preferences.equipmentFilters.statusFilter || '');
        }
        if (preferences?.autoOverview) {
            setShowOverview(true);
        }
    }, [preferences]);

    async function fetchEquipments() {
        try {
            const data = await EquipmentService.fetchEquipments();
            const processedData = await Promise.all(data.map(async equipment => {
                try {
                    const issues = await EquipmentService.fetchIssues(equipment.id);
                    equipment.issues = issues || [];
                } catch {
                    equipment.issues = [];
                }
                return equipment;
            }));
            setEquipments(processedData);
        } catch (error) {
        }
    }

    async function fetchPlants() {
        try {
            const data = await PlantService.fetchPlants();
            setPlants(data);
        } catch (error) {
        }
    }

    function getPlantName(plantCode) {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode || 'No Plant';
    }

    function handleSelectEquipment(equipmentId) {
        const equipment = equipments.find(e => e.id === equipmentId);
        if (equipment) {
            saveLastViewedFilters();
            setSelectedEquipment(equipment);
            if (onSelectEquipment) onSelectEquipment(equipmentId);
        }
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

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const pad = n => n.toString().padStart(2, '0');
        const yyyy = date.getFullYear();
        const mm = pad(date.getMonth() + 1);
        const dd = pad(date.getDate());
        const hh = pad(date.getHours());
        const min = pad(date.getMinutes());
        return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
    }

    function getFiltersAppliedString() {
        const filters = [];
        if (searchText) filters.push(`Search: ${searchText}`);
        if (selectedPlant) {
            const plant = plants.find(p => p.plantCode === selectedPlant);
            filters.push(`Plant: ${plant ? plant.plantName : selectedPlant}`);
        }
        if (statusFilter && statusFilter !== 'All Statuses') filters.push(`Status: ${statusFilter}`);
        return filters.length ? filters.join(', ') : 'No Filters';
    }

    function exportEquipmentsToCSV(equipmentsToExport) {
        if (!equipmentsToExport || equipmentsToExport.length === 0) return;
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const yyyy = now.getFullYear();
        const mm = pad(now.getMonth() + 1);
        const dd = pad(now.getDate());
        const hh = pad(now.getHours());
        const min = pad(now.getMinutes());
        const formattedNow = `${mm}-${dd}-${yyyy} ${hh}-${min}`;
        const filtersApplied = getFiltersAppliedString();
        const fileName = `Equipment Export - ${formattedNow} - ${filtersApplied}.csv`;
        const topHeader = `Equipment Export - ${formattedNow} - ${filtersApplied}`;
        const headers = [
            'Identifying Number',
            'Status',
            'Equipment Type',
            'Assigned Plant',
            'Last Service Date',
            'Cleanliness Rating',
            'Open Issues'
        ];
        const rows = equipmentsToExport.map(equipment => [
            equipment.identifyingNumber || '',
            equipment.status || '',
            equipment.equipmentType || '',
            getPlantName(equipment.assignedPlant),
            formatDate(equipment.lastServiceDate),
            equipment.cleanlinessRating || '',
            Array.isArray(equipment.issues) ? equipment.issues.filter(issue => !issue.time_completed).length : 0
        ]);
        const csvContent = [
            `"${topHeader}"`,
            headers.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','),
            ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    const filteredEquipments = equipments
        .filter(equipment => {
            const matchesSearch = !searchText.trim() ||
                equipment.identifyingNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
                equipment.equipmentType?.toLowerCase().includes(searchText.toLowerCase());
            const matchesPlant = !selectedPlant || equipment.assignedPlant === selectedPlant;
            let matchesStatus = true;
            if (statusFilter && statusFilter !== 'All Statuses') {
                matchesStatus = ['Active', 'Spare', 'In Shop', 'Retired'].includes(statusFilter)
                    ? equipment.status === statusFilter
                    : statusFilter === 'Past Due Service'
                        ? EquipmentUtility.isServiceOverdue(equipment.lastServiceDate)
                        : statusFilter === 'Open Issues'
                            ? equipment.issues?.some(issue => !issue.time_completed)
                            : false;
            }
            return matchesSearch && matchesPlant && matchesStatus;
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

    const statusCounts = ['Active', 'Spare', 'In Shop', 'Retired'].map(status => ({
        status,
        count: equipments.filter(e => e.status === status).length
    }));
    const pastDueServiceCount = equipments.filter(e => EquipmentUtility.isServiceOverdue(e.lastServiceDate)).length;
    const openIssuesCount = equipments.filter(e => e.issues?.some(issue => !issue.time_completed)).length;

    function averageCleanliness() {
        const ratings = equipments.filter(e => e.cleanlinessRating).map(e => e.cleanlinessRating);
        return ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : 'Not Assigned';
    }

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

    return (
        <div className="dashboard-container equipments-view">
            {selectedEquipment ? (
                <EquipmentDetailView
                    equipmentId={selectedEquipment.id}
                    onClose={() => setSelectedEquipment(null)}
                />
            ) : (
                <>
                    <div className="dashboard-header">
                        <h1>{title}</h1>
                        <div className="dashboard-actions">
                            <button
                                className="action-button primary rectangular-button"
                                style={{marginRight: 8, minWidth: 210}}
                                onClick={() => exportEquipmentsToCSV(filteredEquipments)}
                            >
                                <i className="fas fa-file-export" style={{marginRight: 8}}></i> Export
                            </button>
                            <button
                                className="action-button primary rectangular-button"
                                onClick={() => setShowAddSheet(true)}
                                style={{ height: '44px', lineHeight: '1' }}
                            >
                                <i className="fas fa-plus" style={{ marginRight: '8px' }}></i> Add Equipment
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
                                onChange={e => {
                                    setSearchText(e.target.value);
                                    safeUpdateEquipmentFilter('searchText', e.target.value);
                                }}
                            />
                            {searchText && (
                                <button className="clear" onClick={() => {
                                    setSearchText('');
                                    safeUpdateEquipmentFilter('searchText', '');
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
                                        setSelectedPlant(e.target.value);
                                        safeUpdateEquipmentFilter('selectedPlant', e.target.value);
                                    }}
                                    aria-label="Filter by plant"
                                    style={{'--select-active-border': 'var(--accent)', '--select-focus-border': 'var(--accent)'}}
                                >
                                    <option value="">All Plants</option>
                                    {plants.sort((a, b) => parseInt(a.plantCode?.replace(/\D/g, '') || '0') - parseInt(b.plantCode?.replace(/\D/g, '') || '0')).map(plant => (
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
                                    style={{'--select-active-border': 'var(--accent)', '--select-focus-border': 'var(--accent)'}}
                                >
                                    {filterOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            {(searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses')) && (
                                <button className="filter-reset-button" onClick={() => {
                                    setSearchText('');
                                    setSelectedPlant('');
                                    setStatusFilter('');
                                    resetEquipmentFilters?.();
                                }}>
                                    <i className="fas fa-undo"></i> Reset Filters
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
                                <LoadingScreen message="Loading equipment..." inline={true} />
                            </div>
                        ) : filteredEquipments.length === 0 ? (
                            <div className="no-results-container">
                                <div className="no-results-icon">
                                    <i className="fas fa-truck-loading"></i>
                                </div>
                                <h3>No Equipment Found</h3>
                                <p>{searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses') ? "No equipment matches your search criteria." : "There is no equipment in the system yet."}</p>
                                <button className="primary-button" onClick={() => setShowAddSheet(true)}>Add Equipment</button>
                            </div>
                        ) : (
                            <div className={`equipments-grid ${searchText ? 'search-results' : ''}`}>
                                {filteredEquipments.map(equipment => (
                                    <EquipmentCard
                                        key={equipment.id}
                                        equipment={equipment}
                                        plantName={getPlantName(equipment.assignedPlant)}
                                        onSelect={handleSelectEquipment}
                                    />
                                ))}
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
                    {showOverview && <OverviewPopup />}
                </>
            )}
        </div>
    );
}

export default EquipmentsView;
