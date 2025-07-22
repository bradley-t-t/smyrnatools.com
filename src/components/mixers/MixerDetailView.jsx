import React, {useState, useEffect} from 'react';
import {MixerService} from '../../services/MixerService';
import {PlantService} from '../../services/PlantService';
import {OperatorService} from '../../services/OperatorService';
import {UserService} from '../../services/UserService';
import {supabase} from '../../services/DatabaseService';
import {AuthUtility} from '../../utils/AuthUtility';
import {usePreferences} from '../../context/PreferencesContext';
import MixerHistoryView from './MixerHistoryView';
import MixerCommentModal from './MixerCommentModal';
import MixerIssueModal from './MixerIssueModal';
import MixerCard from './MixerCard';
import OperatorSelectModal from './OperatorSelectModal';
import './MixerDetailView.css';
import {MixerUtility} from "../../utils/MixerUtility";
import {Mixer} from "../../models/mixers/Mixer";
import ThemeUtility from "../../utils/ThemeUtility";
import LoadingScreen from "../common/LoadingScreen";

function MixerDetailView({mixerId, onClose}) {
    const {preferences} = usePreferences();
    const [mixer, setMixer] = useState(null);
    const [operators, setOperators] = useState([]);
    const [plants, setPlants] = useState([]);
    const [mixers, setMixers] = useState([]);
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
    const [cleanlinessRating, setCleanlinessRating] = useState(0);
    const [lastServiceDate, setLastServiceDate] = useState(null);
    const [lastChipDate, setLastChipDate] = useState(null);
    const [vin, setVin] = useState('');
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [year, setYear] = useState('');
    const [operatorModalOperators, setOperatorModalOperators] = useState([]);
    const [lastUnassignedOperatorId, setLastUnassignedOperatorId] = useState(null);

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const [mixerData, operatorsData, plantsData, allMixers] = await Promise.all([
                    MixerService.fetchMixerById(mixerId),
                    OperatorService.fetchOperators(),
                    PlantService.fetchPlants(),
                    MixerService.getAllMixers()
                ]);

                setMixer(mixerData);
                setOperators(operatorsData);
                setPlants(plantsData);
                setMixers(allMixers);

                setTruckNumber(mixerData.truckNumber || '');
                setAssignedOperator(mixerData.assignedOperator || '');
                setAssignedPlant(mixerData.assignedPlant || '');
                setStatus(mixerData.status || '');
                setCleanlinessRating(mixerData.cleanlinessRating || 0);
                setLastServiceDate(mixerData.lastServiceDate ? new Date(mixerData.lastServiceDate) : null);
                setLastChipDate(mixerData.lastChipDate ? new Date(mixerData.lastChipDate) : null);
                setVin(mixerData.vin || '');
                setMake(mixerData.make || '');
                setModel(mixerData.model || '');
                setYear(mixerData.year || '');

                setOriginalValues({
                    truckNumber: mixerData.truckNumber || '',
                    assignedOperator: mixerData.assignedOperator || '',
                    assignedPlant: mixerData.assignedPlant || '',
                    status: mixerData.status || '',
                    cleanlinessRating: mixerData.cleanlinessRating || 0,
                    lastServiceDate: mixerData.lastServiceDate ? new Date(mixerData.lastServiceDate) : null,
                    lastChipDate: mixerData.lastChipDate ? new Date(mixerData.lastChipDate) : null,
                    vin: mixerData.vin || '',
                    make: mixerData.make || '',
                    model: mixerData.model || '',
                    year: mixerData.year || ''
                });

                document.documentElement.style.setProperty('--rating-value', mixerData.cleanlinessRating || 0);

                if (mixerData.updatedBy) {
                    try {
                        const userName = await UserService.getUserDisplayName(mixerData.updatedBy);
                        setUpdatedByEmail(userName);
                    } catch {
                        setUpdatedByEmail('Unknown User');
                    }
                }
            } catch (error) {
                console.error('Error fetching mixer details:', error);
            } finally {
                setIsLoading(false);
                setHasUnsavedChanges(false);
            }
        }
        fetchData();
    }, [mixerId]);

    useEffect(() => {
        async function checkPlantRestriction() {
            if (isLoading || !mixer) return;

            try {
                const userId = await UserService.getCurrentUser();
                if (!userId) return;

                const hasPermission = await UserService.hasPermission(userId, 'mixers.bypass.plantrestriction');
                if (hasPermission) return setCanEditMixer(true);

                const {data: profileData} = await supabase.from('users_profiles').select('plant_code').eq('id', userId).single();
                setUserProfile(profileData);

                if (profileData && mixer) {
                    const isSamePlant = profileData.plant_code === mixer.assignedPlant;
                    setCanEditMixer(isSamePlant);
                    if (!isSamePlant) {
                        setPlantRestrictionReason(
                            `You cannot edit or verify this mixer because it belongs to plant ${mixer.assignedPlant} and you are assigned to plant ${profileData.plant_code}.`
                        );
                    }
                }
            } catch (error) {
                console.error('Error checking plant restriction:', error);
            }
        }
        checkPlantRestriction();
    }, [mixer, isLoading]);

    useEffect(() => {
        if (!originalValues.truckNumber || isLoading) return;

        const formatDateForComparison = date => date ? (date instanceof Date ? date.toISOString().split('T')[0] : '') : '';
        const hasChanges =
            truckNumber !== originalValues.truckNumber ||
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
    }, [truckNumber, assignedPlant, status, cleanlinessRating, lastServiceDate, lastChipDate, vin, make, model, year, originalValues, isLoading]);

    useEffect(() => {
        const handleBeforeUnload = e => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    async function handleSave(overrideValues = {}) {
        if (!mixer?.id) {
            alert('Error: Cannot save mixer with undefined ID');
            return;
        }

        setIsSaving(true);
        try {
            let userObj = await UserService.getCurrentUser();
            let userId = typeof userObj === 'object' && userObj !== null ? userObj.id : userObj;

            const formatDate = date => {
                if (!date) return null;
                const parsedDate = date instanceof Date ? date : new Date(date);
                if (isNaN(parsedDate.getTime())) return null;
                return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')} ${String(parsedDate.getHours()).padStart(2, '0')}:${String(parsedDate.getMinutes()).padStart(2, '0')}:${String(parsedDate.getSeconds()).padStart(2, '0')}+00`;
            };

            let assignedOperatorValue = overrideValues.hasOwnProperty('assignedOperator')
                ? overrideValues.assignedOperator
                : assignedOperator;

            let mixerForHistory = {
                ...mixer,
                assignedOperator: overrideValues.hasOwnProperty('prevAssignedOperator')
                    ? overrideValues.prevAssignedOperator
                    : mixer.assignedOperator
            };

            const updatedMixer = {
                ...mixer,
                id: mixer.id,
                truckNumber: overrideValues.truckNumber ?? truckNumber,
                assignedOperator: assignedOperatorValue || null,
                assignedPlant: overrideValues.assignedPlant ?? assignedPlant,
                status: overrideValues.status ?? status,
                cleanlinessRating: (overrideValues.cleanlinessRating ?? cleanlinessRating) || null,
                lastServiceDate: formatDate(overrideValues.lastServiceDate ?? lastServiceDate),
                lastChipDate: formatDate(overrideValues.lastChipDate ?? lastChipDate),
                vin: overrideValues.vin ?? vin,
                make: overrideValues.make ?? make,
                model: overrideValues.model ?? model,
                year: overrideValues.year ?? year,
                updatedAt: new Date().toISOString(),
                updatedBy: userId,
                updatedLast: mixer.updatedLast
            };

            await MixerService.updateMixer(
                updatedMixer.id,
                updatedMixer,
                undefined,
                mixerForHistory
            );
            setMixer(updatedMixer);

            setMessage('Changes saved successfully! Mixer needs verification.');
            setTimeout(() => setMessage(''), 5000);

            setOriginalValues({
                truckNumber: updatedMixer.truckNumber,
                assignedOperator: updatedMixer.assignedOperator,
                assignedPlant: updatedMixer.assignedPlant,
                status: updatedMixer.status,
                cleanlinessRating: updatedMixer.cleanlinessRating,
                lastServiceDate: updatedMixer.lastServiceDate ? new Date(updatedMixer.lastServiceDate) : null,
                lastChipDate: updatedMixer.lastChipDate ? new Date(updatedMixer.lastChipDate) : null,
                vin: updatedMixer.vin,
                make: updatedMixer.make,
                model: updatedMixer.model,
                year: updatedMixer.year
            });

            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Error saving mixer:', error);
            alert(`Error saving changes: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete() {
        if (!mixer) return;
        if (!showDeleteConfirmation) return setShowDeleteConfirmation(true);

        try {
            await supabase.from('mixers').delete().eq('id', mixer.id);
            alert('Mixer deleted successfully');
            onClose();
        } catch (error) {
            console.error('Error deleting mixer:', error);
            alert('Error deleting mixer');
        } finally {
            setShowDeleteConfirmation(false);
        }
    }

    async function handleVerifyMixer() {
        if (!mixer) return;

        setIsSaving(true);
        try {
            if (hasUnsavedChanges) {
                await handleSave().catch(error => {
                    console.error('Error saving changes before verification:', error);
                    alert('Failed to save your changes before verification. Please try saving manually first.');
                    throw new Error('Failed to save changes before verification');
                });
            }

            let userObj = await UserService.getCurrentUser();
            let userId = typeof userObj === 'object' && userObj !== null ? userObj.id : userObj;

            const now = new Date().toISOString();
            const {data, error} = await supabase
                .from('mixers')
                .update({updated_last: now, updated_by: userId})
                .eq('id', mixer.id)
                .select();

            if (error) throw new Error(`Failed to verify mixer: ${error.message}`);
            if (data?.length) {
                setMixer(Mixer.fromApiFormat(data[0]));
                setMessage('Mixer verified successfully!');
                setTimeout(() => setMessage(''), 3000);
            }

            setHasUnsavedChanges(false);

        } catch (error) {
            console.error('Error verifying mixer:', error);
            alert(`Error verifying mixer: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    }

    function handleBackClick() {
        if (hasUnsavedChanges) setShowUnsavedChangesModal(true);
        else onClose();
    }

    function getOperatorName(operatorId) {
        if (!operatorId || operatorId === '0') return 'None';
        const operator = operators.find(op => op.employeeId === operatorId);
        return operator ? (operator.position ? `${operator.name} (${operator.position})` : operator.name) : 'Unknown';
    }

    function getPlantName(plantCode) {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode;
    }

    function formatDate(date) {
        if (!date) return '';
        return date instanceof Date ? date.toISOString().split('T')[0] : date;
    }

    async function fetchOperatorsForModal() {
        let dbOperators = await OperatorService.fetchOperators();
        if (lastUnassignedOperatorId) {
            const alreadyIncluded = dbOperators.some(op => op.employeeId === lastUnassignedOperatorId);
            if (!alreadyIncluded) {
                const unassignedOperator = await OperatorService.fetchOperatorById(lastUnassignedOperatorId);
                if (unassignedOperator) {
                    dbOperators = [...dbOperators, unassignedOperator];
                }
            }
        }
        setOperatorModalOperators(dbOperators);
    }

    async function refreshOperators() {
        const updatedOperators = await OperatorService.fetchOperators();
        setOperators(updatedOperators);
    }

    if (isLoading) {
        return (
            <div className="operator-detail-view">
                <div className="detail-header" style={{backgroundColor: preferences.themeMode === 'dark' ? '#2a2a2a' : '#ffffff', display: 'flex', alignItems: 'center', padding: '0 8px'}}>
                    <button className="back-button" onClick={onClose} style={{marginRight: '8px', backgroundColor: 'var(--accent)'}}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1 style={{color: preferences.themeMode === 'dark' ? '#f5f5f5' : '#212122', textAlign: 'center', flex: 1, margin: '0 auto'}}>Mixer Details</h1>
                    <div style={{width: '36px'}}></div>
                </div>
                <div className="detail-content">
                    <LoadingScreen message="Loading mixer details..." inline={true} />
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
            {showComments && <MixerCommentModal mixerId={mixerId} mixerNumber={mixer?.truckNumber} onClose={() => setShowComments(false)} />}
            {showIssues && <MixerIssueModal mixerId={mixerId} mixerNumber={mixer?.truckNumber} onClose={() => setShowIssues(false)} />}
            {isSaving && (
                <div className="saving-overlay">
                    <div className="saving-indicator"></div>
                </div>
            )}
            <div className="detail-header" style={{backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.primary : ThemeUtility.light.background.primary, color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.primary : ThemeUtility.light.text.primary}}>
                <div className="header-left">
                    <button className="back-button" onClick={handleBackClick} aria-label="Back to mixers" style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>
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
                    <button className="history-button" onClick={() => setShowHistory(true)} style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>
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
                <div className="mixer-card-preview" style={{ position: 'relative', zIndex: 0 }}>
                    <MixerCard mixer={mixer} operatorName={getOperatorName(mixer.assignedOperator)} plantName={getPlantName(mixer.assignedPlant)} showOperatorWarning={false} />
                </div>
                <div className="detail-card">
                    <div className="card-header">
                        <h2>Verification Status</h2>
                    </div>
                    <div className="verification-card">
                        <div className="verification-card-header">
                            <i className="fas fa-clipboard-check"></i>
                            {Mixer.ensureInstance(mixer).isVerified() ? (
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
                                <div className="verification-icon" style={{color: mixer.updatedLast ? (Mixer.ensureInstance(mixer).isVerified() ? '#10b981' : new Date(mixer.updatedAt) > new Date(mixer.updatedLast) ? '#ef4444' : '#f59e0b') : '#ef4444'}}>
                                    <i className="fas fa-calendar-check"></i>
                                </div>
                                <div className="verification-info">
                                    <span className="verification-label">Last Verified</span>
                                    <span className="verification-value" style={{color: mixer.updatedLast ? (Mixer.ensureInstance(mixer).isVerified() ? 'inherit' : new Date(mixer.updatedAt) > new Date(mixer.updatedLast) ? '#ef4444' : '#f59e0b') : '#ef4444'}}>
                                        {mixer.updatedLast ? `${new Date(mixer.updatedLast).toLocaleString()}${!Mixer.ensureInstance(mixer).isVerified() ? (new Date(mixer.updatedAt) > new Date(mixer.updatedLast) ? ' (Changes have been made)' : ' (It is a new week)') : ''}` : 'Never verified'}
                                    </span>
                                </div>
                            </div>
                            <div className="verification-item" title={`Last Updated: ${new Date(mixer.updatedAt).toLocaleString()}`}>
                                <div className="verification-icon" style={{color: mixer.updatedBy ? '#10b981' : '#ef4444'}}>
                                    <i className="fas fa-user-check"></i>
                                </div>
                                <div className="verification-info">
                                    <span className="verification-label">Verified By</span>
                                    <span className="verification-value" style={{color: mixer.updatedBy ? 'inherit' : '#ef4444'}}>{mixer.updatedBy ? (updatedByEmail || 'Unknown User') : 'No verification record'}</span>
                                </div>
                            </div>
                        </div>
                        <button className="verify-now-button" onClick={handleVerifyMixer} disabled={!canEditMixer} style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896', opacity: !canEditMixer ? '0.6' : '1', cursor: !canEditMixer ? 'not-allowed' : 'pointer'}}>
                            <i className="fas fa-check-circle"></i> Verify Now
                        </button>
                        <div className="verification-notice">
                            <i className="fas fa-info-circle"></i>
                            <p>Assets require verification after any changes are made and are reset weekly. <strong>Due: Every Friday at 10:00 AM.</strong></p>
                        </div>
                    </div>
                </div>
                <div className="detail-card">
                    <div className="card-header">
                        <h2>Mixer Information</h2>
                    </div>
                    <p className="edit-instructions">{canEditMixer ? "You can make changes below. Remember to save your changes." : "You are in read-only mode and cannot make changes to this mixer."}</p>
                    <div className="form-sections">
                        <div className="form-section basic-info">
                            <h3>Basic Information</h3>
                            <div className="form-group">
                                <label>Truck Number</label>
                                <input type="text" value={truckNumber} onChange={e => setTruckNumber(e.target.value)} className="form-control" readOnly={!canEditMixer} />
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select value={status} onChange={e => setStatus(e.target.value)} disabled={!canEditMixer} className="form-control">
                                    <option value="">Select Status</option>
                                    <option value="Active">Active</option>
                                    <option value="Spare">Spare</option>
                                    <option value="In Shop">In Shop</option>
                                    <option value="Retired">Retired</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Assigned Plant</label>
                                <select value={assignedPlant} onChange={e => setAssignedPlant(e.target.value)} disabled={!canEditMixer} className="form-control">
                                    <option value="">Select Plant</option>
                                    {plants.map(plant => (
                                        <option key={plant.plantCode} value={plant.plantCode}>{plant.plantName}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Assigned Operator</label>
                                <div className="operator-select-container">
                                    <button
                                        className="operator-select-button form-control"
                                        onClick={async () => {
                                            if (canEditMixer) {
                                                await fetchOperatorsForModal();
                                                setShowOperatorModal(true);
                                            }
                                        }}
                                        type="button"
                                        disabled={!canEditMixer}
                                        style={!canEditMixer ? { cursor: 'not-allowed', opacity: 0.8, backgroundColor: '#f8f9fa' } : {}}
                                    >
                                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {assignedOperator ? getOperatorName(assignedOperator) : 'None (Click to select)'}
                                        </span>
                                    </button>
                                    {canEditMixer && (
                                        assignedOperator ? (
                                            <button
                                                className="unassign-operator-button"
                                                title="Unassign Operator"
                                                onClick={async () => {
                                                    try {
                                                        const prevOperator = assignedOperator;
                                                        await handleSave({
                                                            assignedOperator: null,
                                                            status: 'Spare',
                                                            prevAssignedOperator: prevOperator
                                                        });
                                                        setAssignedOperator(null);
                                                        setStatus('Spare');
                                                        setLastUnassignedOperatorId(prevOperator);
                                                        await refreshOperators();
                                                        await fetchOperatorsForModal();
                                                        const updatedMixer = await MixerService.fetchMixerById(mixerId);
                                                        setMixer(updatedMixer);
                                                        setMessage('Operator unassigned and status set to Spare');
                                                        setTimeout(() => setMessage(''), 3000);
                                                        if (showOperatorModal) {
                                                            setShowOperatorModal(false);
                                                            setTimeout(() => {
                                                                setShowOperatorModal(true);
                                                            }, 0);
                                                        }
                                                    } catch (error) {
                                                        console.error('Error unassigning operator:', error);
                                                        setMessage('Error unassigning operator. Please try again.');
                                                        setTimeout(() => setMessage(''), 3000);
                                                    }
                                                }}
                                                type="button"
                                            >
                                                Unassign Operator
                                            </button>
                                        ) : (
                                            lastUnassignedOperatorId && (
                                                <button
                                                    className="undo-operator-button"
                                                    title="Undo Unassign"
                                                    onClick={async () => {
                                                        try {
                                                            await handleSave({
                                                                assignedOperator: lastUnassignedOperatorId,
                                                                status: 'Active'
                                                            });
                                                            setAssignedOperator(lastUnassignedOperatorId);
                                                            setStatus('Active');
                                                            setLastUnassignedOperatorId(null);
                                                            await refreshOperators();
                                                            await fetchOperatorsForModal();
                                                            const updatedMixer = await MixerService.fetchMixerById(mixerId);
                                                            setMixer(updatedMixer);
                                                            setMessage('Operator re-assigned and status set to Active');
                                                            setTimeout(() => setMessage(''), 3000);
                                                        } catch (error) {
                                                            console.error('Error undoing unassign:', error);
                                                            setMessage('Error undoing unassign. Please try again.');
                                                            setTimeout(() => setMessage(''), 3000);
                                                        }
                                                    }}
                                                    type="button"
                                                    style={{
                                                        backgroundColor: '#10b981',
                                                        color: '#fff',
                                                        marginLeft: '8px',
                                                        height: '38px',
                                                        minWidth: '140px',
                                                        fontSize: '1rem',
                                                        borderRadius: '4px',
                                                        border: 'none',
                                                        padding: '0 16px',
                                                        cursor: 'pointer',
                                                        boxSizing: 'border-box'
                                                    }}
                                                    className="unassign-operator-button"
                                                >
                                                    Undo
                                                </button>
                                            )
                                        ))}
                                </div>
                                {showOperatorModal && (
                                    <OperatorSelectModal
                                        isOpen={showOperatorModal}
                                        onClose={() => setShowOperatorModal(false)}
                                        onSelect={async operatorId => {
                                            const newOperator = operatorId === '0' ? '' : operatorId;
                                            const newStatus = newOperator ? 'Active' : status;
                                            setShowOperatorModal(false);
                                            if (newOperator) {
                                                try {
                                                    await handleSave({
                                                        assignedOperator: newOperator,
                                                        status: newStatus
                                                    });
                                                    setAssignedOperator(newOperator);
                                                    setStatus(newStatus);
                                                    setLastUnassignedOperatorId(null);
                                                    await refreshOperators();
                                                    const updatedMixer = await MixerService.fetchMixerById(mixerId);
                                                    setMixer(updatedMixer);
                                                    setMessage('Operator assigned and status set to Active');
                                                    setTimeout(() => setMessage(''), 3000);
                                                    setHasUnsavedChanges(false);
                                                } catch (error) {
                                                    console.error('Error assigning operator:', error);
                                                    setMessage('Error assigning operator. Please try again.');
                                                    setTimeout(() => setMessage(''), 3000);
                                                }
                                            }
                                        }}
                                        currentValue={assignedOperator}
                                        mixers={mixers}
                                        assignedPlant={assignedPlant}
                                        readOnly={!canEditMixer}
                                        operators={operatorModalOperators}
                                        onRefresh={async () => {
                                            await fetchOperatorsForModal();
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="form-section maintenance-info">
                            <h3>Maintenance Information</h3>
                            <div className="form-group">
                                <label>Last Service Date</label>
                                <input type="date" value={lastServiceDate ? formatDate(lastServiceDate) : ''} onChange={e => setLastServiceDate(e.target.value ? new Date(e.target.value) : null)} className="form-control" readOnly={!canEditMixer} />
                                {lastServiceDate && MixerUtility.isServiceOverdue(lastServiceDate) && <div className="warning-text">Service overdue</div>}
                            </div>
                            <div className="form-group">
                                <label>Last Chip Date</label>
                                <input type="date" value={lastChipDate ? formatDate(lastChipDate) : ''} onChange={e => setLastChipDate(e.target.value ? new Date(e.target.value) : null)} className="form-control" readOnly={!canEditMixer} />
                                {lastChipDate && MixerUtility.isChipOverdue(lastChipDate) && <div className="warning-text">Chip overdue</div>}
                            </div>
                            <div className="form-group">
                                <label>Cleanliness Rating</label>
                                <div className="cleanliness-rating-editor">
                                    <div className="star-input">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button key={star} type="button" className={`star-button ${star <= cleanlinessRating ? 'active' : ''} ${!canEditMixer ? 'disabled' : ''}`} onClick={() => canEditMixer && setCleanlinessRating(star === cleanlinessRating ? 0 : star)} aria-label={`Rate ${star} of 5 stars`} disabled={!canEditMixer}>
                                                <i className={`fas fa-star ${star <= cleanlinessRating ? 'filled' : ''}`} style={star <= cleanlinessRating ? {color: preferences.accentColor === 'red' ? '#b80017' : '#003896'} : {}}></i>
                                            </button>
                                        ))}
                                    </div>
                                    {cleanlinessRating > 0 && (
                                        <div className="rating-value-display">
                                            <span className="rating-label">{[null, 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][cleanlinessRating]}</span>
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
                                <input type="text" value={vin} onChange={e => setVin(e.target.value)} className="form-control" readOnly={!canEditMixer} />
                            </div>
                            <div className="form-group">
                                <label>Make</label>
                                <input type="text" value={make} onChange={e => setMake(e.target.value)} className="form-control" readOnly={!canEditMixer} />
                            </div>
                            <div className="form-group">
                                <label>Model</label>
                                <input type="text" value={model} onChange={e => setModel(e.target.value)} className="form-control" readOnly={!canEditMixer} />
                            </div>
                            <div className="form-group">
                                <label>Year</label>
                                <input type="text" value={year} onChange={e => setYear(e.target.value)} className="form-control" readOnly={!canEditMixer} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="form-actions">
                    {canEditMixer && (
                        <>
                            <button className="primary-button save-button" onClick={handleSave} disabled={isSaving} style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
                            <button className="danger-button" onClick={() => setShowDeleteConfirmation(true)} disabled={isSaving}>Delete Mixer</button>
                        </>
                    )}
                </div>
            </div>
            {showHistory && <MixerHistoryView mixer={mixer} onClose={() => setShowHistory(false)} />}
            {showDeleteConfirmation && (
                <div className="confirmation-modal" style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999}}>
                    <div className="confirmation-content" style={{width: '90%', maxWidth: '500px', margin: '0 auto'}}>
                        <h2>Confirm Delete</h2>
                        <p>Are you sure you want to delete Truck #{mixer.truckNumber}? This action cannot be undone.</p>
                        <div className="confirmation-actions" style={{display: 'flex', justifyContent: 'center', gap: '12px'}}>
                            <button className="cancel-button" onClick={() => setShowDeleteConfirmation(false)}>Cancel</button>
                            <button className="danger-button" onClick={handleDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
            {showUnsavedChangesModal && (
                <div className="confirmation-modal" style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.5)'}}>
                    <div className="confirmation-content" style={{width: '90%', maxWidth: '500px', margin: '0 auto'}}>
                        <h2>Unsaved Changes</h2>
                        <p>You have unsaved changes that will be lost if you navigate away. What would you like to do?</p>
                        <div className="confirmation-actions" style={{justifyContent: 'center', flexWrap: 'wrap', display: 'flex', gap: '12px'}}>
                            <button className="cancel-button" onClick={() => setShowUnsavedChangesModal(false)}>Continue Editing</button>
                            <button
                                className="primary-button"
                                onClick={async () => {
                                    setShowUnsavedChangesModal(false);
                                    try {
                                        await handleSave();
                                        setMessage('Changes saved successfully!');
                                        setTimeout(() => onClose(), 800);
                                    } catch (error) {
                                        setMessage('Error saving changes. Please try again.');
                                        setTimeout(() => setMessage(''), 3000);
                                    }
                                }}
                                disabled={!canEditMixer}
                                style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896', opacity: !canEditMixer ? '0.6' : '1', cursor: !canEditMixer ? 'not-allowed' : 'pointer'}}
                            >Save & Leave</button>
                            <button
                                className="danger-button"
                                onClick={() => {
                                    setShowUnsavedChangesModal(false);
                                    setHasUnsavedChanges(false);
                                    onClose();
                                }}
                            >Discard & Leave</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MixerDetailView;

