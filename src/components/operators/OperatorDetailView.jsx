import React, {useEffect, useState} from 'react';
import {PlantService} from '../../services/PlantService';
import {OperatorService} from '../../services/OperatorService';
import {UserService} from '../../services/UserService';
import LoadingScreen from '../common/LoadingScreen';
import supabase from '../../services/DatabaseService';
import {usePreferences} from '../../context/PreferencesContext';
import OperatorCard from './OperatorCard';
import {generateEmployeeIdFromUUID, generateRandomEmployeeId} from '../../utils/IDUtility';
import { AuthService } from '../../services/AuthService';
import './OperatorDetailView.css';

function OperatorDetailView({operatorId, onClose}) {
    const {preferences} = usePreferences();
    const [hasTrainingPermission, setHasTrainingPermission] = useState(false);
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
    const [smyrnaId, setSmyrnaId] = useState('');
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
            smyrnaId !== originalValues.smyrnaId ||
            name !== originalValues.name ||
            assignedPlant !== originalValues.assignedPlant ||
            status !== originalValues.status ||
            position !== originalValues.position ||
            isTrainer !== originalValues.isTrainer ||
            assignedTrainer !== originalValues.assignedTrainer;

        setHasUnsavedChanges(hasChanges);
    }, [employeeId, smyrnaId, name, assignedPlant, status, position, isTrainer, assignedTrainer, originalValues, isLoading]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const operatorData = await OperatorService.getOperatorByEmployeeId(operatorId);

            if (!operatorData) {
                setIsLoading(false);
                return;
            }

            if (!operatorData.employeeId) {
            }

            setOperator(operatorData);

            const empId = operatorData.employeeId || '';
            const opSmyrnaId = operatorData.smyrnaId || '';
            const operatorName = operatorData.name || '';
            const plant = operatorData.plantCode || '';
            const statusVal = operatorData.status || '';
            const positionVal = operatorData.position || '';
            const isTrainerVal = operatorData.isTrainer || false;
            const trainer = operatorData.assignedTrainer || '';

            setEmployeeId(empId);
            setSmyrnaId(opSmyrnaId);
            setName(operatorName);
            setAssignedPlant(plant);
            setStatus(statusVal);
            setPosition(positionVal);
            setIsTrainer(isTrainerVal);
            setAssignedTrainer(trainer);

            setOriginalValues({
                employeeId: empId,
                smyrnaId: opSmyrnaId,
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
                    setUpdatedByEmail('Unknown User');
                }
            }
        } catch (error) {
        } finally {
            setIsLoading(false);
            setHasUnsavedChanges(false);
        }
    };

    const handleSave = async () => {
        if (!hasTrainingPermission && ['Training', 'Pending Start'].includes(status)) {
            alert('You do not have permission to assign this status.');
            return;
        }

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
                    alert('Your session has expired. Please refresh the page and log in again.');
                    throw new Error('Authentication required: You must be logged in to update operators');
                }

                if (!operator.employeeId) {
                    throw new Error('Cannot update operator: missing employee ID. Try refreshing the page.');
                }

                const originalEmployeeId = operator.employeeId;

                const updatedOperator = {
                    ...operator,
                    employeeId,
                    smyrnaId,
                    name,
                    plantCode: assignedPlant,
                    status,
                    position,
                    isTrainer,
                    assignedTrainer: assignedTrainer || null,
                    updatedAt: new Date().toISOString(),
                    updatedBy: userId
                };

                if (!updatedOperator.assignedTrainer || updatedOperator.assignedTrainer === '0') {
                    updatedOperator.assignedTrainer = null;
                }

                await OperatorService.updateOperator(updatedOperator, userId);
                setOperator(updatedOperator);
                fetchData();

                setMessage('Changes saved successfully!');
                setTimeout(() => setMessage(''), 3000);

                setOriginalValues({
                    employeeId,
                    smyrnaId,
                    name,
                    assignedPlant,
                    status,
                    position,
                    isTrainer,
                    assignedTrainer
                });

                setHasUnsavedChanges(false);
            } catch (error) {
                setMessage(`Error saving changes: ${error.message || 'Unknown error'}`);
                setTimeout(() => setMessage(''), 5000);
            } finally {
                setIsSaving(false);
                resolve();
            }
        });
    };

    const handleDelete = async () => {
        try {
            const confirmed = window.confirm('Are you sure you want to delete this operator?');
            if (!confirmed) return;

            const userId = sessionStorage.getItem('userId') || (await supabase.auth.getUser()).data?.user?.id;
            if (!userId) {
                alert('Your session has expired. Please refresh the page and log in again.');
                throw new Error('Authentication required: You must be logged in to delete operators.');
            }

            const operatorData = await OperatorService.getOperatorByEmployeeId(operatorId);
            if (!operatorData || !operatorData.employeeId) {
                alert('Error: Operator not found or invalid Employee ID.');
                return;
            }

            const result = await OperatorService.deleteOperator(operatorData.employeeId);

            if (result) {
                alert('Operator successfully deleted.');
                onClose();
            } else {
                alert('Failed to delete operator. Please try again.');
            }
        } catch (error) {
            console.error('Error during operator deletion:', error);
            alert('Failed to delete operator. Please try again.');
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
        if (!trainerId || trainerId === null) return 'None';
        const trainer = trainers.find(t => t.employeeId === trainerId);
        return trainer ? (trainer.position ? `${trainer.name} (${trainer.position})` : trainer.name) : 'Unknown';
    };

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode || 'No Plant';
    };

    useEffect(() => {
        async function checkPermission() {
            const userId = sessionStorage.getItem('userId');
            if (userId) {
                const hasPermission = await UserService.hasPermission(userId, 'operators.training');
                setHasTrainingPermission(hasPermission);
            }
        }
        checkPermission();
    }, []);

    if (isLoading) {
        return (
            <div className="operator-detail-view">
                <div className="detail-header" style={{backgroundColor: preferences.themeMode === 'dark' ? '#2a2a2a' : '#ffffff', display: 'flex', alignItems: 'center', padding: '0 8px'}}>
                    <button className="back-button" onClick={onClose} style={{marginRight: '8px', backgroundColor: 'var(--accent)'}}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1 style={{color: preferences.themeMode === 'dark' ? '#f5f5f5' : '#212122', textAlign: 'center', flex: 1, margin: '0 auto'}}>Operator Details</h1>
                    <div style={{width: '36px'}}></div>
                </div>
                <div className="detail-content">
                    <LoadingScreen message="Loading operator details..." inline={true} />
                </div>
            </div>
        );
    }

    if (!operator) {
        return (
            <div className="operator-detail-view">
                <div className="detail-header" style={{backgroundColor: preferences.themeMode === 'dark' ? '#2a2a2a' : '#ffffff', display: 'flex', alignItems: 'center', padding: '0 8px'}}>
                    <button className="back-button" onClick={onClose} style={{marginRight: '8px', backgroundColor: 'var(--accent)'}}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1 style={{color: preferences.themeMode === 'dark' ? '#f5f5f5' : '#212122', textAlign: 'center', flex: 1, margin: '0 auto'}}>Operator Not Found</h1>
                    <div style={{width: '36px'}}></div>
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

            <div className="detail-header" style={{backgroundColor: preferences.themeMode === 'dark' ? '#2a2a2a' : '#ffffff', display: 'flex', alignItems: 'center', padding: '0 8px'}}>
                <button className="back-button" onClick={handleBackClick} aria-label="Back to operators" style={{marginRight: '8px', backgroundColor: 'var(--accent)'}}>
                    <i className="fas fa-arrow-left"></i>
                    <span>Back</span>
                </button>
                <h1 style={{color: preferences.themeMode === 'dark' ? '#f5f5f5' : '#212122', textAlign: 'center', flex: 1, margin: '0 auto'}}>{operator.name || 'Operator Details'}</h1>
                <div style={{width: '36px'}}></div>
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
                            <span
                                className="metadata-value">{operator.createdAt ? new Date(operator.createdAt).toLocaleString() : 'Not Assigned'}</span>
                        </div>
                        <div className="metadata-row">
                            <span className="metadata-label">Last Updated:</span>
                            <span
                                className="metadata-value">{operator.updatedAt ? new Date(operator.updatedAt).toLocaleString() : 'Not Assigned'}</span>
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
                            value={smyrnaId}
                            onChange={(e) => setSmyrnaId(e.target.value)}
                            className="form-control"
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
                            <option value="Active">Active</option>
                            <option value="Light Duty">Light Duty</option>
                            <option value="Terminated">Terminated</option>
                            {hasTrainingPermission && <option value="Pending Start">Pending Start</option>}
                            {hasTrainingPermission && <option value="Training">Training</option>}
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
                            {plants.sort((a, b) => {
                                const aCode = parseInt(a.plantCode?.replace(/\D/g, '') || '0');
                                const bCode = parseInt(b.plantCode?.replace(/\D/g, '') || '0');
                                return aCode - bCode;
                            }).map(plant => (
                                <option key={plant.plantCode} value={plant.plantCode}>
                                    ({plant.plantCode}) {plant.plantName}
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

                {hasTrainingPermission && (
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
                                        setAssignedTrainer(null);
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
                                <option value="">None</option>
                                {trainers.map(trainer => (
                                    <option key={trainer.employeeId} value={trainer.employeeId}>
                                        {trainer.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

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
                <div className="confirmation-modal" style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999}}>
                    <div className="confirmation-content" style={{width: '90%', maxWidth: '500px', margin: '0 auto'}}>
                        <h2>Confirm Delete</h2>
                        <p>Are you sure you want to delete {operator.name}? This action cannot be undone.</p>
                        <div className="confirmation-actions" style={{display: 'flex', justifyContent: 'center', gap: '12px'}}>
                            <button className="cancel-button" onClick={() => setShowDeleteConfirmation(false)}>Cancel</button>
                            <button className="danger-button" onClick={handleDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {showUnsavedChangesModal && (
                <div className="confirmation-modal" style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.5)'}}>
                    <div className="confirmation-content" style={{width: '90%', maxWidth: '500px', margin: '0 auto'}}>
                        <h2>Unsaved Changes</h2>
                        <p>You have unsaved changes that will be lost if you navigate away. What would you like to do?</p>
                        <div className="confirmation-actions" style={{justifyContent: 'center', flexWrap: 'wrap', display: 'flex', gap: '12px'}}>
                            <button className="cancel-button" onClick={() => setShowUnsavedChangesModal(false)}>Continue Editing</button>
                            <button 
                                className="primary-button save-button" 
                                style={{backgroundColor: 'var(--accent-color)'}} 
                                onClick={async () => {
                                    setShowUnsavedChangesModal(false);
                                    try {
                                        await handleSave();
                                        setMessage('Changes saved successfully!');
                                        setTimeout(() => onClose(), 800);
                                    } catch (error) {
                                        setMessage('Error saving changes. Please try again.');
                                        setTimeout(() => setMessage(''), 3000);
                                    }
                                }}
                            >Save & Leave</button>
                            <button 
                                className="danger-button" 
                                onClick={() => {
                                    setShowUnsavedChangesModal(false);
                                    setHasUnsavedChanges(false);
                                    onClose();
                                }}
                            >Discard & Leave</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default OperatorDetailView;

