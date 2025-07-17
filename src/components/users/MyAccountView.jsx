import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/DatabaseService';
import { AuthService } from '../../services/AuthService';
import { UserService } from "../../services/UserService";
import { usePreferences } from '../../context/PreferencesContext';
import './MyAccountView.css';
import SimpleLoading from "../common/SimpleLoading";

function MyAccountView({userId}) {
    const { preferences } = usePreferences();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [userRole, setUserRole] = useState('');
    const [plantCode, setPlantCode] = useState('');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);

    const accentColor = preferences.accentColor === 'red' ? '#b80017' : '#003896';
    const [activeTab, setActiveTab] = useState('profile');

    useEffect(() => {
        fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
        try {
            setLoading(true);
            setMessage('');
            const {data, error: sessionError} = await supabase.auth.getSession();
            const session = data?.session;
            const userIdToUse = userId || (session?.user?.id) || sessionStorage.getItem('userId');
            if (!userIdToUse) {
                setIsAuthenticated(false);
                throw new Error('No active session or user ID');
            }
            setIsAuthenticated(true);
            if (session?.user?.email) {
                setEmail(session.user.email);
            }
            if (!email) {
                try {
                    const {data: userData, error: userError} = await supabase
                        .from('users')
                        .select('email')
                        .eq('id', userIdToUse)
                        .single();
                    if (!userError && userData?.email) {
                        setEmail(userData.email);
                    }
                } catch (err) {
                    console.log('Could not fetch email from users table', err);
                }
            }
            console.log('Fetching profiles for user ID:', userIdToUse);
            const {data: profileData, error: profileError} = await supabase
                .from('users_profiles')
                .select('first_name, last_name, plant_code')
                .eq('id', userIdToUse)
                .single();
            console.log('Profile data received:', profileData, 'Error:', profileError);
            if (profileData?.email && !email) {
                setEmail(profileData.email);
            }
            if (profileData) {
                setUser({...profileData});
                setFirstName(profileData.first_name || '');
                setLastName(profileData.last_name || '');
                setPlantCode(profileData.plant_code || '');
                console.log('Profile data loaded:', profileData);
            } else {
                try {
                    const {data: nameData, error: nameError} = await supabase
                        .rpc('get_user_name', {user_id: userIdToUse});
                    if (!nameError && nameData) {
                        console.log('Got name from RPC:', nameData);
                        if (nameData.first_name) setFirstName(nameData.first_name);
                        if (nameData.last_name) setLastName(nameData.last_name);
                    }
                } catch (e) {
                    console.log('RPC not available or failed:', e);
                }
            }
            try {
                const highestRole = await UserService.getHighestRole(userIdToUse);
                if (highestRole) {
                    setUserRole(highestRole.name);
                }
            } catch (roleErr) {
                console.error('Error fetching user role:', roleErr);
            }
            if (!firstName || !lastName) {
                try {
                    const {data: usersData, error: usersError} = await supabase
                        .from('users')
                        .select('*, profiles(first_name, last_name)')
                        .eq('id', userIdToUse)
                        .single();
                    console.log('Alternative user data:', usersData);
                    if (!usersError && usersData?.profiles) {
                        if (usersData.profiles.first_name) setFirstName(usersData.profiles.first_name);
                        if (usersData.profiles.last_name) setLastName(usersData.profiles.last_name);
                        console.log('Set name from users join');
                    }
                } catch (err) {
                    console.error('Error getting user with profiles:', err);
                }
            }
        } catch (error) {
            console.error('Error fetching profiles:', error.message);
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const updateProfile = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            setMessage('');
            const userIdToUse = userId || sessionStorage.getItem('userId');
            if (!userIdToUse) {
                const {data: {session}, error: sessionError} = await supabase.auth.getSession();
                if (sessionError || !session) {
                    throw new Error('No active session or user ID');
                }
                const {error: profileError} = await supabase
                    .from('users_profiles')
                    .update({
                        first_name: firstName,
                        last_name: lastName,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', session.user.id);
                if (profileError) throw profileError;
            } else {
                const {error: profileError} = await supabase
                    .from('users_profiles')
                    .update({
                        first_name: firstName,
                        last_name: lastName,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', userIdToUse);
                if (profileError) throw profileError;
            }
            setMessage('Profile updated successfully!');
        } catch (error) {
            console.error('Error updating profiles:', error.message);
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const updatePassword = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            setPasswordError('');
            setMessage('');
            if (!currentPassword) {
                throw new Error('Current password is required');
            }
            if (newPassword !== confirmPassword) {
                throw new Error('New passwords do not match');
            }
            if (newPassword.length < 8) {
                throw new Error('Password must be at least 8 characters');
            }
            const {data: userData, error: userError} = await supabase
                .from('users')
                .select('id, email, password_hash, salt')
                .eq('email', email)
                .single();
            if (userError || !userData) {
                throw new Error('Could not verify current password');
            }
            const {AuthUtility} = await import('../../utils/AuthUtility');
            const computedHash = await AuthUtility.hashPassword(currentPassword, userData.salt);
            if (computedHash !== userData.password_hash) {
                throw new Error('Current password is incorrect');
            }
            const salt = AuthUtility.generateSalt();
            const newPasswordHash = await AuthUtility.hashPassword(newPassword, salt);
            const {error: updateError} = await supabase
                .from('users')
                .update({
                    password_hash: newPasswordHash,
                    salt: salt,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userData.id);
            if (updateError) {
                throw updateError;
            }
            console.log('Password updated successfully with new salt:', salt);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowPasswordModal(false);
            setMessage('Password updated successfully!');
        } catch (error) {
            console.error('Error updating password:', error.message);
            setPasswordError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const checkAuth = async () => {
        const {data} = await supabase.auth.getSession();
        return data?.session !== null;
    };

    const handleSignOut = async () => {
        try {
            setLoading(true);
            await AuthService.signOut();
            await supabase.auth.signOut();
            sessionStorage.removeItem('userId');
            window.location.href = '/';
        } catch (error) {
            console.error('Error signing out:', error);
            setMessage(`Error signing out: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="my-account-container">
            {loading && <SimpleLoading />}

            {/* Main Header with Profile Avatar */}
            <div className="account-hero">
                <div className="account-avatar" style={{ borderColor: accentColor }}>
                    {firstName && lastName
                        ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
                        : <i className="fas fa-user"></i>
                    }
                </div>
                <div className="account-hero-content">
                    <h1>
                        {(firstName || lastName) 
                            ? `${firstName || ''} ${lastName || ''}`.trim() 
                            : 'My Account'}
                    </h1>
                    <p className="account-subtitle">{email || 'No email available'}</p>
                    {userRole && <div className="account-badge" style={{ backgroundColor: accentColor }}>{userRole}</div>}
                    {plantCode && <div className="account-badge plant-badge">{plantCode}</div>}
                </div>
            </div>

            {/* Message Banner */}
            {message && (
                <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                    <div className="message-icon">
                        {message.includes('Error') 
                            ? <i className="fas fa-exclamation-circle"></i> 
                            : <i className="fas fa-check-circle"></i>}
                    </div>
                    <p>{message}</p>
                    <button 
                        className="message-close" 
                        onClick={() => setMessage('')}
                        aria-label="Dismiss message"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            )}

            {/* Tabs Navigation */}
            <div className="account-tabs">
                <button 
                    className={`tab ${activeTab === 'profile' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('profile')}
                    style={activeTab === 'profile' ? {borderBottomColor: accentColor} : {}}
                >
                    <i className="fas fa-user"></i> Profile
                </button>
                <button 
                    className={`tab ${activeTab === 'security' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('security')}
                    style={activeTab === 'security' ? {borderBottomColor: accentColor} : {}}
                >
                    <i className="fas fa-shield-alt"></i> Security
                </button>
            </div>

            {/* Profile Content */}
            <div className="account-tab-content" style={{ display: activeTab === 'profile' ? 'block' : 'none' }}>
                <div className="account-section">
                    <div className="section-header">
                        <h2><i className="fas fa-id-card" style={{ color: accentColor }}></i> Personal Information</h2>
                        <p>Update your personal details</p>
                    </div>
                    <div className="account-card elevated">
                        <form onSubmit={updateProfile} className="account-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="first_name">First Name</label>
                                    <div className="input-with-icon">
                                        <i className="fas fa-user" style={{ color: accentColor, marginRight: "8px" }}></i>
                                        <input
                                            type="text"
                                            id="first_name"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            placeholder="Enter your first name"
                                            required
                                            style={{ paddingLeft: "45px" }}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="last_name">Last Name</label>
                                    <div className="input-with-icon">
                                        <i className="fas fa-user" style={{ color: accentColor, marginRight: "8px" }}></i>
                                        <input
                                            type="text"
                                            id="last_name"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            placeholder="Enter your last name"
                                            required
                                            style={{ paddingLeft: "45px" }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="form-actions">
                                <button
                                    type="submit"
                                    className="btn primary"
                                    disabled={loading}
                                    style={{ backgroundColor: accentColor }}
                                >
                                    <i className="fas fa-save"></i> Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="account-section">
                    <div className="section-header">
                        <h2><i className="fas fa-info-circle" style={{ color: accentColor }}></i> Account Details</h2>
                        <p>Your account information</p>
                    </div>
                    <div className="account-card elevated">
                        <div className="info-grid">
                            <div className="info-item">
                                <div className="info-label">
                                    <i className="fas fa-envelope" style={{ color: accentColor }}></i>
                                    Email
                                </div>
                                <div className="info-value">{email || 'Not available'}</div>
                            </div>

                            {userRole && (
                                <div className="info-item">
                                    <div className="info-label">
                                        <i className="fas fa-user-tag" style={{ color: accentColor }}></i>
                                        Role
                                    </div>
                                    <div className="info-value">{userRole}</div>
                                </div>
                            )}

                            {plantCode && (
                                <div className="info-item">
                                    <div className="info-label">
                                        <i className="fas fa-building" style={{ color: accentColor }}></i>
                                        Plant Code
                                    </div>
                                    <div className="info-value">{plantCode}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {}
            <div className="account-tab-content" style={{ display: activeTab === 'security' ? 'block' : 'none' }}>
                {}
                <div className="account-section">
                    <div className="section-header">
                        <h2><i className="fas fa-shield-alt" style={{ color: accentColor }}></i> Account Security</h2>
                        <p>Manage your password and protect your account</p>
                    </div>

                    <div className="security-overview">
                        <div className="security-status-card" style={{ borderColor: accentColor }}>
                            <div className="security-status-header">
                                <div className="security-status-icon" style={{ backgroundColor: accentColor }}>
                                    <i className="fas fa-user-shield"></i>
                                </div>
                                <div className="security-status-title">
                                    <h3>Security Status</h3>
                                    <div className="security-badge secure">
                                        <i className="fas fa-check-circle"></i> Secure
                                    </div>
                                </div>
                            </div>
                            <div className="security-metrics">
                                <div className="security-metric">
                                    <div className="metric-label">Password Strength</div>
                                    <div className="strength-bar">
                                        <div className="strength-indicator high" style={{ width: '85%', backgroundColor: accentColor }}></div>
                                    </div>
                                    <div className="metric-value">Strong</div>
                                </div>
                                <div className="security-metric">
                                    <div className="metric-label">Online Status</div>
                                    <div className="online-status-indicator">
                                        <span className="status-dot" style={{ backgroundColor: '#10b981' }}></span>
                                        <span className="status-text">Active and Visible to Others</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="security-actions-grid">
                        {/* Password Change Card */}
                        <div className="security-action-card">
                            <div className="action-card-content">
                                <div className="action-icon" style={{ backgroundColor: accentColor }}>
                                    <i className="fas fa-key"></i>
                                </div>
                                <h3>Password Management</h3>
                                <p>Change your password regularly to keep your account secure</p>
                                <button 
                                    className="btn action-btn" 
                                    onClick={() => setShowPasswordModal(true)}
                                    style={{ backgroundColor: accentColor }}
                                >
                                    <i className="fas fa-lock"></i> Change Password
                                </button>
                            </div>
                        </div>

                        {/* Session Management Card */}
                        <div className="security-action-card">
                            <div className="action-card-content">
                                <div className="action-icon" style={{ backgroundColor: accentColor }}>
                                    <i className="fas fa-laptop"></i>
                                </div>
                                <h3>Session Management</h3>
                                <p>Control your active sessions across devices</p>
                                <div className="active-session">
                                    <div className="session-icon">
                                        <i className="fas fa-desktop"></i>
                                    </div>
                                    <div className="session-info">
                                        <div className="session-name">Current Browser</div>
                                        <div className="session-details">
                                            <span className="session-status">•</span> Active now
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Account Actions */}
                <div className="account-section">
                    <div className="section-header">
                        <h2><i className="fas fa-cogs" style={{ color: accentColor }}></i> Account Actions</h2>
                        <p>Manage your account settings and sessions</p>
                    </div>

                    <div className="account-actions">
                        <div className="action-button-container" style={{width: '100%'}}>
                            <button 
                                className="action-button logout" 
                                onClick={handleSignOut}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    backgroundColor: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-light)',
                                    padding: '1rem 1.5rem',
                                    borderRadius: '8px',
                                    width: '100%',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div className="action-button-icon" style={{
                                    width: '2.5rem',
                                    height: '2.5rem',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    fontSize: '1.2rem',
                                    backgroundColor: '#fee2e2',
                                    color: '#dc2626'
                                }}>
                                    <i className="fas fa-sign-out-alt"></i>
                                </div>
                                <div className="action-button-content" style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    textAlign: 'left'
                                }}>
                                    <span className="action-title" style={{fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem'}}>
                                        Sign Out
                                    </span>
                                    <span className="action-description" style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                                        End your current session
                                    </span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Security Tips */}
                <div className="account-section">
                    <div className="section-header">
                        <h2><i className="fas fa-info-circle" style={{ color: accentColor }}></i> Security Tips</h2>
                        <p>Recommended practices to keep your account secure</p>
                    </div>

                    <div className="security-tips-container">
                        <div className="security-tip">
                            <div className="tip-icon">
                                <i className="fas fa-fingerprint" style={{ color: accentColor }}></i>
                            </div>
                            <div className="tip-content">
                                <h4>Use a Strong Password</h4>
                                <p>Create a password with at least 8 characters including uppercase letters, numbers, and symbols.</p>
                            </div>
                        </div>

                        <div className="security-tip">
                            <div className="tip-icon">
                                <i className="fas fa-sync-alt" style={{ color: accentColor }}></i>
                            </div>
                            <div className="tip-content">
                                <h4>Change Regularly</h4>
                                <p>Update your password every 90 days to maintain strong security.</p>
                            </div>
                        </div>

                        <div className="security-tip">
                            <div className="tip-icon">
                                <i className="fas fa-user-secret" style={{ color: accentColor }}></i>
                            </div>
                            <div className="tip-content">
                                <h4>Don't Share Credentials</h4>
                                <p>Never share your login information with others or store it in unsecured locations.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div className="modal-overlay" onClick={() => !loading && setShowPasswordModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ margin: '0 auto' }}>
                        <div className="modal-header">
                            <h3><i className="fas fa-key" style={{ color: accentColor }}></i> Change Password</h3>
                            <button
                                className="modal-close"
                                onClick={() => !loading && setShowPasswordModal(false)}
                                disabled={loading}
                                aria-label="Close modal"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {passwordError && (
                            <div className="message error" style={{ margin: '1rem 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: '#feeaea', borderRadius: '8px', color: '#d32f2f' }}>
                                <i className="fas fa-exclamation-circle"></i>
                                <p style={{ margin: 0 }}>{passwordError}</p>
                            </div>
                        )}

                        <form onSubmit={updatePassword} className="password-form">
                            <div className="form-group">
                                <label htmlFor="current_password">Current Password</label>
                                <div className="input-with-icon">
                                    <i className="fas fa-lock" style={{ color: accentColor, marginRight: "8px" }}></i>
                                    <input
                                        type="password"
                                        id="current_password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder="Enter your current password"
                                        required
                                        style={{ paddingLeft: "45px" }}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="new_password">New Password</label>
                                <div className="input-with-icon">
                                    <i className="fas fa-lock" style={{ color: accentColor, marginRight: "8px" }}></i>
                                    <input
                                        type="password"
                                        id="new_password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        required
                                        style={{ paddingLeft: "45px" }}
                                    />
                                </div>
                                <small>Password must be at least 8 characters</small>
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirm_password">Confirm New Password</label>
                                <div className="input-with-icon">
                                    <i className="fas fa-lock" style={{ color: accentColor, marginRight: "8px" }}></i>
                                    <input
                                        type="password"
                                        id="confirm_password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                        required
                                        style={{ paddingLeft: "45px" }}
                                    />
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn secondary"
                                    onClick={() => setShowPasswordModal(false)}
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn primary"
                                    disabled={loading || !currentPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 8}
                                    style={{ backgroundColor: accentColor }}
                                >
                                    <i className="fas fa-check"></i> Update Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MyAccountView;