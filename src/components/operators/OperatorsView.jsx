import React, {useEffect, useRef, useState} from 'react';
import './OperatorsView.css';
import {supabase} from '../../core/SupabaseClient';
import {UserService} from '../../services/auth/UserService';
import OperatorHistoryView from './OperatorHistoryView';
import Theme from '../../utils/Theme';
import OperatorCard from './OperatorCard';
import {usePreferences} from '../../context/PreferencesContext';

function OperatorsView({title, showSidebar, setShowSidebar, onSelectOperator}) {
    // Get user preferences for theming
    const {preferences} = usePreferences();
    // State variables
    const [operators, setOperators] = useState([]);
    const [filteredOperators, setFilteredOperators] = useState([]);
    const [selectedPlant, setSelectedPlant] = useState('');
    const [searchText, setSearchText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [plants, setPlants] = useState([]);
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [showControlPanel, setShowControlPanel] = useState(false);
    const [selectedOperator, setSelectedOperator] = useState(null);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [operatorToDelete, setOperatorToDelete] = useState(null);
    const [showOverview, setShowOverview] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);

    // New operators form state
    const [newEmployeeId, setNewEmployeeId] = useState('');
    const [newName, setNewName] = useState('');
    const [newPlantCode, setNewPlantCode] = useState('');
    const [newStatus, setNewStatus] = useState('Active');
    const [newIsTrainer, setNewIsTrainer] = useState(false);
    const [newAssignedTrainer, setNewAssignedTrainer] = useState('');
    const [newPosition, setNewPosition] = useState('');

    const statuses = ['Active', 'Light Duty', 'Pending Start', 'Terminated', 'Training'];
    const positions = ['Mixer Operator', 'Tractor Operator'];

    // Refs
    const fetchTaskRef = useRef(null);

    // Fetch current user
    useEffect(() => {
        const fetchCurrentUser = async () => {
            const user = await UserService.getCurrentUser();
            if (user) {
                setCurrentUserId(user.id);
            }
        };
        fetchCurrentUser();
    }, []);

    // Fetch operators and plants
    useEffect(() => {
        fetchOperators();
        fetchPlants();

        return () => {
            if (fetchTaskRef.current) {
                fetchTaskRef.current.abort();
            }
        };
    }, []);

    // Update filtered operators when operators, search text, or selected plant changes
    useEffect(() => {
        filterOperators();
    }, [operators, searchText, selectedPlant]);

    // Filter operators based on search text and selected plant
    const filterOperators = () => {
        let filtered = [...operators];

        if (searchText) {
            const lowercasedSearch = searchText.toLowerCase();
            filtered = filtered.filter(op =>
                op.name.toLowerCase().includes(lowercasedSearch) ||
                op.status.toLowerCase().includes(lowercasedSearch)
            );
        }

        if (selectedPlant) {
            filtered = filtered.filter(op => op.plantCode === selectedPlant);
        }

        // Sort by last name
        filtered.sort((a, b) => {
            const nameA = a.name.split(' ').pop().toLowerCase();
            const nameB = b.name.split(' ').pop().toLowerCase();
            return nameA.localeCompare(nameB);
        });

        setFilteredOperators(filtered);
    };

    // Fetch operators from Supabase
    const fetchOperators = async () => {
        setIsLoading(true);
        try {
            const {data, error} = await supabase
                .from('operators')
                .select('*');

            if (error) throw error;

            const formattedOperators = data.map(op => ({
                employeeId: op.employee_id,
                name: op.name,
                plantCode: op.plant_code,
                status: op.status,
                isTrainer: op.is_trainer,
                assignedTrainer: op.assigned_trainer,
                position: op.position
            }));

            setOperators(formattedOperators);
            // Cache operators in localStorage
            localStorage.setItem('cachedOperators', JSON.stringify(formattedOperators));
            localStorage.setItem('cachedOperatorsDate', new Date().toISOString());
        } catch (error) {
            console.error('Error fetching operators:', error);
            // Try to load from cache
            const cachedData = localStorage.getItem('cachedOperators');
            const cacheDate = localStorage.getItem('cachedOperatorsDate');

            if (cachedData && cacheDate) {
                const cachedTime = new Date(cacheDate).getTime();
                const hourAgo = new Date().getTime() - 3600000;

                if (cachedTime > hourAgo) {
                    setOperators(JSON.parse(cachedData));
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch plants from Supabase
    const fetchPlants = async () => {
        try {
            const {data, error} = await supabase
                .from('plants')
                .select('*');

            if (error) throw error;

            setPlants(data);
        } catch (error) {
            console.error('Error fetching plants:', error);
        }
    };

    // Add a new operators
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

            // Reset form fields
            setNewEmployeeId('');
            setNewName('');
            setNewPlantCode('');
            setNewStatus('Active');
            setNewIsTrainer(false);
            setNewAssignedTrainer('');
            setNewPosition('');

            // Close the add sheet
            setShowAddSheet(false);

            // Refresh operators
            fetchOperators();
        } catch (error) {
            console.error('Error adding operators:', error);
            alert('Failed to add operators. Please try again.');
        }
    };

    // Update an existing operators
    const updateOperator = async (updatedOperator) => {
        try {
            const originalOperator = operators.find(op => op.employeeId === updatedOperator.employeeId);

            if (!originalOperator) {
                throw new Error('Original operators not found');
            }

            const update = {
                employee_id: updatedOperator.employeeId,
                name: updatedOperator.name,
                plant_code: updatedOperator.plantCode,
                status: updatedOperator.status,
                is_trainer: updatedOperator.isTrainer,
                assigned_trainer: updatedOperator.assignedTrainer || '0',
                position: updatedOperator.position,
                updated_at: new Date().toISOString()
            };

            const {error} = await supabase
                .from('operators')
                .update(update)
                .eq('employee_id', updatedOperator.employeeId);

            if (error) throw error;

            // Track history for each changed field
            const historyEntries = [];

            if (originalOperator.name !== updatedOperator.name) {
                historyEntries.push({
                    employee_id: updatedOperator.employeeId,
                    field_name: 'name',
                    old_value: originalOperator.name,
                    new_value: updatedOperator.name,
                    changed_at: new Date().toISOString(),
                    changed_by: currentUserId
                });
            }

            if (originalOperator.plantCode !== updatedOperator.plantCode) {
                historyEntries.push({
                    employee_id: updatedOperator.employeeId,
                    field_name: 'plant_code',
                    old_value: originalOperator.plantCode || 'N/A',
                    new_value: updatedOperator.plantCode || 'N/A',
                    changed_at: new Date().toISOString(),
                    changed_by: currentUserId
                });
            }

            if (originalOperator.status !== updatedOperator.status) {
                historyEntries.push({
                    employee_id: updatedOperator.employeeId,
                    field_name: 'status',
                    old_value: originalOperator.status,
                    new_value: updatedOperator.status,
                    changed_at: new Date().toISOString(),
                    changed_by: currentUserId
                });
            }

            if (originalOperator.isTrainer !== updatedOperator.isTrainer) {
                historyEntries.push({
                    employee_id: updatedOperator.employeeId,
                    field_name: 'is_trainer',
                    old_value: String(originalOperator.isTrainer),
                    new_value: String(updatedOperator.isTrainer),
                    changed_at: new Date().toISOString(),
                    changed_by: currentUserId
                });
            }

            if (originalOperator.position !== updatedOperator.position) {
                historyEntries.push({
                    employee_id: updatedOperator.employeeId,
                    field_name: 'position',
                    old_value: originalOperator.position || '',
                    new_value: updatedOperator.position || '',
                    changed_at: new Date().toISOString(),
                    changed_by: currentUserId
                });
            }

            const newAssignedTrainer = updatedOperator.assignedTrainer || '0';
            if (originalOperator.assignedTrainer !== newAssignedTrainer) {
                historyEntries.push({
                    employee_id: updatedOperator.employeeId,
                    field_name: 'assigned_trainer',
                    old_value: originalOperator.assignedTrainer || 'N/A',
                    new_value: newAssignedTrainer || 'N/A',
                    changed_at: new Date().toISOString(),
                    changed_by: currentUserId
                });
            }

            // Save history entries if there are any changes
            if (historyEntries.length > 0) {
                const {error: historyError} = await supabase
                    .from('operator_history')
                    .insert(historyEntries);

                if (historyError) throw historyError;
            }

            // Refresh operators
            fetchOperators();

            // Update selected operators
            setSelectedOperator(updatedOperator);
        } catch (error) {
            console.error('Error updating operators:', error);
            alert('Failed to update operators. Please try again.');
        }
    };

    // Delete an operators
    const deleteOperator = async (operator) => {
        try {
            const {error} = await supabase
                .from('operators')
                .delete()
                .eq('employee_id', operator.employeeId);

            if (error) throw error;

            // Refresh operators
            fetchOperators();

            // Reset selected operators
            setSelectedOperator(null);
            setShowControlPanel(false);
        } catch (error) {
            console.error('Error deleting operators:', error);
            alert('Failed to delete operators. Please try again.');
        }
    };

    // Handle operators selection
    const handleOperatorSelection = async (operator) => {
        setSelectedOperator(operator);
        setShowControlPanel(true);
    };

    // getTrainerName utility function for finding operator's trainer name
    const getTrainerName = (trainerId) => {
        if (!trainerId || trainerId === '0') return 'None';
        const trainer = operators.find(op => op.employeeId === trainerId);
        return trainer ? trainer.name : 'Unknown';
    };

    // Get status color from Theme
    const getStatusColor = (status) => {
        return Theme.operatorStatusColors[status] || Theme.operatorStatusColors.default;
    };

    // Status counts for overview
    const statusCounts = statuses.map(status => ({
        status,
        count: filteredOperators.filter(op => op.status === status).length
    }));

    // Number of trainers
    const filteredTrainersCount = filteredOperators.filter(op => op.isTrainer).length;

    return (
        <div className="dashboard-container operators-view">
            {/* Header */}
            <div className="dashboard-header">
                <h1>
                    {title || 'Operators'}
                    {(searchText || selectedPlant) && (
                        <span className="filtered-indicator">(Filtered)</span>
                    )}
                </h1>
                <div className="dashboard-actions">
                    {setShowSidebar && (
                        <button className="action-button" onClick={() => setShowSidebar(!showSidebar)}>
                            <i className="fas fa-bars"></i>
                            Menu
                        </button>
                    )}
                    <button 
                        className="action-button primary" 
                        onClick={() => setShowAddSheet(true)}
                        style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                    >
                        <i className="fas fa-plus"></i>
                        Add Operator
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="search-filters">
                <div className="search-bar">
                    <input
                        type="text"
                        className="ios-search-input"
                        placeholder="Search operators..."
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
                            aria-label="Filter by plant"
                        >
                            <option value="">All Plants</option>
                            {plants.sort((a, b) => a.plant_name.localeCompare(b.plant_name)).map(plant => (
                                <option key={plant.plant_code} value={plant.plant_code}>
                                    {plant.plant_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {(searchText || selectedPlant) && (
                        <button
                            className="filter-reset-button"
                            onClick={() => {
                                setSearchText('');
                                setSelectedPlant('');
                            }}
                        >
                            <i className="fas fa-undo"></i>
                            Reset Filters
                        </button>
                    )}

                    <button
                        className="ios-button"
                        onClick={() => setShowOverview(true)}
                            style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                        style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                        style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                        style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                    >
                        <i className="fas fa-chart-bar"></i>
                        Overview
                    </button>
                </div>
            </div>

            <div className="content-container">
                {isLoading ? (
                    <div className="loading-indicator">Loading operators...</div>
                ) : filteredOperators.length === 0 ? (
                    <div className="no-results">
                        <div className="no-results-icon">🔍</div>
                        <p>No operators found. Please adjust your search or plant filter.</p>
                    </div>
                ) : (
                    <div className="operators-grid">
                        {filteredOperators.map(operator => (
                            <OperatorCard 
                                key={operator.employeeId} 
                                operator={operator} 
                                plantName={plants.find(p => p.plant_code === operator.plantCode)?.plant_name || 'None'}
                                onSelect={handleOperatorSelection}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Add Operator Modal */}
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
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
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
                                        <option key={pos} value={pos}>
                                            {pos}
                                        </option>
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
                            <button className="cancel-button" onClick={() => setShowAddSheet(false)}>
                                Cancel
                            </button>
                            <button
                                className="primary-button"
                                onClick={addOperator}
                                disabled={!newEmployeeId || !newName}
                                style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                            >
                                Add Operator
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Control Panel Modal */}
            {showControlPanel && selectedOperator && (
                <div className="modal-backdrop">
                    <div className="modal-content control-panel-modal">
                        <div className="modal-header">
                            <h2>Operator Details</h2>
                            <button className="close-button" onClick={() => setShowControlPanel(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="operator-detail-card">
                                <div className="operator-header">
                                    <h3>{selectedOperator.name}</h3>
                                    <div
                                        className="status-dot"
                                        style={{backgroundColor: getStatusColor(selectedOperator.status)}}
                                    ></div>
                                </div>
                                <div className="operator-info-grid">
                                    <div className="info-column">
                                        <div className="info-row">
                                            <div className="info-label">Employee ID</div>
                                            <div className="info-value">{selectedOperator.employeeId}</div>
                                        </div>
                                        <div className="info-row">
                                            <div className="info-label">Plant</div>
                                            <div className="info-value">
                                                {plants.find(p => p.plant_code === selectedOperator.plantCode)?.plant_name || 'None'}
                                            </div>
                                        </div>
                                        <div className="info-row">
                                            <div className="info-label">Status</div>
                                            <div className="info-value">{selectedOperator.status}</div>
                                        </div>
                                    </div>
                                    <div className="info-column">
                                        <div className="info-row">
                                            <div className="info-label">Position</div>
                                            <div className="info-value">{selectedOperator.position || 'Not Assigned'}</div>
                                        </div>
                                        <div className="info-row">
                                            <div className="info-label">Trainer</div>
                                            <div className="info-value">
                                                {selectedOperator.isTrainer ? 'Is a Trainer' : getTrainerName(selectedOperator.assignedTrainer)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="control-panel-actions">
                                <h3>Actions</h3>
                                <div className="action-grid">
                                    <div className="action-tile" onClick={() => setShowHistory(true)}>
                                        <i className="fas fa-history"></i>
                                        <span>View History</span>
                                    </div>
                                    <div className="action-tile">
                                        <i className="fas fa-edit"></i>
                                        <span>Edit Operator</span>
                                    </div>
                                    <div
                                        className="action-tile delete"
                                        onClick={() => {
                                            setOperatorToDelete(selectedOperator);
                                            setShowDeleteConfirmation(true);
                                        }}
                                    >
                                        <i className="fas fa-trash-alt"></i>
                                        <span>Delete Operator</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-button" onClick={() => setShowControlPanel(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History View */}
            {showHistory && selectedOperator && (
                <OperatorHistoryView
                    operator={selectedOperator}
                    onClose={() => setShowHistory(false)}
                />
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirmation && operatorToDelete && (
                <div className="modal-backdrop">
                    <div className="confirmation-dialog">
                        <div className="confirmation-header">
                            <h3>Confirm Delete</h3>
                        </div>
                        <div className="confirmation-body">
                            <p>Are you sure you want to delete {operatorToDelete.name}?</p>
                            <p className="warning">This action cannot be undone.</p>
                        </div>
                        <div className="confirmation-footer">
                            <button
                                className="cancel-button"
                                onClick={() => {
                                    setShowDeleteConfirmation(false);
                                    setOperatorToDelete(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="delete-button"
                                onClick={() => {
                                    deleteOperator(operatorToDelete);
                                    setShowDeleteConfirmation(false);
                                    setOperatorToDelete(null);
                                    setShowControlPanel(false);
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Overview Modal */}
            {showOverview && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Operators Overview</h2>
                            <button className="close-button" onClick={() => setShowOverview(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="overview-metrics">
                                <h3>Status Breakdown</h3>
                                <div className="metrics-row">
                                    {statusCounts.map(({status, count}) => (
                                        <div className="metric-card" key={status}>
                                            <div className="metric-title">{status}</div>
                                            <div className="metric-value">{count}</div>
                                        </div>
                                    ))}
                                </div>

                                <h3 className="section-title">Trainers</h3>
                                <div className="metrics-row">
                                    <div className="metric-card">
                                        <div className="metric-title">Trainers</div>
                                        <div className="metric-value">{filteredTrainersCount}</div>
                                    </div>
                                    <div className="metric-card">
                                        <div className="metric-title">Operators</div>
                                        <div className="metric-value">
                                            {filteredOperators.length - filteredTrainersCount}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-button" onClick={() => setShowOverview(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default OperatorsView;
