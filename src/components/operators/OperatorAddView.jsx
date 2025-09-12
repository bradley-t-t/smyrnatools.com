import React, {useEffect, useState} from 'react';
import {OperatorService} from '../../services/OperatorService';
import {UserService} from '../../services/UserService';
import UserUtility from '../../utils/UserUtility';
import './styles/OperatorAddView.css';

function OperatorAddView({plants, operators = [], onClose, onOperatorAdded}) {
    const [name, setName] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [status, setStatus] = useState('Active');
    const [position, setPosition] = useState('');
    const [isTrainer, setIsTrainer] = useState(false);
    const [assignedTrainer, setAssignedTrainer] = useState('0');
    const [pendingStartDate, setPendingStartDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [hasTrainingPermission, setHasTrainingPermission] = useState(false);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!name) {
            setError('Name is required');
            return;
        }

        if (!assignedPlant) {
            setError('Plant is required');
            return;
        }

        if (!hasTrainingPermission && ['Training', 'Pending Start'].includes(status)) {
            setError('You do not have permission to assign this status.');
            return;
        }

        const normalizedNewName = name.trim().toLowerCase();
        const hasDuplicate = Array.isArray(operators) && operators.some(o => (o?.name || '').trim().toLowerCase() === normalizedNewName);

        if (hasDuplicate) {
            const proceed = window.confirm(`An operator named "${name.trim()}" already exists. Create anyway?`);
            if (!proceed) {
                return;
            }
        }

        setIsSaving(true);

        try {
            let userId = sessionStorage.getItem('userId');
            if (!UserUtility.isValidUUID(userId)) {
                throw new Error('Invalid or missing User ID. Please log in again.');
            }

            const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

            const newOperator = {
                employee_id: UserUtility.generateUUID(),
                smyrna_id: null,
                name: name.trim(),
                plant_code: assignedPlant,
                status,
                position: position || null,
                is_trainer: isTrainer,
                assigned_trainer: UserUtility.safeUUID(assignedTrainer),
                created_at: now,
                updated_at: now,
                updated_by: userId,
                pending_start_date: status === 'Pending Start' ? pendingStartDate : null
            };

            const savedOperator = await OperatorService.createOperator(newOperator);

            if (savedOperator) {
                onOperatorAdded(savedOperator);
                onClose();
            } else {
                throw new Error('Failed to add operator - no data returned from server');
            }
        } catch (error) {
            setError(`Failed to add operator: ${error.message || 'Unknown error. Check console for details.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="add-operator-modal-backdrop">
            <div className="add-operator-modal">
                <div className="add-operator-header">
                    <h2>Add New Operator</h2>
                    <button className="ios-button" onClick={onClose}>Cancel</button>
                </div>
                <div className="add-operator-content">
                    {error && <div className="error-message">{error}</div>}
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="name">Name*</label>
                            <input
                                id="name"
                                type="text"
                                className="ios-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter full name"
                                required
                            />
                        </div>
                        <div className="form-row-horizontal">
                            <div className="form-group">
                                <label htmlFor="assignedPlant">Assigned Plant*</label>
                                <select
                                    id="assignedPlant"
                                    className="ios-select"
                                    value={assignedPlant}
                                    onChange={(e) => setAssignedPlant(e.target.value)}
                                    required
                                >
                                    <option value="">Select Plant</option>
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
                            <div className="form-group">
                                <label htmlFor="status">Status</label>
                                <select
                                    id="status"
                                    className="ios-select"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                >
                                    <option value="Active">Active</option>
                                    <option value="Light Duty">Light Duty</option>
                                    <option value="Terminated">Terminated</option>
                                    {hasTrainingPermission && <option value="Pending Start">Pending Start</option>}
                                    {hasTrainingPermission && <option value="Training">Training</option>}
                                    <option value="No Hire">No Hire</option>
                                </select>
                            </div>
                        </div>
                        {status === 'Pending Start' && (
                            <div className="form-group">
                                <label htmlFor="pendingStartDate">Pending Start Date</label>
                                <input
                                    id="pendingStartDate"
                                    type="date"
                                    className="ios-input"
                                    value={pendingStartDate}
                                    onChange={e => setPendingStartDate(e.target.value)}
                                />
                            </div>
                        )}
                        <div className="form-row-horizontal">
                            <div className="form-group">
                                <label htmlFor="position">Position</label>
                                <select
                                    id="position"
                                    className="ios-select"
                                    value={position}
                                    onChange={(e) => setPosition(e.target.value)}
                                >
                                    <option value="">Select Position</option>
                                    <option value="Mixer Operator">Mixer Operator</option>
                                    <option value="Tractor Operator">Tractor Operator</option>
                                </select>
                            </div>
                            {hasTrainingPermission && (
                                <div className="form-group">
                                    <label htmlFor="isTrainer">Trainer Status</label>
                                    <select
                                        id="isTrainer"
                                        className="ios-select"
                                        value={isTrainer ? "true" : "false"}
                                        onChange={(e) => {
                                            const isTrainerValue = e.target.value === "true";
                                            setIsTrainer(isTrainerValue);
                                            if (isTrainerValue) {
                                                setAssignedTrainer('0');
                                            }
                                        }}
                                    >
                                        <option value="false">Not a Trainer</option>
                                        <option value="true">Trainer</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        {hasTrainingPermission && (
                            <div className="form-group">
                                <label htmlFor="assignedTrainer">Assigned Trainer</label>
                                <select
                                    id="assignedTrainer"
                                    className="ios-select"
                                    value={assignedTrainer}
                                    onChange={(e) => setAssignedTrainer(e.target.value)}
                                    disabled={isTrainer}
                                >
                                    <option value="0">None</option>
                                    {operators
                                        .filter(operator => operator.isTrainer)
                                        .map(trainer => (
                                            <option key={trainer.employeeId} value={trainer.employeeId}>
                                                {trainer.name}
                                            </option>
                                        ))}
                                </select>
                                {operators.filter(op => op.isTrainer).length === 0 && (
                                    <div className="warning-message">
                                        No trainers available
                                    </div>
                                )}
                            </div>
                        )}
                        <button
                            type="submit"
                            className="ios-button-primary"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Adding...' : 'Add Operator'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default OperatorAddView;
