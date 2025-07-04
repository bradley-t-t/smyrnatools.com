import React, {useEffect, useState} from 'react';
import {MixerUtils} from '../../models/Mixer';
import {MixerService} from '../../services/mixers/MixerService';
import {PlantService} from '../../services/PlantService';
import {OperatorService} from '../../services/operators/OperatorService';
import Theme from '../../utils/Theme';
import supabase from '../../core/SupabaseClient';
import MixerHistoryView from './MixerHistoryView';
import './MixerDetailView.css';

function MixerDetailView({mixerId, onClose}) {
    const [mixer, setMixer] = useState(null);
    const [operators, setOperators] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

    // Editable fields
    const [truckNumber, setTruckNumber] = useState('');
    const [assignedOperator, setAssignedOperator] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [status, setStatus] = useState('');

    // Cleanliness rating with CSS variable update
    const [cleanlinessRating, setRating] = useState(0);
    const setCleanlinessRating = (value) => {
        setRating(value);
        document.documentElement.style.setProperty('--rating-value', value);
    };
    const [lastServiceDate, setLastServiceDate] = useState(null);
    const [lastChipDate, setLastChipDate] = useState(null);

    // Load data
    useEffect(() => {
        fetchData();
    }, [mixerId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch mixer details
            const mixerData = await MixerService.fetchMixerById(mixerId);
            setMixer(mixerData);

            // Set form field values
            setTruckNumber(mixerData.truckNumber || '');
            setAssignedOperator(mixerData.assignedOperator || '');
            setAssignedPlant(mixerData.assignedPlant || '');
            setStatus(mixerData.status || '');
            setCleanlinessRating(mixerData.cleanlinessRating || 0);
            setLastServiceDate(mixerData.lastServiceDate ? new Date(mixerData.lastServiceDate) : null);
            setLastChipDate(mixerData.lastChipDate ? new Date(mixerData.lastChipDate) : null);

            // Update CSS variable for the rating slider
            document.documentElement.style.setProperty('--rating-value', mixerData.cleanlinessRating || 0);

            // Fetch operators and plants
            const operatorsData = await OperatorService.fetchOperators();
            setOperators(operatorsData);

            const plantsData = await PlantService.fetchPlants();
            setPlants(plantsData);
        } catch (error) {
            console.error('Error fetching mixer details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Save changes
    const handleSave = async () => {
        if (!mixer) return;

        setIsSaving(true);

        try {
            // Store original mixer for history comparison
            const originalMixer = {...mixer};

            // Get current user for tracking who made changes
            const {data: {user}} = await supabase.auth.getUser();
            const userId = user?.id;

            // Format dates properly to avoid any issues
            const formatDate = (date) => {
                if (!date) return null;
                if (date instanceof Date) return date.toISOString();
                return date; // assume it's already a string
            };

            // Create updated mixer object
            const updatedMixer = {
                ...mixer,
                truckNumber,
                assignedOperator,
                assignedPlant,
                status,
                cleanlinessRating: cleanlinessRating || null,
                lastServiceDate: formatDate(lastServiceDate),
                lastChipDate: formatDate(lastChipDate),
                updatedAt: new Date().toISOString(),
                updatedLast: new Date().toISOString(),
                updatedBy: userId || mixer.updatedBy
            };

            console.log('Saving mixer:', updatedMixer);

            // Update the mixer
            await MixerService.updateMixer(mixer.id, updatedMixer);

            // We already have userId from above

            // Create history entries for changed fields
            if (originalMixer.truckNumber !== updatedMixer.truckNumber) {
                await MixerService.createHistoryEntry(
                    updatedMixer.id,
                    'truck_number',
                    originalMixer.truckNumber,
                    updatedMixer.truckNumber,
                    userId
                );
            }

            if (originalMixer.assignedPlant !== updatedMixer.assignedPlant) {
                await MixerService.createHistoryEntry(
                    updatedMixer.id,
                    'assigned_plant',
                    originalMixer.assignedPlant,
                    updatedMixer.assignedPlant,
                    userId
                );
            }

            if (originalMixer.assignedOperator !== updatedMixer.assignedOperator) {
                await MixerService.createHistoryEntry(
                    updatedMixer.id,
                    'assigned_operator',
                    originalMixer.assignedOperator,
                    updatedMixer.assignedOperator,
                    userId
                );
            }

            if (originalMixer.status !== updatedMixer.status) {
                await MixerService.createHistoryEntry(
                    updatedMixer.id,
                    'status',
                    originalMixer.status,
                    updatedMixer.status,
                    userId
                );
            }

            if (originalMixer.cleanlinessRating !== updatedMixer.cleanlinessRating) {
                await MixerService.createHistoryEntry(
                    updatedMixer.id,
                    'cleanliness_rating',
                    originalMixer.cleanlinessRating,
                    updatedMixer.cleanlinessRating,
                    userId
                );
            }

            if (originalMixer.lastServiceDate !== updatedMixer.lastServiceDate) {
                await MixerService.createHistoryEntry(
                    updatedMixer.id,
                    'last_service_date',
                    originalMixer.lastServiceDate,
                    updatedMixer.lastServiceDate,
                    userId
                );
            }

            if (originalMixer.lastChipDate !== updatedMixer.lastChipDate) {
                await MixerService.createHistoryEntry(
                    updatedMixer.id,
                    'last_chip_date',
                    originalMixer.lastChipDate,
                    updatedMixer.lastChipDate,
                    userId
                );
            }

            // Update local state
            setMixer(updatedMixer);
            alert('Changes saved successfully');

        } catch (error) {
            console.error('Error saving mixer:', error);
            // Show more detailed error message to help troubleshoot
            const errorMessage = error.message || 'Unknown error';

            // Log additional debugging information
            console.error('Error details:', {
                mixerId: mixer?.id,
                truckNumber,
                assignedPlant,
                assignedOperator,
                status,
                cleanlinessRating,
                lastServiceDate: lastServiceDate ? safeFormatDate(lastServiceDate) : null,
                lastChipDate: lastChipDate ? safeFormatDate(lastChipDate) : null,
            });

            alert(`Error saving changes: ${errorMessage}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Delete mixer
    const handleDelete = async () => {
        if (!mixer) return;

        try {
            await supabase
                .from('mixers')
                .delete()
                .eq('id', mixer.id);

            alert('Mixer deleted successfully');
            onClose(); // Return to mixers list
        } catch (error) {
            console.error('Error deleting mixer:', error);
            alert('Error deleting mixer');
        } finally {
            setShowDeleteConfirmation(false);
        }
    };

    // Helper functions
    const getOperatorName = (operatorId) => {
        if (!operatorId || operatorId === '0') return 'None';
        const operator = operators.find(op => op.employeeId === operatorId);
        return operator ? operator.name : 'Unknown';
    };

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode;
    };

    const formatDate = (date) => {
        if (!date) return '';
        return date instanceof Date ? date.toISOString().split('T')[0] : date;
    };

    // Safe date formatter for logging/debugging
    const safeFormatDate = (date) => {
        if (!date) return null;
        try {
            return date instanceof Date ? date.toISOString() : String(date);
        } catch (e) {
            return `[Invalid date: ${String(date)}]`;
        }
    };

    if (isLoading) {
        return (
            <div className="mixer-detail-view">
                <div className="detail-header">
                    <button className="back-button" onClick={onClose}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1>Loading...</h1>
                </div>
                <div className="loading-spinner"></div>
            </div>
        );
    }

    if (!mixer) {
        return (
            <div className="mixer-detail-view">
                <div className="detail-header">
                    <button className="back-button" onClick={onClose}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1>Mixer Not Found</h1>
                </div>
                <div className="error-message">
                    <p>Could not find the requested mixer. It may have been deleted.</p>
                    <button className="primary-button" onClick={onClose}>Return to Mixers</button>
                </div>
            </div>
        );
    }

    return (
        <div className="mixer-detail-view">
            {isSaving && (
                <div className="saving-overlay">
                    <div className="saving-indicator">
                        <div className="saving-spinner"></div>
                        <span>Saving changes...</span>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="detail-header">
                <div className="header-left">
                    <button className="back-button" onClick={onClose} aria-label="Back to mixers">
                        <i className="fas fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                </div>
                <h1>Truck #{mixer.truckNumber || 'N/A'}</h1>
                <div className="header-actions">
                    <button className="history-button" onClick={() => setShowHistory(true)}>
                        <i className="fas fa-history"></i>
                        <span>History</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="detail-content">
                <div className="detail-card">
                    <div className="card-header">
                        <h2>General Information</h2>
                        <div
                            className="status-indicator"
                            style={{backgroundColor: Theme.statusColors[status] || Theme.statusColors.default}}
                        >
                            {status}
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Truck Number</label>
                        <input
                            type="text"
                            value={truckNumber}
                            onChange={(e) => setTruckNumber(e.target.value)}
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
                            <option value="Spare">Spare</option>
                            <option value="In Shop">In Shop</option>
                            <option value="Retired">Retired</option>
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
                        <label>Assigned Operator</label>
                        <select
                            value={assignedOperator}
                            onChange={(e) => setAssignedOperator(e.target.value)}
                            className="form-control"
                        >
                            <option value="0">None</option>
                            {operators.map(operator => (
                                <option key={operator.employeeId} value={operator.employeeId}>
                                    {operator.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="detail-card">
                    <h2>Maintenance Information</h2>

                    <div className="form-group">
                        <label>Last Service Date</label>
                        <input
                            type="date"
                            value={lastServiceDate ? formatDate(lastServiceDate) : ''}
                            onChange={(e) => setLastServiceDate(e.target.value ? new Date(e.target.value) : null)}
                            className="form-control"
                        />
                        {MixerUtils.isServiceOverdue(lastServiceDate) && (
                            <div className="warning-text">Service overdue</div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Last Chip Date</label>
                        <input
                            type="date"
                            value={lastChipDate ? formatDate(lastChipDate) : ''}
                            onChange={(e) => setLastChipDate(e.target.value ? new Date(e.target.value) : null)}
                            className="form-control"
                        />
                        {MixerUtils.isChipOverdue(lastChipDate) && (
                            <div className="warning-text">Chip overdue</div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Cleanliness Rating</label>
                        <div className="cleanliness-rating-editor">
                            <div className="star-input">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        className={`star-button ${star <= cleanlinessRating ? 'active' : ''}`}
                                        onClick={() => setCleanlinessRating(star === cleanlinessRating ? 0 : star)}
                                        aria-label={`Rate ${star} of 5 stars`}
                                    >
                                        <i className={`fas fa-star ${star <= cleanlinessRating ? 'filled' : ''}`}></i>
                                    </button>
                                ))}
                            </div>
                            <div className="rating-slider-container">
                                <input
                                    type="range"
                                    min="0"
                                    max="5"
                                    value={cleanlinessRating}
                                    onChange={(e) => setCleanlinessRating(parseInt(e.target.value))}
                                    className="rating-slider"
                                    aria-label="Adjust cleanliness rating"
                                />
                                <div className="rating-value-display">
                  <span className="rating-label">
                    {cleanlinessRating === 0 && 'Not Rated'}
                      {cleanlinessRating === 1 && 'Poor (1/5)'}
                      {cleanlinessRating === 2 && 'Fair (2/5)'}
                      {cleanlinessRating === 3 && 'Good (3/5)'}
                      {cleanlinessRating === 4 && 'Very Good (4/5)'}
                      {cleanlinessRating === 5 && 'Excellent (5/5)'}
                  </span>
                                </div>
                            </div>
                        </div>
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
                    >
                        Delete Mixer
                    </button>
                </div>
            </div>

            {/* History modal */}
            {showHistory && (
                <MixerHistoryView mixer={mixer} onClose={() => setShowHistory(false)}/>
            )}

            {/* Delete confirmation */}
            {showDeleteConfirmation && (
                <div className="confirmation-modal">
                    <div className="confirmation-content">
                        <h2>Confirm Delete</h2>
                        <p>Are you sure you want to delete Truck #{mixer.truckNumber}? This action cannot be undone.</p>

                        <div className="confirmation-actions">
                            <button
                                className="cancel-button"
                                onClick={() => setShowDeleteConfirmation(false)}
                            >
                                Cancel
                            </button>

                            <button
                                className="danger-button"
                                onClick={handleDelete}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MixerDetailView;
