import React, {useEffect, useState} from 'react';
import {usePreferences} from '../../../app/context/PreferencesContext';
import LoadingScreen from '../common/LoadingScreen';
import TractorCard from './TractorCard';
import TractorOverview from './TractorOverview';
import '../../styles/FilterStyles.css';
import './styles/TractorsView.css';
import { TractorService } from '../../../services/TractorService';
import {TractorUtility} from "../../../utils/TractorUtility";
import {OperatorService} from "../../../services/OperatorService";
import {PlantService} from "../../../services/PlantService";
import TractorAddView from "./TractorAddView";
import TractorDetailView from "./TractorDetailView";

function TractorsView({title = 'Tractor Fleet', showSidebar, setShowSidebar, onSelectTractor}) {
    const {preferences, resetTractorFilters, saveLastViewedFilters, updatePreferences} = usePreferences();
    const [tractors, setTractors] = useState([]);
    const [operators, setOperators] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchText, setSearchText] = useState(preferences.tractorFilters?.searchText || '');
    const [selectedPlant, setSelectedPlant] = useState(preferences.tractorFilters?.selectedPlant || '');
    const [statusFilter, setStatusFilter] = useState(preferences.tractorFilters?.statusFilter || '');
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [showOverview, setShowOverview] = useState(false);
    const [selectedTractor, setSelectedTractor] = useState(null)
    const [reloadTractors, setReloadTractors] = useState(false)
    const filterOptions = ['All Statuses', 'Active', 'Spare', 'In Shop', 'Retired', 'Past Due Service', 'Verified', 'Not Verified', 'Open Issues'];

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
        }
        if (preferences?.autoOverview) {
            setShowOverview(true)
        }
    }, [preferences, reloadTractors]);

    async function fetchTractors() {
        try {
            const data = await TractorService.fetchTractors();
            const processedData = await Promise.all(data.map(async tractor => {
                let latestHistoryDate = null;
                try {
                    const history = await TractorService.getTractorHistory(tractor.id, 1);
                    latestHistoryDate = history[0]?.changedAt || null;
                } catch {}
                try {
                    const issues = await TractorService.fetchIssues(tractor.id);
                    tractor.issues = issues || [];
                } catch {
                    tractor.issues = [];
                }
                tractor.isVerified = () => TractorUtility.isVerified(tractor.updatedLast, tractor.updatedAt, tractor.updatedBy, latestHistoryDate);
                tractor.latestHistoryDate = latestHistoryDate;
                return tractor;
            }));

            for (const tractor of processedData) {
                if (
                    tractor.status === 'Active' &&
                    (
                        !tractor.assignedOperator ||
                        tractor.assignedOperator === '0' ||
                        tractor.assignedOperator === '' ||
                        tractor.assignedOperator === null
                    )
                ) {
                    let cleanlinessRating = tractor.cleanlinessRating;
                    if (!cleanlinessRating || isNaN(cleanlinessRating) || cleanlinessRating < 1) {
                        cleanlinessRating = 1;
                    }
                    let updatedTractor = {...tractor, status: 'Spare', cleanlinessRating};
                    if (!updatedTractor.truckNumber) updatedTractor.truckNumber = tractor.truckNumber || '';
                    if (!updatedTractor.assignedPlant) updatedTractor.assignedPlant = tractor.assignedPlant || '';
                    if (!updatedTractor.hasOwnProperty('hasBlower')) updatedTractor.hasBlower = !!tractor.hasBlower;
                    if (!updatedTractor.hasOwnProperty('vin')) updatedTractor.vin = tractor.vin || '';
                    if (!updatedTractor.hasOwnProperty('make')) updatedTractor.make = tractor.make || '';
                    if (!updatedTractor.hasOwnProperty('model')) updatedTractor.model = tractor.model || '';
                    if (!updatedTractor.hasOwnProperty('year')) updatedTractor.year = tractor.year || '';
                    if (!updatedTractor.hasOwnProperty('lastServiceDate')) updatedTractor.lastServiceDate = tractor.lastServiceDate || null;
                    try {
                        await TractorService.updateTractor(
                            tractor.id,
                            updatedTractor,
                            undefined,
                            tractor
                        );
                        tractor.status = 'Spare';
                        tractor.cleanlinessRating = cleanlinessRating;
                    } catch (e) {}
                }
            }

            setTractors(processedData);
        } catch (error) {
            console.error('Error fetching tractors:', error);
        }
    }

    async function fixActiveTractorsWithoutOperator(tractorsList) {
        const updates = tractorsList
            .filter(m => m.status === 'Active' && (!m.assignedOperator || m.assignedOperator === '0'));
        for (const tractor of updates) {
            try {
                await TractorService.updateTractor(tractor.id, {...tractor, status: 'Spare'}, undefined, tractor);
                tractor.status = 'Spare';
            } catch (e) {}
        }
    }

    async function fetchOperators() {
        try {
            const data = await OperatorService.fetchOperators();
            setOperators(Array.isArray(data) ? data : []);
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
            setStatusFilter('');
            updatePreferences(prev => ({
                ...prev,
                tractorFilters: {
                    ...prev.tractorFilters,
                    statusFilter: ''
                }
            }));
        } else {
            setStatusFilter(status);
            updatePreferences(prev => ({
                ...prev,
                tractorFilters: {
                    ...prev.tractorFilters,
                    statusFilter: status
                }
            }));
        }
        setShowOverview(false);
    }

    function handleBackFromDetail() {
        setSelectedTractor(null)
        setReloadTractors(r => !r)
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

    function exportTractorsToCSV(tractorsToExport) {
        if (!tractorsToExport || tractorsToExport.length === 0) return;
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const yyyy = now.getFullYear();
        const mm = pad(now.getMonth() + 1);
        const dd = pad(now.getDate());
        const hh = pad(now.getHours());
        const min = pad(now.getMinutes());
        const formattedNow = `${mm}-${dd}-${yyyy} ${hh}-${min}`;
        const filtersApplied = getFiltersAppliedString();
        const fileName = `Tractor Export - ${formattedNow} - ${filtersApplied}.csv`;
        const topHeader = `Tractor Export - ${formattedNow} - ${filtersApplied}`;
        const headers = [
            'Truck Number',
            'Status',
            'Assigned Operator',
            'Operator Smyrna ID',
            'Assigned Plant',
            'Last Service Date',
            'Cleanliness Rating',
            'Open Issues'
        ];
        const rows = tractorsToExport.map(tractor => [
            tractor.truckNumber || '',
            tractor.status || '',
            getOperatorName(tractor.assignedOperator),
            getOperatorSmyrnaId(tractor.assignedOperator),
            getPlantName(tractor.assignedPlant),
            formatDate(tractor.lastServiceDate),
            tractor.cleanlinessRating || '',
            Array.isArray(tractor.issues) ? tractor.issues.filter(issue => !issue.time_completed).length : 0
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

    const filteredTractors = tractors
        .filter(tractor => {
            const matchesSearch = !searchText.trim() ||
                tractor.truckNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
                (tractor.assignedOperator && operators.find(op => op.employeeId === tractor.assignedOperator)?.name.toLowerCase().includes(searchText.toLowerCase()));
            const matchesPlant = !selectedPlant || tractor.assignedPlant === selectedPlant;
            let matchesStatus = true;
            if (statusFilter && statusFilter !== 'All Statuses') {
                matchesStatus = ['Active', 'Spare', 'In Shop', 'Retired'].includes(statusFilter) ? tractor.status === statusFilter :
                    statusFilter === 'Past Due Service' ? TractorUtility.isServiceOverdue(tractor.lastServiceDate) :
                        statusFilter === 'Verified' ? tractor.isVerified() :
                            statusFilter === 'Not Verified' ? !tractor.isVerified() :
                                statusFilter === 'Open Issues' ? tractor.issues?.some(issue => !issue.time_completed) : false;
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
            const aNum = parseInt(a.truckNumber?.replace(/\D/g, '') || '0');
            const bNum = parseInt(b.truckNumber?.replace(/\D/g, '') || '0');
            return !isNaN(aNum) && !isNaN(bNum) ? aNum - bNum : (a.truckNumber || '').localeCompare(b.truckNumber || '');
        });

    const statusCounts = ['Active', 'Spare', 'In Shop', 'Retired'].map(status => ({
        status,
        count: tractors.filter(m => m.status === status).length
    }));
    const pastDueServiceCount = tractors.filter(m => TractorUtility.isServiceOverdue(m.lastServiceDate)).length;
    const verifiedCount = tractors.filter(m => m.isVerified()).length;
    const unverifiedCount = tractors.length - verifiedCount;
    const neverVerifiedCount = tractors.filter(m => !m.updatedLast || !m.updatedBy).length;
    const openIssuesCount = tractors.filter(m => m.issues?.some(issue => !issue.time_completed)).length;

    function averageCleanliness() {
        const ratings = tractors.filter(m => m.cleanlinessRating).map(m => m.cleanlinessRating);
        return ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : 'Not Assigned';
    }

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

    if (selectedTractor) {
        return (
            <TractorDetailView
                tractorId={selectedTractor}
                onClose={handleBackFromDetail}
            />
        );
    }

    return (
        <div className="dashboard-container tractors-view">
            <div className="dashboard-header">
                <h1>{title}</h1>
                <div className="dashboard-actions">
                    <button
                        className="action-button primary rectangular-button"
                        style={{marginRight: 8, minWidth: 210}}
                        onClick={() => exportTractorsToCSV(filteredTractors)}
                    >
                        <i className="fas fa-file-export" style={{marginRight: 8}}></i> Export
                    </button>
                    <button
                        className="action-button primary rectangular-button"
                        onClick={() => setShowAddSheet(true)}
                        style={{ height: '44px', lineHeight: '1' }}
                    >
                        <i className="fas fa-plus" style={{ marginRight: '8px' }}></i> Add Tractor
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
                        onChange={e => {
                            setSearchText(e.target.value);
                            updatePreferences(prev => ({
                                ...prev,
                                tractorFilters: {
                                    ...prev.tractorFilters,
                                    searchText: e.target.value
                                }
                            }));
                        }}
                    />
                    {searchText && (
                        <button className="clear" onClick={() => {
                            setSearchText('');
                            updatePreferences(prev => ({
                                ...prev,
                                tractorFilters: {
                                    ...prev.tractorFilters,
                                    searchText: ''
                                }
                            }));
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
                                updatePreferences(prev => ({
                                    ...prev,
                                    tractorFilters: {
                                        ...prev.tractorFilters,
                                        selectedPlant: e.target.value
                                    }
                                }));
                            }}
                            aria-label="Filter by plant"
                            style={{'--select-active-border': preferences.accentColor === 'red' ? '#b80017' : '#003896', '--select-focus-border': preferences.accentColor === 'red' ? '#b80017' : '#003896'}}
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
                                updatePreferences(prev => ({
                                    ...prev,
                                    tractorFilters: {
                                        ...prev.tractorFilters,
                                        statusFilter: e.target.value
                                    }
                                }));
                            }}
                            style={{'--select-active-border': preferences.accentColor === 'red' ? '#b80017' : '#003896', '--select-focus-border': preferences.accentColor === 'red' ? '#b80017' : '#003896'}}
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
                            updatePreferences(prev => ({
                                ...prev,
                                tractorFilters: {
                                    ...prev.tractorFilters,
                                    searchText: '',
                                    selectedPlant: '',
                                    statusFilter: ''
                                }
                            }));
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
                        <LoadingScreen message="Loading tractors..." inline={true} />
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
                ) : (
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
            {showOverview && <OverviewPopup />}
        </div>
    );
}

export default TractorsView;
