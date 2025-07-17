import React, {useEffect, useState} from 'react';
import MixerAddView from './MixerAddView';
import {MixerUtility} from '../../utils/MixerUtility';
import {MixerService} from '../../services/MixerService';
import {PlantService} from '../../services/PlantService';
import {OperatorService} from '../../services/OperatorService';
import LoadingScreen from '../common/LoadingScreen';
import {MixerMaintenanceService} from '../../services/MixerMaintenanceService';
import {usePreferences} from '../../context/PreferencesContext';
import MixerCard from './MixerCard';
import MixerOverview from './MixerOverview';
import '../../styles/FilterStyles.css';
import './MixersView.css';

function MixersView({title = 'Mixer Fleet', showSidebar, setShowSidebar, onSelectMixer}) {
    const {preferences, updateMixerFilter, resetMixerFilters, saveLastViewedFilters} = usePreferences();
    const [mixers, setMixers] = useState([]);
    const [operators, setOperators] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchText, setSearchText] = useState(preferences.mixerFilters?.searchText || '');
    const [selectedPlant, setSelectedPlant] = useState(preferences.mixerFilters?.selectedPlant || '');
    const [statusFilter, setStatusFilter] = useState(preferences.mixerFilters?.statusFilter || '');
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [showOverview, setShowOverview] = useState(false);
    const [selectedMixer, setSelectedMixer] = useState(null);
    const filterOptions = ['All Statuses', 'Active', 'Spare', 'In Shop', 'Retired', 'Past Due Service', 'Verified', 'Not Verified', 'Open Issues'];

    useEffect(() => {
        async function fetchAllData() {
            setIsLoading(true);
            try {
                await Promise.all([fetchMixers(), fetchOperators(), fetchPlants()]);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchAllData();
        if (preferences?.mixerFilters) {
            setSearchText(preferences.mixerFilters.searchText || '');
            setSelectedPlant(preferences.mixerFilters.selectedPlant || '');
            setStatusFilter(preferences.mixerFilters.statusFilter || '');
        }
    }, [preferences]);

    async function fetchMixers() {
        try {
            const data = await MixerService.fetchMixers();
            const processedData = await Promise.all(data.map(async mixer => {
                let latestHistoryDate = null;
                try {
                    const history = await MixerService.getMixerHistory(mixer.id, 1);
                    latestHistoryDate = history[0]?.changedAt || null;
                } catch {}
                try {
                    const issues = await MixerMaintenanceService.fetchIssues(mixer.id);
                    mixer.issues = issues || [];
                } catch {
                    mixer.issues = [];
                }
                mixer.isVerified = () => MixerUtility.isVerified(mixer.updatedLast, mixer.updatedAt, mixer.updatedBy, latestHistoryDate);
                mixer.latestHistoryDate = latestHistoryDate;
                return mixer;
            }));
            setMixers(processedData);
        } catch (error) {
            console.error('Error fetching mixers:', error);
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

    function isOperatorAssignedToMultipleMixers(operatorId) {
        return operatorId && operatorId !== '0' && mixers.filter(m => m.assignedOperator === operatorId).length > 1;
    }

    function handleSelectMixer(mixerId) {
        const mixer = mixers.find(m => m.id === mixerId);
        if (mixer) {
            saveLastViewedFilters();
            setSelectedMixer(mixer);
            onSelectMixer?.(mixerId);
        }
    }

    const filteredMixers = mixers
        .filter(mixer => {
            const matchesSearch = !searchText.trim() ||
                mixer.truckNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
                (mixer.assignedOperator && operators.find(op => op.employeeId === mixer.assignedOperator)?.name.toLowerCase().includes(searchText.toLowerCase()));
            const matchesPlant = !selectedPlant || mixer.assignedPlant === selectedPlant;
            let matchesStatus = true;
            if (statusFilter && statusFilter !== 'All Statuses') {
                matchesStatus = ['Active', 'Spare', 'In Shop', 'Retired'].includes(statusFilter) ? mixer.status === statusFilter :
                    statusFilter === 'Past Due Service' ? MixerUtility.isServiceOverdue(mixer.lastServiceDate) :
                        statusFilter === 'Verified' ? mixer.isVerified() :
                            statusFilter === 'Not Verified' ? !mixer.isVerified() :
                                statusFilter === 'Open Issues' ? mixer.issues?.some(issue => !issue.time_completed) : false;
            }
            return matchesSearch && matchesPlant && matchesStatus;
        })
        .sort((a, b) => {
            if (a.status === 'Active' && b.status !== 'Active') return -1;
            if (a.status !== 'Active' && b.status === 'Active') return 1;
            if (a.status === 'Retired' && b.status !== 'Retired') return 1;
            if (a.status !== 'Retired' && b.status === 'Retired') return -1;
            if (a.status !== b.status) return a.status.localeCompare(b.status);
            const aNum = parseInt(a.truckNumber?.replace(/\D/g, '') || '0');
            const bNum = parseInt(b.truckNumber?.replace(/\D/g, '') || '0');
            return !isNaN(aNum) && !isNaN(bNum) ? aNum - bNum : (a.truckNumber || '').localeCompare(b.truckNumber || '');
        });

    const statusCounts = ['Active', 'Spare', 'In Shop', 'Retired'].map(status => ({
        status,
        count: mixers.filter(m => m.status === status).length
    }));
    const pastDueServiceCount = mixers.filter(m => MixerUtility.isServiceOverdue(m.lastServiceDate)).length;
    const verifiedCount = mixers.filter(m => m.isVerified()).length;
    const unverifiedCount = mixers.length - verifiedCount;
    const neverVerifiedCount = mixers.filter(m => !m.updatedLast || !m.updatedBy).length;
    const openIssuesCount = mixers.filter(m => m.issues?.some(issue => !issue.time_completed)).length;

    function averageCleanliness() {
        const ratings = mixers.filter(m => m.cleanlinessRating).map(m => m.cleanlinessRating);
        return ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : 'Not Assigned';
    }

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
                    />
                </div>
                <div className="modal-footer">
                    <button className="primary-button" onClick={() => setShowOverview(false)}>Close</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="dashboard-container mixers-view">
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
                        style={{ height: '44px', lineHeight: '1' }}
                    >
                        <i className="fas fa-plus" style={{ marginRight: '8px' }}></i> Add Mixer
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
                            updateMixerFilter('searchText', e.target.value);
                        }}
                    />
                    {searchText && (
                        <button className="clear" onClick={() => {
                            setSearchText('');
                            updateMixerFilter('searchText', '');
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
                                updateMixerFilter('selectedPlant', e.target.value);
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
                                updateMixerFilter('statusFilter', e.target.value);
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
                            resetMixerFilters();
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
                        <LoadingScreen message="Loading mixers..." inline={true} />
                    </div>
                ) : filteredMixers.length === 0 ? (
                    <div className="no-results-container">
                        <div className="no-results-icon">
                            <i className="fas fa-truck-loading"></i>
                        </div>
                        <h3>No Mixers Found</h3>
                        <p>{searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses') ? "No mixers match your search criteria." : "There are no mixers in the system yet."}</p>
                        <button className="primary-button" onClick={() => setShowAddSheet(true)}>Add Mixer</button>
                    </div>
                ) : (
                    <div className={`mixers-grid ${searchText ? 'search-results' : ''}`}>
                        {filteredMixers.map(mixer => (
                            <MixerCard
                                key={mixer.id}
                                mixer={{...mixer, operatorSmyrnaId: getOperatorSmyrnaId(mixer.assignedOperator)}}
                                operatorName={getOperatorName(mixer.assignedOperator)}
                                plantName={getPlantName(mixer.assignedPlant)}
                                showOperatorWarning={isOperatorAssignedToMultipleMixers(mixer.assignedOperator)}
                                onSelect={handleSelectMixer}
                            />
                        ))}
                    </div>
                )}
            </div>
            {showAddSheet && (
                <MixerAddView
                    plants={plants}
                    operators={operators}
                    onClose={() => setShowAddSheet(false)}
                    onMixerAdded={newMixer => setMixers([...mixers, newMixer])}
                />
            )}
            {showOverview && <OverviewPopup />}
        </div>
    );
}

export default MixersView;