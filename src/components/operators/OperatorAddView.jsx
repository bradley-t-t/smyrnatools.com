import React, {useState} from 'react';
import {OperatorService} from '../../services/operators/OperatorService';
import {AuthService} from '../../services/auth/AuthService';
import './OperatorAddView.css';

function OperatorAddView({plants, operators = [], onClose, onOperatorAdded}) {
    const hasOperators = Array.isArray(operators) && operators.length > 0;
    const [employeeId, setEmployeeId] = useState('');
    const [name, setName] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [status, setStatus] = useState('Active');
    const [position, setPosition] = useState('');
    const [isTrainer, setIsTrainer] = useState(false);
    const [assignedTrainer, setAssignedTrainer] = useState('0');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!employeeId) {
            setError('Employee ID is required');
            return;
        }

        if (!name) {
            setError('Name is required');
            return;
        }

        if (!assignedPlant) {
            setError('Plant is required');
            return;
        }

        setIsSaving(true);

        try {
            let userId = AuthService.currentUser?.id;
            if (!userId) {
                userId = sessionStorage.getItem('userId');
            }

            if (!userId) {
                throw new Error('User ID not available. Please log in again.');
            }

            const formatDateForDb = (date) => {
                if (!date) return null;
                const d = new Date(date);
                if (isNaN(d.getTime())) return null;

                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                const seconds = String(d.getSeconds()).padStart(2, '0');

                return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+00`;
            };

            const now = formatDateForDb(new Date());

            const newOperator = {
                employee_id: employeeId,
                name,
                plant_code: assignedPlant,
                status,
                position,
                is_trainer: isTrainer,
                assigned_trainer: isTrainer ? '0' : assignedTrainer,
                created_at: now,
                updated_at: now,
                updated_by: userId
            };

            const savedOperator = await OperatorService.createOperator(newOperator, userId);

            if (savedOperator) {
                onOperatorAdded(savedOperator);
                onClose();
            } else {
                throw new Error('Failed to add operator - no data returned from server');
            }
        } catch (error) {
            console.error('Error adding operator:', error);
            setError(`Failed to add operator: ${error.message || 'Unknown error'}`);
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
                            <label htmlFor="employeeId">Employee ID*</label>
                            <input
                                id="employeeId"
                                type="text"
                                className="ios-input"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                placeholder="Enter employee ID"
                                required
                            />
                        </div>

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
                            <label htmlFor="status">Status</label>
                            <select
                                id="status"
                                className="ios-select"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                <option value="Active">Active</option>
                                <option value="Light Duty">Light Duty</option>
                                <option value="Pending Start">Pending Start</option>
                                <option value="Terminated">Terminated</option>
                                <option value="Training">Training</option>
                            </select>
                        </div>

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
                                <option value="false">Non-Trainer</option>
                                <option value="true">Trainer</option>
                            </select>
                        </div>

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
                                <div className="warning-message"
                                     style={{marginTop: '5px', fontSize: '12px', color: '#FF9500'}}>
                                    No trainers available
                                </div>
                            )}
                        </div>

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