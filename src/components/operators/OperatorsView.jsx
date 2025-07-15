import React, {useEffect, useState} from 'react';
import './OperatorsView.css';
import '../../styles/FilterStyles.css';
import {supabase} from '../../services/DatabaseService';
import {UserService} from '../../services/UserService';
import OperatorDetailView from './OperatorDetailView';
import OperatorCard from './OperatorCard';
import OperatorsOverview from './OperatorsOverview';
import {usePreferences} from '../../context/PreferencesContext';

function OperatorsView({title = 'Operator Roster', showSidebar, setShowSidebar, onSelectOperator}) {
    const {preferences, updateOperatorFilter, resetOperatorFilters} = usePreferences();
    const [operators, setOperators] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchText, setSearchText] = useState(preferences.operatorFilters?.searchText || '');
    const [selectedPlant, setSelectedPlant] = useState(preferences.operatorFilters?.selectedPlant || '');
    const [statusFilter, setStatusFilter] = useState(preferences.operatorFilters?.statusFilter || '');
    const [positionFilter, setPositionFilter] = useState(preferences.operatorFilters?.positionFilter || '');
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [showOverview, setShowOverview] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showDetailView, setShowDetailView] = useState(false);
    const [selectedOperator, setSelectedOperator] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [newEmployeeId, setNewEmployeeId] = useState('');
    const [newName, setNewName] = useState('');
    const [newPlantCode, setNewPlantCode] = useState('');
    const [newStatus, setNewStatus] = useState('Active');
    const [newIsTrainer, setNewIsTrainer] = useState(false);
    const [newAssignedTrainer, setNewAssignedTrainer] = useState('');
    const [newPosition, setNewPosition] = useState('');

    const statuses = ['Active', 'Light Duty', 'Pending Start', 'Terminated', 'Training'];
    const positions = ['Mixer Operator', 'Tractor Operator'];
    const filterOptions = [
        'All Statuses', 'Active', 'Light Duty', 'Pending Start', 'Terminated', 'Training',
        'Trainer', 'Not Trainer'
    ];
    const positionOptions = ['All Positions', 'Mixer Operator', 'Tractor Operator'];

    useEffect(() => {
        const fetchCurrentUser = async () => {
            const user = await UserService.getCurrentUser();
            if (user) {
                setCurrentUserId(user.id);
            }
        };
        fetchCurrentUser();
    }, []);

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        if (preferences.operatorFilters) {
            setSearchText(preferences.operatorFilters.searchText || '');
            setSelectedPlant(preferences.operatorFilters.selectedPlant || '');
            setStatusFilter(preferences.operatorFilters.statusFilter || '');
            setPositionFilter(preferences.operatorFilters.positionFilter || '');
        }
    }, [preferences.operatorFilters]);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                fetchOperators(),
                fetchPlants()
            ]);
        } catch (error) {
        } finally {
            setIsLoading(false);
        }
    };

    const fetchOperators = async () => {
        try {
            const {data, error} = await supabase
                .from('operators')
                .select('*');

            if (error) throw error;

            const formattedOperators = data.map(op => ({
                employeeId: op.employee_id,
                smyrnaId: op.smyrna_id || '',
                name: op.name,
                plantCode: op.plant_code,
                status: op.status,
                isTrainer: op.is_trainer,
                assignedTrainer: op.assigned_trainer,
                position: op.position
            }));

            setOperators(formattedOperators);
            localStorage.setItem('cachedOperators', JSON.stringify(formattedOperators));
            localStorage.setItem('cachedOperatorsDate', new Date().toISOString());
        } catch (error) {
            const cachedData = localStorage.getItem('cachedOperators');
            const cacheDate = localStorage.getItem('cachedOperatorsDate');
            if (cachedData && cacheDate) {
                const cachedTime = new Date(cacheDate).getTime();
                const hourAgo = new Date().getTime() - 3600000;
                if (cachedTime > hourAgo) {
                    setOperators(JSON.parse(cachedData));
                }
            }
        }
    };

    const fetchPlants = async () => {
        try {
            const {data, error} = await supabase
                .from('plants')
                .select('*');

            if (error) throw error;
            setPlants(data);
        } catch (error) {
        }
    };

    const addOperator = async () => {
        try {
            const newOperator = {
                employee_id: newEmployeeId,
                name: newName,
                plant_code: newPlantCode || null,
                status: newStatus,
                is_trainer: newIsTrainer,
                assigned_trainer: newAssignedTrainer || '0',
                position: newPosition,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const {error} = await supabase
                .from('operators')
                .insert([newOperator]);

            if (error) throw error;

            setNewEmployeeId('');
            setNewName('');
            setNewPlantCode('');
            setNewStatus('Active');
            setNewIsTrainer(false);
            setNewAssignedTrainer('');
            setNewPosition('');
            setShowAddSheet(false);
            fetchOperators();
        } catch (error) {
            alert('Failed to add operator. Please try again.');
        }
    };

    const deleteOperator = async (operatorId) => {
        try {
            const {error} = await supabase
                .from('operators')
                .delete()
                .eq('employee_id', operatorId);

            if (error) throw error;
            fetchOperators();
            setSelectedOperator(null);
        } catch (error) {
            alert('Failed to delete operator. Please try again.');
        }
    };

    const filteredOperators = operators
        .filter(operator => {
            const matchesSearch = searchText.trim() === '' ||
                operator.name.toLowerCase().includes(searchText.toLowerCase()) ||
                operator.employeeId.toLowerCase().includes(searchText.toLowerCase());

            const matchesPlant = selectedPlant === '' || operator.plantCode === selectedPlant;

            let matchesStatus = true;
            if (statusFilter && statusFilter !== 'All Statuses') {
                if (statuses.includes(statusFilter)) {
                    matchesStatus = operator.status === statusFilter;
                } else if (statusFilter === 'Trainer') {
                    matchesStatus = operator.isTrainer === true || String(operator.isTrainer).toLowerCase() === 'true';
                } else if (statusFilter === 'Not Trainer') {
                    matchesStatus = operator.isTrainer !== true && String(operator.isTrainer).toLowerCase() !== 'true';
                }
            }

            let matchesPosition = true;
            if (positionFilter && positionFilter !== 'All Positions') {
                matchesPosition = operator.position === positionFilter;
            }

            return matchesSearch && matchesPlant && matchesStatus && matchesPosition;
        })
        .sort((a, b) => {
            if (a.status === 'Active' && b.status !== 'Active') return -1;
            if (a.status !== 'Active' && b.status === 'Active') return 1;
            if (a.status === 'Terminated' && b.status !== 'Terminated') return 1;
            if (a.status !== 'Terminated' && b.status === 'Terminated') return -1;
            if (a.status !== b.status) return a.status.localeCompare(b.status);

            const nameA = a.name.split(' ').pop().toLowerCase();
            const nameB = b.name.split(' ').pop().toLowerCase();
            return nameA.localeCompare(nameB);
        });

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plant_code === plantCode);
        return plant ? plant.plant_name : plantCode || 'No Plant';
    };

    const handleSelectOperator = (operator) => {
        setSelectedOperator(operator);
        if (onSelectOperator) {
            onSelectOperator(operator.employeeId);
        } else {
            setShowDetailView(true);
        }
    };

    const statusCounts = statuses.map(status => ({
        status,
        count: operators.filter(op => op.status === status).length
    }));

    const trainerCount = operators.filter(op => op.isTrainer).length;

    const OverviewPopup = () => (
        <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Operators Overview</h2>
                    <button className="close-button" onClick={() => setShowOverview(false)}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <OperatorsOverview
                        filteredOperators={filteredOperators}
                        selectedPlant={selectedPlant}
                    />
                </div>
                <div className="modal-footer">
                    <button className="primary-button" onClick={() => setShowOverview(false)}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="dashboard-container operators-view">
            {showDetailView && selectedOperator && (
                <OperatorDetailView
                    operatorId={selectedOperator.employeeId}
                    onClose={() => {
                        setShowDetailView(false);
                        fetchOperators();
                    }}
                />
            )}

            {!showDetailView && (
                <>
                    <div className="dashboard-header">
                        <h1>
                            {title}
                        </h1>
                        <div className="dashboard-actions">
                            <button className="action-button primary" onClick={() => setShowAddSheet(true)}>
                                <i className="fas fa-plus"></i>
                                Add Operator
                            </button>
                        </div>
                    </div>

                    <div className="search-filters">
                        <div className="search-bar">
                            <input
                                type="text"
                                className="ios-search-input"
                                placeholder="Search by name or ID..."
                                value={searchText}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSearchText(value);
                                    updateOperatorFilter('searchText', value);
                                }}
                            />
                            {searchText && (
                                <button className="clear" onClick={() => {
                                    setSearchText('');
                                    updateOperatorFilter('searchText', '');
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
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSelectedPlant(value);
                                        updateOperatorFilter('selectedPlant', value);
                                    }}
                                    aria-label="Filter by plant"
                                    style={{
                                        '--select-active-border': preferences.accentColor === 'red' ? '#b80017' : '#003896',
                                        '--select-focus-border': preferences.accentColor === 'red' ? '#b80017' : '#003896'
                                    }}
                                >
                                    <option value="">All Plants</option>
                                    {plants.sort((a, b) => {
                                        const aCode = parseInt(a.plant_code?.replace(/\D/g, '') || '0');
                                        const bCode = parseInt(b.plant_code?.replace(/\D/g, '') || '0');
                                        return aCode - bCode;
                                    }).map(plant => (
                                        <option key={plant.plant_code} value={plant.plant_code}>
                                            ({plant.plant_code}) {plant.plant_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="filter-wrapper">
                                <select
                                    className="ios-select"
                                    value={statusFilter}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setStatusFilter(value);
                                        updateOperatorFilter('statusFilter', value);
                                    }}
                                    style={{
                                        '--select-active-border': preferences.accentColor === 'red' ? '#b80017' : '#003896',
                                        '--select-focus-border': preferences.accentColor === 'red' ? '#b80017' : '#003896'
                                    }}
                                >
                                    {filterOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="filter-wrapper">
                                <select
                                    className="ios-select"
                                    value={positionFilter}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setPositionFilter(value);
                                        updateOperatorFilter('positionFilter', value);
                                    }}
                                    style={{
                                        '--select-active-border': preferences.accentColor === 'red' ? '#b80017' : '#003896',
                                        '--select-focus-border': preferences.accentColor === 'red' ? '#b80017' : '#003896'
                                    }}
                                >
                                    {positionOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>

                            {(searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses') || (positionFilter && positionFilter !== 'All Positions')) && (
                                <button
                                    className="filter-reset-button"
                                    onClick={() => {
                                        setSearchText('');
                                        setSelectedPlant('');
                                        setStatusFilter('');
                                        setPositionFilter('');
                                        resetOperatorFilters();
                                    }}
                                >
                                    <i className="fas fa-undo"></i>
                                    Reset Filters
                                </button>
                            )}

                            <button className="ios-button" onClick={() => setShowOverview(true)}>
                                <i className="fas fa-chart-bar"></i>
                                Overview
                            </button>
                        </div>
                    </div>

                    <div className="content-container">
                        {isLoading ? (
                            <div className="loading-container">
                                <div className="ios-spinner"></div>
                                <p>Loading operators...</p>
                            </div>
                        ) : filteredOperators.length === 0 ? (
                            <div className="no-results-container">
                                <div className="no-results-icon">
                                    <i className="fas fa-user-slash"></i>
                                </div>
                                <h3>No Operators Found</h3>
                                <p>
                                    {searchText || selectedPlant || (statusFilter && statusFilter !== 'All Statuses')
                                        ? "No operators match your search criteria."
                                        : "There are no operators in the system yet."}
                                </p>
                                <button className="primary-button" onClick={() => setShowAddSheet(true)}>
                                    Add Operator
                                </button>
                            </div>
                        ) : (
                            <div className={`operators-grid ${searchText ? 'search-results' : ''}`}>
                                {filteredOperators.map(operator => (
                                    <OperatorCard
                                        key={operator.employeeId}
                                        operator={operator}
                                        plantName={getPlantName(operator.plantCode)}
                                        onSelect={handleSelectOperator}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {showAddSheet && (
                        <div className="modal-backdrop">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h2>Add New Operator</h2>
                                    <button className="close-button" onClick={() => setShowAddSheet(false)}>
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                                <div className="modal-body">
                                    <div className="form-group">
                                        <label>Employee ID</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={newEmployeeId}
                                            onChange={(e) => setNewEmployeeId(e.target.value)}
                                            placeholder="Enter employee ID"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Name</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            placeholder="Enter full name"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Plant</label>
                                        <select
                                            className="form-control"
                                            value={newPlantCode}
                                            onChange={(e) => setNewPlantCode(e.target.value)}
                                        >
                                            <option value="">Select a plant</option>
                                            {plants.map(plant => (
                                                <option key={plant.plant_code} value={plant.plant_code}>
                                                    {plant.plant_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Status</label>
                                        <select
                                            className="form-control"
                                            value={newStatus}
                                            onChange={(e) => setNewStatus(e.target.value)}
                                        >
                                            {statuses.map(status => (
                                                <option key={status} value={status}>{status}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Position</label>
                                        <select
                                            className="form-control"
                                            value={newPosition}
                                            onChange={(e) => setNewPosition(e.target.value)}
                                        >
                                            <option value="">Select position</option>
                                            {positions.map(pos => (
                                                <option key={pos} value={pos}>{pos}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group checkbox-group">
                                        <input
                                            type="checkbox"
                                            id="is-trainer"
                                            className="form-checkbox"
                                            checked={newIsTrainer}
                                            onChange={(e) => setNewIsTrainer(e.target.checked)}
                                        />
                                        <label htmlFor="is-trainer">Is a Trainer</label>
                                    </div>
                                    {!newIsTrainer && (
                                        <div className="form-group">
                                            <label>Assigned Trainer</label>
                                            <select
                                                className="form-control"
                                                value={newAssignedTrainer}
                                                onChange={(e) => setNewAssignedTrainer(e.target.value)}
                                            >
                                                <option value="0">None</option>
                                                {operators
                                                    .filter(op => op.isTrainer)
                                                    .map(trainer => (
                                                        <option key={trainer.employeeId} value={trainer.employeeId}>
                                                            {trainer.name}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer">
                                    <button
                                        className="cancel-button"
                                        onClick={() => setShowAddSheet(false)}
                                        style={{ borderColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="primary-button"
                                        onClick={addOperator}
                                        disabled={!newEmployeeId || !newName}
                                    >
                                        Add Operator
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showOverview && <OverviewPopup/>}
                </>
            )}
        </div>
    );
}

export default OperatorsView;