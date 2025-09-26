import React, {useEffect, useMemo, useState} from 'react';
import {ListService} from '../../services/ListService';
import {UserService} from '../../services/UserService';
import {usePreferences} from '../../app/context/PreferencesContext';
import LoadingScreen from '../common/LoadingScreen';
import GrammarUtility from '../../utils/GrammarUtility';
import './styles/ListDetailView.css';
import './styles/ScrollStyles.css';
import {RegionService} from '../../services/RegionService';

function ListDetailView({itemId, onClose}) {
    const {preferences} = usePreferences();
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [plant, setPlant] = useState(null);
    const [creator, setCreator] = useState(null);
    const [completer, setCompleter] = useState(null);
    const [editing, setEditing] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [formData, setFormData] = useState({description: '', plantCode: '', deadline: '', comments: ''});
    const [plants, setPlants] = useState([]);
    const [message, setMessage] = useState({text: '', type: ''});
    const [regionPlantCodes, setRegionPlantCodes] = useState(new Set());

    useEffect(() => {
        if (itemId) {
            Promise.all([fetchItem(), fetchPlants()]).catch(() => {
            });
        }
        return () => {
        };
    }, [itemId]);

    async function fetchItem() {
        setLoading(true);
        try {
            const items = await ListService.fetchListItems();
            const found = items.find(i => i.id === itemId);
            setItem(found);
            setFormData({
                description: found?.description || '',
                plantCode: found?.plant_code || '',
                deadline: ListService.formatDateForInput(found?.deadline) || '',
                comments: found?.comments || ''
            });
            const plantData = ListService.plants.find(p => p.plant_code === found?.plant_code);
            setPlant(plantData);
            setCreator(ListService.creatorProfiles[found?.user_id]);
            setCompleter(ListService.creatorProfiles[found?.completed_by]);
        } catch {
            showMessage('Failed to load item details', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function fetchPlants() {
        try {
            const plantsData = await ListService.fetchPlants();
            setPlants(plantsData);
        } catch {
            showMessage('Failed to load plants', 'error');
        }
    }

    useEffect(() => {
        let cancelled = false;

        async function loadAllowed() {
            let regionCode = preferences.selectedRegion?.code || '';
            try {
                if (!regionCode) {
                    const user = await UserService.getCurrentUser();
                    const uid = user?.id || '';
                    if (uid) {
                        const profilePlant = await UserService.getUserPlant(uid);
                        const plantCode = typeof profilePlant === 'string' ? profilePlant : (profilePlant?.plant_code || profilePlant?.plantCode || '');
                        if (plantCode) {
                            const regions = await RegionService.fetchRegionsByPlantCode(plantCode);
                            const r = Array.isArray(regions) && regions.length ? regions[0] : null;
                            regionCode = r ? (r.regionCode || r.region_code || '') : '';
                        }
                    }
                }
                if (!regionCode) {
                    if (!cancelled) setRegionPlantCodes(new Set());
                    return;
                }
                const regionPlants = await RegionService.fetchRegionPlants(regionCode);
                if (cancelled) return;
                const codes = new Set(regionPlants.map(p => String(p.plantCode || p.plant_code || '').trim().toUpperCase()).filter(Boolean));
                setRegionPlantCodes(codes);
                if (formData.plantCode && !codes.has(String(formData.plantCode).trim().toUpperCase()))
                    setFormData(prev => ({...prev, plantCode: prev.plantCode}));
            } catch {
                if (!cancelled) setRegionPlantCodes(new Set());
            }
        }

        loadAllowed();

        return () => {
            cancelled = true
        };
    }, [preferences.selectedRegion?.code, formData.plantCode]);

    const filteredPlants = useMemo(() => {
        if (!regionPlantCodes || regionPlantCodes.size === 0) return plants;
        return plants.filter(p => regionPlantCodes.has(String(p.plant_code || '').trim().toUpperCase()));
    }, [plants, regionPlantCodes]);

    function handleChange(e) {
        setFormData(prev => ({...prev, [e.target.name]: e.target.value}));
    }

    function showMessage(text, type = 'success', duration = 3000) {
        setMessage({text, type});
        if (duration) setTimeout(() => setMessage({text: '', type: ''}), duration);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            if (!formData.description.trim()) return showMessage('Description is required', 'error');
            const deadlineDate = new Date(formData.deadline);
            if (isNaN(deadlineDate.getTime())) return showMessage('Invalid deadline date', 'error');
            await ListService.updateListItem({
                ...item,
                description: formData.description,
                plant_code: formData.plantCode || null,
                deadline: deadlineDate.toISOString(),
                comments: formData.comments || null
            });
            await fetchItem();
            setEditing(false);
            showMessage('Changes saved successfully!');
        } catch {
            showMessage('Failed to update completion status', 'error', 5000);
        }
    }

    async function handleToggleCompletion() {
        try {
            const user = await UserService.getCurrentUser();
            const userId = user?.id;
            await ListService.toggleCompletion(item, userId);
            showMessage(!item.completed ? 'Item marked as complete' : 'Item marked as incomplete');
            onClose();
        } catch {
            showMessage('Failed to update completion status', 'error');
        }
    }

    async function handleDelete() {
        try {
            await ListService.deleteListItem(itemId);
            onClose();
        } catch {
            showMessage('Failed to delete item', 'error');
            setShowDeleteConfirmation(false);
        }
    }

    const statusInfo = ListService.calculateStatusInfo(item);

    useEffect(() => {
        function onKeyDown(e) {
            const tag = (e.target && e.target.tagName) || ''
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
            const key = (e.key || '').toLowerCase()
            if (key === 'escape') {
                e.preventDefault()
                onClose?.()
            } else if (key === 'e') {
                e.preventDefault()
                setEditing(prev => !prev)
            } else if (key === 'c') {
                e.preventDefault()
                handleToggleCompletion()
            } else if (key === 'delete' || key === 'backspace') {
                e.preventDefault()
                setShowDeleteConfirmation(true)
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    if (loading) {
        return (
            <div className="list-popup-outer" style={{willChange: 'transform', backfaceVisibility: 'hidden'}}>
                <div className="list-popup-inner" style={{willChange: 'opacity, transform'}}>
                    <div className="list-popup-header">
                        <div>
                            <button className="list-back-button" onClick={onClose} aria-label="Back">
                                <i className="fas fa-arrow-left"></i>
                                <span>Back</span>
                            </button>
                        </div>
                    </div>
                    <div className="list-popup-content">
                        <LoadingScreen message="Loading item details..." inline={true}/>
                    </div>
                </div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="list-popup-outer" style={{willChange: 'transform', backfaceVisibility: 'hidden'}}>
                <div className="list-popup-inner" style={{willChange: 'opacity, transform'}}>
                    <div className="list-popup-header">
                        <div>
                            <button className="list-back-button" onClick={onClose} aria-label="Back">
                                <i className="fas fa-arrow-left"></i>
                                <span>Back</span>
                            </button>
                        </div>
                    </div>
                    <div className="list-popup-content">
                        <div className="error-state">
                            <i className="fas fa-exclamation-triangle"></i>
                            <h2>Item Not Found</h2>
                            <p>The requested item could not be found or has been deleted.</p>
                            <button className="primary-button" onClick={onClose}>Go Back</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="list-popup-outer" style={{willChange: 'transform', backfaceVisibility: 'hidden'}}>
            <div className="list-popup-inner" style={{willChange: 'opacity, transform'}}>
                <div className="list-popup-header">
                    <div>
                        <button className="list-back-button" onClick={onClose} aria-label="Back">
                            <i className="fas fa-arrow-left"></i>
                            <span>Back</span>
                        </button>
                    </div>
                </div>
                <div className="list-popup-content">
                    <div className="detail-left">
                        {message.text && (
                            <div className={`message ${message.type}`}>
                                <i className={`fas fa-${message.type === 'error' ? 'exclamation-circle' : 'check-circle'}`}></i>
                                <span>{message.text}</span>
                            </div>
                        )}
                        {editing ? (
                            <div className="edit-form-container">
                                <form onSubmit={handleSubmit} className="edit-form">
                                    <div className="form-group">
                                        <label htmlFor="description">Description <span
                                            className="required">*</span></label>
                                        <input
                                            type="text"
                                            id="description"
                                            name="description"
                                            value={formData.description}
                                            onChange={handleChange}
                                            onBlur={() => setFormData(prev => ({
                                                ...prev,
                                                description: GrammarUtility.cleanDescription(prev.description)
                                            }))}
                                            className="form-control"
                                            placeholder="What needs to be done?"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label htmlFor="plantCode">Plant</label>
                                            <select
                                                id="plantCode"
                                                name="plantCode"
                                                value={formData.plantCode}
                                                onChange={handleChange}
                                                className="form-control"
                                            >
                                                <option value="">Select a plant</option>
                                                {!regionPlantCodes.has(String(formData.plantCode || '').trim().toUpperCase()) && formData.plantCode && (
                                                    <option value={formData.plantCode}>{formData.plantCode}</option>
                                                )}
                                                {filteredPlants.map(p => (
                                                    <option key={p.plant_code}
                                                            value={p.plant_code}>({p.plant_code}) {p.plant_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="deadline">Deadline <span
                                                className="required">*</span></label>
                                            <input
                                                type="datetime-local"
                                                id="deadline"
                                                name="deadline"
                                                value={formData.deadline}
                                                onChange={handleChange}
                                                className="form-control"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="comments">Comments</label>
                                        <textarea
                                            id="comments"
                                            name="comments"
                                            value={formData.comments}
                                            onChange={handleChange}
                                            onBlur={() => setFormData(prev => ({
                                                ...prev,
                                                comments: GrammarUtility.cleanComments(prev.comments)
                                            }))}
                                            className="form-control"
                                            rows="4"
                                            placeholder="Add any additional notes or context here..."
                                        ></textarea>
                                    </div>
                                    <div className="form-actions">
                                        <button type="button" className="cancel-button"
                                                onClick={() => setEditing(false)}>Cancel
                                        </button>
                                        <button type="submit" className="save-button">Save Changes</button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <>
                                <div className="item-details">
                                    <h2 className="item-title">{item.description}</h2>
                                    <div className="item-status" style={{color: statusInfo.color}}>
                                        <i className={`fas fa-${statusInfo.icon}`} style={{marginRight: '8px'}}></i>
                                        <span style={{fontWeight: 600}}>{statusInfo.label}</span>
                                        {item.deadline && (
                                            <span className="item-deadline" style={{marginLeft: '16px'}}>
                                                <i className="fas fa-calendar-alt" style={{marginRight: '4px'}}></i>
                                                {ListService.formatDate(item.deadline)}
                                            </span>
                                        )}
                                    </div>
                                    {plant && (
                                        <div className="item-plant">
                                            <i className="fas fa-building"></i>
                                            <span>{plant.plant_name} ({plant.plant_code})</span>
                                        </div>
                                    )}
                                    {item.comments && (
                                        <div className="item-comments">
                                            <h3>Comments</h3>
                                            <p>{item.comments}</p>
                                        </div>
                                    )}
                                    <div className="meta-information">
                                        <div className="meta-section">
                                            <h3><i className="fas fa-history"></i> History</h3>
                                            <div className="meta-row">
                                                <div className="meta-label">Created by</div>
                                                <div
                                                    className="meta-value">{creator ? `${creator.first_name} ${creator.last_name}` : 'Unknown'}</div>
                                            </div>
                                            <div className="meta-row">
                                                <div className="meta-label">Created on</div>
                                                <div
                                                    className="meta-value">{ListService.formatDate(item.created_at)}</div>
                                            </div>
                                            {item.completed && (
                                                <>
                                                    <div className="meta-row">
                                                        <div className="meta-label">Completed by</div>
                                                        <div
                                                            className="meta-value">{completer ? `${completer.first_name} ${completer.last_name}` : 'Unknown'}</div>
                                                    </div>
                                                    <div className="meta-row">
                                                        <div className="meta-label">Completed on</div>
                                                        <div
                                                            className="meta-value">{ListService.formatDate(item.completed_at)}</div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="action-buttons">
                                    <button className="edit-secondary-button" onClick={() => setEditing(true)}>
                                        <i className="fas fa-edit"></i> Edit
                                    </button>
                                    <button className={`toggle-completion-button${item.completed ? ' completed' : ''}`}
                                            onClick={handleToggleCompletion}>
                                        {item.completed ? (
                                            <>
                                                <i className="fas fa-undo"></i> Mark as Incomplete
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-check"></i> Mark as Complete
                                            </>
                                        )}
                                    </button>
                                    <button className="delete-button" onClick={() => setShowDeleteConfirmation(true)}>
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                {showDeleteConfirmation && (
                    <div className="modal-overlay" onClick={() => setShowDeleteConfirmation(false)}>
                        <div className="delete-confirmation-modal" onClick={e => e.stopPropagation()}>
                            <div className="delete-modal-content">
                                <div className="delete-modal-header">
                                    <div className="delete-icon-container">
                                        <i className="fas fa-exclamation-triangle"></i>
                                    </div>
                                    <h2>Delete Item</h2>
                                    <button className="close-modal-button"
                                            onClick={() => setShowDeleteConfirmation(false)}>
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>

                                <div className="delete-modal-body">
                                    <div className="item-to-delete">
                                        <i className="fas fa-file-alt item-icon"></i>
                                        <span className="item-name">{item.description}</span>
                                    </div>

                                    <p className="delete-warning-text">Are you sure you want to delete this item?</p>

                                    <div className="warning-container">
                                        <i className="fas fa-exclamation-circle"></i>
                                        <span>This action cannot be undone. All associated information will be permanently removed.</span>
                                    </div>
                                </div>

                                <div className="delete-modal-footer">
                                    <button className="cancel-delete-button"
                                            onClick={() => setShowDeleteConfirmation(false)}>
                                        Cancel
                                    </button>
                                    <button className="confirm-delete-button" onClick={handleDelete}>
                                        <i className="fas fa-trash-alt"></i>
                                        Delete Item
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ListDetailView;
