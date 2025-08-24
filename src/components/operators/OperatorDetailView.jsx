import React, {useEffect, useState} from 'react';
import supabase from '../../services/DatabaseService';
import OperatorCard from './OperatorCard';
import './styles/OperatorDetailView.css';
import OperatorScheduledOffButton from './OperatorScheduledOffView';

function OperatorDetailView({operatorId, onClose, onScheduledOffSaved}) {
    const [operator, setOperator] = useState(null);
    const [plants, setPlants] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [smyrnaId, setSmyrnaId] = useState('');
    const [name, setName] = useState('');
    const [status, setStatus] = useState('');
    const [assignedPlant, setAssignedPlant] = useState('');
    const [position, setPosition] = useState('');
    const [pendingStartDate, setPendingStartDate] = useState('');
    const [isTrainer, setIsTrainer] = useState(false);
    const [assignedTrainer, setAssignedTrainer] = useState('');
    const [hasTrainingPermission, setHasTrainingPermission] = useState(false);
    const [updatedByEmail] = useState('');
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [hasUnsavedChanges] = useState(false);
    const [scheduledOffDays, setScheduledOffDays] = useState([]);
    const [rating, setRating] = useState(0);

    useEffect(() => {
        document.body.classList.add('in-detail-view');
        return () => {
            document.body.classList.remove('in-detail-view');
        };
    }, []);

    useEffect(() => {
        fetchData();
        fetchScheduledOff();
        fetchPlants();
        fetchTrainers();
    }, [operatorId]);

    const fetchPlants = async () => {
        const {data} = await supabase.from('plants').select('*');
        setPlants(data || []);
    };

    const fetchTrainers = async () => {
        const {data} = await supabase
            .from('operators')
            .select('employee_id, name, is_trainer')
            .eq('is_trainer', true);
        setTrainers((data || []).map(trainer => ({
            employeeId: trainer.employee_id,
            name: trainer.name
        })));
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const {data} = await supabase
                .from('operators')
                .select('*')
                .eq('employee_id', operatorId)
                .single();
            setOperator(data);
            setSmyrnaId(data.smyrna_id || '');
            setName(data.name || '');
            setStatus(data.status || '');
            setAssignedPlant(data.plant_code || '');
            setPosition(data.position || '');
            setPendingStartDate(data.pending_start_date || '');
            setIsTrainer(data.is_trainer || false);
            setAssignedTrainer(data.assigned_trainer || '');
            setHasTrainingPermission(true);
            setRating(typeof data.rating === 'number' ? data.rating : Number(data.rating) || 0);
        } catch (error) {
        }
        setIsLoading(false);
    };

    const fetchScheduledOff = async () => {
        if (!operatorId) return;
        const {data} = await supabase
            .from('operators_scheduled_off')
            .select('days_off')
            .eq('id', operatorId)
            .single();
        setScheduledOffDays(data && data.days_off ? data.days_off : []);
    };

    const handleBackClick = async () => {
        if (hasUnsavedChanges) {
            await handleSave();
        }
        if (onClose) onClose();
    };

    const handleDelete = async () => {
        setIsSaving(true);
        await supabase.from('operators').delete().eq('employee_id', operatorId);
        setIsSaving(false);
        if (onClose) onClose();
    };

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plant_code === plantCode);
        return plant ? plant.plant_name : plantCode || 'No Plant';
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage('');
        let updateObj = {
            smyrna_id: smyrnaId,
            name: name,
            status: status,
            plant_code: assignedPlant,
            position: position,
            is_trainer: isTrainer,
            assigned_trainer: assignedTrainer,
            pending_start_date: status === 'Pending Start' ? pendingStartDate : null,
            rating: typeof rating === 'number' ? rating : Number(rating) || 0
        }
        try {
            const {error} = await supabase
                .from('operators')
                .update(updateObj)
                .eq('employee_id', operatorId);
            if (error) {
                setMessage('Error saving changes. Please try again.');
            } else {
                setMessage('Changes saved successfully!');
                fetchData();
            }
        } catch (e) {
            setMessage('Error saving changes. Please try again.');
        }
        setIsSaving(false);
        setTimeout(() => setMessage(''), 3000);
    };

    if (isLoading) {
    }

    if (!operator) {
    }

    return (
        <div className="operator-detail-view">
            {isSaving && (
                <div className="saving-overlay">
                    <div className="saving-indicator"></div>
                </div>
            )}
            <div className="detail-header">
                <div className="header-left">
                    <button className="back-button" onClick={handleBackClick} aria-label="Back to operators">
                        <i className="fas fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1>{operator && operator.name ? operator.name : 'Operator Details'}</h1>
                </div>
                <div className="header-right">
                    <OperatorScheduledOffButton
                        operator={operator}
                        daysOff={scheduledOffDays}
                        onSave={days => {
                            setScheduledOffDays(days);
                            if (typeof onScheduledOffSaved === 'function') onScheduledOffSaved();
                        }}
                        refreshScheduledOff={fetchScheduledOff}
                    />
                </div>
            </div>
            <div className="detail-content">
                {message && (
                    <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                        {message}
                    </div>
                )}
                <div className="operator-card-preview">
                    <OperatorCard
                        operator={operator}
                        plantName={getPlantName(operator && operator.plantCode)}
                        showOperatorWarning={false}
                        rating={rating}
                    />
                </div>
                <div className="detail-card">
                    <div className="card-header">
                        <h2>Edit Information</h2>
                    </div>
                    <p className="edit-instructions">Make changes below and click Save when finished.</p>
                    <style>{`.form-group { margin-bottom: 25px !important; }`}</style>
                    <div className="metadata-info" style={{display: 'none'}}>
                        <div className="metadata-row">
                            <span className="metadata-label">Created:</span>
                            <span
                                className="metadata-value">{operator && operator.createdAt ? new Date(operator.createdAt).toLocaleString() : 'Not Assigned'}</span>
                        </div>
                        <div className="metadata-row">
                            <span className="metadata-label">Last Updated:</span>
                            <span
                                className="metadata-value">{operator && operator.updatedAt ? new Date(operator.updatedAt).toLocaleString() : 'Not Assigned'}</span>
                        </div>
                        {operator && operator.updatedBy && (
                            <div className="metadata-row">
                                <span className="metadata-label">Updated By:</span>
                                <span className="metadata-value">{updatedByEmail || 'Unknown User'}</span>
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label>Employee ID</label>
                        <input
                            type="text"
                            value={smyrnaId}
                            onChange={(e) => setSmyrnaId(e.target.value)}
                            className="form-control"
                        />
                    </div>
                    <div className="form-group">
                        <label>Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
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
                            <option value="Active">Active</option>
                            <option value="Light Duty">Light Duty</option>
                            <option value="Terminated">Terminated</option>
                            {hasTrainingPermission && <option value="Pending Start">Pending Start</option>}
                            {hasTrainingPermission && <option value="Training">Training</option>}
                            <option value="No Hire">No Hire</option>
                        </select>
                    </div>
                    {status === 'Pending Start' && (
                        <div className="form-group">
                            <label>Pending Start Date</label>
                            <input
                                type="date"
                                value={pendingStartDate || ''}
                                onChange={e => setPendingStartDate(e.target.value)}
                                className="form-control"
                            />
                        </div>
                    )}
                    <div className="form-group">
                        <label>Assigned Plant</label>
                        <select
                            value={assignedPlant}
                            onChange={(e) => setAssignedPlant(e.target.value)}
                            className="form-control"
                        >
                            <option value="">Select Plant</option>
                            {plants.sort((a, b) => {
                                const aCode = parseInt(a.plant_code?.replace(/\D/g, '') || '0');
                                const bCode = parseInt(b.plant_code?.replace(/\D/g, '') || '0');
                                return aCode - bCode;
                            }).map(plant => (
                                <option key={plant.plant_code} value={plant.plant_code}>
                                    ({plant.plant_code}) {plant.plant_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Position</label>
                        <select
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            className="form-control"
                        >
                            <option value="">Select Position</option>
                            <option value="Mixer Operator">Mixer Operator</option>
                            <option value="Tractor Operator">Tractor Operator</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Rating</label>
                        <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <span
                                    key={star}
                                    style={{
                                        cursor: 'pointer',
                                        fontSize: 24,
                                        lineHeight: 1,
                                        userSelect: 'none'
                                    }}
                                    onClick={() => setRating(star)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') setRating(star);
                                    }}
                                    tabIndex={0}
                                    aria-label={`Set rating to ${star} star${star > 1 ? 's' : ''}`}
                                    role="button"
                                >
                                    {star <= rating ? '★' : '☆'}
                                </span>
                            ))}
                            <span style={{marginLeft: 8}}>{rating > 0 ? `${rating} / 5` : 'Not Rated'}</span>
                        </div>
                    </div>
                </div>
                {hasTrainingPermission && (
                    <div className="detail-card">
                        <h2>Training Information</h2>
                        <div className="form-group">
                            <label>Trainer Status</label>
                            <select
                                id="trainer-status"
                                className="form-control"
                                value={isTrainer ? "true" : "false"}
                                onChange={(e) => {
                                    const isTrainerValue = e.target.value === "true";
                                    setIsTrainer(isTrainerValue);
                                    if (isTrainerValue) {
                                        setAssignedTrainer(null);
                                    }
                                }}
                            >
                                <option value="false">Not a Trainer</option>
                                <option value="true">Trainer</option>
                            </select>
                        </div>
                        {status === 'Training' && (
                            <div className="form-group">
                                <label>Assigned Trainer</label>
                                <select
                                    value={assignedTrainer}
                                    onChange={(e) => setAssignedTrainer(e.target.value)}
                                    className="form-control"
                                    disabled={isTrainer}
                                >
                                    <option value="">None</option>
                                    {trainers.map(trainer => (
                                        <option key={trainer.employeeId} value={trainer.employeeId}>
                                            {trainer.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                )}
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
                        Delete Operator
                    </button>
                </div>
            </div>
            {showDeleteConfirmation && (
                <div className="confirmation-modal">
                    <div className="confirmation-content">
                        <h2>Confirm Delete</h2>
                        <p>Are you sure you want to delete {operator && operator.name}? This action cannot be
                            undone.</p>
                        <div className="confirmation-actions">
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

export default OperatorDetailView;
