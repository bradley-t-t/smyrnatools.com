import React, {useEffect, useState} from 'react';
import MixerAddView from './MixerAddView';
import {MixerUtils} from '../../models/Mixer';
import {MixerService} from '../../services/mixers/MixerService';
import {PlantService} from '../../services/PlantService';
import {OperatorService} from '../../services/operators/OperatorService';
import MixerCard from './MixerCard';
import MixerHistoryView from './MixerHistoryView';
// Theme is not used directly in this component
import './MixersView.css';

function MixersView({title = 'Mixer Fleet', showSidebar, setShowSidebar, onSelectMixer}) {
    // State variables
    const [mixers, setMixers] = useState([]);
    const [operators, setOperators] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [selectedPlant, setSelectedPlant] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [showOverview, setShowOverview] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [selectedMixer, setSelectedMixer] = useState(null);
    const [showMetrics, setShowMetrics] = useState(true);

    // Filter options
    const filterOptions = [
        'All Statuses', 'Active', 'Spare', 'In Shop', 'Retired',
        'Past Due Service', 'Verified', 'Not Verified'
    ];

    // Fetch data on component mount
    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                fetchMixers(),
                fetchOperators(),
                fetchPlants()
            ]);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMixers = async () => {
        try {
            const data = await MixerService.fetchMixers();
            setMixers(data);
        } catch (error) {
            console.error('Error fetching mixers:', error);
        }
    };

    const fetchOperators = async () => {
        try {
            const data = await OperatorService.fetchOperators();
            setOperators(data);
        } catch (error) {
            console.error('Error fetching operators:', error);
        }
    };

    const fetchPlants = async () => {
        try {
            const data = await PlantService.fetchPlants();
            setPlants(data);
        } catch (error) {
            console.error('Error fetching plants:', error);
        }
    };

    // State for metrics visibility (currently not used but kept for future functionality)
    // const toggleMetricsVisibility = () => {
    //   setShowMetrics(!showMetrics);
    // };

    // Filter mixers based on search text, plant, and status
    const filteredMixers = mixers
        .filter(mixer => {
            // Search text filter
            const matchesSearch = searchText.trim() === '' ||
                mixer.truckNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
                (mixer.assignedOperator && operators.find(op =>
                    op.employeeId === mixer.assignedOperator)?.name.toLowerCase().includes(searchText.toLowerCase()));

            // Plant filter
            const matchesPlant = selectedPlant === '' || mixer.assignedPlant === selectedPlant;

            // Status filter
            let matchesStatus = true;
            if (statusFilter && statusFilter !== 'All Statuses') {
                if (['Active', 'Spare', 'In Shop', 'Retired'].includes(statusFilter)) {
                    matchesStatus = mixer.status === statusFilter;
                } else if (statusFilter === 'Past Due Service') {
                    matchesStatus = MixerUtils.isServiceOverdue(mixer.lastServiceDate);
                } else if (statusFilter === 'Verified') {
                    matchesStatus = mixer.isVerified === true;
                } else if (statusFilter === 'Not Verified') {
                    matchesStatus = mixer.isVerified === false;
                }
            }

            return matchesSearch && matchesPlant && matchesStatus;
        })
        // Sort mixers
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

    // Get operators name by ID
    const getOperatorName = (operatorId) => {
        if (!operatorId || operatorId === '0') return 'None';
        const operator = operators.find(op => op.employeeId === operatorId);
        return operator ? operator.name : 'Unknown';
    };

    // Get plant name by code
    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode || 'No Plant';
    };

    // Check if operators is assigned to multiple mixers
    const isOperatorAssignedToMultipleMixers = (operatorId) => {
        if (!operatorId || operatorId === '0') return false;
        return mixers.filter(m => m.assignedOperator === operatorId).length > 1;
    };

    // Handle mixer selection
    const handleSelectMixer = (mixerId) => {
        const mixer = mixers.find(m => m.id === mixerId);
        if (mixer) {
            setSelectedMixer(mixer);
            if (onSelectMixer) {
                onSelectMixer(mixerId);
            }
        }
    };

    // Calculate status counts for overview
    const statusCounts = ['Active', 'Spare', 'In Shop', 'Retired'].map(status => ({
        status,
        count: mixers.filter(m => m.status === status).length
    }));

    const pastDueServiceCount = mixers.filter(m => MixerUtils.isServiceOverdue(m.lastServiceDate)).length;

    // Calculate average cleanliness rating
    const averageCleanliness = () => {
        const ratings = mixers.filter(m => m.cleanlinessRating).map(m => m.cleanlinessRating);
        return ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : 'N/A';
    };

    // Overview popup component
    const OverviewPopup = () => (
        <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Mixers Overview</h2>
                    <button className="close-button" onClick={() => setShowOverview(false)}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <div className="overview-metrics">
                        <div className="metrics-row">
                            {statusCounts.map(({status, count}) => (
                                <div className="metric-card" key={status}>
                                    <div className="metric-title">{status}</div>
                                    <div className="metric-value">{count}</div>
                                </div>
                            ))}
                            <div className="metric-card">
                                <div className="metric-title">Need Service</div>
                                <div className="metric-value">{pastDueServiceCount}</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-title">Need Chip</div>
                                <div
                                    className="metric-value">{mixers.filter(m => MixerUtils.isChipOverdue(m.lastChipDate)).length}</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-title">Avg. Cleanliness</div>
                                <div className="metric-value">{averageCleanliness()}</div>
                            </div>
                        </div>
                    </div>
                    <div className="overview-section">
                        <h3>Plant Distribution</h3>
                        <div className="plant-distribution">
                            {plants.map(plant => {
                                const count = mixers.filter(m => m.assignedPlant === plant.plantCode).length;
                                return count > 0 ? (
                                    <div key={plant.plantCode} className="plant-item">
                                        <div className="plant-name">{plant.plantName || plant.plantCode}</div>
                                        <div className="plant-count">{count}</div>
                                    </div>
                                ) : null;
                            })}
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button
                        className="primary-button"
                        onClick={() => setShowOverview(false)}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="dashboard-container mixers-view">
            {/* Header */}
            <div className="dashboard-header">
                <h1>{title}</h1>
                <div className="dashboard-actions">
                    {setShowSidebar && (
                        <button className="action-button" onClick={() => setShowSidebar(!showSidebar)}>
                            <i className="fas fa-bars"></i>
                            Menu
                        </button>
                    )}
                    <button className="action-button primary" onClick={() => setShowAddSheet(true)}>
                        <i className="fas fa-plus"></i>
                        Add Mixer
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="search-filters">
                <div className="search-bar">
                    <input
                        type="text"
                        className="ios-search-input"
                        placeholder="Search by truck or operator..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                    />
                    {searchText && (
                        <button
                            className="clear"
                            onClick={() => setSearchText('')}
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>

                <div className="filters">
                    <div className="filter-wrapper">
                        <select
                            className="ios-select"
                            value={selectedPlant}
                            onChange={(e) => setSelectedPlant(e.target.value)}
                        >
                            <option value="">All Plants</option>
                            {plants.map(plant => (
                                <option key={plant.plantCode} value={plant.plantCode}>
                                    {plant.plantName}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-wrapper">
                        <select
                            className="ios-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            {filterOptions.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>

                    {(searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses')) && (
                        <button
                            className="filter-reset-button"
                            onClick={() => {
                                setSearchText('');
                                setSelectedPlant('');
                                setStatusFilter('');
                            }}
                        >
                            <i className="fas fa-undo"></i>
                            Reset Filters
                        </button>
                    )}

                    <button
                        className="ios-button"
                        onClick={() => setShowOverview(true)}
                    >
                        <i className="fas fa-chart-bar"></i>
                        Overview
                    </button>
                </div>
            </div>

            {/* Content Container */}
            <div className="content-container">
                {isLoading ? (
                    <div className="loading-container">
                        <div className="ios-spinner"></div>
                        <p>Loading mixers...</p>
                    </div>
                ) : filteredMixers.length === 0 ? (
                    <div className="no-results-container">
                        <div className="no-results-icon">
                            <i className="fas fa-truck-loading"></i>
                        </div>
                        <h3>No Mixers Found</h3>
                        <p>
                            {searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses')
                                ? "No mixers match your search criteria."
                                : "There are no mixers in the system yet."}
                        </p>
                        <button
                            className="primary-button"
                            onClick={() => setShowAddSheet(true)}
                        >
                            Add Mixer
                        </button>
                    </div>
                ) : (
                    <div className="mixers-grid">
                        {filteredMixers.map(mixer => (
                            <MixerCard
                                key={mixer.id}
                                mixer={mixer}
                                operatorName={getOperatorName(mixer.assignedOperator)}
                                plantName={getPlantName(mixer.assignedPlant)}
                                showOperatorWarning={isOperatorAssignedToMultipleMixers(mixer.assignedOperator)}
                                onSelect={handleSelectMixer}
                                onDelete={() => {
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Add Mixer View */}
            {showAddSheet && (
                <MixerAddView
                    plants={plants}
                    operators={operators}
                    onClose={() => setShowAddSheet(false)}
                    onMixerAdded={(newMixer) => {
                        setMixers([...mixers, newMixer]);
                    }}
                />
            )}

            {/* Overview Modal */}
            {showOverview && <OverviewPopup/>}

            {/* History Modal */}
            {showHistory && selectedMixer && (
                <MixerHistoryView
                    mixer={selectedMixer}
                    onClose={() => setShowHistory(false)}
                />
            )}
        </div>
    );
}

export default MixersView;