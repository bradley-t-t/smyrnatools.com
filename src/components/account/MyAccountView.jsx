import React, {useEffect, useState} from 'react';
import {supabase} from '../../core/clients/SupabaseClient';
import {AuthService} from '../../services/auth/AuthService';
import SimpleLoading from '../common/SimpleLoading';
import {usePreferences} from '../../context/PreferencesContext';
import './MyAccountView.css';

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

    useEffect(() => {
        fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
        try {
            setLoading(true);
            setMessage('');

            // First get the current session regardless of userId
            const {data, error: sessionError} = await supabase.auth.getSession();
            const session = data?.session;

            // Get user ID from session, props, or storage
            const userIdToUse = userId || (session?.user?.id) || sessionStorage.getItem('userId');

            if (!userIdToUse) {
                setIsAuthenticated(false);
                throw new Error('No active session or user ID');
            }

            setIsAuthenticated(true);

            // Set email from session if available
            if (session?.user?.email) {
                setEmail(session.user.email);
            }

            // If email is still not set, try to get it from users table
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

            console.log('Fetching profile for user ID:', userIdToUse);

            const {data: profileData, error: profileError} = await supabase
                .from('profiles')
                .select('first_name, last_name, plant_code, email')
                .eq('id', userIdToUse)
                .single();

            console.log('Profile data received:', profileData, 'Error:', profileError);

            // If profile has email and we don't have it from session, use from profile
            if (profileData?.email && !email) {
                setEmail(profileData.email);
            }

            // Store profile data
            if (profileData) {
                // Ensure we set the user data
                setUser({...profileData});

                // Set the individual fields
                setFirstName(profileData.first_name || '');
                setLastName(profileData.last_name || '');
                setPlantCode(profileData.plant_code || '');

                console.log('Profile data loaded:', profileData);
            } else {
                // Try a raw SQL query to get the name if all else fails
                try {
                    // This uses RPC or stored procedure if available
                    const {data: nameData, error: nameError} = await supabase
                        .rpc('get_user_name', {user_id: userIdToUse});

                    if (!nameError && nameData) {
                        console.log('Got name from RPC:', nameData);
                        if (nameData.first_name) setFirstName(nameData.first_name);
                        if (nameData.last_name) setLastName(nameData.last_name);
                    }
                } catch (e) {
                    console.log('RPC not available or failed:', e);
                    // Ignore errors here as this is just a fallback
                }
            }

            // Fetch user role using AccountManager
            try {
                const { AccountManager } = await import('../../core/managers/AccountManager');
                const highestRole = await AccountManager.getHighestRole(userIdToUse);
                if (highestRole) {
                    setUserRole(highestRole.name);
                }
            } catch (roleErr) {
                console.error('Error fetching user role:', roleErr);
            }

            // If we still don't have first/last name, try one more source
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
                    console.error('Error getting user with profile:', err);
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error.message);
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

            // Use passed userId, or get from session, or from storage
            const userIdToUse = userId || sessionStorage.getItem('userId');

            if (!userIdToUse) {
                // Last attempt - try to get from active session
                const {data: {session}, error: sessionError} = await supabase.auth.getSession();
                if (sessionError || !session) {
                    throw new Error('No active session or user ID');
                }

                // Use session user ID
                const {error: profileError} = await supabase
                    .from('profiles')
                    .update({
                        first_name: firstName,
                        last_name: lastName,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', session.user.id);

                if (profileError) throw profileError;
            } else {
                // Use available user ID
                const {error: profileError} = await supabase
                    .from('profiles')
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
            console.error('Error updating profile:', error.message);
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

            // Get user data from database first
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, email, password_hash, salt')
                .eq('email', email)
                .single();

            if (userError || !userData) {
                throw new Error('Could not verify current password');
            }

            // Verify current password using AuthUtils
            const { AuthUtils } = await import('../../utils/AuthUtils');
            const computedHash = await AuthUtils.hashPassword(currentPassword, userData.salt);

            if (computedHash !== userData.password_hash) {
                throw new Error('Current password is incorrect');
            }

            // Ensure we're using the same method to hash the password as the Swift client
            // by directly creating and storing the hash ourselves instead of using updatePassword
            const salt = AuthUtils.generateSalt();
            const newPasswordHash = await AuthUtils.hashPassword(newPassword, salt);

            // Update password directly in the database instead of using AuthService
            // This ensures compatibility with Swift client
            const { error: updateError } = await supabase
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

            // Log the success for debugging
            console.log('Password updated successfully with new salt:', salt);

            // Clear form and close modal
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

    // 2FA functionality removed as requested

    // Check if user is authenticated using Supabase session
    const checkAuth = async () => {
        const {data} = await supabase.auth.getSession();
        return data?.session !== null;
    };

    // We'll use the authentication check from fetchUserProfile instead of a separate userId
    // If fetchUserProfile encounters an error, it will show the appropriate message

    // Handle sign out
    const handleSignOut = async () => {
        try {
            setLoading(true);

            // Use AuthService to sign out
            await AuthService.signOut();

            // Also sign out from Supabase Auth
            await supabase.auth.signOut();

            // Clear session storage
            sessionStorage.removeItem('userId');

            // Redirect to login page (the app will handle this automatically on next render)
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
            <div className="account-header">
                <h1>My Account</h1>
                <p>Manage your personal information and security settings</p>
            </div>

            {loading && <SimpleLoading />}

            <div className="account-content">
                {message && (
                    <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                        {message}
                    </div>
                )}

                {/* Account Information */}
                <div className="account-card" style={{ textAlign: 'left', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div className="account-card-header" style={{ textAlign: 'left' }}>
                        <h2 style={{ textAlign: 'left' }}><i className="fas fa-user-circle" style={{ color: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}></i> Account Information</h2>
                    </div>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', flex: '1' }}>
                        <tbody>
                            <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                                <td style={{ padding: '10px 0', width: '140px', textAlign: 'left' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <i className="fas fa-user" style={{ color: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}></i>
                                        <strong>Name:</strong>
                                    </span>
                                </td>
                                <td style={{ padding: '10px 0', textAlign: 'left' }}>
                                    {(firstName || lastName) ? `${firstName || ''} ${lastName || ''}`.trim() : 'Name not available'}
                                </td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                                <td style={{ padding: '10px 0', textAlign: 'left' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <i className="fas fa-envelope" style={{ color: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}></i>
                                        <strong>Email:</strong>
                                    </span>
                                </td>
                                <td style={{ padding: '10px 0', textAlign: 'left' }}>
                                    {email || 'No email available'}
                                </td>
                            </tr>
                            {userRole && (
                                <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                                    <td style={{ padding: '10px 0', textAlign: 'left' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <i className="fas fa-user-tag" style={{ color: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}></i>
                                            <strong>Role:</strong>
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 0', textAlign: 'left' }}>
                                        {userRole}
                                    </td>
                                </tr>
                            )}
                            {plantCode && (
                                <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                                    <td style={{ padding: '10px 0', textAlign: 'left' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <i className="fas fa-building" style={{ color: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}></i>
                                            <strong>Plant Code:</strong>
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 0', textAlign: 'left' }}>
                                        {plantCode}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Profile Information */}
                <div className="account-card" style={{ textAlign: 'left' }}>
                    <div className="account-card-header">
                        <h2><i className="fas fa-id-card" style={{ color: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}></i> Personal Information</h2>
                        <p>Update your personal details</p>
                    </div>
                    <form onSubmit={updateProfile} className="account-form">
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="first_name">First Name</label>
                                <input
                                    type="text"
                                    id="first_name"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="First Name"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="last_name">Last Name</label>
                                <input
                                    type="text"
                                    id="last_name"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Last Name"
                                    required
                                />
                            </div>
                        </div>
                        {/* Phone field removed as it doesn't exist in the database schema */}
                        <div className="form-actions">
                            <button 
                                type="submit" 
                                className="save-button" 
                                disabled={loading}
                                style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>

                {/* Security Settings */}
                <div className="account-card" style={{ textAlign: 'left', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div className="account-card-header">
                        <h2><i className="fas fa-shield-alt" style={{ color: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}></i> Security</h2>
                        <p>Manage your password and security settings</p>
                    </div>

                    <button 
                        className="password-button" 
                        onClick={() => setShowPasswordModal(true)}
                        style={{ 
                            backgroundColor: 'var(--bg-primary)', 
                            color: 'var(--text-primary)',
                            borderColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'
                        }}
                    >
                        <span className="password-button-text">
                            <i className="fas fa-lock" style={{ color: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}></i>
                            Change Password
                        </span>
                        <i className="fas fa-chevron-right" style={{ color: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}></i>
                    </button>

                    <div className="sign-out-divider"></div>

                    <button 
                        className="sign-out-button" 
                        onClick={handleSignOut} 
                        disabled={loading}
                        style={{ backgroundColor: 'var(--bg-primary)' }}
                    >
                        <span className="sign-out-button-text" style={{ color: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}>
                            <i className="fas fa-sign-out-alt" style={{ color: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}></i>
                            Sign Out
                        </span>
                        <i className="fas fa-chevron-right" style={{ color: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}></i>
                    </button>
                </div>
            </div>

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div className="modal-backdrop" onClick={() => !loading && setShowPasswordModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Change Password</h3>
                            <button 
                                className="modal-close-btn" 
                                onClick={() => !loading && setShowPasswordModal(false)}
                                disabled={loading}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {passwordError && (
                            <div className="message error">
                                {passwordError}
                            </div>
                        )}

                        <form onSubmit={updatePassword}>
                            <div className="form-group">
                                <label htmlFor="current_password">Current Password</label>
                                <input
                                    type="password"
                                    id="current_password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter your current password"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="new_password">New Password</label>
                                <input
                                    type="password"
                                    id="new_password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    required
                                />
                                <small>Password must be at least 8 characters</small>
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirm_password">Confirm New Password</label>
                                <input
                                    type="password"
                                    id="confirm_password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    required
                                />
                            </div>

                            <div className="modal-actions">
                                <button 
                                    type="button" 
                                    className="modal-cancel-btn"
                                    onClick={() => setShowPasswordModal(false)}
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="modal-submit-btn"
                                    disabled={loading || !currentPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 8}
                                    style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}
                                >
                                    Update Password
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