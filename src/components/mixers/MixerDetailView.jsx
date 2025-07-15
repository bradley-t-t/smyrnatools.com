import React, {useEffect, useState} from 'react';
import {Mixer} from '../../models/mixers/Mixer';
import {MixerUtils} from '../../utils/MixerUtils';
import {MixerService} from '../../services/MixerService';
import {PlantService} from '../../services/PlantService';
import {OperatorService} from '../../services/OperatorService';
import {UserService} from '../../services/UserService';
import {supabase} from '../../core/clients/SupabaseClient';
import {usePreferences} from '../../context/PreferencesContext';
import MixerHistoryView from './MixerHistoryView';
import MixerCommentModal from './MixerCommentModal';
import MixerIssueModal from './MixerIssueModal';
import MixerCard from './MixerCard';
import OperatorSelectModal from './OperatorSelectModal';
import './MixerDetailView.css';

// Add CSS styling for plant restriction
const plantRestrictionStyles = `
.plant-restriction-warning {
    background-color: #fff3cd;
    color: #856404;
    padding: 12px 16px;
    margin-bottom: 16px;
    border: 1px solid #ffeeba;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.plant-restriction-warning i {
    font-size: 20px;
}

.rating-stars .star.disabled {
    cursor: not-allowed;
    opacity: 0.7;
}

.form-control[readonly] {
    background-color: #f8f9fa;
    cursor: not-allowed;
    opacity: 0.8;
}

.star-button.disabled {
    cursor: not-allowed;
    opacity: 0.7;
}

.edit-instructions {
    font-style: italic;
    color: #666;
}

.unassign-operator-button {
    margin-top: 8px;
    background-color: #f44336;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    transition: background-color 0.2s;
}

.unassign-operator-button:hover {
    background-color: #d32f2f;
}

.unassign-operator-button i {
    margin-right: 8px;
}
`;

// Add styles to document head
const styleElement = document.createElement('style');
styleElement.textContent = plantRestrictionStyles;
document.head.appendChild(styleElement);

