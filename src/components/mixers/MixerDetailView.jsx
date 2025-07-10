import React, {useEffect, useState} from 'react';
import {Mixer, MixerUtils} from '../../models/Mixer';
import {MixerService} from '../../services/mixers/MixerService';
import {PlantService} from '../../services/PlantService';
import {OperatorService} from '../../services/operators/OperatorService';
import {UserService} from '../../services/auth/UserService';
import SimpleLoading from '../common/SimpleLoading';
import LoadingText from '../common/LoadingText';
import Theme from '../../utils/Theme';
import supabase from '../../core/SupabaseClient';
import {usePreferences} from '../../context/PreferencesContext';
import MixerHistoryView from './MixerHistoryView';
import MixerCommentModal from './MixerCommentModal';
import MixerCard from './MixerCard';
import '../common/LoadingText.css';
import './MixerDetailView.css';

function MixerDetailView({mixerId, onClose}) {
    const {preferences} = usePreferences();
    const [mixer, setMixer] = useState(null);
    const [operators, setOperators] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [updatedByEmail, setUpdatedByEmail] = useState(null);
    const [message, setMessage] = useState('');

    // Original values for detecting changes
    const [originalValues, setOriginalValues] = useState({});

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

    // Track changes to detect unsaved changes
    useEffect(() => {
        if (!originalValues.truckNumber && !isLoading) return;

        // Skip during initial load
        if (isLoading) return;

        const formatDateForComparison = (date) => {
            if (!date) return '';
            return date instanceof Date ? date.toISOString().split('T')[0] : '';
        };

        const hasChanges =
            truckNumber !== originalValues.truckNumber ||
            assignedOperator !== originalValues.assignedOperator ||
            assignedPlant !== originalValues.assignedPlant ||
            status !== originalValues.status ||
            cleanlinessRating !== originalValues.cleanlinessRating ||
            formatDateForComparison(lastServiceDate) !== formatDateForComparison(originalValues.lastServiceDate) ||
            formatDateForComparison(lastChipDate) !== formatDateForComparison(originalValues.lastChipDate);

        setHasUnsavedChanges(hasChanges);
    }, [
        truckNumber,
        assignedOperator,
        assignedPlant,
        status,
        cleanlinessRating,
        lastServiceDate,
        lastChipDate,
        originalValues,
        isLoading
    ]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch mixer details
            const mixerData = await MixerService.fetchMixerById(mixerId);
            setMixer(mixerData);

            // Set form field values
            const truckNum = mixerData.truckNumber || '';
            const operator = mixerData.assignedOperator || '';
            const plant = mixerData.assignedPlant || '';
            const statusVal = mixerData.status || '';
            const rating = mixerData.cleanlinessRating || 0;
            const serviceDate = mixerData.lastServiceDate ? new Date(mixerData.lastServiceDate) : null;
            const chipDate = mixerData.lastChipDate ? new Date(mixerData.lastChipDate) : null;

            // Set current values
            setTruckNumber(truckNum);
            setAssignedOperator(operator);
            setAssignedPlant(plant);
            setStatus(statusVal);
            setCleanlinessRating(rating);
            setLastServiceDate(serviceDate);
            setLastChipDate(chipDate);

            // Store original values for change detection
            setOriginalValues({
                truckNumber: truckNum,
                assignedOperator: operator,
                assignedPlant: plant,
                status: statusVal,
                cleanlinessRating: rating,
                lastServiceDate: serviceDate,
                lastChipDate: chipDate
            });

            // Reset unsaved changes flag
            setHasUnsavedChanges(false);

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
            setHasUnsavedChanges(false);
        }
    };

    // Save changes
    const handleSave = async () => {
        return new Promise(async (resolve, reject) => {
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
                updatedAt: new Date().toISOString()
                // Don't update updatedLast as that should only be updated by verify button
                // Don't update updatedBy either - it should only be updated by verify button
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

            // Update original values to match current values
            setOriginalValues({
                truckNumber,
                assignedOperator,
                assignedPlant,
                status,
                cleanlinessRating,
                lastServiceDate,
                lastChipDate
            });

            // Reset unsaved changes flag
            setHasUnsavedChanges(false);

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
            resolve(); // Resolve the promise when save is complete
        }
        });
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

    // Verify mixer
    const handleVerifyMixer = async () => {
        if (!mixer) return;

        setIsSaving(true);

        try {
            // First, check if there are unsaved changes and save them
            if (hasUnsavedChanges) {
                try {
                    await handleSave();
                } catch (saveError) {
                    console.error('Error saving changes before verification:', saveError);
                    alert('Failed to save your changes before verification. Please try saving manually first.');
                    throw new Error('Failed to save changes before verification');
                }
            }

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
                console.error('No authenticated user found');
                alert('Your session has expired. Please refresh the page and log in again.');
                throw new Error('Authentication required: You must be logged in to verify mixers');
            }

            // Update only the updated_last field to mark it as verified
            // We intentionally don't update updated_at here
            const {data, error} = await supabase
                .from('mixers')
                .update({
                    updated_last: new Date().toISOString(),
                    updated_by: userId
                })
                .eq('id', mixer.id)
                .select();

            if (error) {
                console.error('Error verifying mixer:', error);
                throw new Error(`Failed to verify mixer: ${error.message}`);
            }

            // Update local state
            if (data && data.length > 0) {
                setMixer(Mixer.fromApiFormat(data[0]));
                setMessage('Mixer verified successfully!');
                setTimeout(() => setMessage(''), 3000);
            }

            // Refresh data
            fetchData();

        } catch (error) {
            console.error('Error verifying mixer:', error);
            alert(`Error verifying mixer: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Handle back button click with unsaved changes check
    const handleBackClick = () => {
        if (hasUnsavedChanges) {
            setShowUnsavedChangesModal(true);
        } else {
            onClose();
        }
    };

    // Add event listener for browser back button
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                // Standard way to show a confirmation dialog before leaving
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [hasUnsavedChanges]);

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
                    <h1>Mixer Details</h1>
                </div>
                <div className="detail-content">
                    <div className="content-loading-container"></div>
                </div>
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
            {showComments && (
                <MixerCommentModal
                    mixerId={mixerId}
                    mixerNumber={mixer?.truckNumber}
                    onClose={() => setShowComments(false)}
                />
            )}
            {isSaving && (
                <div className="saving-overlay">
                    <div className="saving-indicator"></div>
                </div>
            )}

            {/* Header */}
            <div className="detail-header">
                <div className="header-left">
                    <button
                        className="back-button"
                        onClick={handleBackClick}
                        aria-label="Back to mixers"
                        style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                    >
                        <i className="fas fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                </div>
                <h1>Truck #{mixer.truckNumber || 'Not Assigned'}</h1>
                <div className="header-actions">
                    <button className="comments-button" onClick={() => setShowComments(true)}>
                        <i className="fas fa-comments"></i> Comments
                    </button>
                    <button
                        className="history-button"
                        onClick={() => setShowHistory(true)}
                        style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                    >
                        <i className="fas fa-history"></i>
                        <span>History</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="detail-content" style={{ maxWidth: '1000px', margin: '0 auto' }}>
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
                        <h2>Verification Status</h2>
                    </div>
                    <div className="verification-card">
                        <div className="verification-card-header">
                            <i className="fas fa-clipboard-check"></i>
                            <h3></h3>
                            {mixer.isVerified() ? (
                                <div className="verification-badge verified">
                                    <i className="fas fa-check-circle"></i>
                                    <span>Verified</span>
                                </div>
                            ) : (
                                <div className="verification-badge needs-verification">
                                    <i className="fas fa-exclamation-circle"></i>
                                    <span>{!mixer.updatedLast || !mixer.updatedBy ? 'Needs Verification' : 'Verification Outdated'}</span>
                                </div>
                            )}
                        </div>

                        <div className="verification-details">
                            <div className="verification-item">
                                <div className="verification-icon">
                                    <i className="fas fa-calendar-plus"></i>
                                </div>
                                <div className="verification-info">
                                    <span className="verification-label">Created</span>
                                    <span className="verification-value">{mixer.createdAt ? new Date(mixer.createdAt).toLocaleString() : 'Not Assigned'}</span>
                                </div>
                            </div>

                            <div className="verification-item">
                                <div className="verification-icon" style={{ color: mixer.updatedLast ? (mixer.isVerified() ? '#10b981' : '#f59e0b') : '#ef4444' }}>
                                    <i className="fas fa-calendar-check"></i>
                                </div>
                                <div className="verification-info">
                                    <span className="verification-label">Last Verified</span>
                                    <span className="verification-value" style={{ color: mixer.updatedLast ? (mixer.isVerified() ? 'inherit' : '#f59e0b') : '#ef4444' }}>
                                        {mixer.updatedLast ? new Date(mixer.updatedLast).toLocaleString() : 'Never verified'}
                                    </span>
                                </div>
                            </div>

                            <div className="verification-item">
                                <div className="verification-icon" style={{ color: mixer.updatedBy ? '#10b981' : '#ef4444' }}>
                                    <i className="fas fa-user-check"></i>
                                </div>
                                <div className="verification-info">
                                    <span className="verification-label">Verified By</span>
                                    <span className="verification-value" style={{ color: mixer.updatedBy ? 'inherit' : '#ef4444' }}>
                                        {mixer.updatedBy ? (updatedByEmail || 'Unknown User') : 'No verification record'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            className="verify-now-button"
                            onClick={handleVerifyMixer}
                            style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                        >
                            <i className="fas fa-check-circle"></i>
                            Verify Now
                        </button>

                        <div className="verification-notice">
                            <i className="fas fa-info-circle"></i>
                            <p>
                                Assets require verification after any changes are made and/or at the start of each work week.
                                <strong>  Due: Every Friday at 10:00 AM.</strong>
                            </p>
                        </div>
                    </div>
                </div>
                <div className="detail-card">
                    <div className="card-header">
                        <h2>Mixer Information</h2>
                    </div>
                    <p className="edit-instructions">You can make changes below. Remember to save your changes.</p>

                    <div className="form-sections">
                        <div className="form-section basic-info">
                            <h3>Basic Information</h3>
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

                        <div className="form-section maintenance-info">
                            <h3>Maintenance Information</h3>
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
                                                <i className={`fas fa-star ${star <= cleanlinessRating ? 'filled' : ''}`}
                                                   style={star <= cleanlinessRating ? { color: preferences.accentColor === 'red' ? '#b80017' : '#003896' } : {}}
                                                ></i>
                                            </button>
                                        ))}
                                    </div>
                                    {cleanlinessRating > 0 && (
                                        <div className="rating-value-display">
                                            <span className="rating-label">
                                                {cleanlinessRating === 1 && 'Poor'}
                                                {cleanlinessRating === 2 && 'Fair'}
                                                {cleanlinessRating === 3 && 'Good'}
                                                {cleanlinessRating === 4 && 'Very Good'}
                                                {cleanlinessRating === 5 && 'Excellent'}
                                            </span>
                                        </div>
                                    )}
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
                        style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
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

            {/* Unsaved changes confirmation */}
            {showUnsavedChangesModal && (
                <div className="confirmation-modal">
                    <div className="confirmation-content">
                        <h2>Unsaved Changes</h2>
                        <p>You have unsaved changes that will be lost if you navigate away. What would you like to do?</p>

                        <div className="confirmation-actions">
                            <button
                                className="cancel-button"
                                onClick={() => setShowUnsavedChangesModal(false)}
                            >
                                Continue Editing
                            </button>

                            <button
                                className="primary-button"
                                onClick={async () => {
                                    setShowUnsavedChangesModal(false);
                                    try {
                                        await handleSave();
                                        // Show brief success message
                                        setMessage('Changes saved successfully!');
                                        // After saving is complete, navigate back
                                        setTimeout(() => onClose(), 800);
                                    } catch (error) {
                                        console.error('Error saving before navigation:', error);
                                        setMessage('Error saving changes. Please try again.');
                                        setTimeout(() => setMessage(''), 3000);
                                    }
                                }}
                                style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                            >
                                Save & Leave
                            </button>

                            <button
                                className="danger-button"
                                onClick={() => {
                                    setShowUnsavedChangesModal(false);
                                    // Reset form to original values to prevent unsaved changes warning
                                    setHasUnsavedChanges(false);
                                    onClose();
                                }}
                            >
                                Discard & Leave
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MixerDetailView;
