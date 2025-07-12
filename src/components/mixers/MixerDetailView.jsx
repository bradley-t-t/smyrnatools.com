import React, {useEffect, useState} from 'react';
import {Mixer, MixerUtils} from '../../models/mixers/Mixer';
import {MixerService} from '../../services/mixers/MixerService';
import {PlantService} from '../../services/plants/PlantService';
import {OperatorService} from '../../services/operators/OperatorService';
import {UserService} from '../../services/auth/UserService';
import supabase from '../../core/clients/SupabaseClient';
import {usePreferences} from '../../context/preferences/PreferencesContext';
import MixerHistoryView from './MixerHistoryView';
import MixerCommentModal from './MixerCommentModal';
import MixerIssueModal from './MixerIssueModal';
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
    const [showIssues, setShowIssues] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [updatedByEmail, setUpdatedByEmail] = useState(null);
    const [message, setMessage] = useState('');

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
                    assignedOperator,
                    assignedPlant,
                    status,
                    cleanlinessRating: cleanlinessRating || null,
                    lastServiceDate: formatDate(lastServiceDate),
                    lastChipDate: formatDate(lastChipDate),
                    vin,
                    make,
                    model,
                    year,
                    updatedAt: new Date().toISOString()
                };

                await MixerService.updateMixer(updatedMixer.id, updatedMixer);

                setMixer(updatedMixer);
                fetchData();

                setMessage('Changes saved successfully!');
                setTimeout(() => setMessage(''), 3000);

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
        if (!operatorId || operatorId === '0') return 'None';
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
                    <button className="issues-button" onClick={() => setShowIssues(true)} style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>
                        <i className="fas fa-tools"></i> Issues
                    </button>
                    <button className="comments-button" onClick={() => setShowComments(true)}>
                        <i className="fas fa-comments"></i> Comments
                    </button>
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
            <div className="detail-content" style={{maxWidth: '1000px', margin: '0 auto'}}>
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
                                     style={{color: mixer.updatedLast ? (mixer.isVerified() ? '#10b981' : '#f59e0b') : '#ef4444'}}>
                                    <i className="fas fa-calendar-check"></i>
                                </div>
                                <div className="verification-info">
                                    <span className="verification-label">Last Verified</span>
                                    <span className="verification-value"
                                          style={{color: mixer.updatedLast ? (mixer.isVerified() ? 'inherit' : '#f59e0b') : '#ef4444'}}>
                                        {mixer.updatedLast ? new Date(mixer.updatedLast).toLocaleString() : 'Never verified'}
                                    </span>
                                </div>
                            </div>
                            <div className="verification-item">
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
                            style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}
                        >
                            <i className="fas fa-check-circle"></i>
                            Verify Now
                        </button>
                        <div className="verification-notice">
                            <i className="fas fa-info-circle"></i>
                            <p>
                                Assets require verification after any changes are made and/or at the start of each work
                                week.
                                <strong> Due: Every Friday at 10:00 AM.</strong>
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
                                />
                            </div>
                            <div className="form-group">
                                <label>Make</label>
                                <input
                                    type="text"
                                    value={make}
                                    onChange={(e) => setMake(e.target.value)}
                                    className="form-control"
                                />
                            </div>
                            <div className="form-group">
                                <label>Model</label>
                                <input
                                    type="text"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="form-control"
                                />
                            </div>
                            <div className="form-group">
                                <label>Year</label>
                                <input
                                    type="text"
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                    className="form-control"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="form-actions">
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
                                style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}
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