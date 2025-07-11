import React, { useState } from 'react';
import { MixerService } from '../../services/mixers/MixerService';
import { Mixer } from '../../models/Mixer';
import { AuthService } from '../../services/auth/AuthService';
import './MixerAddView.css';

function MixerAddView({ plants, operators = [], onClose, onMixerAdded }) {
    const hasOperators = Array.isArray(operators) && operators.length > 0;
    const [truckNumber, setTruckNumber] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [assignedOperator, setAssignedOperator] = useState('0');
    const [cleanlinessRating, setCleanlinessRating] = useState(3);
    const [status, setStatus] = useState('Active');
    const [lastServiceDate, setLastServiceDate] = useState('');
    const [lastChipDate, setLastChipDate] = useState('');
    const [vin, setVin] = useState('');
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [year, setYear] = useState('');
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
            let userId = AuthService.currentUser?.id || sessionStorage.getItem('userId');
            if (!userId) {
                throw new Error('User ID not available. Please log in again.');
            }

            const operatorToSave = status !== 'Active' ? '0' : assignedOperator;

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

            const newMixer = new Mixer({
                truck_number: truckNumber,
                assigned_plant: assignedPlant,
                assigned_operator: operatorToSave,
                cleanliness_rating: cleanlinessRating,
                status: status,
                last_service_date: lastServiceDate ? formatDateForDb(new Date(lastServiceDate)) : null,
                last_chip_date: lastChipDate ? formatDateForDb(new Date(lastChipDate)) : null,
                vin: vin,
                make: make,
                model: model,
                year: year,
                created_at: now,
                updated_at: now,
                updated_by: userId,
                updated_last: now
            });

            const savedMixer = await MixerService.createMixer(newMixer, userId);
            if (savedMixer) {
                onMixerAdded(savedMixer);
                onClose();
            } else {
                throw new Error('Failed to add mixer - no data returned from server');
            }
        } catch (error) {
            console.error('Error adding mixer:', error);
            setError(`Failed to add mixer: ${error.message || 'Unknown error'}`);
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
                            <label htmlFor="vin">VIN</label>
                            <input
                                id="vin"
                                type="text"
                                className="ios-input"
                                value={vin}
                                onChange={(e) => setVin(e.target.value)}
                                placeholder="Enter VIN"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="make">Make</label>
                            <input
                                id="make"
                                type="text"
                                className="ios-input"
                                value={make}
                                onChange={(e) => setMake(e.target.value)}
                                placeholder="Enter make"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="model">Model</label>
                            <input
                                id="model"
                                type="text"
                                className="ios-input"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                placeholder="Enter model"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="year">Year</label>
                            <input
                                id="year"
                                type="text"
                                className="ios-input"
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                placeholder="Enter year"
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
                                {operators
                                    .filter(operator =>
                                        operator.position === "Mixer Operator" ||
                                        operator.position?.toLowerCase().includes('mixer') ||
                                        operator.position?.toLowerCase().includes('driver')
                                    )
                                    .map(operator => (
                                        <option key={operator.employeeId} value={operator.employeeId}>
                                            {operator.name}
                                        </option>
                                    ))}
                            </select>
                            {operators.length === 0 && (
                                <div className="warning-message" style={{ marginTop: '5px', fontSize: '12px', color: '#FF9500' }}>
                                    No operators available
                                </div>
                            )}
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
                                        aria-label={`Set ${star} star rating`}
                                    >
                                        {cleanlinessRating >= star ? '★' : '☆'}
                                    </button>
                                ))}
                            </div>
                            <div className="rating-text">
                                {cleanlinessRating ? `${cleanlinessRating} star${cleanlinessRating !== 1 ? 's' : ''}` : 'Not Rated'}
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