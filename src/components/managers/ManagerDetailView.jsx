import React, { useState, useEffect } from 'react';
import { supabase } from '../../core/clients/SupabaseClient';
import { usePreferences } from '../../context/PreferencesContext';
import { DatabaseService } from '../../core/services/DatabaseService';
import ManagerCard from './ManagerCard';
import ThemeUtils from '../../utils/ThemeUtils';
import { useAuth } from '../../context/AuthContext';
import './ManagerDetailView.css';
import {UserService} from "../../services/UserService";

function ManagerDetailView({ managerId, onClose }) {
    // eslint-disable-next-line no-unused-vars
    const { preferences } = usePreferences();
    const { user } = useAuth();
    const [manager, setManager] = useState(null);
    const [plants, setPlants] = useState([]);
    const [availableRoles, setAvailableRoles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [message, setMessage] = useState('');
    const [originalValues, setOriginalValues] = useState({});
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [currentUserRoleWeight, setCurrentUserRoleWeight] = useState(0);

    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [plantCode, setPlantCode] = useState('');
    const [roleName, setRoleName] = useState('');
    const [password, setPassword] = useState('');
    const [showPasswordField, setShowPasswordField] = useState(false);

    useEffect(() => {
        document.body.classList.add('in-detail-view');
        return () => {
            document.body.classList.remove('in-detail-view');
        };
    }, []);

    useEffect(() => {
        if (managerId) {
            fetchManagerDetails();
            fetchPlants();
            fetchRoles();
            fetchCurrentUserRole();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [managerId]);

    // Fetch the current user's highest role weight
    const fetchCurrentUserRole = async () => {
        try {
            if (!user || !user.id) {
                console.warn('No authenticated user found for role check');
                return;
            }

            const highestRole = await UserService.getHighestRole(user.id);
            if (highestRole) {
                setCurrentUserRoleWeight(highestRole.weight || 0);
                console.log(`Current user has role ${highestRole.name} with weight ${highestRole.weight}`);
            } else {
                console.warn('No role found for current user');
                setCurrentUserRoleWeight(0);
            }
        } catch (error) {
            console.error('Error fetching current user role:', error);
            setCurrentUserRoleWeight(0);
        }
    };

    // Check if view should be read-only based on role weights
    useEffect(() => {
        if (!manager) return;

        const managerRoleWeight = manager.roleWeight || 0;
        const canEdit = currentUserRoleWeight > managerRoleWeight;

        setIsReadOnly(!canEdit);
        console.log(`Manager role weight: ${managerRoleWeight}, Current user role weight: ${currentUserRoleWeight}`);
        console.log(`Manager detail view is ${!canEdit ? 'read-only' : 'editable'}`);
    }, [manager, currentUserRoleWeight]);

    const fetchRoles = async () => {
        try {
            console.log('DETAIL VIEW: Fetching roles with multiple approaches');

            // 1. Try DatabaseService first (raw SQL)
            try {
                console.log('DETAIL VIEW: Using DatabaseService to get roles');
                const rolesData = await DatabaseService.getAllRecords('users_roles');
                console.log('DETAIL VIEW: Roles from DatabaseService:', rolesData);

                if (rolesData && rolesData.length > 0) {
                    console.log('DETAIL VIEW: Using roles from DatabaseService');
                    setAvailableRoles(rolesData);

                    // If current role is not in available roles, set to first role
                    const roleExists = rolesData.some(r => r.name === roleName);
                    if (!roleExists && rolesData.length > 0) {
                        console.log(`DETAIL VIEW: Current role ${roleName} not found, setting to ${rolesData[0].name}`);
                        setRoleName(rolesData[0].name);
                    }
                    return; // Exit if this approach worked
                }
            } catch (dbServiceError) {
                console.error('DETAIL VIEW: DatabaseService error:', dbServiceError.message);
                // Continue to next approach if this failed
            }

            // 2. Try direct Supabase query as fallback
            console.log('DETAIL VIEW: Directly querying with Supabase');
            const { data, error } = await supabase
                .from('users_roles')
                .select('*');

            if (error) {
                console.error('DETAIL VIEW: Supabase error:', error);
                throw error;
            }

            console.log('DETAIL VIEW: Roles from direct Supabase query:', data);

            if (data && Array.isArray(data) && data.length > 0) {
                console.log('DETAIL VIEW: Using roles from Supabase query');
                setAvailableRoles(data);

                // If current role is not in available roles, set to first role
                const roleExists = data.some(r => r.name === roleName);
                if (!roleExists && data.length > 0) {
                    setRoleName(data[0].name);
                }
            } else {
                console.warn('DETAIL VIEW: No roles found in database');
                setAvailableRoles([]);
            }
        } catch (error) {
            console.error('DETAIL VIEW: Error fetching roles:', error.message);
            setAvailableRoles([]);
        }
    };

    useEffect(() => {
        if (!originalValues.email || isLoading) return;

        const hasChanges =
            firstName !== originalValues.firstName ||
            lastName !== originalValues.lastName ||
            email !== originalValues.email ||
            plantCode !== originalValues.plantCode ||
            roleName !== originalValues.roleName ||
            (showPasswordField && password);

        setHasUnsavedChanges(hasChanges);
    }, [firstName, lastName, email, plantCode, roleName, password, showPasswordField, originalValues, isLoading]);

    const fetchManagerDetails = async () => {
        setIsLoading(true);
        try {
            // Get user data
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', managerId)
                .single();

            if (userError) throw userError;

            // Get profile data
            const { data: profileData, error: profileError } = await supabase
                .from('users_profiles')
                .select('*')
                .eq('id', managerId)
                .single();

            if (profileError) throw profileError;

            // Get user's role from users_permissions
            const { data: permissionData, error: permissionError } = await supabase
                .from('users_permissions')
                .select('role_id')
                .eq('user_id', managerId)
                .single();

            if (permissionError) {
                // If no role assigned, this is not an error to throw
                if (permissionError.code !== 'PGRST116') {
                    console.error('Error fetching permissions:', permissionError);
                    throw permissionError;
                }
            }

            // Get role name if role_id exists
            let roleName = 'User';
            let roleId = null;
            let roleWeight = 0;

            if (permissionData?.role_id) {
                const { data: roleData, error: roleError } = await supabase
                    .from('users_roles')
                    .select('name, id, weight')
                    .eq('id', permissionData.role_id)
                    .single();

                if (!roleError && roleData) {
                    roleName = roleData.name;
                    roleId = roleData.id;
                    roleWeight = roleData.weight || 0;
                }
            }

            // Combine the data
            const managerData = {
                id: managerId,
                email: userData.email,
                firstName: profileData.first_name,
                lastName: profileData.last_name,
                plantCode: profileData.plant_code,
                roleName: roleName,
                roleId: roleId,
                roleWeight: roleWeight,
                createdAt: profileData.created_at,
                updatedAt: profileData.updated_at,
            };

            setManager(managerData);
            setFirstName(managerData.firstName);
            setLastName(managerData.lastName);
            setEmail(managerData.email);
            setPlantCode(managerData.plantCode);
            setRoleName(managerData.roleName);

            setOriginalValues({
                firstName: managerData.firstName,
                lastName: managerData.lastName,
                email: managerData.email,
                plantCode: managerData.plantCode,
                roleName: managerData.roleName,
            });

            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Error fetching manager details:', error);
            setMessage('Error fetching manager details');
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPlants = async () => {
        try {
            const { data, error } = await supabase
                .from('plants')
                .select('*');

            if (error) throw error;
            setPlants(data || []);
        } catch (error) {
            console.error('Error fetching plants:', error);
        }
    };

    const handleSave = async () => {
        return new Promise(async (resolve, reject) => {
            if (!manager || !manager.id) {
                alert('Error: Cannot save manager with undefined ID');
                reject(new Error('Cannot save manager with undefined ID'));
                return;
            }

            setIsSaving(true);
            try {
                // Check if manager still exists before updating
                const { data: checkManager, error: checkError } = await supabase
                    .from('users_profiles')
                    .select('id')
                    .eq('id', manager.id)
                    .single();

                if (checkError || !checkManager) {
                    throw new Error(`Manager with ID ${manager.id} not found`);
                }

                // Update profiles
                const { error: profileError } = await supabase
                    .from('users_profiles')
                    .update({
                        first_name: firstName,
                        last_name: lastName,
                        plant_code: plantCode,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', manager.id);

                if (profileError) throw profileError;

                // Update email in users table
                const { error: userError } = await supabase
                    .from('users')
                    .update({
                        email,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', manager.id);

                if (userError) throw userError;

                // Find the role ID from the selected role name
                const selectedRole = availableRoles.find(role => role.name === roleName);
                if (!selectedRole) {
                    throw new Error(`Role '${roleName}' not found in available roles. Please refresh and try again.`);
                }

                const roleId = selectedRole.id;

                // Check if user already has a role
                const { data: existingPermission, error: permCheckError } = await supabase
                    .from('users_permissions')
                    .select('id')
                    .eq('user_id', managerId);

                if (permCheckError) throw permCheckError;

                // Update or insert the role permission
                if (existingPermission && existingPermission.length > 0) {
                    const { error: permUpdateError } = await supabase
                        .from('users_permissions')
                        .update({
                            role_id: roleId,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', managerId);

                    if (permUpdateError) throw permUpdateError;
                } else {
                    const { error: permInsertError } = await supabase
                        .from('users_permissions')
                        .insert({
                            user_id: managerId,
                            role_id: roleId,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });

                    if (permInsertError) throw permInsertError;
                }

                // Update password if provided
                if (showPasswordField && password) {
                    const { data: userData, error: userFetchError } = await supabase
                        .from('users')
                        .select('salt')
                        .eq('id', managerId)
                        .single();

                    if (userFetchError) throw userFetchError;

                    const salt = userData.salt;
                    const { AuthUtils } = await import('../../utils/AuthUtils');
                    const passwordHash = await AuthUtils.hashPassword(password, salt);

                    const { error: passwordError } = await supabase
                        .from('users')
                        .update({
                            password_hash: passwordHash,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', managerId);

                    if (passwordError) throw passwordError;
                }

                setMessage('Changes saved successfully!');
                setTimeout(() => setMessage(''), 3000);
                setOriginalValues({
                    firstName,
                    lastName,
                    email,
                    plantCode,
                    roleName,
                });
                setHasUnsavedChanges(false);
                setShowPasswordField(false);
                setPassword('');
                await fetchManagerDetails();
                // Success message and state update
                setMessage('Changes saved successfully!');
                setTimeout(() => setMessage(''), 3000);

                // Update the original values to match current values
                setOriginalValues({
                    firstName,
                    lastName,
                    email,
                    plantCode,
                    roleName
                });

                setHasUnsavedChanges(false);
                setIsSaving(false);
                resolve();
            } catch (error) {
                console.error('Error saving manager:', error);
                setMessage(`Error saving changes: ${error.message || 'Unknown error'}`);
                setTimeout(() => setMessage(''), 5000);
                setIsSaving(false);
                reject(error);
            }
        });
    };

    const handleDelete = async () => {
        if (!manager) return;

        if (!showDeleteConfirmation) {
            setShowDeleteConfirmation(true);
            return;
        }

        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', managerId);

            if (error) throw error;

            alert('Manager deleted successfully');
            onClose();
        } catch (error) {
            console.error('Error deleting manager:', error);
            alert('Error deleting manager');
        } finally {
            setShowDeleteConfirmation(false);
        }
    };

    const handleBackClick = () => {
        if (hasUnsavedChanges) {
            setShowUnsavedChangesModal(true);
        } else {
            onClose();
        }
    };

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const getPlantName = (plantCode) => {
        const plant = plants.find((p) => p.plant_code === plantCode);
        return plant ? plant.plant_name : plantCode || 'No Plant';
    };

    if (isLoading) {
        return (
            <div className="manager-detail-view">
                <div className="detail-header">
                    <button className="back-button" onClick={onClose}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1>Manager Details</h1>
                </div>
                <div className="detail-content">
                    <div className="content-loading-container">
                        <div className="ios-spinner"></div>
                        <p>Loading manager details...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!manager) {
        return (
            <div className="manager-detail-view">
                <div className="detail-header">
                    <button className="back-button" onClick={onClose}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1>Manager Not Found</h1>
                </div>
                <div className="error-message">
                    <p>Could not find the requested manager. They may have been deleted.</p>
                    <button className="primary-button" onClick={onClose}>
                        Return to Managers
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="manager-detail-view">
            {isSaving && (
                <div className="saving-overlay">
                    <div className="saving-indicator"></div>
                </div>
            )}

            <div className="detail-header">
                <div className="header-left">
                    <button
                        className="back-button"
                        onClick={handleBackClick}
                        aria-label="Back to managers"
                    >
                        <i className="fas fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                </div>
                <h1>
                    {manager.firstName} {manager.lastName || 'Manager Details'}
                </h1>
                <div className="header-actions">
                    {!isReadOnly && (
                        <>
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
                                Delete Manager
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="detail-content">
                {message && (
                    <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                        {message}
                    </div>
                )}

                {isReadOnly && (
                    <div className="message warning" style={{marginBottom: '16px'}}>
                        <i className="fas fa-lock" style={{marginRight: '8px'}}></i>
                        View-Only Mode | You can't edit this manager.
                    </div>
                )}

                <div className="manager-card-preview">
                    <ManagerCard
                        manager={manager}
                        plantName={getPlantName(manager.plantCode)}
                    />
                </div>

                <div className="detail-card">
                    <div className="card-header">
                        <h2>Edit Information</h2>
                    </div>
                    <p className="edit-instructions">
                        Make changes below and click Save when finished.
                    </p>

                    <div className="metadata-info" style={{ display: 'none' }}>
                        <div className="metadata-row">
                            <span className="metadata-label">Created:</span>
                            <span className="metadata-value">
                                {manager.createdAt
                                    ? new Date(manager.createdAt).toLocaleString()
                                    : 'Not Assigned'}
                            </span>
                        </div>
                        <div className="metadata-row">
                            <span className="metadata-label">Last Updated:</span>
                            <span className="metadata-value">
                                {manager.updatedAt
                                    ? new Date(manager.updatedAt).toLocaleString()
                                    : 'Not Assigned'}
                            </span>
                            <button 
                                onClick={e => { e.preventDefault(); fetchRoles(); }}
                                style={{marginLeft: '10px', fontSize: '10px'}}
                            >
                                Refresh roles
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>First Name</label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className={`form-control ${isReadOnly ? 'disabled-field' : ''}`}
                            readOnly={isReadOnly}
                        />
                    </div>

                    <div className="form-group">
                        <label>Last Name</label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className={`form-control ${isReadOnly ? 'disabled-field' : ''}`}
                            readOnly={isReadOnly}
                        />
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`form-control ${isReadOnly ? 'disabled-field' : ''}`}
                            readOnly={isReadOnly}
                        />
                    </div>

                    <div className="form-group">
                        <label>Plant</label>
                        <select
                            value={plantCode}
                            onChange={(e) => setPlantCode(e.target.value)}
                            className={`form-control ${isReadOnly ? 'disabled-field' : ''}`}
                            disabled={isReadOnly}
                        >
                            <option value="">Select Plant</option>
                            {plants
                                .sort((a, b) => {
                                    const aCode = parseInt(a.plant_code?.replace(/\D/g, '') || '0');
                                    const bCode = parseInt(b.plant_code?.replace(/\D/g, '') || '0');
                                    return aCode - bCode;
                                })
                                .map((plant) => (
                                    <option key={plant.plant_code} value={plant.plant_code}>
                                        ({plant.plant_code}) {plant.plant_name}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Role</label>
                        <select
                            value={roleName}
                            onChange={(e) => setRoleName(e.target.value)}
                            className={`form-control ${isReadOnly ? 'disabled-field' : ''}`}
                            disabled={isReadOnly}
                        >
                            {availableRoles.length === 0 ? (
                                <option value="">Loading roles...</option>
                            ) : (
                                availableRoles.map(role => (
                                    <option key={role.id} value={role.name}>
                                        {role.name}
                                    </option>
                                ))
                            )}
                        </select>
                        <div className="debug-info" style={{fontSize: '10px', color: '#888', marginTop: '4px'}}>
                            {availableRoles.length > 0 ? 
                                `Found ${availableRoles.length} roles in database` : 
                                'No roles found. Click refresh button above.'}
                            {isReadOnly && (
                                <div style={{color: '#e53e3e', marginTop: '4px'}}>
                                    You cannot edit this manager.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-group">
                        <div className="password-header">
                            <label>Password</label>
                            {!showPasswordField && !isReadOnly && (
                                <button
                                    className="text-button"
                                    onClick={() => setShowPasswordField(true)}
                                >
                                    Change Password
                                </button>
                            )}
                        </div>
                        {showPasswordField && (
                            <div className="password-fields">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    className="form-control"
                                />
                                <button
                                    className="text-button small"
                                    onClick={() => {
                                        setShowPasswordField(false);
                                        setPassword('');
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {!isReadOnly && (
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
                            Delete Manager
                        </button>
                    </div>
                )}
            </div>

            {showDeleteConfirmation && (
                <div className="confirmation-modal">
                    <div className="confirmation-content">
                        <h2>Confirm Delete</h2>
                        <p>
                            Are you sure you want to delete {manager.firstName} {manager.lastName}?
                            This action cannot be undone.
                        </p>
                        <div className="confirmation-actions">
                            <button
                                className="cancel-button"
                                onClick={() => setShowDeleteConfirmation(false)}
                            >
                                Cancel
                            </button>
                            <button className="danger-button" onClick={handleDelete}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showUnsavedChangesModal && (
                <div className="confirmation-modal">
                    <div className="confirmation-content">
                        <h2>Unsaved Changes</h2>
                        <p>
                            You have unsaved changes that will be lost if you navigate away. What
                            would you like to do?
                        </p>
                        <div className="confirmation-actions">
                            <button
                                className="cancel-button"
                                onClick={() => setShowUnsavedChangesModal(false)}
                            >
                                Continue Editing
                            </button>
                            <button
                                className="primary-button save-button"
                                onClick={async () => {
                                    setShowUnsavedChangesModal(false);
                                    try {
                                        await handleSave();
                                        setMessage('Changes saved successfully!');
                                        setTimeout(() => onClose(), 800);
                                    } catch (error) {
                                        console.error('Error saving before navigation:', error);
                                        setMessage('Error saving changes. Please try again.');
                                        setTimeout(() => setMessage(''), 3000);
                                    }
                                }}
                            >
                                Save & Leave
                            </button>
                            <button
                                className="danger-button"
                                onClick={() => {
                                    setShowUnsavedChangesModal(false);
                                    setHasUnsavedChanges(false);
                                    onClose();
                                }}
                            >
                                Discard & Leave
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ManagerDetailView;