import React, {useState, useEffect} from 'react';
import {supabase} from '../../../services/DatabaseService';
import {usePreferences} from '../../../app/context/PreferencesContext';
import LoadingScreen from '../common/LoadingScreen';
import ManagerCard from './ManagerCard';
import {useAuth} from '../../../app/context/AuthContext';
import './styles/ManagerDetailView.css';
import {UserService} from '../../../services/UserService';
import {DatabaseService} from '../../../services/DatabaseService';
import {AuthUtility} from '../../../utils/AuthUtility';
import ThemeUtility from '../../../utils/ThemeUtility';

function ManagerDetailView({managerId, onClose}) {
    const {preferences} = usePreferences();
    const {user} = useAuth();
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
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [plantCode, setPlantCode] = useState('');
    const [roleName, setRoleName] = useState('');
    const [password, setPassword] = useState('');
    const [showPasswordField, setShowPasswordField] = useState(false);

    useEffect(() => {
        document.body.classList.add('in-detail-view');
        return () => document.body.classList.remove('in-detail-view');
    }, []);

    useEffect(() => {
        if (managerId) {
            Promise.all([fetchManagerDetails(), fetchPlants(), fetchRoles(), fetchCurrentUserRole()]).catch(() => {});
        }
    }, [managerId]);

    useEffect(() => {
        const headerElement = document.querySelector('.detail-header');
        if (headerElement) {
            headerElement.style.backgroundColor = preferences.themeMode === 'dark' ? '#2a2a2a' : '#ffffff';
            const headerTitle = headerElement.querySelector('h1');
            if (headerTitle) {
                headerTitle.style.color = preferences.themeMode === 'dark' ? '#f5f5f5' : '#212122';
            }
        }
    }, [preferences.themeMode]);

    useEffect(() => {
        if (!manager || isLoading) return;
        const hasChanges =
            firstName !== originalValues.firstName ||
            lastName !== originalValues.lastName ||
            email !== originalValues.email ||
            plantCode !== originalValues.plantCode ||
            roleName !== originalValues.roleName ||
            (showPasswordField && password);
        setHasUnsavedChanges(hasChanges);
    }, [firstName, lastName, email, plantCode, roleName, password, showPasswordField, originalValues, isLoading]);

    useEffect(() => {
        if (!manager) return;
        setIsReadOnly(currentUserRoleWeight <= (manager.roleWeight || 0));
    }, [manager, currentUserRoleWeight]);

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

    async function fetchCurrentUserRole() {
        try {
            if (!user?.id) return;
            const highestRole = await UserService.getHighestRole(user.id);
            setCurrentUserRoleWeight(highestRole?.weight || 0);
        } catch (error) {
            console.error('Error fetching current user role:', error);
            setCurrentUserRoleWeight(0);
        }
    }

    async function fetchRoles() {
        try {
            const rolesData = await DatabaseService.getAllRecords('users_roles');
            if (rolesData?.length) {
                setAvailableRoles(rolesData);
                if (!rolesData.some(r => r.name === roleName) && rolesData.length) {
                    setRoleName(rolesData[0].name);
                }
                return;
            }

            const {data, error} = await supabase.from('users_roles').select('*');
            if (error) throw error;
            setAvailableRoles(data || []);
            if (data?.length && !data.some(r => r.name === roleName)) {
                setRoleName(data[0].name);
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
            setAvailableRoles([]);
        }
    }

    async function fetchManagerDetails() {
        setIsLoading(true);
        try {
            const [{data: userData, error: userError}, {data: profileData, error: profileError}, {data: permissionData, error: permissionError}] = await Promise.all([
                supabase.from('users').select('*').eq('id', managerId).single(),
                supabase.from('users_profiles').select('*').eq('id', managerId).single(),
                supabase.from('users_permissions').select('role_id').eq('user_id', managerId).single()
            ]);

            if (userError) throw userError;
            if (profileError) throw profileError;
            if (permissionError && permissionError.code !== 'PGRST116') throw permissionError;

            let roleName = 'User', roleId = null, roleWeight = 0;
            if (permissionData?.role_id) {
                const {data: roleData, error: roleError} = await supabase
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

            const managerData = {
                id: managerId,
                email: userData.email,
                firstName: profileData.first_name,
                lastName: profileData.last_name,
                plantCode: profileData.plant_code,
                roleName,
                roleId,
                roleWeight,
                createdAt: profileData.created_at,
                updatedAt: profileData.updated_at
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
                roleName: managerData.roleName
            });
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Error fetching manager details:', error);
            setMessage('Error fetching manager details');
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setIsLoading(false);
        }
    }

    async function fetchPlants() {
        try {
            const {data, error} = await supabase.from('plants').select('*');
            if (error) throw error;
            setPlants(data || []);
        } catch (error) {
            console.error('Error fetching plants:', error);
        }
    }

    async function handleSave() {
        if (!manager?.id) {
            alert('Error: Cannot save manager with undefined ID');
            throw new Error('Cannot save manager with undefined ID');
        }

        setIsSaving(true);
        try {
            const {data: checkManager} = await supabase.from('users_profiles').select('id').eq('id', manager.id).single();
            if (!checkManager) throw new Error(`Manager with ID ${manager.id} not found`);

            const [{error: profileError}, {error: userError}] = await Promise.all([
                supabase.from('users_profiles').update({
                    first_name: firstName,
                    last_name: lastName,
                    plant_code: plantCode,
                    updated_at: new Date().toISOString()
                }).eq('id', manager.id),
                supabase.from('users').update({
                    email,
                    updated_at: new Date().toISOString()
                }).eq('id', manager.id)
            ]);

            if (profileError) throw profileError;
            if (userError) throw userError;

            const selectedRole = availableRoles.find(role => role.name === roleName);
            if (!selectedRole) throw new Error(`Role '${roleName}' not found in available roles.`);

            const {data: existingPermission} = await supabase.from('users_permissions').select('id').eq('user_id', managerId);
            const updateData = {
                role_id: selectedRole.id,
                updated_at: new Date().toISOString()
            };
            const {error: permError} = existingPermission?.length
                ? await supabase.from('users_permissions').update(updateData).eq('user_id', managerId)
                : await supabase.from('users_permissions').insert({...updateData, user_id: managerId, created_at: new Date().toISOString()});
            if (permError) throw permError;

            if (showPasswordField && password) {
                const {data: userData, error: userFetchError} = await supabase.from('users').select('salt').eq('id', managerId).single();
                if (userFetchError) throw userFetchError;
                const passwordHash = await AuthUtility.hashPassword(password, userData.salt);
                const {error: passwordError} = await supabase.from('users').update({
                    password_hash: passwordHash,
                    updated_at: new Date().toISOString()
                }).eq('id', managerId);
                if (passwordError) throw passwordError;
            }

            setMessage('Changes saved successfully!');
            setTimeout(() => setMessage(''), 3000);
            setOriginalValues({firstName, lastName, email, plantCode, roleName});
            setHasUnsavedChanges(false);
            setShowPasswordField(false);
            setPassword('');
            await fetchManagerDetails();
        } catch (error) {
            console.error('Error saving manager:', error);
            setMessage(`Error saving changes: ${error.message || 'Unknown error'}`);
            setTimeout(() => setMessage(''), 5000);
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete() {
        if (!manager) return;
        if (!showDeleteConfirmation) {
            setShowDeleteConfirmation(true);
            return;
        }

        try {
            const {error} = await supabase.from('users').delete().eq('id', managerId);
            if (error) throw error;
            alert('Manager deleted successfully');
            onClose();
        } catch (error) {
            console.error('Error deleting manager:', error);
            alert('Error deleting manager');
        } finally {
            setShowDeleteConfirmation(false);
        }
    }

    const handleBackClick = () => {
        if (hasUnsavedChanges) setShowUnsavedChangesModal(true);
        else onClose();
    };

    const getPlantName = plantCode => {
        const plant = plants.find(p => p.plant_code === plantCode);
        return plant ? plant.plant_name : plantCode || 'No Plant';
    };

    if (isLoading) {
        return (
            <div className="manager-detail-view">
                <div className="detail-header">
                    <div className="header-left">
                        <button className="back-button" onClick={onClose}>
                            <i className="fas fa-arrow-left"></i>
                        </button>
                    </div>
                    <div className="header-center">
                        <h1>Manager Details</h1>
                    </div>
                    <div className="header-right"></div>
                </div>
                <div className="detail-content">
                    <LoadingScreen message="Loading manager details..." inline={true} />
                </div>
            </div>
        );
    }

    if (!manager) {
        return (
            <div className="manager-detail-view">
                <div className="detail-header">
                    <div className="header-left">
                        <button className="back-button" onClick={onClose}>
                            <i className="fas fa-arrow-left"></i>
                        </button>
                    </div>
                    <div className="header-center">
                        <h1>Manager Not Found</h1>
                    </div>
                    <div className="header-right"></div>
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
                    <button className="back-button" onClick={handleBackClick} aria-label="Back to managers">
                        <i className="fas fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1>{manager.firstName} {manager.lastName || 'Manager Details'}</h1>
                </div>
                <div className="header-right"></div>
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
                    <ManagerCard manager={manager} plantName={getPlantName(manager.plantCode)} />
                </div>
                <div className="detail-card">
                    <div className="card-header">
                        <h2>Edit Information</h2>
                    </div>
                    <p className="edit-instructions">Make changes below and click Save when finished.</p>
                    <div className="metadata-info" style={{display: 'none'}}>
                        <div className="metadata-row">
                            <span className="metadata-label">Created:</span>
                            <span className="metadata-value">{manager.createdAt ? new Date(manager.createdAt).toLocaleString() : 'Not Assigned'}</span>
                        </div>
                        <div className="metadata-row">
                            <span className="metadata-label">Last Updated:</span>
                            <span className="metadata-value">{manager.updatedAt ? new Date(manager.updatedAt).toLocaleString() : 'Not Assigned'}</span>
                            <button onClick={() => fetchRoles()} style={{marginLeft: '10px', fontSize: '10px'}}>Refresh roles</button>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>First Name</label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                            className={`form-control ${isReadOnly ? 'disabled-field' : ''}`}
                            readOnly={isReadOnly}
                        />
                    </div>
                    <div className="form-group">
                        <label>Last Name</label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={e => setLastName(e.target.value)}
                            className={`form-control ${isReadOnly ? 'disabled-field' : ''}`}
                            readOnly={isReadOnly}
                        />
                    </div>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className={`form-control ${isReadOnly ? 'disabled-field' : ''}`}
                            readOnly={isReadOnly}
                        />
                    </div>
                    <div className="form-group">
                        <label>Plant</label>
                        <select
                            value={plantCode}
                            onChange={e => setPlantCode(e.target.value)}
                            className={`form-control ${isReadOnly ? 'disabled-field' : ''}`}
                            disabled={isReadOnly}
                        >
                            <option value="">Select Plant</option>
                            {plants.sort((a, b) => parseInt(a.plant_code?.replace(/\D/g, '') || '0') - parseInt(b.plant_code?.replace(/\D/g, '') || '0')).map(plant => (
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
                            onChange={e => setRoleName(e.target.value)}
                            className={`form-control ${isReadOnly ? 'disabled-field' : ''}`}
                            disabled={isReadOnly}
                        >
                            {availableRoles.length ? availableRoles.map(role => (
                                <option key={role.id} value={role.name}>{role.name}</option>
                            )) : (
                                <option value="">Loading roles...</option>
                            )}
                        </select>
                        <div className="debug-info" style={{fontSize: '10px', color: '#888', marginTop: '4px'}}>
                            {availableRoles.length ? `Found ${availableRoles.length} roles in database` : 'No roles found. Click refresh button above.'}
                            {isReadOnly && (
                                <div style={{color: '#e53e3e', marginTop: '4px'}}>You cannot edit this manager.</div>
                            )}
                        </div>
                    </div>
                    <div className="form-group">
                        <div className="password-header">
                            <label>Password</label>
                            {!showPasswordField && !isReadOnly && (
                                <button className="text-button" onClick={() => setShowPasswordField(true)}>Change Password</button>
                            )}
                        </div>
                        {showPasswordField && (
                            <div className="password-fields">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    className="form-control"
                                />
                                <button className="text-button small" onClick={() => { setShowPasswordField(false); setPassword(''); }}>
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                {!isReadOnly && (
                    <div className="form-actions">
                        <button className="primary-button save-button" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button className="danger-button" onClick={() => setShowDeleteConfirmation(true)} disabled={isSaving}>
                            Delete Manager
                        </button>
                    </div>
                )}
            </div>
            {showDeleteConfirmation && (
                <div className="confirmation-modal" style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999}}>
                    <div className="confirmation-content" style={{width: '90%', maxWidth: '500px', margin: '0 auto'}}>
                        <h2>Confirm Delete</h2>
                        <p>Are you sure you want to delete {manager.firstName} {manager.lastName}? This action cannot be undone.</p>
                        <div className="confirmation-actions" style={{display: 'flex', justifyContent: 'center', gap: '12px'}}>
                            <button className="cancel-button" onClick={() => setShowDeleteConfirmation(false)}>Cancel</button>
                            <button className="danger-button" onClick={handleDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
            {showUnsavedChangesModal && (
                <div className="confirmation-modal" style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.5)'}}>
                    <div className="confirmation-content" style={{width: '90%', maxWidth: '500px', margin: '0 auto'}}>
                        <h2>Unsaved Changes</h2>
                        <p>You have unsaved changes that will be lost if you navigate away. What would you like to do?</p>
                        <div className="confirmation-actions" style={{justifyContent: 'center', flexWrap: 'wrap', display: 'flex', gap: '12px'}}>
                            <button className="cancel-button" onClick={() => setShowUnsavedChangesModal(false)}>Continue Editing</button>
                            <button className="primary-button save-button" style={{backgroundColor: 'var(--accent-color)'}} onClick={async () => {
                                setShowUnsavedChangesModal(false);
                                try {
                                    await handleSave();
                                    setMessage('Changes saved successfully!');
                                    setTimeout(() => onClose(), 800);
                                } catch (error) {
                                    setMessage('Error saving changes. Please try again.');
                                    setTimeout(() => setMessage(''), 3000);
                                }
                            }}>Save & Leave</button>
                            <button className="danger-button" onClick={() => {
                                setShowUnsavedChangesModal(false);
                                setHasUnsavedChanges(false);
                                onClose();
                            }}>Discard & Leave</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ManagerDetailView;

