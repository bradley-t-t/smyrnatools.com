import React, {useEffect, useState} from 'react';
import {MixerUtils} from '../../models/Mixer';
import {MixerService} from '../../services/mixers/MixerService';
import {PlantService} from '../../services/PlantService';
import {OperatorService} from '../../services/operators/OperatorService';
import {UserService} from '../../services/auth/UserService';
import Theme from '../../utils/Theme';
import supabase from '../../core/SupabaseClient';
import MixerHistoryView from './MixerHistoryView';
import MixerCard from './MixerCard';
import './MixerDetailView.css';

function MixerDetailView({mixerId, onClose}) {
    const [mixer, setMixer] = useState(null);
    const [operators, setOperators] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [updatedByEmail, setUpdatedByEmail] = useState(null);
    const [message, setMessage] = useState('');

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

            // Try to get user name if we have updatedBy
            if (mixerData.updatedBy) {
                try {
                    // Get user display name from UserService - we've enhanced this to prioritize full name
                    const userName = await UserService.getUserDisplayName(mixerData.updatedBy);
                    setUpdatedByEmail(userName);
                } catch (error) {
                    console.log('Could not fetch user info:', error);
                    setUpdatedByEmail('Unknown User');
                }
            }
        } catch (error) {
            console.error('Error fetching mixer details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Save changes
    const handleSave = async () => {
        if (!mixer || !mixer.id) {
            alert('Error: Cannot save mixer with undefined ID');
            return;
        }

        setIsSaving(true);

        try {
            // Store original mixer for history comparison
            const originalMixer = {...mixer};

            // Try multiple methods to get the current user ID
            let userId = null;

            // Method 1: Get from sessionStorage (most reliable)
            userId = sessionStorage.getItem('userId');

            // Method 2: If not in sessionStorage, try supabase auth
            if (!userId) {
                try {
                    const {data: {user}} = await supabase.auth.getUser();
                    userId = user?.id;
                } catch (authError) {
                    console.error('Error getting user from Supabase auth:', authError);
                }
            }

            // Strong authentication check
            if (!userId) {
                // This shouldn't happen in normal flow, as app should redirect to login
                console.error('No authenticated user found');
                alert('Your session has expired. Please refresh the page and log in again.');
                throw new Error('Authentication required: You must be logged in to update mixers');
            }

            // Format dates properly to avoid any issues with specific format: YYYY-MM-DD HH:MM:SS+00
            const formatDate = (date) => {
                if (!date) return null;
                try {
                    const parsedDate = date instanceof Date ? date : new Date(date);
                    if (isNaN(parsedDate.getTime())) return null;

                    // Format to YYYY-MM-DD HH:MM:SS+00 format
                    const year = parsedDate.getFullYear();
                    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                    const day = String(parsedDate.getDate()).padStart(2, '0');
                    const hours = String(parsedDate.getHours()).padStart(2, '0');
                    const minutes = String(parsedDate.getMinutes()).padStart(2, '0');
                    const seconds = String(parsedDate.getSeconds()).padStart(2, '0');

                    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+00`;
                } catch (e) {
                    console.error('Date parsing error:', e);
                    return null;
                }
            };

            // Create updated mixer object
            const updatedMixer = {
                ...mixer,
                id: mixer.id, // Ensure ID is explicitly included
                truckNumber,
                assignedOperator,
                assignedPlant,
                status,
                cleanlinessRating: cleanlinessRating || null,
                lastServiceDate: formatDate(lastServiceDate),
                lastChipDate: formatDate(lastChipDate),
                updatedAt: new Date().toISOString(),
                updatedBy: userId || mixer.updatedBy
            };

            console.log('Saving mixer:', updatedMixer);

            // Update the mixer
            await MixerService.updateMixer(updatedMixer.id, updatedMixer);

            // We already have userId from above

            // Make sure we have a valid userId for history entries
            const historyUserId = userId || sessionStorage.getItem('userId') || '00000000-0000-0000-0000-000000000000';
            console.log('Using history userId:', historyUserId);

            // History entries are now automatically created in the MixerService.updateMixer method
            // We removed the manual history entry creation here to prevent duplicate entries

            // Update local state
            setMixer(updatedMixer);

            // Refresh data to update MixerCard
            fetchData();

            // Set a success message that will clear itself after a few seconds
            setMessage('Changes saved successfully!');
            setTimeout(() => setMessage(''), 3000);

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

        if (!showDeleteConfirmation) {
            setShowDeleteConfirmation(true);
            return;
        }

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

        if (operator) {
            // Include position if available
            if (operator.position) {
                return `${operator.name} (${operator.position})`;
            }
            return operator.name;
        }

        return 'Unknown';
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
                {message && (
                    <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                        {message}
                    </div>
                )}

                {/* Display MixerCard at the top */}
                <div className="mixer-card-preview">
                    <MixerCard 
                        mixer={mixer}
                        operatorName={getOperatorName(mixer.assignedOperator)}
                        plantName={getPlantName(mixer.assignedPlant)}
                        showOperatorWarning={false}
                    />
                </div>

                <div className="detail-card">
                    <div className="card-header">
                        <h2>Edit Information</h2>
                    </div>
                    <p className="edit-instructions">Make changes below and click Save when finished.</p>

                    <div className="metadata-info">
                        <div className="metadata-row">
                            <span className="metadata-label">Created:</span>
                            <span className="metadata-value">{mixer.createdAt ? new Date(mixer.createdAt).toLocaleString() : 'N/A'}</span>
                        </div>
                        <div className="metadata-row">
                            <span className="metadata-label">Last Updated:</span>
                            <span className="metadata-value">{mixer.updatedLast ? new Date(mixer.updatedLast).toLocaleString() : 'N/A'}</span>
                        </div>
                        {mixer.updatedBy && (
                            <div className="metadata-row">
                                <span className="metadata-label">Updated By:</span>
                                <span className="metadata-value">
                                    {updatedByEmail || 'Unknown User'}
                                </span>
                            </div>
                        )}
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
                        {lastServiceDate && MixerUtils.isServiceOverdue(lastServiceDate) && (
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
                        {lastChipDate && MixerUtils.isChipOverdue(lastChipDate) && (
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
                        disabled={isSaving}
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
