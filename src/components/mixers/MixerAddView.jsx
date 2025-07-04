import React, {useState} from 'react';
import {MixerService} from '../../services/mixers/MixerService';
import {Mixer} from '../../models/Mixer';
import './MixerAddView.css';

function MixerAddView({plants, operators, onClose, onMixerAdded}) {
    const [truckNumber, setTruckNumber] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [assignedOperator, setAssignedOperator] = useState('0');
    const [cleanlinessRating, setCleanlinessRating] = useState(3);
    const [status, setStatus] = useState('Active');
    const [lastServiceDate, setLastServiceDate] = useState('');
    const [lastChipDate, setLastChipDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!truckNumber) {
            setError('Truck number is required');
            return;
        }

        if (!assignedPlant) {
            setError('Plant is required');
            return;
        }

        setIsSaving(true);

        try {
            // If status is not Active, operators should be unassigned
            const operatorToSave = status !== 'Active' ? '0' : assignedOperator;

            // Create a new Mixer object
            const newMixer = new Mixer({
                truck_number: truckNumber,
                assigned_plant: assignedPlant,
                assigned_operator: operatorToSave,
                cleanliness_rating: cleanlinessRating,
                status: status,
                last_service_date: lastServiceDate || null,
                last_chip_date: lastChipDate || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            // Save the new mixer
            const savedMixer = await MixerService.createMixer(newMixer);

            if (savedMixer) {
                // Notify parent component
                onMixerAdded(savedMixer);
                onClose();
            }
        } catch (error) {
            console.error('Error adding mixer:', error);
            setError('Failed to add mixer. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="add-mixer-modal-backdrop">
            <div className="add-mixer-modal">
                <div className="add-mixer-header">
                    <h2>Add New Mixer</h2>
                    <button className="ios-button" onClick={onClose}>Cancel</button>
                </div>

                <div className="add-mixer-content">
                    {error && <div className="error-message">{error}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="truckNumber">Truck Number*</label>
                            <input
                                id="truckNumber"
                                type="text"
                                className="ios-input"
                                value={truckNumber}
                                onChange={(e) => setTruckNumber(e.target.value)}
                                placeholder="Enter truck number"
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
                                {plants.map(plant => (
                                    <option key={plant.plantCode} value={plant.plantCode}>
                                        {plant.plantName}
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
                                onChange={(e) => {
                                    setStatus(e.target.value);
                                    // If new status is not Active, unassign operators
                                    if (e.target.value !== 'Active') {
                                        setAssignedOperator('0');
                                    }
                                }}
                            >
                                <option value="Active">Active</option>
                                <option value="Spare">Spare</option>
                                <option value="In Shop">In Shop</option>
                                <option value="Retired">Retired</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="assignedOperator">Assigned Operator</label>
                            <select
                                id="assignedOperator"
                                className="ios-select"
                                value={assignedOperator}
                                onChange={(e) => setAssignedOperator(e.target.value)}
                                disabled={status !== 'Active'}
                            >
                                <option value="0">Unassigned</option>
                                {operators.map(operator => (
                                    <option key={operator.employeeId} value={operator.employeeId}>
                                        {operator.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="cleanlinessRating">Cleanliness Rating</label>
                            <div className="rating-container">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        type="button"
                                        className={`star-button ${cleanlinessRating >= star ? 'active' : ''}`}
                                        onClick={() => setCleanlinessRating(star)}
                                    >
                                        ⭐
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="lastServiceDate">Last Service Date</label>
                            <input
                                id="lastServiceDate"
                                type="date"
                                className="ios-input"
                                value={lastServiceDate}
                                onChange={(e) => setLastServiceDate(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="lastChipDate">Last Chip Date</label>
                            <input
                                id="lastChipDate"
                                type="date"
                                className="ios-input"
                                value={lastChipDate}
                                onChange={(e) => setLastChipDate(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            className="ios-button-primary"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Adding...' : 'Add Mixer'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default MixerAddView;
