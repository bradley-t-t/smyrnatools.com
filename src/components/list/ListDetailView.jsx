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

  // No need for body class when using modal

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

      // Fetch plant details
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

      // Fetch creator profile
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

      // Fetch completer profile if completed
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
    const words = text.split(' ');
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

      // Enforce word limit
      const words = formData.description.trim().split(' ');
      if (words.length > wordLimit) {
        const truncatedDescription = words.slice(0, wordLimit).join(' ');
        setFormData(prev => ({ ...prev, description: truncatedDescription }));
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
            description: truncateDescription(formData.description),
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
          <div className="detail-view-header">
            <h2>Item Details</h2>
            <button className="close-button" onClick={onClose} aria-label="Close details">
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="detail-view-content">
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
          <div className="detail-view-header">
            <h2>Item Not Found</h2>
            <button className="close-button" onClick={onClose} aria-label="Close details">
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="detail-view-content">
            <div className="error-message">
              <p>Could not find the requested item. It may have been deleted.</p>
              <button className="save-button" onClick={onClose} style={{ marginTop: '16px' }}>
                Return to List
              </button>
            </div>
          </div>
        </div>
    );
  }

  return (
      <div className="detail-view-container">
        {editing && (
            <div className="saving-overlay" style={{ display: message ? 'block' : 'none' }}>
              <div className="saving-indicator"></div>
            </div>
        )}

        <div className="detail-view-header">
          <div className="header-left">
            <button className="close-button" onClick={onClose} aria-label="Close details">
              <i className="fas fa-times"></i>
            </button>
          </div>
          <h2>{editing ? 'Edit Item' : (truncateDescription(item.description) || 'Item Details')}</h2>
          <div className="header-actions">
            {!editing && (
                <button
                    className="edit-button"
                    onClick={() => setEditing(true)}
                    style={{
                      backgroundColor: preferences.accentColor === 'red' ? '#ffeaea' : '#e6f0ff',
                      color: preferences.accentColor === 'red' ? '#b80017' : '#003896'
                    }}
                >
                  <i className="fas fa-edit"></i>
                  Edit
                </button>
            )}
          </div>
        </div>

        <div className="detail-view-content">
          {(message || errorMessage) && (
              <div className={`message ${(message.includes('Error') || errorMessage) ? 'error' : 'success'}`}>
                {message || errorMessage}
              </div>
          )}

          {editing ? (
              <div className="detail-card">
                <div className="card-header">
                  <h2>Edit Information</h2>
                </div>
                <p className="edit-instructions">Make changes below and click Save when finished.</p>
                <form onSubmit={handleSubmit} className="edit-form">
                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <input
                        type="text"
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        className="form-control"
                        required
                    />
                    <div className="word-limit-indicator">
                      <span className={formData.description.split(' ').length > wordLimit ? 'exceeded' : ''}>
                        {formData.description.split(' ').length}/{wordLimit} words max
                      </span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="plantCode">Plant</label>
                    <select
                        id="plantCode"
                        name="plantCode"
                        value={formData.plantCode}
                        onChange={handleChange}
                        className="form-control"
                    >
                      <option value="">No Plant</option>
                      {plants.map(plant => (
                          <option key={plant.plant_code} value={plant.plant_code}>
                            ({plant.plant_code}) {plant.plant_name}
                          </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="deadline">Deadline</label>
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

                  <div className="form-group">
                    <label htmlFor="comments">Comments</label>
                    <textarea
                        id="comments"
                        name="comments"
                        value={formData.comments}
                        onChange={handleChange}
                        className="form-control"
                        rows="3"
                    ></textarea>
                  </div>

                  <div className="form-actions">
                    <button
                        type="button"
                        className="cancel-button"
                        onClick={() => setEditing(false)}
                    >
                      Cancel
                    </button>
                    <button
                        type="submit"
                        className="save-button"
                        style={{
                          backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896',
                        }}
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
          ) : (
              <div className="detail-card">
                <div className="card-header">
                  <h2>Item Information</h2>
                </div>
                <div className="item-details">
                  <div className="detail-section">
                    <h3>Description</h3>
                    <p>{item.description || 'N/A'}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Plant</h3>
                    <p>{plant ? `${plant.plant_code} - ${plant.plant_name}` : 'No Plant'}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Deadline</h3>
                    <p className={item.completed ? '' : (new Date(item.deadline) < new Date() ? 'overdue' : '')}>
                      {formatDate(item.deadline)}
                      {!item.completed && new Date(item.deadline) < new Date() && item.deadline && (
                          <span className="overdue-indicator"> (Overdue)</span>
                      )}
                    </p>
                  </div>

                  <div className="detail-section">
                    <h3>Status</h3>
                    <p>
                  <span className={`status-badge ${item.completed ? 'completed' : (new Date(item.deadline) < new Date() && item.deadline ? 'overdue' : 'pending')}`}>
                    {item.completed ? 'Completed' : (new Date(item.deadline) < new Date() && item.deadline ? 'Overdue' : 'Pending')}
                  </span>
                    </p>
                  </div>

                  <div className="detail-section">
                    <h3>Created By</h3>
                    <p>{creator ? `${creator.first_name} ${creator.last_name}` : (item.user_id || 'Unknown')}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Created At</h3>
                    <p>{formatDate(item.created_at)}</p>
                  </div>

                  {item.completed && (
                      <>
                        <div className="detail-section">
                          <h3>Completed By</h3>
                          <p>{completer ? `${completer.first_name} ${completer.last_name}` : (item.completed_by || 'Unknown')}</p>
                        </div>

                        <div className="detail-section">
                          <h3>Completed At</h3>
                          <p>{formatDate(item.completed_at)}</p>
                        </div>
                      </>
                  )}

                  {item.comments && (
                      <div className="detail-section">
                        <h3>Comments</h3>
                        <p className="comments">{item.comments}</p>
                      </div>
                  )}

                  <div className="action-buttons">
                    <button
                        className="toggle-completion-button"
                        onClick={handleToggleCompletion}
                        style={{
                          backgroundColor: item.completed
                              ? '#f0fff4'
                              : (preferences.accentColor === 'red' ? '#ffeaea' : '#e6f0ff'),
                          color: item.completed
                              ? '#38a169'
                              : (preferences.accentColor === 'red' ? '#b80017' : '#003896')
                        }}
                    >
                      {item.completed ? (
                          <>
                            <i className="fas fa-undo"></i>
                            Mark as Incomplete
                          </>
                      ) : (
                          <>
                            <i className="fas fa-check"></i>
                            Mark as Complete
                          </>
                      )}
                    </button>

                    <button className="delete-button" onClick={handleDelete}>
                      <i className="fas fa-trash"></i>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
          )}

          {!editing && (
              <div className="form-actions">
                <button
                    className="save-button"
                    onClick={() => setEditing(true)}
                    style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                >
                  <i className="fas fa-edit"></i>
                  Edit Item
                </button>
                <button
                    className="delete-button"
                    onClick={() => setShowDeleteConfirmation(true)}
                >
                  <i className="fas fa-trash"></i>
                  Delete Item
                </button>
              </div>
          )}
        </div>

        {showDeleteConfirmation && (
            <div className="confirmation-modal">
              <div className="confirmation-content">
                <h2>Confirm Delete</h2>
                <p>Are you sure you want to delete {item.description || 'this item'}? This action cannot be undone.</p>
                <div className="confirmation-actions">
                  <button className="cancel-button" onClick={() => setShowDeleteConfirmation(false)}>
                    Cancel
                  </button>
                  <button className="delete-button" onClick={handleDelete}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}

export default ListDetailView;