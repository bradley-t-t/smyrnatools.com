import React, { useState, useEffect } from 'react';
import './ListDetailView.css';
import { supabase } from '../../core/clients/SupabaseClient';
import { usePreferences } from '../../context/PreferencesContext';

function ListDetailView({ itemId, onClose }) {
  const { preferences } = usePreferences();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plant, setPlant] = useState(null);
  const [creator, setCreator] = useState(null);
  const [completer, setCompleter] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    description: '',
    plantCode: '',
    deadline: '',
    comments: ''
  });
  const [plants, setPlants] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [wordLimit] = useState(5);

  useEffect(() => {
    if (itemId) {
      fetchItem();
      fetchPlants();
    }
  }, [itemId]);

  const fetchItem = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
          .from('list_items')
          .select('*')
          .eq('id', itemId)
          .single();

      if (error) throw error;

      setItem(data);
      setFormData({
        description: data.description || '',
        plantCode: data.plant_code || '',
        deadline: formatDateForInput(data.deadline) || '',
        comments: data.comments || ''
      });

      if (data.plant_code) {
        const { data: plantData, error: plantError } = await supabase
            .from('plants')
            .select('*')
            .eq('plant_code', data.plant_code)
            .single();

        if (!plantError) {
          setPlant(plantData);
        }
      }

      if (data.user_id) {
        const { data: userData, error: userError } = await supabase
            .from('users_profiles')
            .select('*')
            .eq('id', data.user_id)
            .single();

        if (!userError) {
          setCreator(userData);
        }
      }

      if (data.completed && data.completed_by) {
        const { data: completerData, error: completerError } = await supabase
            .from('users_profiles')
            .select('*')
            .eq('id', data.completed_by)
            .single();

        if (!completerError) {
          setCompleter(completerData);
        }
      }
    } catch (error) {
      console.error('Error fetching item:', error);
      setErrorMessage('Failed to load item details');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlants = async () => {
    try {
      const { data, error } = await supabase
          .from('plants')
          .select('*')
          .order('plant_code');

      if (error) throw error;
      setPlants(data);
    } catch (error) {
      console.error('Error fetching plants:', error);
      setErrorMessage('Failed to load plants');
    }
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const truncateDescription = (text) => {
    if (!text) return '';
    const words = text.trim().split(/\s+/);
    return words.slice(0, wordLimit).join(' ') + (words.length > wordLimit ? '...' : '');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      if (!formData.description.trim()) {
        setMessage('Description is required');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      const words = formData.description.trim().split(/\s+/);
      if (words.length > wordLimit) {
        setMessage(`Description cannot exceed ${wordLimit} words`);
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      const deadlineDate = new Date(formData.deadline);
      if (isNaN(deadlineDate.getTime())) {
        setMessage('Invalid deadline date');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      const { error } = await supabase
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
      setMessage('Changes saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating item:', error);
      setMessage(`Error saving changes: ${error.message || 'Unknown error'}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleToggleCompletion = async () => {
    try {
      const completed = !item.completed;
      const completedAt = completed ? new Date().toISOString() : null;
      const completedBy = completed ? (await supabase.auth.getUser()).data.user?.id : null;

      const { error } = await supabase
          .from('list_items')
          .update({
            completed,
            completed_at: completedAt,
            completed_by: completedBy
          })
          .eq('id', itemId);

      if (error) throw error;
      await fetchItem();
    } catch (error) {
      console.error('Error toggling completion:', error);
      setMessage('Failed to update completion status');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirmation) {
      setShowDeleteConfirmation(true);
      return;
    }

    try {
      const { error } = await supabase
          .from('list_items')
          .delete()
          .eq('id', itemId);

      if (error) throw error;
      onClose();
    } catch (error) {
      console.error('Error deleting item:', error);
      setMessage('Failed to delete item');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setShowDeleteConfirmation(false);
    }
  };

  if (loading) {
    return (
        <div className="detail-view-container">
          <div className="detail-view-header" style={{ backgroundColor: preferences.accentColor === 'red' ? 'var(--primary-red)' : 'var(--primary-blue)' }}>
            <div className="header-container">
              <div className="header-left">
                <button className="close-button" onClick={onClose} aria-label="Close details">
                  <i className="fas fa-chevron-left"></i>
                </button>
                <h2>Loading Item</h2>
              </div>
            </div>
          </div>
          <div className="detail-view-content centered">
            <div className="loading-container">
              <div className="ios-spinner"></div>
              <p>Loading item details...</p>
            </div>
          </div>
        </div>
    );
  }

  if (!item) {
    return (
        <div className="detail-view-container">
          <div className="detail-view-header" style={{ backgroundColor: preferences.accentColor === 'red' ? 'var(--primary-red)' : 'var(--primary-blue)' }}>
            <div className="header-container">
              <div className="header-left">
                <button className="close-button" onClick={onClose} aria-label="Close details">
                  <i className="fas fa-chevron-left"></i>
                </button>
                <h2>Item Not Found</h2>
              </div>
            </div>
          </div>
          <div className="detail-view-content centered">
            <div className="error-container">
              <div className="error-icon">
                <i className="fas fa-exclamation-circle"></i>
              </div>
              <h3>Item Not Found</h3>
              <p>The requested item could not be found. It may have been deleted.</p>
              <button
                  className="primary-button"
                  onClick={onClose}
                  style={{
                    backgroundColor: preferences.accentColor === 'red' ? 'var(--primary-red)' : 'var(--primary-blue)'
                  }}
              >
                <i className="fas fa-arrow-left"></i> Return to List
              </button>
            </div>
          </div>
        </div>
    );
  }

  return (
      <div className="detail-view-container">
        {editing && (
            <div className="saving-overlay" style={{ display: message ? 'flex' : 'none' }}>
              <div className="saving-indicator"></div>
            </div>
        )}

        <div className="detail-view-header" style={{ backgroundColor: preferences.accentColor === 'red' ? 'var(--primary-red)' : 'var(--primary-blue)' }}>
          <div className="header-container">
            <div className="header-left">
              <button className="close-button" onClick={onClose} aria-label="Close details">
                <i className="fas fa-chevron-left"></i>
              </button>
              <h2>{editing ? 'Edit Item' : (truncateDescription(item.description) || 'Item Details')}</h2>
            </div>
            <div className="header-actions">
              {!editing && (
                <>
                  <button
                      className="edit-button"
                      onClick={() => setEditing(true)}
                      style={{
                        backgroundColor: preferences.accentColor === 'red' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.2)',
                        color: 'white'
                      }}
                  >
                    <i className="fas fa-edit"></i> Edit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="detail-view-content">
          {(message || errorMessage) && (
              <div className={`message ${(message.includes('Error') || errorMessage) ? 'error' : 'success'}`}>
                <i className={`fas ${(message.includes('Error') || errorMessage) ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
                {message || errorMessage}
              </div>
          )}

          {editing ? (
              <div className="detail-card edit-card">
                <div className="edit-header">
                  <h2><i className="fas fa-pen"></i> Edit Item</h2>
                </div>
                <form onSubmit={handleSubmit} className="edit-form">
                  <div className="form-section">
                    <div className="form-group description-group">
                      <label htmlFor="description">
                        <i className="fas fa-file-alt"></i> Description <span className="required">*</span>
                      </label>
                      <input
                          type="text"
                          id="description"
                          name="description"
                          value={formData.description}
                          onChange={handleChange}
                          className="form-control"
                          placeholder="Brief description of the item"
                          required
                          autoFocus
                      />
                      <div className="word-limit-indicator">
                    <span className={formData.description.trim().split(/\s+/).length > wordLimit ? 'exceeded' : ''}>
                      <i className="fas fa-info-circle"></i> {formData.description.trim().split(/\s+/).length}/{wordLimit} words
                    </span>
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="plantCode">
                        <i className="fas fa-building"></i> Plant
                      </label>
                      <select
                          id="plantCode"
                          name="plantCode"
                          value={formData.plantCode}
                          onChange={handleChange}
                          className="form-control"
                      >
                        <option value="">Select a plant</option>
                        {plants.map(plant => (
                            <option key={plant.plant_code} value={plant.plant_code}>
                              ({plant.plant_code}) {plant.plant_name}
                            </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="deadline">
                        <i className="fas fa-calendar-alt"></i> Deadline <span className="required">*</span>
                      </label>
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
                    <label htmlFor="comments">
                      <i className="fas fa-comment-alt"></i> Comments
                    </label>
                    <textarea
                        id="comments"
                        name="comments"
                        value={formData.comments}
                        onChange={handleChange}
                        className="form-control"
                        rows="4"
                        placeholder="Additional notes or instructions..."
                    ></textarea>
                  </div>

                  <div className="form-actions">
                    <button
                        type="button"
                        className="cancel-button"
                        onClick={() => setEditing(false)}
                    >
                      <i className="fas fa-times"></i> Cancel
                    </button>
                    <button
                        type="submit"
                        className="save-button"
                        style={{
                          backgroundColor: preferences.accentColor === 'red' ? 'var(--primary-red)' : 'var(--primary-blue)'
                        }}
                    >
                      <i className="fas fa-save"></i> Save Changes
                    </button>
                  </div>
                </form>
              </div>
          ) : (
              <div className="detail-card">
                <div className="status-banner" style={{
                  backgroundColor: item.completed
                      ? 'var(--success-green)'
                      : (new Date(item.deadline) < new Date() && item.deadline ? 'var(--danger-red)' : 'var(--primary-blue)')
                }}>
              <span className="status-text">
                <i className={`fas ${item.completed ? 'fa-check-circle' : (new Date(item.deadline) < new Date() && item.deadline ? 'fa-exclamation-circle' : 'fa-clock')}`}></i>
                {item.completed ? 'Completed' : (new Date(item.deadline) < new Date() && item.deadline ? 'Overdue' : 'Pending')}
              </span>
                </div>

                <div className="item-main-details">
                  <h2 className="item-title">{truncateDescription(item.description) || 'Untitled Item'}</h2>

                  <div className="item-metadata">
                    <div className="metadata-item">
                      <i className="fas fa-building"></i>
                      <span>{plant ? `${plant.plant_code} - ${plant.plant_name}` : 'No Plant'}</span>
                    </div>

                    <div className="metadata-item">
                      <i className="fas fa-calendar-alt"></i>
                      <span className={item.completed ? '' : (new Date(item.deadline) < new Date() && item.deadline ? 'overdue-text' : '')}>
                    {formatDate(item.deadline)}
                  </span>
                    </div>
                  </div>
                </div>

                {item.comments && (
                    <div className="comments-section">
                      <h3><i className="fas fa-comment-alt"></i> Comments</h3>
                      <div className="comment-content">{item.comments}</div>
                    </div>
                )}

                <div className="creator-info">
                  <div className="info-group">
                    <div className="info-item">
                      <label>Created By</label>
                      <span>{creator ? `${creator.first_name} ${creator.last_name}` : (item.user_id || 'Unknown')}</span>
                    </div>
                    <div className="info-item">
                      <label>Created</label>
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                  </div>

                  {item.completed && (
                      <div className="info-group">
                        <div className="info-item">
                          <label>Completed By</label>
                          <span>{completer ? `${completer.first_name} ${completer.last_name}` : (item.completed_by || 'Unknown')}</span>
                        </div>
                        <div className="info-item">
                          <label>Completed</label>
                          <span>{formatDate(item.completed_at)}</span>
                        </div>
                      </div>
                  )}
                </div>

                <div className="action-buttons">
                  <button
                      className="toggle-completion-button"
                      onClick={handleToggleCompletion}
                      style={{
                        backgroundColor: item.completed ? 
                          (preferences.accentColor === 'red' ? 'var(--primary-red)' : 'var(--primary-blue)') : 
                          'var(--success)'
                      }}
                  >
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
                </div>
              </div>
          )}
        </div>

        {showDeleteConfirmation && (
            <div className="confirmation-modal">
              <div className="confirmation-content">
                <div className="confirmation-header">
                  <i className="fas fa-exclamation-triangle warning-icon"></i>
                  <h2>Confirm Delete</h2>
                </div>
                <div className="confirmation-body">
                  <p>Are you sure you want to delete this item?</p>
                  <p className="item-to-delete">"{truncateDescription(item.description) || 'Untitled item'}"</p>
                  <p className="warning-text"><i className="fas fa-exclamation-circle"></i> This action cannot be undone.</p>
                </div>
                <div className="confirmation-actions">
                  <button className="cancel-button" onClick={() => setShowDeleteConfirmation(false)}>
                    <i className="fas fa-times"></i> Cancel
                  </button>
                  <button className="delete-button danger" onClick={handleDelete}>
                    <i className="fas fa-trash"></i> Delete
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}

export default ListDetailView;