import React, {useState} from 'react';
import {EquipmentService} from '../../services/EquipmentService';
import {AuthService} from '../../services/AuthService';
import './styles/EquipmentAddView.css';

function EquipmentAddView({plants, onClose, onEquipmentAdded}) {
    const [identifyingNumber, setIdentifyingNumber] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [equipmentType, setEquipmentType] = useState('');
    const [status, setStatus] = useState('Active');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!identifyingNumber) return setError('Identifying number is required');
        if (!assignedPlant) return setError('Plant is required');
        if (!equipmentType) return setError('Equipment type is required');

        setIsSaving(true);
        try {
            const userId = AuthService.currentUser?.id || sessionStorage.getItem('userId');
            if (!userId) throw new Error('User ID not available. Please log in again.');

            const newEquipment = {
                identifying_number: identifyingNumber,
                assigned_plant: assignedPlant,
                equipment_type: equipmentType,
                status
            };

            const savedEquipment = await EquipmentService.createEquipment(newEquipment, userId);
            if (!savedEquipment) throw new Error('Failed to add equipment - no data returned from server');

            onEquipmentAdded(savedEquipment);
            onClose();
        } catch (error) {
            setError(`Failed to add equipment: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="add-equipment-modal-backdrop">
            <div className="add-equipment-modal enhanced">
                <div className="add-equipment-header sticky">
                    <h2>Add New Equipment</h2>
                    <button className="ios-button close-btn" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="add-equipment-content-scrollable">
                    <div className="add-equipment-content">
                        {error && <div className="error-message">{error}</div>}
                        <form onSubmit={handleSubmit} autoComplete="off">
                            <div className="form-section">
                                <div className="form-row">
                                    <div className="form-group wide">
                                        <label htmlFor="identifyingNumber">Identifying Number*</label>
                                        <input
                                            id="identifyingNumber"
                                            type="text"
                                            className="ios-input"
                                            value={identifyingNumber}
                                            onChange={e => setIdentifyingNumber(e.target.value)}
                                            placeholder="Enter identifying number"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="form-section">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="assignedPlant">Assigned Plant*</label>
                                        <select
                                            id="assignedPlant"
                                            className="ios-select"
                                            value={assignedPlant}
                                            onChange={e => setAssignedPlant(e.target.value)}
                                            required
                                        >
                                            <option value="">Select Plant</option>
                                            {plants?.length ? plants.map(plant => (
                                                <option key={plant.plantCode} value={plant.plantCode}>
                                                    ({plant.plantCode}) {plant.plantName}
                                                </option>
                                            )) : <option disabled>Loading plants...</option>}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="equipmentType">Equipment Type*</label>
                                        <select
                                            id="equipmentType"
                                            className="ios-select"
                                            value={equipmentType}
                                            onChange={e => setEquipmentType(e.target.value)}
                                            required
                                        >
                                            <option value="">Select Type</option>
                                            <option value="Front-End Loader">Front-End Loader</option>
                                            <option value="Excavator">Excavator</option>
                                            <option value="Mini-Excavator">Mini-Excavator</option>
                                            <option value="Skid Steer">Skid Steer</option>
                                            <option value="Forklift">Forklift</option>
                                            <option value="Manlift">Manlift</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="status">Status</label>
                                        <select
                                            id="status"
                                            className="ios-select"
                                            value={status}
                                            onChange={e => setStatus(e.target.value)}
                                        >
                                            <option value="Active">Active</option>
                                            <option value="Spare">Spare</option>
                                            <option value="In Shop">In Shop</option>
                                            <option value="Retired">Retired</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="ios-button-primary" disabled={isSaving}>
                                    {isSaving ? 'Adding...' : 'Add Equipment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EquipmentAddView;