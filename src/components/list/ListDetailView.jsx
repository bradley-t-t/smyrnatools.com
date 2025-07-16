import React, {useState, useEffect} from 'react';
import {supabase} from '../../services/DatabaseService';
import {usePreferences} from '../../context/PreferencesContext';
import ThemeUtility from '../../utils/ThemeUtility';
import './ListDetailView.css';

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
      Promise.all([fetchItem(), fetchPlants()]).catch(() => {});
    }
  }, [itemId]);


  async function fetchItem() {
    setLoading(true);
    try {
      const {data, error} = await supabase.from('list_items').select('*').eq('id', itemId).single();
      if (error) throw error;

      setItem(data);
      setFormData({
        description: data.description || '',
        plantCode: data.plant_code || '',
        deadline: formatDateForInput(data.deadline) || '',
        comments: data.comments || ''
      });

      const [{data: plantData}, {data: creatorData}, {data: completerData}] = await Promise.all([
        data.plant_code ? supabase.from('plants').select('*').eq('plant_code', data.plant_code).single() : Promise.resolve({data: null}),
        data.user_id ? supabase.from('users_profiles').select('*').eq('id', data.user_id).single() : Promise.resolve({data: null}),
        data.completed && data.completed_by ? supabase.from('users_profiles').select('*').eq('id', data.completed_by).single() : Promise.resolve({data: null})
      ]);

      setPlant(plantData);
      setCreator(creatorData);
      setCompleter(completerData);
    } catch {
      showMessage('Failed to load item details', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlants() {
    try {
      const {data, error} = await supabase.from('plants').select('*').order('plant_code');
      if (error) throw error;
      setPlants(data);
    } catch {
      showMessage('Failed to load plants', 'error');
    }
  }

  function formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString(undefined, {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
  }

  function getRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHr = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHr / 24);

    if (diffSec < 60) return `${diffSec} second${diffSec !== 1 ? 's' : ''} ago`;
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
    if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
    return formatDate(dateString);
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

      const {error} = await supabase
          .from('list_items')
          .update({
            description: formData.description,
            plant_code: formData.plantCode || null,
            deadline: deadlineDate.toISOString(),
            comments: formData.comments || null
          })
          .eq('id', itemId);

      if (error) throw error;

      await fetchItem();
      setEditing(false);
      showMessage('Changes saved successfully!');
    } catch {
      showMessage('Error saving changes', 'error', 5000);
    }
  }

  async function handleToggleCompletion() {
    try {
      const completed = !item.completed;
      const completedAt = completed ? new Date().toISOString() : null;
      const completedBy = completed ? (await supabase.auth.getUser()).data.user?.id : null;

      const {error} = await supabase
          .from('list_items')
          .update({completed, completed_at: completedAt, completed_by: completedBy})
          .eq('id', itemId);

      if (error) throw error;

      showMessage(completed ? 'Item marked as complete' : 'Item marked as incomplete');
      await fetchItem();
    } catch {
      showMessage('Failed to update completion status', 'error');
    }
  }

  async function handleDelete() {
    try {
      const {error} = await supabase.from('list_items').delete().eq('id', itemId);
      if (error) throw error;
      onClose();
    } catch {
      showMessage('Failed to delete item', 'error');
      setShowDeleteConfirmation(false);
    }
  }

  function calculateStatusInfo() {
    if (!item) return {color: '#718096', label: 'Unknown', icon: 'question-circle'};
    if (item.completed) return {color: '#10B981', label: 'Completed', icon: 'check-circle'};

    const deadline = new Date(item.deadline);
    const now = new Date();
    if (isNaN(deadline.getTime())) return {color: '#718096', label: 'No Deadline', icon: 'calendar-times'};
    if (deadline < now) return {color: '#EF4444', label: 'Overdue', icon: 'exclamation-circle'};

    const hours = (deadline - now) / (1000 * 60 * 60);
    if (hours < 24) return {color: '#F59E0B', label: 'Due Soon', icon: 'clock'};
    return {color: '#3B82F6', label: 'Upcoming', icon: 'calendar-check'};
  }

  if (loading) {
    return (
        <div className="detail-view">
          <div className="detail-header" style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896', display: 'flex', alignItems: 'center', padding: '0 8px'}}>
            <button className="back-button" onClick={onClose} style={{marginRight: '8px'}}>
              <i className="fas fa-arrow-left"></i>
            </button>
            <h1 style={{color: '#ffffff', textAlign: 'center', flex: 1, margin: '0 auto'}}>Loading...</h1>
            <div style={{width: '36px'}}></div>
          </div>
          <div className="detail-content loading">
            <div className="loader">
              <div className="spinner"></div>
              <p style={{color: '#ffffff', textAlign: 'center', flex: 1}}>Loading item details...</p>
            </div>
          </div>
        </div>
    );
  }

  if (!item) {
    return (
        <div className="detail-view">
          <div className="detail-header" style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896', display: 'flex', alignItems: 'center', padding: '0 8px'}}>
            <button className="back-button" onClick={onClose} style={{marginRight: '8px'}}>
              <i className="fas fa-arrow-left"></i>
            </button>
            <h1 style={{color: '#ffffff', textAlign: 'center', flex: 1, margin: '0 auto'}}>Not Found</h1>
            <div style={{width: '36px'}}></div>
          </div>
          <div className="detail-content error">
            <div className="error-state">
              <i className="fas fa-exclamation-triangle"></i>
              <h2>Item Not Found</h2>
              <p>The requested item could not be found or has been deleted.</p>
              <button className="primary-button" onClick={onClose}>Go Back</button>
            </div>
          </div>
        </div>
    );
  }

  const statusInfo = calculateStatusInfo();

  return (
      <div className="detail-view">
                  <div className="detail-header" style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896', display: 'flex', alignItems: 'center', padding: '0 8px'}}>
          <button className="back-button" onClick={onClose} style={{marginRight: '8px'}}>
            <i className="fas fa-arrow-left"></i>
          </button>
          {!editing ? (
              <button className="edit-button" onClick={() => setEditing(true)}>
                <i className="fas fa-edit"></i>
              </button>
          ) : (
              <div style={{width: '36px'}}></div>
          )}
        </div>
        <div className="detail-content">
          {message.text && (
              <div className={`message ${message.type}`}>
                <i className={`fas fa-${message.type === 'error' ? 'exclamation-circle' : 'check-circle'}`}></i>
                <span>{message.text}</span>
              </div>
          )}
          {editing ? (
                              <div className="edit-form-container" style={{backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.primary : '#ffffff'}}>
                <form onSubmit={handleSubmit} className="edit-form">
                  <div className="form-group">
                    <label htmlFor="description" style={{color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.secondary : '#718096'}}>Description <span className="required">*</span></label>
                    <input
                        type="text"
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        className="form-control"
                        placeholder="What needs to be done?"
                        required
                        autoFocus
                        style={{backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.secondary : '#ffffff', color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.primary : '#1a202c', borderColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.border.light : '#e2e8f0'}}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="plantCode" style={{color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.secondary : '#718096'}}>Plant</label>
                      <select 
                        id="plantCode" 
                        name="plantCode" 
                        value={formData.plantCode} 
                        onChange={handleChange} 
                        className="form-control"
                        style={{backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.secondary : '#ffffff', color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.primary : '#1a202c', borderColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.border.light : '#e2e8f0'}}
                      >
                        <option value="">Select a plant</option>
                        {plants.map(plant => (
                            <option key={plant.plant_code} value={plant.plant_code}>({plant.plant_code}) {plant.plant_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="deadline" style={{color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.secondary : '#718096'}}>Deadline <span className="required">*</span></label>
                      <input
                          type="datetime-local"
                          id="deadline"
                          name="deadline"
                          value={formData.deadline}
                          onChange={handleChange}
                          className="form-control"
                          required
                          style={{backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.secondary : '#ffffff', color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.primary : '#1a202c', borderColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.border.light : '#e2e8f0'}}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="comments" style={{color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.secondary : '#718096'}}>Comments</label>
                    <textarea
                        id="comments"
                        name="comments"
                        value={formData.comments}
                        onChange={handleChange}
                        className="form-control"
                        rows="4"
                        placeholder="Add any additional notes or context here..."
                        style={{backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.secondary : '#ffffff', color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.primary : '#1a202c', borderColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.border.light : '#e2e8f0'}}
                    ></textarea>
                  </div>
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button" 
                      onClick={() => setEditing(false)}
                      style={{backgroundColor: preferences.themeMode === 'dark' ? ThemeUtility.dark.background.tertiary : '#f5f5f5', color: preferences.themeMode === 'dark' ? ThemeUtility.dark.text.primary : '#718096'}}
                    >Cancel</button>
                    <button type="submit" className="save-button" style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>Save Changes</button>
                  </div>
                </form>
              </div>
          ) : (
              <>
                <div className="item-details">
                  <h2 className="item-title">{item.description}</h2>
                  <div className="item-status" style={{color: statusInfo.color, marginBottom: '16px', paddingLeft: '24px'}}>
                    <i className={`fas fa-${statusInfo.icon}`} style={{marginRight: '8px'}}></i>
                    <span style={{fontWeight: 600}}>{statusInfo.label}</span>
                    {item.deadline && (
                      <span className="item-deadline" style={{marginLeft: '16px'}}>
                        <i className="fas fa-calendar-alt" style={{marginRight: '4px'}}></i>
                        {formatDate(item.deadline)}
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
                        <div className="meta-value">{creator ? `${creator.first_name} ${creator.last_name}` : 'Unknown'}</div>
                      </div>
                      <div className="meta-row">
                        <div className="meta-label">Created on</div>
                        <div className="meta-value">{formatDate(item.created_at)}</div>
                      </div>
                      {item.completed && (
                          <>
                            <div className="meta-row">
                              <div className="meta-label">Completed by</div>
                              <div className="meta-value">{completer ? `${completer.first_name} ${completer.last_name}` : 'Unknown'}</div>
                            </div>
                            <div className="meta-row">
                              <div className="meta-label">Completed on</div>
                              <div className="meta-value">{formatDate(item.completed_at)}</div>
                            </div>
                          </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="action-buttons" style={{marginTop: '-10px'}}>
                  <button className="toggle-completion-button" style={{backgroundColor: item.completed ? '#EF4444' : '#10B981'}} onClick={handleToggleCompletion}>
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
                    <h2 style={{color: preferences.themeMode === 'dark' ? '#f7fafc' : '#1a202c'}}>Delete Item</h2>
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
                      <span className="item-name" style={{color: preferences.themeMode === 'dark' ? '#f7fafc' : '#1a202c', fontWeight: 500}}>{item.description}</span>
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
                      <span style={{color: preferences.themeMode === 'dark' ? '#f7fafc' : '#1a202c', fontWeight: 500}}>This action cannot be undone. All associated information will be permanently removed.</span>
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
  );
}

export default ListDetailView;