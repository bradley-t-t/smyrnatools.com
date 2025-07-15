import React, {useState, useEffect} from 'react';
import './ListAddView.css';
import {supabase} from '../../core/clients/SupabaseClient';
import {UserService} from '../../services/UserService';
import {usePreferences} from '../../context/PreferencesContext';
import {generateUUID} from '../../utils/UUIDUtils';

function ListAddView({onClose, onItemAdded, item = null, plants = []}) {
    const {preferences} = usePreferences();
    const [description, setDescription] = useState('');
    const [plantCode, setPlantCode] = useState('');
    const [deadline, setDeadline] = useState('');
    const [comments, setComments] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [errors, setErrors] = useState({});
    const [userPlantCode, setUserPlantCode] = useState(null);
    const [canBypassPlantRestriction, setCanBypassPlantRestriction] = useState(false);
    const [plantRestrictionMessage, setPlantRestrictionMessage] = useState('');

    useEffect(() => {
        // Set default deadline to today at 5:00 PM
        const today = new Date();
        today.setHours(17, 0, 0, 0);
        setDeadline(today.toISOString().slice(0, 16));

        // Get current user and check permissions
        const fetchCurrentUser = async () => {
            const user = await UserService.getCurrentUser();
            if (user) {
                setCurrentUserId(user.id);

                // Check if user has permission to bypass plant restriction
                const hasPermission = await UserService.hasPermission(user.id, 'list.bypass.plantrestriction');
                setCanBypassPlantRestriction(hasPermission);

                // If they don't have bypass permission, get their assigned plant
                if (!hasPermission) {
                    try {
                        const { data: profileData } = await supabase
                            .from('users_profiles')
                            .select('plant_code')
                            .eq('id', user.id)
                            .single();

                        if (profileData && profileData.plant_code) {
                            setUserPlantCode(profileData.plant_code);
                            setPlantCode(profileData.plant_code);
                            setPlantRestrictionMessage(`You can only create items for your assigned plant (${profileData.plant_code}).`);
                        }
                    } catch (error) {
                        console.error('Error fetching user plant code:', error);
                    }
                }
            }
        };
        fetchCurrentUser();

        // If editing an existing item, populate the form
        if (item) {
            setDescription(item.description || '');
            // Only set the plant code if user can bypass restriction or it matches their plant
            if (canBypassPlantRestriction || !userPlantCode || item.plantCode === userPlantCode) {
                setPlantCode(item.plantCode || '');
            }
            // Format the date for datetime-local input
            if (item.deadline) {
                const deadlineDate = new Date(item.deadline);
                setDeadline(deadlineDate.toISOString().slice(0, 16));
            }
            setComments(item.comments || '');
        }
    }, [item]);

    const validate = () => {
        const newErrors = {};
        if (!description.trim()) newErrors.description = 'Description is required';
        if (!plantCode) newErrors.plantCode = 'Plant is required';
        if (!deadline) newErrors.deadline = 'Deadline is required';

        // Check if user is trying to bypass plant restriction
        if (!canBypassPlantRestriction && userPlantCode && plantCode !== userPlantCode) {
            newErrors.plantCode = `You can only create items for your assigned plant (${userPlantCode})`;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSaving(true);
        try {
            if (item) {
                // Update existing item
                const {error} = await supabase
                    .from('list_items')
                    .update({
                        plant_code: plantCode,
                        description: description,
                        deadline: new Date(deadline).toISOString(),
                        comments: comments
                    })
                    .eq('id', item.id);

                if (error) throw error;
            } else {
                // Create new item
                const {error} = await supabase
                    .from('list_items')
                    .insert([
                        {
                            id: generateUUID(),
                            user_id: currentUserId,
                            plant_code: plantCode,
                            description: description,
                            deadline: new Date(deadline).toISOString(),
                            comments: comments,
                            created_at: new Date().toISOString(),
                            completed: false
                        }
                    ]);

                if (error) throw error;
            }

            if (onItemAdded) {
                onItemAdded();
            }
        } catch (error) {
            console.error('Error saving list item:', error);
            const errorMessage = error.message || 'Unknown error';
            alert(`Failed to save list item: ${errorMessage}. Please try again.`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content list-add-modal">
                <div className="modal-header">
                    <h2>{item ? 'Edit List Item' : 'Add New List Item'}</h2>
                    <button className="close-button" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className={`form-group ${errors.description ? 'has-error' : ''}`}>
                            <label>Description</label>
                            <input
                                type="text"
                                className="form-control"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Enter item description"
                                required
                            />
                            {errors.description && <div className="error-message">{errors.description}</div>}
                        </div>
                        <div className={`form-group ${errors.plantCode ? 'has-error' : ''}`}>
                            <label>Plant</label>
                            {plantRestrictionMessage && (
                                <div className="plant-restriction-notice">
                                    <i className="fas fa-info-circle"></i> {plantRestrictionMessage}
                                </div>
                            )}
                            <select
                                className="form-control"
                                value={plantCode}
                                onChange={(e) => setPlantCode(e.target.value)}
                                disabled={!canBypassPlantRestriction && userPlantCode}
                                required
                            >
                                <option value="">Select a plant</option>
                                {plants.map(plant => (
                                    <option 
                                        key={plant.plant_code} 
                                        value={plant.plant_code}
                                        disabled={!canBypassPlantRestriction && userPlantCode && plant.plant_code !== userPlantCode}
                                    >
                                        {plant.plant_name}
                                    </option>
                                ))}
                            </select>
                            {errors.plantCode && <div className="error-message">{errors.plantCode}</div>}
                        </div>
                        <div className={`form-group ${errors.deadline ? 'has-error' : ''}`}>
                            <label>Deadline</label>
                            <input
                                type="datetime-local"
                                className="form-control"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                required
                            />
                            {errors.deadline && <div className="error-message">{errors.deadline}</div>}
                        </div>
                        <div className="form-group">
                            <label>Comments</label>
                            <textarea
                                className="form-control"
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                placeholder="Enter any additional comments"
                                rows={4}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button
                            type="button"
                            className="cancel-button"
                            onClick={onClose}
                            style={{ borderColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="primary-button"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving...' : (item ? 'Update Item' : 'Add Item')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ListAddView;
