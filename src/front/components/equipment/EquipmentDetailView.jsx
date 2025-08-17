import React, {useEffect, useRef, useState} from 'react';
import {EquipmentService} from '../../../services/EquipmentService';
import {PlantService} from '../../../services/PlantService';
import {UserService} from '../../../services/UserService';
import {supabase} from '../../../services/DatabaseService';
import {usePreferences} from '../../../app/context/PreferencesContext';
import EquipmentCommentModal from './EquipmentCommentModal';
import EquipmentIssueModal from './EquipmentIssueModal';
import EquipmentCard from './EquipmentCard';
import EquipmentUtility from '../../../utils/EquipmentUtility';
import EquipmentHistoryView from './EquipmentHistoryView';
import './styles/EquipmentDetailView.css';
import LoadingScreen from '../common/LoadingScreen';

function EquipmentDetailView({equipmentId, onClose}) {
    const {preferences} = usePreferences();
    const [equipment, setEquipment] = useState(null);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [showIssues, setShowIssues] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [message, setMessage] = useState('');
    const [canEditEquipment, setCanEditEquipment] = useState(true);
    const [plantRestrictionReason, setPlantRestrictionReason] = useState('');
    const [originalValues, setOriginalValues] = useState({});
    const [identifyingNumber, setIdentifyingNumber] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [equipmentType, setEquipmentType] = useState('');
    const [status, setStatus] = useState('');
    const [cleanlinessRating, setCleanlinessRating] = useState(0);
    const [conditionRating, setConditionRating] = useState(0);
    const [lastServiceDate, setLastServiceDate] = useState(null);
    const [hoursMileage, setHoursMileage] = useState('');
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [year, setYear] = useState('');
    const [comments, setComments] = useState([]);
    const [issues, setIssues] = useState([]);
    const equipmentCardRef = useRef(null);

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const [equipmentData, plantsData] = await Promise.all([
                    EquipmentService.fetchEquipmentById(equipmentId),
                    PlantService.fetchPlants()
                ]);

                setEquipment(equipmentData);
                setPlants(plantsData);

                setIdentifyingNumber(equipmentData.identifyingNumber || '');
                setAssignedPlant(equipmentData.assignedPlant || '');
                setEquipmentType(equipmentData.equipmentType || '');
                setStatus(equipmentData.status || '');
                setCleanlinessRating(equipmentData.cleanlinessRating || 0);
                setConditionRating(equipmentData.conditionRating || 0);
                setLastServiceDate(equipmentData.lastServiceDate ? new Date(equipmentData.lastServiceDate) : null);
                setHoursMileage(equipmentData.hoursMileage || '');
                setMake(equipmentData.equipmentMake || '');
                setModel(equipmentData.equipmentModel || '');
                setYear(equipmentData.yearMade || '');

                setOriginalValues({
                    identifyingNumber: equipmentData.identifyingNumber || '',
                    assignedPlant: equipmentData.assignedPlant || '',
                    equipmentType: equipmentData.equipmentType || '',
                    status: equipmentData.status || '',
                    cleanlinessRating: equipmentData.cleanlinessRating || 0,
                    conditionRating: equipmentData.conditionRating || 0,
                    lastServiceDate: equipmentData.lastServiceDate ? new Date(equipmentData.lastServiceDate) : null,
                    hoursMileage: equipmentData.hoursMileage || '',
                    make: equipmentData.equipmentMake || '',
                    model: equipmentData.equipmentModel || '',
                    year: equipmentData.yearMade || ''
                });
            } catch (error) {
                console.error('Error fetching equipment details:', error);
            } finally {
                setIsLoading(false);
                setHasUnsavedChanges(false);
            }
        }

        fetchData();
    }, [equipmentId]);

    useEffect(() => {
        async function checkPlantRestriction() {
            if (isLoading || !equipment) return;

            try {
                const userId = await UserService.getCurrentUser();
                if (!userId) return;

                const hasPermission = await UserService.hasPermission(userId, 'equipments.bypass.plantrestriction');
                if (hasPermission) return setCanEditEquipment(true);

                const {data: profileData} = await supabase.from('users_profiles').select('plant_code').eq('id', userId).single();
                if (profileData && equipment) {
                    const isSamePlant = profileData.plant_code === equipment.assignedPlant;
                    setCanEditEquipment(isSamePlant);
                    if (!isSamePlant) {
                        setPlantRestrictionReason(
                            `You cannot edit this equipment because it belongs to plant ${equipment.assignedPlant} and you are assigned to plant ${profileData.plant_code}.`
                        );
                    }
                }
            } catch (error) {
                console.error('Error checking plant restriction:', error);
            }
        }

        checkPlantRestriction();
    }, [equipment, isLoading]);

    useEffect(() => {
        if (!originalValues.identifyingNumber || isLoading) return;

        const formatDateForComparison = date => date ? (date instanceof Date ? date.toISOString().split('T')[0] : '') : '';
        const hasChanges =
            identifyingNumber !== originalValues.identifyingNumber ||
            assignedPlant !== originalValues.assignedPlant ||
            equipmentType !== originalValues.equipmentType ||
            status !== originalValues.status ||
            cleanlinessRating !== originalValues.cleanlinessRating ||
            conditionRating !== originalValues.conditionRating ||
            formatDateForComparison(lastServiceDate) !== formatDateForComparison(originalValues.lastServiceDate) ||
            hoursMileage !== originalValues.hoursMileage ||
            make !== originalValues.make ||
            model !== originalValues.model ||
            year !== originalValues.year;

        setHasUnsavedChanges(hasChanges);
    }, [identifyingNumber, assignedPlant, equipmentType, status, cleanlinessRating, conditionRating, lastServiceDate, hoursMileage, make, model, year, originalValues, isLoading]);

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

    async function handleSave() {
        if (!equipment?.id) {
            alert('Error: Cannot save equipment with undefined ID');
            return;
        }

        setIsSaving(true);
        try {
            const userId = await UserService.getCurrentUser();

            const updatedEquipment = {
                ...equipment,
                id: equipment.id,
                identifyingNumber,
                assignedPlant,
                equipmentType,
                status,
                cleanlinessRating: cleanlinessRating || null,
                conditionRating: conditionRating || null,
                lastServiceDate,
                hoursMileage: hoursMileage ? parseFloat(hoursMileage) : null,
                equipmentMake: make,
                equipmentModel: model,
                yearMade: year ? parseInt(year) : null,
                updatedAt: new Date().toISOString(),
                updatedBy: userId
            };

            await EquipmentService.updateEquipment(updatedEquipment.id, updatedEquipment, userId);
            setEquipment(updatedEquipment);

            setMessage('Changes saved successfully!');
            setTimeout(() => setMessage(''), 5000);

            setOriginalValues({
                identifyingNumber: updatedEquipment.identifyingNumber,
                assignedPlant: updatedEquipment.assignedPlant,
                equipmentType: updatedEquipment.equipmentType,
                status: updatedEquipment.status,
                cleanlinessRating: updatedEquipment.cleanlinessRating,
                conditionRating: updatedEquipment.conditionRating,
                lastServiceDate: updatedEquipment.lastServiceDate ? new Date(updatedEquipment.lastServiceDate) : null,
                hoursMileage: updatedEquipment.hoursMileage,
                make: updatedEquipment.equipmentMake,
                model: updatedEquipment.equipmentModel,
                year: updatedEquipment.yearMade
            });

            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Error saving equipment:', error);
            alert(`Error saving changes: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete() {
        if (!equipment) return;
        if (!showDeleteConfirmation) return setShowDeleteConfirmation(true);

        try {
            await EquipmentService.deleteEquipment(equipment.id);
            alert('Equipment deleted successfully');
            onClose();
        } catch (error) {
            console.error('Error deleting equipment:', error);
            alert('Error deleting equipment');
        } finally {
            setShowDeleteConfirmation(false);
        }
    }

    async function handleBackClick() {
        if (hasUnsavedChanges) {
            await handleSave();
        }
        onClose();
    }

    function getPlantName(plantCode) {
        const plant = plants.find(p => p.plantCode === plantCode);
        return plant ? plant.plantName : plantCode;
    }

    function formatDate(date) {
        if (!date) return '';
        return date instanceof Date ? date.toISOString().split('T')[0] : date;
    }

    useEffect(() => {
        async function fetchCommentsAndIssues() {
            if (!equipmentId) return;
            try {
                const comments = await EquipmentService.fetchComments(equipmentId);
                setComments(Array.isArray(comments) ? comments.filter(c => c && (c.comment || c.text)) : []);
                const issues = await EquipmentService.fetchIssues(equipmentId);
                setIssues(Array.isArray(issues) ? issues.filter(i => i && (i.issue || i.title || i.description)) : []);
            } catch {
                setComments([]);
                setIssues([]);
            }
        }

        fetchCommentsAndIssues();
    }, [equipmentId]);

    function handleExportEmail() {
        if (!equipment) return;
        const hasComments = comments && comments.length > 0;
        const openIssues = (issues || []).filter(issue => !issue.time_completed);
        let summary = `Equipment Summary for ${equipment.equipmentType} #${equipment.identifyingNumber || ''}

Basic Information
Status: ${equipment.status || ''}
Assigned Plant: ${getPlantName(equipment.assignedPlant)}
Equipment Type: ${equipment.equipmentType || ''}
Cleanliness Rating: ${equipment.cleanlinessRating || 'N/A'}
Condition Rating: ${equipment.conditionRating || 'N/A'}
Last Service Date: ${equipment.lastServiceDate ? new Date(equipment.lastServiceDate).toLocaleDateString() : 'N/A'}
Hours/Mileage: ${equipment.hoursMileage || 'N/A'}
Make: ${equipment.equipmentMake || ''}
Model: ${equipment.equipmentModel || ''}
Year: ${equipment.yearMade || ''}

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
        const subject = encodeURIComponent(`Equipment Summary for ${equipment.equipmentType} #${equipment.identifyingNumber || ''}`);
        const body = encodeURIComponent(summary);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }

    if (isLoading) {
        return (
            <div className="equipment-detail-view">
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
                    <h1 style={{color: 'var(--text-primary)', textAlign: 'center', flex: 1, margin: '0 auto'}}>Equipment
                        Details</h1>
                    <div style={{width: '36px'}}></div>
                </div>
                <div className="detail-content">
                    <LoadingScreen message="Loading equipment details..." inline={true}/>
                </div>
            </div>
        );
    }

    if (!equipment) {
        return (
            <div className="equipment-detail-view">
                <div className="detail-header"
                     style={{backgroundColor: 'var(--detail-header-bg)', color: 'var(--text-primary)'}}>
                    <button className="back-button" onClick={onClose}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1>Equipment Not Found</h1>
                </div>
                <div className="error-message">
                    <p>Could not find the requested equipment. It may have been deleted.</p>
                    <button className="primary-button" onClick={onClose}>Return to Equipment</button>
                </div>
            </div>
        );
    }

    return (
        <div className="equipment-detail-view">
            {showComments &&
                <EquipmentCommentModal equipmentId={equipmentId} equipmentNumber={equipment?.identifyingNumber}
                                       onClose={() => setShowComments(false)}/>}
            {showIssues && <EquipmentIssueModal equipmentId={equipmentId} equipmentNumber={equipment?.identifyingNumber}
                                                onClose={() => setShowIssues(false)}/>}
            {showHistory && (
                <EquipmentHistoryView
                    equipment={equipment}
                    onClose={() => setShowHistory(false)}
                />
            )}
            {isSaving && (
                <div className="saving-overlay">
                    <div className="saving-indicator"></div>
                </div>
            )}
            <div className="detail-header"
                 style={{backgroundColor: 'var(--detail-header-bg)', color: 'var(--text-primary)'}}>
                <div className="header-left">
                    <button className="back-button" onClick={() => handleBackClick()} aria-label="Back to equipment">
                        <i className="fas fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                </div>
                <h1>{equipment.equipmentType} #{equipment.identifyingNumber || 'Not Assigned'}</h1>
                <div className="header-actions">
                    <button className="issues-button" style={{marginRight: 0}} onClick={handleExportEmail}>
                        <i className="fas fa-envelope"></i> Email
                    </button>
                    {canEditEquipment && (
                        <>
                            <button className="issues-button" onClick={() => setShowIssues(true)}>
                                <i className="fas fa-tools"></i> Issues
                            </button>
                            <button className="comments-button" onClick={() => setShowComments(true)}>
                                <i className="fas fa-comments"></i> Comments
                            </button>
                            <button className="history-button" onClick={() => setShowHistory(true)}>
                                <i className="fas fa-history"></i> History
                            </button>
                        </>
                    )}
                </div>
            </div>
            {!canEditEquipment && (
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
                <div className="equipment-card-preview" style={{position: 'relative', zIndex: 0}}>
                    <div ref={equipmentCardRef}>
                        <EquipmentCard equipment={equipment} plantName={getPlantName(equipment.assignedPlant)}/>
                    </div>
                </div>
                <div className="detail-card">
                    <div className="card-header">
                        <h2>Equipment Information</h2>
                    </div>
                    <p className="edit-instructions">{canEditEquipment ? "You can make changes below. Remember to save your changes." : "You are in read-only mode and cannot make changes to this equipment."}</p>
                    <div className="form-sections">
                        <div className="form-section basic-info">
                            <h3>Basic Information</h3>
                            <div className="form-group">
                                <label>Identifying Number</label>
                                <input type="text" value={identifyingNumber}
                                       onChange={e => setIdentifyingNumber(e.target.value)} className="form-control"
                                       readOnly={!canEditEquipment}/>
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select value={status} onChange={e => setStatus(e.target.value)}
                                        disabled={!canEditEquipment} className="form-control">
                                    <option value="">Select Status</option>
                                    <option value="Active">Active</option>
                                    <option value="Spare">Spare</option>
                                    <option value="In Shop">In Shop</option>
                                    <option value="Retired">Retired</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Assigned Plant</label>
                                <select value={assignedPlant} onChange={e => setAssignedPlant(e.target.value)}
                                        disabled={!canEditEquipment} className="form-control">
                                    <option value="">Select Plant</option>
                                    {plants.map(plant => (
                                        <option key={plant.plantCode} value={plant.plantCode}>{plant.plantName}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Equipment Type</label>
                                <select value={equipmentType} onChange={e => setEquipmentType(e.target.value)}
                                        disabled={!canEditEquipment} className="form-control">
                                    <option value="">Select Type</option>
                                    <option value="Front-End Loader">Front-End Loader</option>
                                    <option value="Excavator">Excavator</option>
                                    <option value="Mini-Excavator">Mini-Excavator</option>
                                    <option value="Skid Steer">Skid Steer</option>
                                    <option value="Forklift">Forklift</option>
                                    <option value="Manlift">Manlift</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-section maintenance-info">
                            <h3>Maintenance Information</h3>
                            <div className="form-group">
                                <label>Last Service Date</label>
                                <input type="date" value={lastServiceDate ? formatDate(lastServiceDate) : ''}
                                       onChange={e => setLastServiceDate(e.target.value ? new Date(e.target.value) : null)}
                                       className="form-control" readOnly={!canEditEquipment}/>
                                {lastServiceDate && EquipmentUtility.isServiceOverdue(lastServiceDate) &&
                                    <div className="warning-text">Service overdue</div>}
                            </div>
                            <div className="form-group">
                                <label>Hours/Mileage</label>
                                <input type="number" value={hoursMileage}
                                       onChange={e => setHoursMileage(e.target.value)} className="form-control"
                                       readOnly={!canEditEquipment} min="0"/>
                            </div>
                            <div className="form-group">
                                <label>Cleanliness Rating</label>
                                <div className="cleanliness-rating-editor">
                                    <div className="star-input">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button
                                                key={star}
                                                type="button"
                                                className={`star-button ${star <= cleanlinessRating ? 'active' : ''} ${!canEditEquipment ? 'disabled' : ''}`}
                                                onClick={() => canEditEquipment && setCleanlinessRating(star === cleanlinessRating ? 0 : star)}
                                                aria-label={`Rate ${star} of 5 stars`}
                                                disabled={!canEditEquipment}
                                            >
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
                            <div className="form-group">
                                <label>Condition Rating</label>
                                <div className="condition-rating-editor">
                                    <div className="star-input">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button
                                                key={star}
                                                type="button"
                                                className={`star-button ${star <= conditionRating ? 'active' : ''} ${!canEditEquipment ? 'disabled' : ''}`}
                                                onClick={() => canEditEquipment && setConditionRating(star === conditionRating ? 0 : star)}
                                                aria-label={`Rate ${star} of 5 stars`}
                                                disabled={!canEditEquipment}
                                            >
                                                <i className={`fas fa-star ${star <= conditionRating ? 'filled' : ''}`}
                                                   style={star <= conditionRating ? {color: preferences.accentColor === 'red' ? '#b80017' : '#003896'} : {}}></i>
                                            </button>
                                        ))}
                                    </div>
                                    {conditionRating > 0 && (
                                        <div className="rating-value-display">
                                            <span
                                                className="rating-label">{[null, 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][conditionRating]}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="form-section vehicle-info">
                            <h3>Asset Details</h3>
                            <div className="form-group">
                                <label>Make</label>
                                <input type="text" value={make} onChange={e => setMake(e.target.value)}
                                       className="form-control" readOnly={!canEditEquipment}/>
                            </div>
                            <div className="form-group">
                                <label>Model</label>
                                <input type="text" value={model} onChange={e => setModel(e.target.value)}
                                       className="form-control" readOnly={!canEditEquipment}/>
                            </div>
                            <div className="form-group">
                                <label>Year</label>
                                <input type="number" value={year} onChange={e => setYear(e.target.value)}
                                       className="form-control" readOnly={!canEditEquipment} min="1900"
                                       max={new Date().getFullYear()}/>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="form-actions">
                    {canEditEquipment && (
                        <>
                            <button className="primary-button save-button" onClick={handleSave}
                                    disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
                            <button className="danger-button" onClick={() => setShowDeleteConfirmation(true)}
                                    disabled={isSaving}>Delete Equipment
                            </button>
                        </>
                    )}
                </div>
            </div>
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
                        <p>Are you sure you want to delete {equipment.equipmentType} #{equipment.identifyingNumber}?
                            This action cannot be undone.</p>
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

export default EquipmentDetailView;

