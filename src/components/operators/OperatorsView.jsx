import React, {useEffect, useRef, useState} from 'react';
import './OperatorsView.css';
import supabase from '../../core/SupabaseClient';
import {UserService} from '../../services/auth/UserService';
import OperatorHistoryView from './OperatorHistoryView';

function OperatorsView({title, showSidebar, setShowSidebar, onSelectOperator}) {
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

    // Get trainer name by ID
    const getTrainerName = (trainerId) => {
        if (!trainerId || trainerId === '0') return 'None';
        const trainer = operators.find(op => op.employeeId === trainerId);
        return trainer ? trainer.name : 'Unknown';
    };

    // Get status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'Active':
                return '#38a169'; // green
            case 'Light Duty':
                return '#ecc94b'; // yellow
            case 'Pending Start':
                return '#ed8936'; // orange
            case 'Terminated':
                return '#e53e3e'; // red
            case 'Training':
                return '#3182ce'; // blue
            default:
                return '#718096'; // gray
        }
    };

    // Status counts for overview
    const statusCounts = statuses.map(status => ({
        status,
        count: filteredOperators.filter(op => op.status === status).length
    }));

    // Number of trainers
    const filteredTrainersCount = filteredOperators.filter(op => op.isTrainer).length;

    // Render OperatorCard component
    const OperatorCard = ({operator}) => {
        const trainerName = getTrainerName(operator.assignedTrainer);
        const statusColor = getStatusColor(operator.status);

        return (
            <div className="operator-card" onClick={() => handleOperatorSelection(operator)}>
                <div className="card-content">
                    <div className="card-header">
                        <h3 className="operator-name">{operator.name}</h3>
                        <div className="status-indicator" style={{backgroundColor: statusColor}}></div>
                    </div>
                    <div className="card-details">
                        <div className="detail-row">
                            <div className="detail-label">Employee ID</div>
                            <div className="detail-value">{operator.employeeId}</div>
                        </div>
                        <div className="detail-row">
                            <div className="detail-label">Plant</div>
                            <div className="detail-value">{operator.plantCode || 'None'}</div>
                        </div>
                        <div className="detail-row">
                            <div className="detail-label">Status</div>
                            <div className="detail-value">{operator.status}</div>
                        </div>
                        <div className="detail-row">
                            <div className="detail-label">Position</div>
                            <div className="detail-value">{operator.position || 'Not Assigned'}</div>
                        </div>
                        <div className="detail-row">
                            <div className="detail-label">Trainer</div>
                            <div className="detail-value">{operator.isTrainer ? 'Yes' : 'No'}</div>
                        </div>
                        <div className="detail-row">
                            <div className="detail-label">Assigned Trainer</div>
                            <div className="detail-value">{trainerName}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-container operators-view">
            {/* Header */}
            <div className="dashboard-header">
                <h1>{title || 'Operator Fleet'}</h1>
                <div className="dashboard-actions">
                    {setShowSidebar && (
                        <button className="action-button" onClick={() => setShowSidebar(!showSidebar)}>
                            <i className="fas fa-bars"></i>
                            Menu
                        </button>
                    )}
                    <button className="action-button primary" onClick={() => setShowAddSheet(true)}>
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
                        placeholder="Search by name or status..."
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
                            {plants.map((plant) => (
                                <option key={plant.id} value={plant.plant_code}>
                                    {plant.plant_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {(selectedPlant || searchText) && (
                        <button
                            className="filter-reset-button"
                            onClick={() => {
                                setSelectedPlant('');
                                setSearchText('');
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
                        <p>Loading operators...</p>
                    </div>
                ) : filteredOperators.length === 0 ? (
                    <div className="no-results-container">
                        <div className="no-results-icon">
                            <i className="fas fa-user-slash"></i>
                        </div>
                        <h3>No Operators Found</h3>
                        <p>
                            {searchText || selectedPlant
                                ? "No operators match your search criteria."
                                : "There are no operators in the system yet."}
                        </p>
                        <button
                            className="primary-button"
                            onClick={() => setShowAddSheet(true)}
                        >
                            Add Operator
                        </button>
                    </div>
                ) : (
                    <div className="operators-grid">
                        {filteredOperators.map((operator) => (
                            <OperatorCard
                                key={operator.employeeId}
                                operator={operator}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Add Operator Modal */}
            {showAddSheet && (
                <div className="modal-backdrop" onClick={() => setShowAddSheet(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add Operator</h2>
                            <button className="close-button" onClick={() => setShowAddSheet(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label htmlFor="employeeId">Employee ID</label>
                                <input
                                    type="text"
                                    id="employeeId"
                                    value={newEmployeeId}
                                    onChange={(e) => setNewEmployeeId(e.target.value)}
                                    className="form-control"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="name">Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="form-control"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="position">Position</label>
                                <select
                                    id="position"
                                    value={newPosition}
                                    onChange={(e) => setNewPosition(e.target.value)}
                                    className="form-control"
                                >
                                    <option value="">Select a Position</option>
                                    {positions.map((position) => (
                                        <option key={position} value={position}>
                                            {position}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="plant">Plant</label>
                                <select
                                    id="plant"
                                    value={newPlantCode}
                                    onChange={(e) => setNewPlantCode(e.target.value)}
                                    className="form-control"
                                >
                                    <option value="">None</option>
                                    {plants.map((plant) => (
                                        <option key={plant.id} value={plant.plant_code}>
                                            {plant.plant_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="status">Status</label>
                                <select
                                    id="status"
                                    value={newStatus}
                                    onChange={(e) => setNewStatus(e.target.value)}
                                    className="form-control"
                                >
                                    {statuses.map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group checkbox-group">
                                <input
                                    type="checkbox"
                                    id="isTrainer"
                                    checked={newIsTrainer}
                                    onChange={(e) => setNewIsTrainer(e.target.checked)}
                                    className="form-checkbox"
                                />
                                <label htmlFor="isTrainer">Is Trainer</label>
                            </div>
                            {newStatus === 'Training' && (
                                <div className="form-group">
                                    <label htmlFor="assignedTrainer">Assigned Trainer</label>
                                    <select
                                        id="assignedTrainer"
                                        value={newAssignedTrainer}
                                        onChange={(e) => setNewAssignedTrainer(e.target.value)}
                                        className="form-control"
                                    >
                                        <option value="">Unassigned</option>
                                        {operators
                                            .filter((op) => op.isTrainer)
                                            .map((trainer) => (
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
                            >
                                Cancel
                            </button>
                            <button
                                className="primary-button"
                                onClick={addOperator}
                                disabled={!newEmployeeId || !newName || !newPosition}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Operator Control Panel */}
            {showControlPanel && selectedOperator && (
                <div className="modal-backdrop" onClick={() => setShowControlPanel(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Operator Control Panel</h2>
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
                                            <div className="info-value">{selectedOperator.plantCode || 'None'}</div>
                                        </div>
                                        <div className="info-row">
                                            <div className="info-label">Status</div>
                                            <div className="info-value">{selectedOperator.status}</div>
                                        </div>
                                        <div className="info-row">
                                            <div className="info-label">Position</div>
                                            <div
                                                className="info-value">{selectedOperator.position || 'Not Assigned'}</div>
                                        </div>
                                    </div>
                                    <div className="info-column">
                                        <div className="info-row">
                                            <div className="info-label">Trainer</div>
                                            <div
                                                className="info-value">{selectedOperator.isTrainer ? 'Yes' : 'No'}</div>
                                        </div>
                                        <div className="info-row">
                                            <div className="info-label">Assigned Trainer</div>
                                            <div
                                                className="info-value">{getTrainerName(selectedOperator.assignedTrainer)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="control-panel-actions">
                                <div className="action-grid">
                                    <button className="action-tile" onClick={() => {
                                        // Edit operators info
                                        const updatedOperator = {...selectedOperator};
                                        // Open a modal to edit the operators info
                                        // For simplicity, we'll just prompt for now
                                        const newName = prompt('Enter new name:', selectedOperator.name);
                                        if (newName && newName !== selectedOperator.name) {
                                            updatedOperator.name = newName;
                                            updateOperator(updatedOperator);
                                        }
                                    }}>
                                        <i className="fas fa-user-edit"></i>
                                        <span>Operator Info</span>
                                    </button>
                                    <button className="action-tile" onClick={() => {
                                        // Assign plant
                                        const updatedOperator = {...selectedOperator};
                                        // Show a dropdown with all plants
                                        const plantIndex = prompt(
                                            'Select plant number:\n' +
                                            plants.map((p, i) => `${i + 1}. ${p.plant_name}`).join('\n') +
                                            '\n0. None'
                                        );
                                        if (plantIndex !== null) {
                                            const index = parseInt(plantIndex);
                                            if (index === 0) {
                                                updatedOperator.plantCode = null;
                                                updateOperator(updatedOperator);
                                            } else if (index > 0 && index <= plants.length) {
                                                updatedOperator.plantCode = plants[index - 1].plant_code;
                                                updateOperator(updatedOperator);
                                            }
                                        }
                                    }}>
                                        <i className="fas fa-building"></i>
                                        <span>Assign Plant</span>
                                    </button>
                                    <button className="action-tile" onClick={() => {
                                        // Change status
                                        const updatedOperator = {...selectedOperator};
                                        // Show a dropdown with all statuses
                                        const statusIndex = prompt(
                                            'Select status number:\n' +
                                            statuses.map((s, i) => `${i + 1}. ${s}`).join('\n')
                                        );
                                        if (statusIndex !== null) {
                                            const index = parseInt(statusIndex);
                                            if (index > 0 && index <= statuses.length) {
                                                updatedOperator.status = statuses[index - 1];
                                                if (updatedOperator.status !== 'Training') {
                                                    updatedOperator.assignedTrainer = '0';
                                                }
                                                updateOperator(updatedOperator);
                                            }
                                        }
                                    }}>
                                        <i className="fas fa-exchange-alt"></i>
                                        <span>Change Status</span>
                                    </button>
                                    <button className="action-tile" onClick={() => {
                                        // Training settings
                                        const updatedOperator = {...selectedOperator};
                                        // Toggle trainer status
                                        const confirmMessage = `${selectedOperator.name} is ${selectedOperator.isTrainer ? '' : 'not '}a trainer. Change?`;
                                        if (window.confirm(confirmMessage)) {
                                            updatedOperator.isTrainer = !selectedOperator.isTrainer;
                                            // If changing to not a trainer and is in training, also change status
                                            if (!updatedOperator.isTrainer && updatedOperator.status === 'Training') {
                                                const trainingConfirmMessage = 'This operators is in training. Change status to Active?';
                                                if (window.confirm(trainingConfirmMessage)) {
                                                    updatedOperator.status = 'Active';
                                                    updatedOperator.assignedTrainer = '0';
                                                }
                                            }
                                            updateOperator(updatedOperator);
                                        }
                                    }}>
                                        <i className="fas fa-user-graduate"></i>
                                        <span>Training Settings</span>
                                    </button>
                                    <button className="action-tile" onClick={() => {
                                        // View history
                                        setShowHistory(true);
                                        setShowControlPanel(false);
                                    }}>
                                        <i className="fas fa-history"></i>
                                        <span>View History</span>
                                    </button>
                                    <button className="action-tile delete" onClick={() => {
                                        setOperatorToDelete(selectedOperator);
                                        setShowDeleteConfirmation(true);
                                        setShowControlPanel(false);
                                    }}>
                                        <i className="fas fa-trash-alt"></i>
                                        <span>Delete Operator</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="cancel-button"
                                onClick={() => setShowControlPanel(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Dialog */}
            {showDeleteConfirmation && operatorToDelete && (
                <div className="modal-backdrop" onClick={() => setShowDeleteConfirmation(false)}>
                    <div className="confirmation-dialog" onClick={(e) => e.stopPropagation()}>
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
                                onClick={() => setShowDeleteConfirmation(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="delete-button"
                                onClick={() => {
                                    deleteOperator(operatorToDelete);
                                    setShowDeleteConfirmation(false);
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
                <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Operators Overview</h2>
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
                                        <div className="metric-title">Trainers</div>
                                        <div className="metric-value">{filteredTrainersCount}</div>
                                    </div>
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
            )}

            {/* History Modal */}
            {showHistory && selectedOperator && (
                <OperatorHistoryView
                    employeeId={selectedOperator.employeeId}
                    onClose={() => setShowHistory(false)}
                />
            )}
        </div>
    );
}

export default OperatorsView;
