import React, {useEffect, useRef, useState} from 'react';
import {TractorService} from '../../services/TractorService';
import {PlantService} from '../../services/PlantService';
import {OperatorService} from '../../services/OperatorService';
import {UserService} from '../../services/UserService';
import {supabase} from '../../services/DatabaseService';
import {usePreferences} from '../../app/context/PreferencesContext';
import TractorHistoryView from './TractorHistoryView';
import TractorCommentModal from './TractorCommentModal';
import TractorIssueModal from './TractorIssueModal';
import TractorCard from './TractorCard';
import './styles/TractorDetailView.css';
import {TractorUtility} from "../../utils/TractorUtility";
import {Tractor} from "../../config/models/tractors/Tractor";
import LoadingScreen from "../common/LoadingScreen";
import OperatorSelectModal from "../mixers/OperatorSelectModal";

function TractorDetailView({tractorId, onClose}) {
    const {preferences} = usePreferences();
    const [tractor, setTractor] = useState(null);
    const [operators, setOperators] = useState([]);
    const [plants, setPlants] = useState([]);
    const [tractors, setTractors] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [showIssues, setShowIssues] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [updatedByEmail, setUpdatedByEmail] = useState(null);
    const [message, setMessage] = useState('');
    const [showOperatorModal, setShowOperatorModal] = useState(false);
    const [canEditTractor, setCanEditTractor] = useState(true);
    const [plantRestrictionReason, setPlantRestrictionReason] = useState('');
    const [originalValues, setOriginalValues] = useState({});
    const [truckNumber, setTruckNumber] = useState('');
    const [assignedOperator, setAssignedOperator] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [status, setStatus] = useState('');
    const [cleanlinessRating, setCleanlinessRating] = useState(0);
    const [lastServiceDate, setLastServiceDate] = useState(null);
    const [hasBlower, setHasBlower] = useState(false);
    const [vin, setVin] = useState('');
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [year, setYear] = useState('');
    const [freight, setFreight] = useState('');
    const [operatorModalOperators, setOperatorModalOperators] = useState([]);
    const [lastUnassignedOperatorId, setLastUnassignedOperatorId] = useState(null);
    const [comments, setComments] = useState([]);
    const [issues, setIssues] = useState([]);
    const tractorCardRef = useRef(null);

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const [tractorData, operatorsData, plantsData, allTractors] = await Promise.all([
                    TractorService.fetchTractorById(tractorId),
                    OperatorService.fetchOperators(),
                    PlantService.fetchPlants(),
                    TractorService.getAllTractors()
                ]);

                setTractor(tractorData);
                setOperators(operatorsData);
                setPlants(plantsData);
                setTractors(allTractors);

                setTruckNumber(tractorData.truckNumber || '');
                setAssignedOperator(tractorData.assignedOperator || '');
                setAssignedPlant(tractorData.assignedPlant || '');
                setStatus(tractorData.status || '');
                setCleanlinessRating(tractorData.cleanlinessRating || 0);
                setLastServiceDate(tractorData.lastServiceDate ? new Date(tractorData.lastServiceDate) : null);
                setHasBlower(tractorData.hasBlower || false);
                setVin(tractorData.vin || '');
                setMake(tractorData.make || '');
                setModel(tractorData.model || '');
                setYear(tractorData.year || '');
                setFreight(tractorData.freight || '');

                setOriginalValues({
                    truckNumber: tractorData.truckNumber || '',
                    assignedOperator: tractorData.assignedOperator || '',
                    assignedPlant: tractorData.assignedPlant || '',
                    status: tractorData.status || '',
                    cleanlinessRating: tractorData.cleanlinessRating || 0,
                    lastServiceDate: tractorData.lastServiceDate ? new Date(tractorData.lastServiceDate) : null,
                    hasBlower: tractorData.hasBlower || false,
                    vin: tractorData.vin || '',
                    make: tractorData.make || '',
                    model: tractorData.model || '',
                    year: tractorData.year || '',
                    freight: tractorData.freight || ''
                });

                document.documentElement.style.setProperty('--rating-value', tractorData.cleanlinessRating || 0);

                if (tractorData.updatedBy) {
                    try {
                        const userName = await UserService.getUserDisplayName(tractorData.updatedBy);
                        setUpdatedByEmail(userName);
                    } catch {
                        setUpdatedByEmail('Unknown User');
                    }
                }
            } catch (error) {
                console.error('Error fetching tractor details:', error);
            } finally {
                setIsLoading(false);
                setHasUnsavedChanges(false);
            }
        }

        fetchData();
    }, [tractorId]);

    useEffect(() => {
        async function checkPlantRestriction() {
            if (isLoading || !tractor) return;

            try {
                const userId = await UserService.getCurrentUser();
                if (!userId) return;

                const hasPermission = await UserService.hasPermission(userId, 'tractors.bypass.plantrestriction');
                if (hasPermission) return setCanEditTractor(true);

                const {data: profileData} = await supabase.from('users_profiles').select('plant_code').eq('id', userId).single();

                if (profileData && tractor) {
                    const isSamePlant = profileData.plant_code === tractor.assignedPlant;
                    setCanEditTractor(isSamePlant);
                    if (!isSamePlant) {
                        setPlantRestrictionReason(
                            `You cannot edit or verify this tractor because it belongs to plant ${tractor.assignedPlant} and you are assigned to plant ${profileData.plant_code}.`
                        );
                    }
                }
            } catch (error) {
                console.error('Error checking plant restriction:', error);
            }
        }

        checkPlantRestriction();
    }, [tractor, isLoading]);

    useEffect(() => {
        if (!originalValues.truckNumber || isLoading) return;

        const formatDateForComparison = date => date ? (date instanceof Date ? date.toISOString().split('T')[0] : '') : '';
        const hasChanges =
            truckNumber !== originalValues.truckNumber ||
            assignedPlant !== originalValues.assignedPlant ||
            status !== originalValues.status ||
            cleanlinessRating !== originalValues.cleanlinessRating ||
            formatDateForComparison(lastServiceDate) !== formatDateForComparison(originalValues.lastServiceDate) ||
            hasBlower !== originalValues.hasBlower ||
            vin !== originalValues.vin ||
            make !== originalValues.make ||
            model !== originalValues.model ||
            year !== originalValues.year ||
            freight !== originalValues.freight;

        setHasUnsavedChanges(hasChanges);
    }, [truckNumber, assignedPlant, status, cleanlinessRating, lastServiceDate, hasBlower, vin, make, model, year, freight, originalValues, isLoading]);

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
        if (!tractor?.id) {
            alert('Error: Cannot save tractor with undefined ID');
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

            let assignedOperatorValue = Object.prototype.hasOwnProperty.call(overrideValues, 'assignedOperator')
                ? overrideValues.assignedOperator
                : assignedOperator;

            let statusValue = Object.prototype.hasOwnProperty.call(overrideValues, 'status')
                ? overrideValues.status
                : status;

            if ((!assignedOperatorValue || assignedOperatorValue === '' || assignedOperatorValue === null) && statusValue === 'Active') {
                statusValue = 'Spare';
            }
            if (assignedOperatorValue && statusValue !== 'Active') {
                statusValue = 'Active';
            }
            if (['In Shop', 'Retired', 'Spare'].includes(statusValue) && assignedOperatorValue) {
                assignedOperatorValue = null;
            }

            let tractorForHistory = {
                ...tractor,
                assignedOperator: Object.prototype.hasOwnProperty.call(overrideValues, 'prevAssignedOperator')
                    ? overrideValues.prevAssignedOperator
                    : tractor.assignedOperator
            };

            let cleanlinessValue = overrideValues.cleanlinessRating ?? cleanlinessRating;
            if (!cleanlinessValue || isNaN(cleanlinessValue) || cleanlinessValue < 1) {
                cleanlinessValue = 1;
            }

            const updatedTractor = {
                ...tractor,
                id: tractor.id,
                truckNumber: overrideValues.truckNumber ?? truckNumber,
                assignedOperator: assignedOperatorValue || null,
                assignedPlant: overrideValues.assignedPlant ?? assignedPlant,
                status: statusValue,
                cleanlinessRating: cleanlinessValue,
                lastServiceDate: formatDate(overrideValues.lastServiceDate ?? lastServiceDate),
                hasBlower: overrideValues.hasBlower ?? hasBlower,
                vin: overrideValues.vin ?? vin,
                make: overrideValues.make ?? make,
                model: overrideValues.model ?? model,
                year: overrideValues.year ?? year,
                freight: overrideValues.freight ?? freight,
                updatedAt: new Date().toISOString(),
                updatedBy: userId,
                updatedLast: tractor.updatedLast
            };

            await TractorService.updateTractor(
                updatedTractor.id,
                updatedTractor,
                undefined,
                tractorForHistory
            );
            setTractor(updatedTractor);

            setMessage('Changes saved successfully! Tractor needs verification.');
            setTimeout(() => setMessage(''), 5000);

            setOriginalValues({
                truckNumber: updatedTractor.truckNumber,
                assignedOperator: updatedTractor.assignedOperator,
                assignedPlant: updatedTractor.assignedPlant,
                status: updatedTractor.status,
                cleanlinessRating: updatedTractor.cleanlinessRating,
                lastServiceDate: updatedTractor.lastServiceDate ? new Date(updatedTractor.lastServiceDate) : null,
                hasBlower: updatedTractor.hasBlower,
                vin: updatedTractor.vin,
                make: updatedTractor.make,
                model: updatedTractor.model,
                year: updatedTractor.year,
                freight: updatedTractor.freight || ''
            });

            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Error saving tractor:', error);
            alert(`Error saving changes: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete() {
        if (!tractor) return;
        if (!showDeleteConfirmation) return setShowDeleteConfirmation(true);

        try {
            await supabase.from('tractors').delete().eq('id', tractor.id);
            alert('Tractor deleted successfully');
            onClose();
        } catch (error) {
            console.error('Error deleting tractor:', error);
            alert('Error deleting tractor');
        } finally {
            setShowDeleteConfirmation(false);
        }
    }

    async function handleVerifyTractor() {
        if (!tractor) return

        const operatorName = getOperatorName(assignedOperator)
        if (
            status === 'Active' &&
            (
                assignedOperator === null ||
                assignedOperator === undefined ||
                assignedOperator === '0' ||
                (assignedOperator && operatorName === 'Unknown')
            )
        ) {
            setMessage('Cannot verify: Assigned operator is missing or invalid.')
            setTimeout(() => setMessage(''), 4000)
            return
        }

        setIsSaving(true)
        try {
            if (hasUnsavedChanges) {
                await handleSave().catch(error => {
                    console.error('Error saving changes before verification:', error)
                    alert('Failed to save your changes before verification. Please try saving manually first.')
                    throw new Error('Failed to save changes before verification')
                })
            }

            let userObj = await UserService.getCurrentUser()
            let userId = typeof userObj === 'object' && userObj !== null ? userObj.id : userObj

            const now = new Date().toISOString()
            const {data, error} = await supabase
                .from('tractors')
                .update({updated_last: now, updated_by: userId})
                .eq('id', tractor.id)
                .select()

            if (error) {
                console.error('Failed to verify tractor:', error)
                alert(`Error verifying tractor: ${error.message}`)
                setIsSaving(false)
                return
            }
            if (data?.length) {
                setTractor(Tractor.fromApiFormat(data[0]))
                setMessage('Tractor verified successfully!')
                setTimeout(() => setMessage(''), 3000)
            }

            setHasUnsavedChanges(false)

        } catch (error) {
            console.error('Error verifying tractor:', error)
            alert(`Error verifying tractor: ${error.message}`)
        } finally {
            setIsSaving(false)
        }
    }

    function handleBackClick() {
        if (hasUnsavedChanges) {
            handleSave()
        }
        onClose()
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
            const unassignedOperator = dbOperators.find(op => op.employeeId === lastUnassignedOperatorId);
            if (unassignedOperator) {
                dbOperators = [...dbOperators, unassignedOperator];
            }
        }
        setOperatorModalOperators(dbOperators);
    }

    async function refreshOperators() {
        const updatedOperators = await OperatorService.fetchOperators();
        setOperators(updatedOperators);
    }

    useEffect(() => {
        async function fetchCommentsAndIssues() {
            if (!tractorId) return;
            const {data: commentData} = await supabase
                .from('tractors_comments')
                .select('*')
                .eq('tractor_id', tractorId)
                .order('created_at', {ascending: false});
            setComments(Array.isArray(commentData) ? commentData.filter(c => c && (c.comment || c.text)) : []);
            const {data: issueData} = await supabase
                .from('tractors_maintenance')
                .select('*')
                .eq('tractor_id', tractorId)
                .order('time_created', {ascending: false});
            setIssues(Array.isArray(issueData) ? issueData.filter(i => i && (i.issue || i.title || i.description)) : []);
        }

        fetchCommentsAndIssues();
    }, [tractorId]);

    function handleExportEmail() {
        if (!tractor) return;
        const hasComments = comments && comments.length > 0;
        const openIssues = (issues || []).filter(issue => !issue.time_completed);
        let summary = `Tractor Summary for Truck #${tractor.truckNumber || ''}

Basic Information
Status: ${tractor.status || ''}
Assigned Plant: ${getPlantName(tractor.assignedPlant)}
Assigned Operator: ${getOperatorName(tractor.assignedOperator)}
Freight: ${tractor.freight || ''}
Cleanliness Rating: ${tractor.cleanlinessRating || 'N/A'}
Last Service Date: ${tractor.lastServiceDate ? new Date(tractor.lastServiceDate).toLocaleDateString() : 'N/A'}
Has Blower: ${tractor.hasBlower ? 'Yes' : 'No'}
VIN: ${tractor.vin || ''}
Make: ${tractor.make || ''}
Model: ${tractor.model || ''}
Year: ${tractor.year || ''}

Comments
${hasComments
            ? comments.map(c =>
                `- ${c.author || 'Unknown'}: ${c.comment || c.text} (${new Date(c.created_at || c.createdAt).toLocaleString()})`
            ).join('\n')
            : 'No comments.'}

Issues (${openIssues.length})
${openIssues.length > 0
            ? openIssues.map(i =>
                `- ${i.issue || i.title || i.description || ''} (${new Date(i.time_created || i.created_at).toLocaleString()})`
            ).join('\n')
            : 'No open issues.'}
`;
        const subject = encodeURIComponent(`Tractor Summary for Truck #${tractor.truckNumber || ''}`);
        const body = encodeURIComponent(summary);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }

    if (isLoading) {
        return (
            <div className="operator-detail-view">
                <div className="detail-header" style={{
                    backgroundColor: 'var(--detail-header-bg)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px'
                }}>
                    <button className="back-button" onClick={onClose} style={{marginRight: '8px'}}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1 style={{color: 'var(--text-primary)', textAlign: 'center', flex: 1, margin: '0 auto'}}>Tractor
                        Details</h1>
                    <div style={{width: '36px'}}></div>
                </div>
                <div className="detail-content">
                    <LoadingScreen message="Loading tractor details..." inline={true}/>
                </div>
            </div>
        );
    }

    if (!tractor) {
        return (
            <div className="tractor-detail-view">
                <div className="detail-header"
                     style={{backgroundColor: 'var(--detail-header-bg)', color: 'var(--text-primary)'}}>
                    <button className="back-button" onClick={onClose}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1>Tractor Not Found</h1>
                </div>
                <div className="error-message">
                    <p>Could not find the requested tractor. It may have been deleted.</p>
                    <button className="primary-button" onClick={onClose}>Return to Tractors</button>
                </div>
            </div>
        );
    }

    return (
        <div className="tractor-detail-view">
            {showComments && <TractorCommentModal tractorId={tractorId} tractorNumber={tractor?.truckNumber}
                                                  onClose={() => setShowComments(false)}/>}
            {showIssues && <TractorIssueModal tractorId={tractorId} tractorNumber={tractor?.truckNumber}
                                              onClose={() => setShowIssues(false)}/>}
            {isSaving && (
                <div className="saving-overlay">
                    <div className="saving-indicator"></div>
                </div>
            )}
            <div className="detail-header"
                 style={{backgroundColor: 'var(--detail-header-bg)', color: 'var(--text-primary)'}}>
                <div className="header-left">
                    <button className="back-button" onClick={handleBackClick} aria-label="Back to tractors">
                        <i className="fas fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                </div>
                <h1>Truck #{tractor.truckNumber || 'Not Assigned'}</h1>
                <div className="header-actions">
                    <button className="issues-button" style={{marginRight: 0}} onClick={handleExportEmail}>
                        <i className="fas fa-envelope"></i> Email
                    </button>
                    {canEditTractor && (
                        <>
                            <button className="issues-button" onClick={() => setShowIssues(true)}>
                                <i className="fas fa-tools"></i> Issues
                            </button>
                            <button className="comments-button" onClick={() => setShowComments(true)}>
                                <i className="fas fa-comments"></i> Comments
                            </button>
                        </>
                    )}
                    <button className="history-button" onClick={() => setShowHistory(true)}>
                        <i className="fas fa-history"></i>
                        <span>History</span>
                    </button>
                </div>
            </div>
            {!canEditTractor && (
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
                <div className="tractor-card-preview" style={{position: 'relative', zIndex: 0}}>
                    <div ref={tractorCardRef}>
                        <TractorCard tractor={tractor} operatorName={getOperatorName(tractor.assignedOperator)}
                                     plantName={getPlantName(tractor.assignedPlant)} showOperatorWarning={false}/>
                    </div>
                </div>
                <div className="detail-card">
                    <div className="card-header">
                        <h2>Verification Status</h2>
                    </div>
                    <div className="verification-card">
                        <div className="verification-card-header">
                            <i className="fas fa-clipboard-check"></i>
                            {Tractor.ensureInstance(tractor).isVerified() ? (
                                <div className="verification-badge verified">
                                    <i className="fas fa-check-circle"></i>
                                    <span>Verified</span>
                                </div>
                            ) : (
                                <div className="verification-badge needs-verification">
                                    <i className="fas fa-exclamation-circle"></i>
                                    <span>{!tractor.updatedLast || !tractor.updatedBy ? 'Needs Verification' : 'Verification Outdated'}</span>
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
                                        className="verification-value">{tractor.createdAt ? new Date(tractor.createdAt).toLocaleString() : 'Not Assigned'}</span>
                                </div>
                            </div>
                            <div className="verification-item">
                                <div className="verification-icon"
                                     style={{color: tractor.updatedLast ? (Tractor.ensureInstance(tractor).isVerified() ? '#10b981' : new Date(tractor.updatedAt) > new Date(tractor.updatedLast) ? '#ef4444' : '#f59e0b') : '#ef4444'}}>
                                    <i className="fas fa-calendar-check"></i>
                                </div>
                                <div className="verification-info">
                                    <span className="verification-label">Last Verified</span>
                                    <span className="verification-value"
                                          style={{color: tractor.updatedLast ? (Tractor.ensureInstance(tractor).isVerified() ? 'inherit' : new Date(tractor.updatedAt) > new Date(tractor.updatedLast) ? '#ef4444' : '#f59e0b') : '#ef4444'}}>
                                        {tractor.updatedLast ? `${new Date(tractor.updatedLast).toLocaleString()}${!Tractor.ensureInstance(tractor).isVerified() ? (new Date(tractor.updatedAt) > new Date(tractor.updatedLast) ? ' (Changes have been made)' : ' (It is a new week)') : ''}` : 'Never verified'}
                                    </span>
                                </div>
                            </div>
                            <div className="verification-item"
                                 title={`Last Updated: ${new Date(tractor.updatedAt).toLocaleString()}`}>
                                <div className="verification-icon"
                                     style={{color: tractor.updatedBy ? '#10b981' : '#ef4444'}}>
                                    <i className="fas fa-user-check"></i>
                                </div>
                                <div className="verification-info">
                                    <span className="verification-label">Verified By</span>
                                    <span className="verification-value"
                                          style={{color: tractor.updatedBy ? 'inherit' : '#ef4444'}}>{tractor.updatedBy ? (updatedByEmail || 'Unknown User') : 'No verification record'}</span>
                                </div>
                            </div>
                        </div>
                        <button className="verify-now-button" onClick={handleVerifyTractor} disabled={!canEditTractor}>
                            <i className="fas fa-check-circle"></i> Verify Now
                        </button>
                        <div className="verification-notice">
                            <i className="fas fa-info-circle"></i>
                            <p>Assets require verification after any changes are made and are reset weekly. <strong>Due:
                                Every Friday at 10:00 AM.</strong> Resets on Mondays at 5pm.</p>
                        </div>
                    </div>
                </div>
                <div className="detail-card">
                    <div className="card-header">
                        <h2>Tractor Information</h2>
                    </div>
                    <p className="edit-instructions">{canEditTractor ? "You can make changes below. Remember to save your changes." : "You are in read-only mode and cannot make changes to this tractor."}</p>
                    <div className="form-sections">
                        <div className="form-section basic-info">
                            <h3>Basic Information</h3>
                            <div className="form-group">
                                <label>Truck Number</label>
                                <input type="text" value={truckNumber} onChange={e => setTruckNumber(e.target.value)}
                                       className="form-control" readOnly={!canEditTractor}/>
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    value={status}
                                    onChange={async e => {
                                        const newStatus = e.target.value;
                                        if (
                                            assignedOperator &&
                                            originalValues.status === 'Active' &&
                                            ['In Shop', 'Retired', 'Spare'].includes(newStatus)
                                        ) {
                                            await handleSave({status: newStatus, assignedOperator: null});
                                            setStatus(newStatus);
                                            setAssignedOperator(null);
                                            setLastUnassignedOperatorId(assignedOperator);
                                            setMessage('Status changed and operator unassigned');
                                            setTimeout(() => setMessage(''), 3000);
                                            await refreshOperators();
                                            await fetchOperatorsForModal();
                                            const updatedTractor = await TractorService.fetchTractorById(tractorId);
                                            setTractor(updatedTractor);
                                        } else {
                                            setStatus(newStatus);
                                        }
                                    }}
                                    disabled={!canEditTractor}
                                    className="form-control"
                                >
                                    <option value="">Select Status</option>
                                    <option
                                        value="Active"
                                        disabled={!assignedOperator}
                                        style={!assignedOperator ? {
                                            color: 'var(--text-disabled)',
                                            backgroundColor: 'var(--background-disabled)'
                                        } : {}}
                                    >
                                        Active{!assignedOperator ? ' (Cannot set without an operator assigned)' : ''}
                                    </option>
                                    <option value="Spare">Spare</option>
                                    <option value="In Shop">In Shop</option>
                                    <option value="Retired">Retired</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Assigned Plant</label>
                                <select value={assignedPlant} onChange={e => setAssignedPlant(e.target.value)}
                                        disabled={!canEditTractor} className="form-control">
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
                                            if (canEditTractor) {
                                                await fetchOperatorsForModal();
                                                setShowOperatorModal(true);
                                            }
                                        }}
                                        type="button"
                                        disabled={!canEditTractor}
                                        style={!canEditTractor ? {
                                            cursor: 'not-allowed',
                                            opacity: 0.8,
                                            backgroundColor: '#f8f9fa'
                                        } : {}}
                                    >
                                        <span style={{display: 'block', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                            {assignedOperator ? getOperatorName(assignedOperator) : 'None (Click to select)'}
                                        </span>
                                    </button>
                                    {canEditTractor && (
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
                                                        const updatedTractor = await TractorService.fetchTractorById(tractorId);
                                                        setTractor(updatedTractor);
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
                                                    className="undo-operator-button unassign-operator-button"
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
                                                            const updatedTractor = await TractorService.fetchTractorById(tractorId);
                                                            setTractor(updatedTractor);
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
                                                    const updatedTractor = await TractorService.fetchTractorById(tractorId);
                                                    setTractor(updatedTractor);
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
                                        tractors={tractors}
                                        assignedPlant={assignedPlant}
                                        readOnly={!canEditTractor}
                                        operators={operatorModalOperators}
                                        onRefresh={async () => {
                                            await fetchOperatorsForModal();
                                        }}
                                    />
                                )}
                            </div>
                            <div className="form-group">
                                <label>Freight</label>
                                <select
                                    value={freight}
                                    onChange={e => setFreight(e.target.value)}
                                    disabled={!canEditTractor}
                                    className="form-control"
                                >
                                    <option value="">Select Freight</option>
                                    <option value="Cement">Cement</option>
                                    <option value="Aggregate">Aggregate</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-section maintenance-info">
                            <h3>Maintenance Information</h3>
                            <div className="form-group">
                                <label>Last Service Date</label>
                                <input type="date" value={lastServiceDate ? formatDate(lastServiceDate) : ''}
                                       onChange={e => setLastServiceDate(e.target.value ? new Date(e.target.value) : null)}
                                       className="form-control" readOnly={!canEditTractor}/>
                                {lastServiceDate && TractorUtility.isServiceOverdue(lastServiceDate) &&
                                    <div className="warning-text">Service overdue</div>}
                            </div>
                            <div className="form-group">
                                <label>Has Blower</label>
                                <select value={hasBlower ? 'Yes' : 'No'}
                                        onChange={e => setHasBlower(e.target.value === 'Yes')}
                                        disabled={!canEditTractor} className="form-control">
                                    <option value="No">No</option>
                                    <option value="Yes">Yes</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Cleanliness Rating</label>
                                <div className="cleanliness-rating-editor">
                                    <div className="star-input">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button key={star} type="button"
                                                    className={`star-button ${star <= cleanlinessRating ? 'active' : ''} ${!canEditTractor ? 'disabled' : ''}`}
                                                    onClick={() => canEditTractor && setCleanlinessRating(star === cleanlinessRating ? 0 : star)}
                                                    aria-label={`Rate ${star} of 5 stars`} disabled={!canEditTractor}>
                                                <i className={`fas fa-star ${star <= cleanlinessRating ? 'filled' : ''}`}
                                                   style={star <= cleanlinessRating ? {color: preferences.accentColor === 'red' ? '#b80017' : '#003896'} : {}}></i>
                                            </button>
                                        ))}
                                    </div>
                                    {cleanlinessRating > 0 && (
                                        <div className="rating-value-display">
                                            <span
                                                className="rating-label">{[null, 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][cleanlinessRating]}</span>
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
                                <input type="text" value={vin} onChange={e => setVin(e.target.value)}
                                       className="form-control" readOnly={!canEditTractor}/>
                            </div>
                            <div className="form-group">
                                <label>Make</label>
                                <input type="text" value={make} onChange={e => setMake(e.target.value)}
                                       className="form-control" readOnly={!canEditTractor}/>
                            </div>
                            <div className="form-group">
                                <label>Model</label>
                                <input type="text" value={model} onChange={e => setModel(e.target.value)}
                                       className="form-control" readOnly={!canEditTractor}/>
                            </div>
                            <div className="form-group">
                                <label>Year</label>
                                <input type="text" value={year} onChange={e => setYear(e.target.value)}
                                       className="form-control" readOnly={!canEditTractor}/>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="form-actions">
                    {canEditTractor && (
                        <>
                            <button className="primary-button save-button" onClick={handleSave}
                                    disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
                            <button className="danger-button" onClick={() => setShowDeleteConfirmation(true)}
                                    disabled={isSaving}>Delete Tractor
                            </button>
                        </>
                    )}
                </div>
            </div>
            {showHistory && <TractorHistoryView tractor={tractor} onClose={() => setShowHistory(false)}/>}
            {showDeleteConfirmation && (
                <div className="confirmation-modal" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 9999
                }}>
                    <div className="confirmation-content" style={{width: '90%', maxWidth: '500px', margin: '0 auto'}}>
                        <h2>Confirm Delete</h2>
                        <p>Are you sure you want to delete Truck #{tractor.truckNumber}? This action cannot be
                            undone.</p>
                        <div className="confirmation-actions"
                             style={{display: 'flex', justifyContent: 'center', gap: '12px'}}>
                            <button className="cancel-button" onClick={() => setShowDeleteConfirmation(false)}>Cancel
                            </button>
                            <button className="danger-button" onClick={handleDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TractorDetailView;
