import React, {useEffect, useState} from 'react';
import {PlantService} from '../../services/PlantService';
import {OperatorService} from '../../services/operators/OperatorService';
import {UserService} from '../../services/auth/UserService';
import Theme from '../../utils/Theme';
import supabase from '../../core/SupabaseClient';
import {usePreferences} from '../../context/PreferencesContext';
import OperatorCard from './OperatorCard';
import './OperatorDetailView.css';

function OperatorDetailView({operatorId, onClose}) {
    const {preferences} = usePreferences();
    const [operator, setOperator] = useState(null);
    const [trainers, setTrainers] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [updatedByEmail, setUpdatedByEmail] = useState(null);
    const [message, setMessage] = useState('');
    const [originalValues, setOriginalValues] = useState({});

    const [employeeId, setEmployeeId] = useState('');
    const [name, setName] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [status, setStatus] = useState('');
    const [position, setPosition] = useState('');
    const [isTrainer, setIsTrainer] = useState(false);
    const [assignedTrainer, setAssignedTrainer] = useState('');

    useEffect(() => {
        document.body.classList.add('in-detail-view');
        return () => {
            document.body.classList.remove('in-detail-view');
        };
    }, []);

    useEffect(() => {
        fetchData();
    }, [operatorId]);

    useEffect(() => {
        if (!originalValues.employeeId && !isLoading) return;
        if (isLoading) return;

        const hasChanges =
            name !== originalValues.name ||
            assignedPlant !== originalValues.assignedPlant ||
            status !== originalValues.status ||
            position !== originalValues.position ||
            isTrainer !== originalValues.isTrainer ||
            assignedTrainer !== originalValues.assignedTrainer;

        setHasUnsavedChanges(hasChanges);
    }, [employeeId, name, assignedPlant, status, position, isTrainer, assignedTrainer, originalValues, isLoading]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const operatorData = await OperatorService.getOperatorByEmployeeId(operatorId);
            setOperator(operatorData);

            const empId = operatorData.employeeId || '';
            const operatorName = operatorData.name || '';
            const plant = operatorData.plantCode || '';
            const statusVal = operatorData.status || '';
            const positionVal = operatorData.position || '';
            const isTrainerVal = operatorData.isTrainer || false;
            const trainer = operatorData.assignedTrainer || '0';

            setEmployeeId(empId);
            setName(operatorName);
            setAssignedPlant(plant);
            setStatus(statusVal);
            setPosition(positionVal);
            setIsTrainer(isTrainerVal);
            setAssignedTrainer(trainer);

            setOriginalValues({
                employeeId: empId,
                name: operatorName,
                assignedPlant: plant,
                status: statusVal,
                position: positionVal,
                isTrainer: isTrainerVal,
                assignedTrainer: trainer
            });

            setHasUnsavedChanges(false);

            const trainersData = await OperatorService.getAllTrainers();
            setTrainers(trainersData);

            const plantsData = await PlantService.fetchPlants();
            setPlants(plantsData);

            if (operatorData.updatedBy) {
                try {
                    const userName = await UserService.getUserDisplayName(operatorData.updatedBy);
                    setUpdatedByEmail(userName);
                } catch (error) {
                    console.log('Could not fetch user info:', error);
                    setUpdatedByEmail('Unknown User');
                }
            }
        } catch (error) {
            console.error('Error fetching operator details:', error);
        } finally {
            setIsLoading(false);
            setHasUnsavedChanges(false);
        }
    };

    const handleSave = async () => {
        return new Promise(async (resolve, reject) => {
            if (!operator || !operator.employeeId) {
                alert('Error: Cannot save operator with undefined Employee ID');
                return;
            }

            setIsSaving(true);
            try {
                let userId = sessionStorage.getItem('userId');
                if (!userId) {
                    const {data: {user}} = await supabase.auth.getUser();
                    userId = user?.id;
                }

                if (!userId) {
                    console.error('No authenticated user found');
                    alert('Your session has expired. Please refresh the page and log in again.');
                    throw new Error('Authentication required: You must be logged in to update operators');
                }

                const updatedOperator = {
                    ...operator,
                    employeeId,
                    name,
                    plantCode: assignedPlant,
                    status,
                    position,
                    isTrainer,
                    assignedTrainer: assignedTrainer || '0',
                    updatedAt: new Date().toISOString(),
                    updatedBy: userId
                };

                await OperatorService.updateOperator(updatedOperator, userId);
                setOperator(updatedOperator);
                fetchData();

                setMessage('Changes saved successfully!');
                setTimeout(() => setMessage(''), 3000);

                setOriginalValues({
                    employeeId,
                    name,
                    assignedPlant,
                    status,
                    position,
                    isTrainer,
                    assignedTrainer
                });

                setHasUnsavedChanges(false);
            } catch (error) {
                console.error('Error saving operator:', error);
                alert(`Error saving changes: ${error.message || 'Unknown error'}`);
            } finally {
                setIsSaving(false);
                resolve();
            }
        });
    };

    const handleDelete = async () => {
        if (!operator) return;

        if (!showDeleteConfirmation) {
            setShowDeleteConfirmation(true);
            return;
        }

        try {
            await OperatorService.deleteOperator(operator.employeeId);
            alert('Operator deleted successfully');
            onClose();
        } catch (error) {
            console.error('Error deleting operator:', error);
            alert('Error deleting operator');
        } finally {
            setShowDeleteConfirmation(false);
        }
    };

    const handleBackClick = () => {
        if (hasUnsavedChanges) {
            setShowUnsavedChangesModal(true);
        } else {
            onClose();
        }
    };

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const getTrainerName = (trainerId) => {
        if (!trainerId || trainerId === '0') return 'None';
        const trainer = trainers.find(t => t.employeeId === trainerId);
        return trainer ? (trainer.position ? `${trainer.name} (${trainer.position})` : trainer.name) : 'Unknown';
    };

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode || 'No Plant';
    };

    if (isLoading) {
        return (
            <div className="operator-detail-view">
                <div className="detail-header">
                    <button className="back-button" onClick={onClose}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1>Operator Details</h1>
                </div>
                <div className="detail-content">
                    <div className="content-loading-container">
                        <div className="ios-spinner"></div>
                        <p>Loading operator details...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!operator) {
        return (
            <div className="operator-detail-view">
                <div className="detail-header">
                    <button className="back-button" onClick={onClose}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1>Operator Not Found</h1>
                </div>
                <div className="error-message">
                    <p>Could not find the requested operator. They may have been deleted.</p>
                    <button className="primary-button" onClick={onClose}>Return to Operators</button>
                </div>
            </div>
        );
    }

    return (
        <div className="operator-detail-view">
            {isSaving && (
                <div className="saving-overlay">
                    <div className="saving-indicator"></div>
                </div>
            )}

            <div className="detail-header">
                <div className="header-left">
                    <button className="back-button" onClick={handleBackClick} aria-label="Back to operators">
                        <i className="fas fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                </div>
                <h1>{operator.name || 'Operator Details'}</h1>
                <div className="header-actions">
                </div>
            </div>

            <div className="detail-content">
                {message && (
                    <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                        {message}
                    </div>
                )}

                <div className="operator-card-preview">
                    <OperatorCard
                        operator={operator}
                        plantName={getPlantName(operator.plantCode)}
                        showOperatorWarning={false}
                    />
                </div>

                <div className="detail-card">
                    <div className="card-header">
                        <h2>Edit Information</h2>
                    </div>
                    <p className="edit-instructions">Make changes below and click Save when finished.</p>

                    <div className="metadata-info" style={{display: 'none'}}>
                        <div className="metadata-row">
                            <span className="metadata-label">Created:</span>
                            <span className="metadata-value">{operator.createdAt ? new Date(operator.createdAt).toLocaleString() : 'N/A'}</span>
                        </div>
                        <div className="metadata-row">
                            <span className="metadata-label">Last Updated:</span>
                            <span className="metadata-value">{operator.updatedAt ? new Date(operator.updatedAt).toLocaleString() : 'N/A'}</span>
                        </div>
                        {operator.updatedBy && (
                            <div className="metadata-row">
                                <span className="metadata-label">Updated By:</span>
                                <span className="metadata-value">{updatedByEmail || 'Unknown User'}</span>
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Employee ID</label>
                        <input
                            type="text"
                            value={employeeId}
                            readOnly
                            className="form-control disabled-field"
                        />
                    </div>

                    <div className="form-group">
                        <label>Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="form-control"
                        />
                    </div>

                    <div className="form-group">
                        <label>Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="form-control"
                        >
                            <option value="">Select Status</option>
                            <option value="Active">Active</option>
                            <option value="Light Duty">Light Duty</option>
                            <option value="Pending Start">Pending Start</option>
                            <option value="Terminated">Terminated</option>
                            <option value="Training">Training</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Assigned Plant</label>
                        <select
                            value={assignedPlant}
                            onChange={(e) => setAssignedPlant(e.target.value)}
                            className="form-control"
                        >
                            <option value="">Select Plant</option>
                            {plants.map(plant => (
                                <option key={plant.plantCode} value={plant.plantCode}>
                                    {plant.plantName}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Position</label>
                        <select
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            className="form-control"
                        >
                            <option value="">Select Position</option>
                            <option value="Mixer Operator">Mixer Operator</option>
                            <option value="Tractor Operator">Tractor Operator</option>
                        </select>
                    </div>
                </div>

                <div className="detail-card">
                    <h2>Training Information</h2>

                    <div className="form-group">
                        <label>Trainer Status</label>
                        <select
                            id="trainer-status"
                            className="form-control"
                            value={isTrainer ? "true" : "false"}
                            onChange={(e) => {
                                const isTrainerValue = e.target.value === "true";
                                setIsTrainer(isTrainerValue);
                                if (isTrainerValue) {
                                    setAssignedTrainer('0');
                                }
                            }}
                        >
                            <option value="false">Non-Trainer</option>
                            <option value="true">Trainer</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Assigned Trainer</label>
                        <select
                            value={assignedTrainer}
                            onChange={(e) => setAssignedTrainer(e.target.value)}
                            className="form-control"
                            disabled={isTrainer}
                        >
                            <option value="0">None</option>
                            {trainers.map(trainer => (
                                <option key={trainer.employeeId} value={trainer.employeeId}>
                                    {trainer.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="form-actions">
                    <button
                        className="primary-button save-button"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>

                    <button
                        className="danger-button"
                        onClick={() => setShowDeleteConfirmation(true)}
                        disabled={isSaving}
                    >
                        Delete Operator
                    </button>
                </div>
            </div>

            {showDeleteConfirmation && (
                <div className="confirmation-modal">
                    <div className="confirmation-content">
                        <h2>Confirm Delete</h2>
                        <p>Are you sure you want to delete {operator.name}? This action cannot be undone.</p>
                        <div className="confirmation-actions">
                            <button className="cancel-button" onClick={() => setShowDeleteConfirmation(false)}>
                                Cancel
                            </button>
                            <button className="danger-button" onClick={handleDelete}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showUnsavedChangesModal && (
                <div className="confirmation-modal">
                    <div className="confirmation-content">
                        <h2>Unsaved Changes</h2>
                        <p>You have unsaved changes that will be lost if you navigate away. What would you like to do?</p>
                        <div className="confirmation-actions">
                            <button className="cancel-button" onClick={() => setShowUnsavedChangesModal(false)}>
                                Continue Editing
                            </button>
                            <button
                                    className="primary-button save-button"
                                onClick={async () => {
                                    setShowUnsavedChangesModal(false);
                                    try {
                                        await handleSave();
                                        setMessage('Changes saved successfully!');
                                        setTimeout(() => onClose(), 800);
                                    } catch (error) {
                                        console.error('Error saving before navigation:', error);
                                        setMessage('Error saving changes. Please try again.');
                                        setTimeout(() => setMessage(''), 3000);
                                    }
                                }}
                            >
                                Save & Leave
                            </button>
                            <button
                                className="danger-button"
                                onClick={() => {
                                    setShowUnsavedChangesModal(false);
                                    setHasUnsavedChanges(false);
                                    onClose();
                                }}
                            >
                                Discard & Leave
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default OperatorDetailView;