function MixerDetailView({mixerId, onClose}) {
    const {preferences} = usePreferences();
    const [mixer, setMixer] = useState(null);
    const [operators, setOperators] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [showIssues, setShowIssues] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [updatedByEmail, setUpdatedByEmail] = useState(null);
    const [message, setMessage] = useState('');
    const [showOperatorModal, setShowOperatorModal] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [canEditMixer, setCanEditMixer] = useState(true);
    const [plantRestrictionReason, setPlantRestrictionReason] = useState('');

    const [originalValues, setOriginalValues] = useState({});
    const [truckNumber, setTruckNumber] = useState('');
    const [assignedOperator, setAssignedOperator] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [status, setStatus] = useState('');
    const [cleanlinessRating, setRating] = useState(0);
    const [lastServiceDate, setLastServiceDate] = useState(null);
    const [lastChipDate, setLastChipDate] = useState(null);
    const [vin, setVin] = useState('');
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [year, setYear] = useState('');

    const setCleanlinessRating = (value) => {
        setRating(value);
        document.documentElement.style.setProperty('--rating-value', value);
    };

    useEffect(() => {
        fetchData();
    }, [mixerId]);

    // Check for plant restriction permission
    useEffect(() => {
        const checkPlantRestriction = async () => {
            if (isLoading || !mixer) return;

            try {
                // Get current user ID
                let userId = sessionStorage.getItem('userId');
                if (!userId) {
                    const {data} = await supabase.auth.getUser();
                    userId = data?.user?.id;
                }

                if (!userId) {
                    console.error('No authenticated user found');
                    return;
                }

                // Check if user has bypass permission
                const hasPermission = await UserService.hasPermission(userId, 'mixers.bypass.plantrestriction');
                if (hasPermission) {
                    setCanEditMixer(true);
                    return;
                }

                // Get user profile to check plant_code
                const {data: profileData} = await supabase
                    .from('users_profiles')
                    .select('plant_code')
                    .eq('id', userId)
                    .single();

                setUserProfile(profileData);

                // Check if mixer's plant matches user's plant
                if (profileData && mixer) {
                    const isSamePlant = profileData.plant_code === mixer.assignedPlant;
                    setCanEditMixer(isSamePlant);

                    if (!isSamePlant) {
                        setPlantRestrictionReason(
                            `You cannot edit or verify this mixer because it belongs to plant ${mixer.assignedPlant} ` +
                            `and you are assigned to plant ${profileData.plant_code}.`
                        );
                    }
                }
            } catch (error) {
                console.error('Error checking plant restriction:', error);
            }
        };

        checkPlantRestriction();
    }, [mixer, isLoading]);

    useEffect(() => {
        if (!originalValues.truckNumber && !isLoading) return;
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
            formatDateForComparison(lastChipDate) !== formatDateForComparison(originalValues.lastChipDate) ||
            vin !== originalValues.vin ||
            make !== originalValues.make ||
            model !== originalValues.model ||
            year !== originalValues.year;

        setHasUnsavedChanges(hasChanges);
    }, [
        truckNumber,
        assignedOperator,
        assignedPlant,
        status,
        cleanlinessRating,
        lastServiceDate,
        lastChipDate,
        vin,
        make,
        model,
        year,
        originalValues,
        isLoading
    ]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const mixerData = await MixerService.fetchMixerById(mixerId);
            setMixer(mixerData);

            const truckNum = mixerData.truckNumber || '';
            const operator = mixerData.assignedOperator || '';
            const plant = mixerData.assignedPlant || '';
            const statusVal = mixerData.status || '';
            const rating = mixerData.cleanlinessRating || 0;
            const serviceDate = mixerData.lastServiceDate ? new Date(mixerData.lastServiceDate) : null;
            const chipDate = mixerData.lastChipDate ? new Date(mixerData.lastChipDate) : null;
            const vinVal = mixerData.vin || '';
            const makeVal = mixerData.make || '';
            const modelVal = mixerData.model || '';
            const yearVal = mixerData.year || '';

            setTruckNumber(truckNum);
            setAssignedOperator(operator);
            setAssignedPlant(plant);
            setStatus(statusVal);
            setCleanlinessRating(rating);
            setLastServiceDate(serviceDate);
            setLastChipDate(chipDate);
            setVin(vinVal);
            setMake(makeVal);
            setModel(modelVal);
            setYear(yearVal);

            setOriginalValues({
                truckNumber: truckNum,
                assignedOperator: operator,
                assignedPlant: plant,
                status: statusVal,
                cleanlinessRating: rating,
                lastServiceDate: serviceDate,
                lastChipDate: chipDate,
                vin: vinVal,
                make: makeVal,
                model: modelVal,
                year: yearVal
            });

            setHasUnsavedChanges(false);
            document.documentElement.style.setProperty('--rating-value', mixerData.cleanlinessRating || 0);

            const operatorsData = await OperatorService.fetchOperators();
            setOperators(operatorsData);

            const plantsData = await PlantService.fetchPlants();
            setPlants(plantsData);

            if (mixerData.updatedBy) {
                try {
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

    const handleSave = async () => {
        return new Promise(async (resolve, reject) => {
            if (!mixer || !mixer.id) {
                alert('Error: Cannot save mixer with undefined ID');
                return;
            }

            setIsSaving(true);

            try {
                let userId = sessionStorage.getItem('userId');
                if (!userId) {
                    const {data: {user}} = await supabase.auth.getUser();
                    userId = user?.id;
                }

                if (!userId) {
                    console.error('No authenticated user found');
                    alert('Your session has expired. Please refresh the page and log in again.');
                    throw new Error('Authentication required: You must be logged in to update mixers');
                }

                const formatDate = (date) => {
                    if (!date) return null;
                    try {
                        const parsedDate = date instanceof Date ? date : new Date(date);
                        if (isNaN(parsedDate.getTime())) return null;
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

                const updatedMixer = {
                    ...mixer,
                    id: mixer.id,
                    truckNumber,
                    assignedOperator: assignedOperator || null,  // Ensure empty string becomes null for UUID compatibility
                    assignedPlant,
                    status,
                    cleanlinessRating: cleanlinessRating || null,
                    lastServiceDate: formatDate(lastServiceDate),
                    lastChipDate: formatDate(lastChipDate),
                    vin,
                    make,
                    model,
                    year,
                    updatedAt: new Date().toISOString() // This will map to updated_at in the database
                    // Do NOT reset the verification status (updatedLast) when making changes
                    // updatedLast should only be changed when explicitly verifying
                };

                // Important: Keep the existing verification status (updatedLast) value
                // Do NOT reset verification status when saving normal changes
                // Make sure the updatedLast value from the original mixer is preserved
                const preservedUpdatedLast = mixer.updatedLast;

                console.log('Updating mixer with data:', {
                    id: updatedMixer.id,
                    updatedAt: updatedMixer.updatedAt,
                    // Include only changed fields in log
                    changes: Object.entries(updatedMixer).filter(([key, val]) => 
                        mixer[key] !== val && key !== 'updatedAt'
                    ).reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {}),
                    keepingVerificationStatus: preservedUpdatedLast ? 'Preserving existing verification' : 'Still unverified'
                });

                // Explicitly set updatedLast to its current value to ensure it's not changed
                updatedMixer.updatedLast = preservedUpdatedLast;
                console.log('Sending mixer update with operator value:', updatedMixer.assignedOperator);
                await MixerService.updateMixer(updatedMixer.id, updatedMixer);

                setMixer(updatedMixer);
                fetchData();

                setMessage('Changes saved successfully! Mixer needs verification.');
                // Keep the message visible longer for the verification notice
                setTimeout(() => setMessage(''), 5000);

                setOriginalValues({
                    truckNumber,
                    assignedOperator,
                    assignedPlant,
                    status,
                    cleanlinessRating,
                    lastServiceDate,
                    lastChipDate,
                    vin,
                    make,
                    model,
                    year
                });

                setHasUnsavedChanges(false);
            } catch (error) {
                console.error('Error saving mixer:', error);
                const errorMessage = error.message || 'Unknown error';
                console.error('Error details:', {
                    mixerId: mixer?.id,
                    truckNumber,
                    assignedPlant,
                    assignedOperator,
                    status,
                    cleanlinessRating,
                    lastServiceDate: lastServiceDate ? formatDate(lastServiceDate) : null,
                    lastChipDate: lastChipDate ? formatDate(lastChipDate) : null,
                    vin,
                    make,
                    model,
                    year
                });
                alert(`Error saving changes: ${errorMessage}`);
            } finally {
                setIsSaving(false);
                resolve();
            }
        });
    };

    const handleDelete = async () => {
        if (!mixer) return;

        if (!showDeleteConfirmation) {
            setShowDeleteConfirmation(true);
            return;
        }

        // No longer shows operator modal during delete

        try {
            await supabase
                .from('mixers')
                .delete()
                .eq('id', mixer.id);

            alert('Mixer deleted successfully');
            onClose();
        } catch (error) {
            console.error('Error deleting mixer:', error);
            alert('Error deleting mixer');
        } finally {
            setShowDeleteConfirmation(false);
        }
    };

    const handleVerifyMixer = async () => {
        if (!mixer) return;

        setIsSaving(true);

        try {
            if (hasUnsavedChanges) {
                try {
                    await handleSave();
                } catch (saveError) {
                    console.error('Error saving changes before verification:', saveError);
                    alert('Failed to save your changes before verification. Please try saving manually first.');
                    throw new Error('Failed to save changes before verification');
                }
            }

            let userId = sessionStorage.getItem('userId');
            if (!userId) {
                const {data: {user}} = await supabase.auth.getUser();
                userId = user?.id;
            }

            if (!userId) {
                console.error('No authenticated user found');
                alert('Your session has expired. Please refresh the page and log in again.');
                throw new Error('Authentication required: You must be logged in to verify mixers');
            }

                            // Only modify the verification fields - DO NOT touch other fields
                            const now = new Date().toISOString();
                            console.log(`Verifying mixer ${mixer.id} at ${now} by user ${userId}`);
                            const {data, error} = await supabase
                .from('mixers')
                .update({
                    updated_last: now,
                    updated_by: userId
                })
                .eq('id', mixer.id)
                .select();

            if (error) {
                console.error('Error verifying mixer:', error);
                throw new Error(`Failed to verify mixer: ${error.message}`);
            }

            if (data && data.length > 0) {
                setMixer(Mixer.fromApiFormat(data[0]));
                setMessage('Mixer verified successfully!');
                setTimeout(() => setMessage(''), 3000);
            }

            fetchData();
        } catch (error) {
            console.error('Error verifying mixer:', error);
            alert(`Error verifying mixer: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleBackClick = () => {
        if (hasUnsavedChanges) {
            setShowUnsavedChangesModal(true);
        } else {
            onClose();
        }
    };

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const getOperatorName = (operatorId) => {
        if (!operatorId || operatorId === '' || operatorId === '0') return 'None';
        const operator = operators.find(op => op.employeeId === operatorId);
        return operator ? (operator.position ? `${operator.name} (${operator.position})` : operator.name) : 'Unknown';
    };

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode;
    };

    const formatDate = (date) => {
        if (!date) return '';
        return date instanceof Date ? date.toISOString().split('T')[0] : date;
    };

// State for all mixers (needed for checking multiple assignments)
const [mixers, setMixers] = useState([]);

// Fetch all mixers on component mount
useEffect(() => {
    async function fetchAllMixers() {
        try {
            const allMixers = await MixerService.getAllMixers();
            setMixers(allMixers);
        } catch (error) {
            console.error('Error fetching all mixers:', error);
        }
    }

    fetchAllMixers();
}, []);
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
            {showIssues && (
                <MixerIssueModal
                    mixerId={mixerId}
                    mixerNumber={mixer?.truckNumber}
                    onClose={() => setShowIssues(false)}
                />
            )}
            {isSaving && (
                <div className="saving-overlay">
                    <div className="saving-indicator"></div>
                </div>
            )}
            <div className="detail-header">
                <div className="header-left">
                    <button
                        className="back-button"
                        onClick={handleBackClick}
                        aria-label="Back to mixers"
                        style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}
                    >
                        <i className="fas fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                </div>
                <h1>Truck #{mixer.truckNumber || 'Not Assigned'}</h1>
                <div className="header-actions">
                    {canEditMixer && (
                        <>
                            <button className="issues-button" onClick={() => setShowIssues(true)} style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>
                                <i className="fas fa-tools"></i> Issues
                            </button>
                            <button className="comments-button" onClick={() => setShowComments(true)}>
                                <i className="fas fa-comments"></i> Comments
                            </button>
                        </>
                    )}
                    <button
                        className="history-button"
                        onClick={() => setShowHistory(true)}
                        style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}
                    >
                        <i className="fas fa-history"></i>
                        <span>History</span>
                    </button>
                </div>
            </div>

                {!canEditMixer && (
                    <div className="plant-restriction-warning">
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>{plantRestrictionReason}</span>
                    </div>
                )}
            <div className="detail-content" style={{maxWidth: '1000px', margin: '0 auto', overflow: 'visible'}}>
                {message && (
                    <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                        {message}
                    </div>
                )}
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
                                    <span
                                        className="verification-value">{mixer.createdAt ? new Date(mixer.createdAt).toLocaleString() : 'Not Assigned'}</span>
                                </div>
                            </div>
                            <div className="verification-item">
                                <div className="verification-icon"
                                     style={{color: mixer.updatedLast ? (mixer.isVerified() ? '#10b981' : 
                                            new Date(mixer.updatedAt) > new Date(mixer.updatedLast) ? '#ef4444' : '#f59e0b') : '#ef4444'}}>
                                    <i className="fas fa-calendar-check"></i>
                                </div>
                                <div className="verification-info">
                                    <span className="verification-label">Last Verified</span>
                                    <span className="verification-value"
                                          style={{color: mixer.updatedLast ? (mixer.isVerified() ? 'inherit' : 
                                                 new Date(mixer.updatedAt) > new Date(mixer.updatedLast) ? '#ef4444' : '#f59e0b') : '#ef4444'}}>
                                        {mixer.updatedLast ? 
                                            `${new Date(mixer.updatedLast).toLocaleString()}${!mixer.isVerified() ? 
                                                (new Date(mixer.updatedAt) > new Date(mixer.updatedLast) ? 
                                                    ' (Changes have been made)' : 
                                                    ' (It is a new week)') : 
                                                ''}` :
                                            'Never verified'}
                                    </span>
                                </div>
                            </div>
                                                            <div className="verification-item" title={`Last Updated: ${new Date(mixer.updatedAt).toLocaleString()}`}>
                                <div className="verification-icon"
                                     style={{color: mixer.updatedBy ? '#10b981' : '#ef4444'}}>
                                    <i className="fas fa-user-check"></i>
                                </div>
                                <div className="verification-info">
                                    <span className="verification-label">Verified By</span>
                                    <span className="verification-value"
                                          style={{color: mixer.updatedBy ? 'inherit' : '#ef4444'}}>
                                        {mixer.updatedBy ? (updatedByEmail || 'Unknown User') : 'No verification record'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            className="verify-now-button"
                            onClick={handleVerifyMixer}
                            disabled={!canEditMixer}
                            style={{
                                backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896',
                                opacity: !canEditMixer ? '0.6' : '1',
                                cursor: !canEditMixer ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <i className="fas fa-check-circle"></i>
                            Verify Now
                        </button>
                        <div className="verification-notice">
                            <i className="fas fa-info-circle"></i>
                            <p>
                                Assets require verification after any changes are made and are reset weekly.
                                <strong> Due: Every Friday at 10:00 AM.</strong>
                            </p>
                        </div>
                    </div>
                </div>
                <div className="detail-card">
                    <div className="card-header">
                        <h2>Mixer Information</h2>
                    </div>
                    <p className="edit-instructions">
                        {canEditMixer 
                            ? "You can make changes below. Remember to save your changes." 
                            : "You are in read-only mode and cannot make changes to this mixer."}
                    </p>
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
                                    readOnly={!canEditMixer}
                                />
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                        disabled={!canEditMixer}
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
                                        disabled={!canEditMixer}
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
                                <div className="operator-select-container">
                                    <button 
                                        className="operator-select-button form-control"
                                        onClick={() => canEditMixer && setShowOperatorModal(true)}
                                        type="button"
                                        disabled={!canEditMixer}
                                        style={!canEditMixer ? {cursor: 'not-allowed', opacity: 0.8, backgroundColor: '#f8f9fa'} : {}}
                                    >
                                                                                    <span style={{display: 'block', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                            {assignedOperator
                                                ? getOperatorName(assignedOperator)
                                                : 'None (Click to select)'}
                                                                                    </span>
                                    </button>
                                    {assignedOperator && canEditMixer && (
                                        <button
                                            className="unassign-operator-button"
                                            onClick={() => {
                                                if (window.confirm(`Are you sure you want to unassign the operator? The truck status will be changed to Spare.`)) {
                                                    setAssignedOperator(null);
                                                    setStatus('Spare');
                                                    setMessage('Operator unassigned and status set to Spare');
                                                    setTimeout(() => setMessage(''), 3000);
                                                }
                                            }}
                                            type="button"
                                        >
                                            <i className="fas fa-user-slash" style={{ marginRight: '8px' }}></i>
                                            Unassign Operator
                                        </button>
                                    )}
                                </div>
                                {showOperatorModal && (
                                    <OperatorSelectModal
                                        isOpen={showOperatorModal}
                                        onClose={() => setShowOperatorModal(false)}
                                        onSelect={(operatorId) => {
                                            console.log('Selected operator in modal:', operatorId, typeof operatorId);
                                            setAssignedOperator(operatorId === '0' ? '' : operatorId);
                                            // If assigning an operator, ensure status is Active
                                            if (operatorId && operatorId !== '0') {
                                                setStatus('Active');
                                            }
                                            setShowOperatorModal(false);
                                        }}
                                        currentValue={assignedOperator}
                                        mixers={mixers || []}
                                        assignedPlant={assignedPlant}
                                        readOnly={!canEditMixer}
                                    />
                                )}
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
                                    readOnly={!canEditMixer}
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
                                    readOnly={!canEditMixer}
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
                                                className={`star-button ${star <= cleanlinessRating ? 'active' : ''} ${!canEditMixer ? 'disabled' : ''}`}
                                                onClick={() => canEditMixer && setCleanlinessRating(star === cleanlinessRating ? 0 : star)}
                                                aria-label={`Rate ${star} of 5 stars`}
                                                disabled={!canEditMixer}
                                            >
                                                <i className={`fas fa-star ${star <= cleanlinessRating ? 'filled' : ''}`}
                                                   style={star <= cleanlinessRating ? {color: preferences.accentColor === 'red' ? '#b80017' : '#003896'} : {}}
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
                    <div className="form-sections">
                        <div className="form-section vehicle-info">
                            <h3>Asset Details</h3>
                            <div className="form-group">
                                <label>VIN</label>
                                <input
                                    type="text"
                                    value={vin}
                                    onChange={(e) => setVin(e.target.value)}
                                    className="form-control"
                                    readOnly={!canEditMixer}
                                />
                            </div>
                            <div className="form-group">
                                <label>Make</label>
                                <input
                                    type="text"
                                    value={make}
                                    onChange={(e) => setMake(e.target.value)}
                                    className="form-control"
                                    readOnly={!canEditMixer}
                                />
                            </div>
                            <div className="form-group">
                                <label>Model</label>
                                <input
                                    type="text"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="form-control"
                                    readOnly={!canEditMixer}
                                />
                            </div>
                            <div className="form-group">
                                <label>Year</label>
                                <input
                                    type="text"
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                    className="form-control"
                                    readOnly={!canEditMixer}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="form-actions">
                    {canEditMixer && (
                        <>
                            <button
                                className="primary-button save-button"
                                onClick={handleSave}
                                disabled={isSaving}
                                style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}
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
                        </>
                    )}
                </div>
            </div>
            {showHistory && (
                <MixerHistoryView mixer={mixer} onClose={() => setShowHistory(false)}/>
            )}
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
                                                                            {/* Removed duplicate operator modal that caused conflicts */}
                        </div>
                    </div>
                </div>
            )}
            {showUnsavedChangesModal && (
                <div className="confirmation-modal">
                    <div className="confirmation-content">
                        <h2>Unsaved Changes</h2>
                        <p>You have unsaved changes that will be lost if you navigate away. What would you like to
                            do?</p>
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
                                        setMessage('Changes saved successfully!');
                                        setTimeout(() => onClose(), 800);
                                    } catch (error) {
                                        console.error('Error saving before navigation:', error);
                                        setMessage('Error saving changes. Please try again.');
                                        setTimeout(() => setMessage(''), 3000);
                                    }
                                }}
                                    disabled={!canEditMixer}
                                    style={{
                                        backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896',
                                        opacity: !canEditMixer ? '0.6' : '1',
                                        cursor: !canEditMixer ? 'not-allowed' : 'pointer'
                                    }}
                            >
                                Save & Leave
                            </button>
                            <button
                                className="danger-button"
                                onClick={() => {
                                    setShowUnsavedChangesModal(false);
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