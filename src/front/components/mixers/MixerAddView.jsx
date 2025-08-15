import React, {useState, useEffect} from 'react';
import {MixerService} from '../../../services/MixerService';
import {Mixer} from '../../../config/models/mixers/Mixer';
import {AuthService} from '../../../services/AuthService';
import './styles/MixerAddView.css';

function MixerAddView({plants, onClose, onMixerAdded}) {
    const [truckNumber, setTruckNumber] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [status, setStatus] = useState('Active');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadMixers() {
            try {
                const mixers = await MixerService.fetchMixers();
            } catch (error) {
                console.error('Error loading mixers:', error);
            }
        }
        loadMixers();
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
            const newMixer = new Mixer({
                truck_number: truckNumber,
                assigned_plant: assignedPlant,
                assigned_operator: '0',
                cleanliness_rating: 5,
                status,
                created_at: now,
                updated_at: now,
                updated_by: userId,
                updated_last: now
            });

            const savedMixer = await MixerService.createMixer(newMixer, userId);
            if (!savedMixer) throw new Error('Failed to add mixer - no data returned from server');

            onMixerAdded(savedMixer);
            onClose();
        } catch (error) {
            setError(`Failed to add mixer: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="add-mixer-modal-backdrop">
            <div className="add-mixer-modal enhanced">
                <div className="add-mixer-header sticky">
                    <h2>Add New Mixer</h2>
                    <button className="ios-button close-btn" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="add-mixer-content-scrollable">
                    <div className="add-mixer-content">
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
                                                <option key={plant.plant_code} value={plant.plant_code}>
                                                    ({plant.plant_code}) {plant.plant_name}
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
                            <div className="form-actions">
                                <button type="submit" className="ios-button-primary" disabled={isSaving}>
                                    {isSaving ? 'Adding...' : 'Add Mixer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MixerAddView;