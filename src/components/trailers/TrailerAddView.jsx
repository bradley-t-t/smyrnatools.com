import React, {useEffect, useState} from 'react';
import {TrailerService} from '../../services/TrailerService';
import Trailer from '../../config/models/trailers/Trailer';
import {AuthService} from '../../services/AuthService';
import './styles/TrailerAddView.css';

function TrailerAddView({plants, onClose, onTrailerAdded}) {
    const [trailerNumber, setTrailerNumber] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [trailerType, setTrailerType] = useState('Cement');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [cleanlinessRating, setCleanlinessRating] = useState(1);

    useEffect(() => {
        async function loadTrailers() {
            try {
                await TrailerService.fetchTrailers();
            } catch (error) {
                console.error('Error loading trailers:', error);
            }
        }

        loadTrailers();
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!trailerNumber) return setError('Trailer number is required');
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
            const newTrailer = new Trailer({
                trailer_number: trailerNumber,
                assigned_plant: assignedPlant,
                trailer_type: trailerType,
                assigned_tractor: null,
                cleanliness_rating: cleanlinessRating,
                created_at: now,
                updated_at: now,
                updated_by: userId,
                updated_last: now
            });

            const savedTrailer = await TrailerService.createTrailer(newTrailer, userId);
            if (!savedTrailer) throw new Error('Failed to add trailer - no data returned from server');

            onTrailerAdded(savedTrailer);
            onClose();
        } catch (error) {
            setError(`Failed to add trailer: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="add-tractor-modal-backdrop">
            <div className="add-tractor-modal enhanced">
                <div className="add-tractor-header sticky">
                    <h2>Add New Trailer</h2>
                    <button className="ios-button close-btn" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="add-tractor-content-scrollable">
                    <div className="add-tractor-content">
                        {error && <div className="error-message">{error}</div>}
                        <form onSubmit={handleSubmit} autoComplete="off">
                            <div className="form-section">
                                <div className="form-row">
                                    <div className="form-group wide">
                                        <label htmlFor="trailerNumber">Trailer Number*</label>
                                        <input
                                            id="trailerNumber"
                                            type="text"
                                            className="ios-input"
                                            value={trailerNumber}
                                            onChange={e => setTrailerNumber(e.target.value)}
                                            placeholder="Enter trailer number"
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
                                        <label htmlFor="trailerType">Trailer Type</label>
                                        <select
                                            id="trailerType"
                                            className="ios-select"
                                            value={trailerType}
                                            onChange={e => setTrailerType(e.target.value)}
                                        >
                                            <option value="Cement">Cement</option>
                                            <option value="End Dump">End Dump</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="form-section">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="cleanlinessRating">Cleanliness Rating</label>
                                        <select
                                            id="cleanlinessRating"
                                            className="ios-select"
                                            value={cleanlinessRating}
                                            onChange={e => setCleanlinessRating(Number(e.target.value))}
                                        >
                                            {[1, 2, 3, 4, 5].map(rating => (
                                                <option key={rating}
                                                        value={rating}>{rating} Star{rating > 1 ? 's' : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="ios-button-primary" disabled={isSaving}>
                                    {isSaving ? 'Adding...' : 'Add Trailer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TrailerAddView;