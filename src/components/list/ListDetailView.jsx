import React, {useEffect, useState} from 'react';
import {ListService} from '../../services/ListService';
import {UserService} from '../../services/UserService';
import {usePreferences} from '../../app/context/PreferencesContext';
import LoadingScreen from '../common/LoadingScreen';
import ThemeUtility from '../../utils/ThemeUtility';
import GrammarUtility from '../../utils/GrammarUtility';
import './styles/ListDetailView.css';
import './styles/ScrollStyles.css';
import ListItemChat from './ListItemChat';

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

    if (loading) {
        return (
            <div className="popup-outer" style={{willChange: 'transform', backfaceVisibility: 'hidden'}}>
                <div className="popup-inner" style={{willChange: 'opacity, transform'}}>
                    <div className="popup-header">
                        <button className="back-button" onClick={onClose}>
                            <i className="fas fa-arrow-left"></i>
                        </button>
                        <div style={{width: '36px'}}></div>
                    </div>
                    <div className="popup-content">
                        <LoadingScreen message="Loading item details..." inline={true}/>
                    </div>
                </div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="popup-outer" style={{willChange: 'transform', backfaceVisibility: 'hidden'}}>
                <div className="popup-inner" style={{willChange: 'opacity, transform'}}>
                    <div className="popup-header">
                        <button className="back-button" onClick={onClose}>
                            <i className="fas fa-arrow-left"></i>
                        </button>
                        <div style={{width: '36px'}}></div>
                    </div>
                    <div className="popup-content">
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
        <div className="popup-outer" style={{willChange: 'transform', backfaceVisibility: 'hidden'}}>
            <div className="popup-inner" style={{willChange: 'opacity, transform'}}>
                <div className="popup-header" style={{position: 'relative'}}>
                    <button className="back-button" onClick={onClose}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <div style={{flex: 1}}></div>
                    {!editing ? (
                        <button
                            className="edit-button"
                            onClick={() => setEditing(true)}
                            style={{
                                position: 'absolute',
                                right: 16,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                marginLeft: 'auto'
                            }}
                        >
                            <i className="fas fa-edit"></i>
                        </button>
                    ) : (
                        <div style={{width: '36px'}}></div>
                    )}
                </div>
                <div className="popup-content popup-content-split">
                    <div className="detail-left">
                        {message.text && (
                            <div className={`message ${message.type}`}>
                                <i className={`fas fa-${message.type === 'error' ? 'exclamation-circle' : 'check-circle'}`}></i>
                                <span>{message.text}</span>
                            </div>
                        )}
                        {editing ? (
                            <div className="edit-form-container"
                                 style={{backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.primary : '#ffffff'}}>
                                <form onSubmit={handleSubmit} className="edit-form">
                                    <div className="form-group">
                                        <label htmlFor="description"
                                               style={{color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.secondary : '#718096'}}>Description <span
                                            className="required">*</span></label>
                                        <input
                                            type="text"
                                            id="description"
                                            name="description"
                                            value={formData.description}
                                            onChange={handleChange}
                                            onBlur={() => setFormData(prev => ({...prev, description: GrammarUtility.cleanDescription(prev.description)}))}
                                            className="form-control"
                                            placeholder="What needs to be done?"
                                            required
                                            autoFocus
                                            style={{
                                                backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.secondary : '#ffffff',
                                                color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.primary : '#1a202c',
                                                borderColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.border.light : '#e2e8f0'
                                            }}
                                        />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label htmlFor="plantCode"
                                                   style={{color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.secondary : '#718096'}}>Plant</label>
                                            <select
                                                id="plantCode"
                                                name="plantCode"
                                                value={formData.plantCode}
                                                onChange={handleChange}
                                                className="form-control"
                                                style={{
                                                    backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.secondary : '#ffffff',
                                                    color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.primary : '#1a202c',
                                                    borderColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.border.light : '#e2e8f0'
                                                }}
                                            >
                                                <option value="">Select a plant</option>
                                                {plants.map(plant => (
                                                    <option key={plant.plant_code}
                                                            value={plant.plant_code}>({plant.plant_code}) {plant.plant_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="deadline"
                                                   style={{color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.secondary : '#718096'}}>Deadline <span
                                                className="required">*</span></label>
                                            <input
                                                type="datetime-local"
                                                id="deadline"
                                                name="deadline"
                                                value={formData.deadline}
                                                onChange={handleChange}
                                                className="form-control"
                                                required
                                                style={{
                                                    backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.secondary : '#ffffff',
                                                    color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.primary : '#1a202c',
                                                    borderColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.border.light : '#e2e8f0'
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="comments"
                                               style={{color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.secondary : '#718096'}}>Comments</label>
                                        <textarea
                                            id="comments"
                                            name="comments"
                                            value={formData.comments}
                                            onChange={handleChange}
                                            onBlur={() => setFormData(prev => ({...prev, comments: GrammarUtility.cleanComments(prev.comments)}))}
                                            className="form-control"
                                            rows="4"
                                            placeholder="Add any additional notes or context here..."
                                            style={{
                                                backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.secondary : '#ffffff',
                                                color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.primary : '#1a202c',
                                                borderColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.border.light : '#e2e8f0'
                                            }}
                                        ></textarea>
                                    </div>
                                    <div className="form-actions">
                                        <button
                                            type="button"
                                            className="cancel-button"
                                            onClick={() => setEditing(false)}
                                            style={{
                                                backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.tertiary : '#f5f5f5',
                                                color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.primary : '#718096'
                                            }}
                                        >Cancel
                                        </button>
                                        <button type="submit" className="save-button"
                                                style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>Save
                                            Changes
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <>
                                <div className="item-details">
                                    <h2 className="item-title">{item.description}</h2>
                                    <div className="item-status"
                                         style={{color: statusInfo.color, marginBottom: '16px', paddingLeft: '24px'}}>
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
                                                <div className="meta-value">{ListService.formatDate(item.created_at)}</div>
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
                    <div className="detail-right">
                        <ListItemChat itemId={itemId}/>
                    </div>
                </div>
                {showDeleteConfirmation && (
                    <div className="modal-overlay" onClick={() => setShowDeleteConfirmation(false)}>
                        <div
                            className="delete-confirmation-modal"
                            onClick={e => e.stopPropagation()}
                            style={{
                                backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.primary : ThemeUtility.light.background.primary,
                                color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.primary : '#1a202c'
                            }}
                        >
                            <div className="delete-modal-content">
                                <div
                                    className="delete-modal-header"
                                    style={{
                                        borderBottomColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.border.light : ThemeUtility.light.border.light,
                                        color: preferences.themeMode === 'dark' ? '#f7fafc' : '#1a202c'
                                    }}
                                >
                                    <div
                                        className="delete-icon-container"
                                        style={{
                                            color: preferences.accentColor === 'red' ? ThemeUtility.accent.red.primary : ThemeUtility.accent.blue.primary
                                        }}
                                    >
                                        <i className="fas fa-exclamation-triangle"></i>
                                    </div>
                                    <h2 style={{color: preferences.themeMode === 'dark' ? '#f7fafc' : '#1a202c'}}>Delete
                                        Item</h2>
                                    <button
                                        className="close-modal-button"
                                        onClick={() => setShowDeleteConfirmation(false)}
                                        style={{
                                            color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.secondary : ThemeUtility.light.text.secondary
                                        }}
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>

                                <div
                                    className="delete-modal-body"
                                    style={{
                                        backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.secondary : ThemeUtility.light.background.secondary,
                                        color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.primary : '#1a202c'
                                    }}
                                >
                                    <div className="item-to-delete">
                                        <i className="fas fa-file-alt item-icon"></i>
                                        <span className="item-name" style={{
                                            color: preferences.themeMode === 'dark' ? '#f7fafc' : '#1a202c',
                                            fontWeight: 500
                                        }}>{item.description}</span>
                                    </div>

                                    <p
                                        className="delete-warning-text"
                                        style={{
                                            color: preferences.themeMode === 'dark' ? '#f7fafc' : '#1a202c',
                                            fontWeight: 500
                                        }}
                                    >
                                        Are you sure you want to delete this item?
                                    </p>

                                    <div
                                        className="warning-container"
                                        style={{
                                            backgroundColor: preferences.themeMode === 'dark' ? 'rgba(229, 62, 62, 0.1)' : 'rgba(229, 62, 62, 0.08)'
                                        }}
                                    >
                                        <i className="fas fa-exclamation-circle" style={{color: '#e53e3e'}}></i>
                                        <span style={{
                                            color: preferences.themeMode === 'dark' ? '#f7fafc' : '#1a202c',
                                            fontWeight: 500
                                        }}>This action cannot be undone. All associated information will be permanently removed.</span>
                                    </div>
                                </div>

                                <div
                                    className="delete-modal-footer"
                                    style={{
                                        backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.secondary : ThemeUtility.light.background.secondary,
                                        borderTopColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.border.light : ThemeUtility.light.border.light
                                    }}
                                >
                                    <button
                                        className="cancel-delete-button"
                                        onClick={() => setShowDeleteConfirmation(false)}
                                        style={{
                                            backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.tertiary : ThemeUtility.light.background.tertiary,
                                            color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.primary : ThemeUtility.light.text.secondary
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="confirm-delete-button"
                                        onClick={handleDelete}
                                        style={{backgroundColor: preferences.accentColor === 'red' ? ThemeUtility.accent.red.primary : ThemeUtility.accent.blue.primary}}
                                    >
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
