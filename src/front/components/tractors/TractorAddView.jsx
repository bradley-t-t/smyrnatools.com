import React, {useState, useEffect} from 'react';
import {TractorService} from '../../../services/TractorService';
import {Tractor} from '../../../config/models/tractors/Tractor';
import {AuthService} from '../../../services/AuthService';
import './styles/TractorAddView.css';

function TractorAddView({plants, onClose, onTractorAdded}) {
    const [truckNumber, setTruckNumber] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [status, setStatus] = useState('Active');
    const [hasBlower, setHasBlower] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [cleanlinessRating, setCleanlinessRating] = useState(1);

    useEffect(() => {
        async function loadTractors() {
            try {
                const tractors = await TractorService.fetchTractors();
            } catch (error) {
                console.error('Error loading tractors:', error);
            }
        }
        loadTractors();
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!truckNumber) return setError('Truck number is required');
        if (!assignedPlant) return setError('Plant is required');

        setIsSaving(true);
        try {
            const userId = AuthService.currentUser?.id || sessionStorage.getItem('userId');
            if (!userId) throw new Error('User ID not available. Please log in again.');

            const formatDateForDb = date => {
                if (!date) return null;
                const d = new Date(date);
                if (isNaN(d.getTime())) return null;
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}+00`;
            };

            const now = formatDateForDb(new Date());
            const newTractor = new Tractor({
                truck_number: truckNumber,
                assigned_plant: assignedPlant,
                assigned_operator: '0',
                cleanliness_rating: 1,
                status,
                has_blower: hasBlower,
                created_at: now,
                updated_at: now,
                updated_by: userId,
                updated_last: now
            });

            const savedTractor = await TractorService.createTractor(newTractor, userId);
            if (!savedTractor) throw new Error('Failed to add tractor - no data returned from server');

            onTractorAdded(savedTractor);
            onClose();
        } catch (error) {
            setError(`Failed to add tractor: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="add-tractor-modal-backdrop">
            <div className="add-tractor-modal enhanced">
                <div className="add-tractor-header sticky">
                    <h2>Add New Tractor</h2>
                    <button className="ios-button close-btn" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="add-tractor-content-scrollable">
                    <div className="add-tractor-content">
                        {error && <div className="error-message">{error}</div>}
                        <form onSubmit={handleSubmit} autoComplete="off">
                            <div className="form-section">
                                <div className="form-row">
                                    <div className="form-group wide">
                                        <label htmlFor="truckNumber">Truck Number*</label>
                                        <input
                                            id="truckNumber"
                                            type="text"
                                            className="ios-input"
                                            value={truckNumber}
                                            onChange={e => setTruckNumber(e.target.value)}
                                            placeholder="Enter truck number"
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
                            <div className="form-section">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="hasBlower">Has Blower</label>
                                        <select
                                            id="hasBlower"
                                            className="ios-select"
                                            value={hasBlower ? 'Yes' : 'No'}
                                            onChange={e => setHasBlower(e.target.value === 'Yes')}
                                        >
                                            <option value="No">No</option>
                                            <option value="Yes">Yes</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="ios-button-primary" disabled={isSaving}>
                                    {isSaving ? 'Adding...' : 'Add Tractor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TractorAddView;