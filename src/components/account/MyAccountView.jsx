import React, {useEffect, useState} from 'react';
import {supabase} from '../../core/SupabaseClient';
import {AuthService} from '../../services/auth/AuthService';
import './MyAccountView.css';

function MyAccountView({userId}) {
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

        // Add a fallback method to ensure we get the name if the first fetch fails
        const checkProfileAgain = setTimeout(() => {
            // If we still don't have the name, try again
            if (!firstName && !lastName) {
                console.log('Name still not loaded, trying again');
                fetchUserProfile();
            }
        }, 1000);

        return () => clearTimeout(checkProfileAgain);
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

            // Fetch user role using userIdToUse
            const {data: roleData, error: roleError} = await supabase
                .from('user_roles')
                .select('role_name')
                .eq('user_id', userIdToUse)
                .single();

            if (!roleError && roleData) {
                setUserRole(roleData.role_name);
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

            // First verify the current password by signing in
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: email,
                password: currentPassword,
            });

            if (signInError) {
                throw new Error('Current password is incorrect');
            }

            // Then update to the new password
            const {error} = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                throw error;
            }

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

            {loading && <div className="loading-spinner">Loading...</div>}

            <div className="account-content">
                {message && (
                    <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                        {message}
                    </div>
                )}

                {/* Account Information */}
                <div className="account-card">
                    <div className="account-card-header">
                        <h2>Account Information</h2>
                    </div>
                    <div className="info-row">
                        <span className="info-label"><i className="fas fa-user"></i> Name:</span>
                        <span className="info-value">
                {(firstName || lastName) ? `${firstName || ''} ${lastName || ''}`.trim() : 'Name not available'}
              </span>
                    </div>
                    <div className="info-row">
                        <span className="info-label"><i className="fas fa-envelope"></i> Email:</span>
                        <span className="info-value">{email || 'No email available'}</span>
                    </div>
                    {userRole && (
                        <div className="info-row">
                            <span className="info-label"><i className="fas fa-user-tag"></i> Role:</span>
                            <span className="info-value">{userRole}</span>
                        </div>
                    )}
                    {plantCode && (
                        <div className="info-row">
                            <span className="info-label"><i className="fas fa-building"></i> Plant Code:</span>
                            <span className="info-value">{plantCode}</span>
                        </div>
                    )}
                </div>

                {/* Profile Information */}
                <div className="account-card">
                    <div className="account-card-header">
                        <h2>Personal Information</h2>
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
                            <button type="submit" className="save-button" disabled={loading}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Security Settings */}
                <div className="account-card">
                    <div className="account-card-header">
                        <h2>Security</h2>
                        <p>Manage your password and security settings</p>
                    </div>

                    <button 
                        className="password-button" 
                        onClick={() => setShowPasswordModal(true)}
                    >
                        <span className="password-button-text">
                            <i className="fas fa-lock"></i>
                            Change Password
                        </span>
                        <i className="fas fa-chevron-right"></i>
                    </button>

                    <div className="sign-out-divider"></div>

                    <button 
                        className="sign-out-button" 
                        onClick={handleSignOut} 
                        disabled={loading}
                    >
                        <span className="sign-out-button-text">
                            <i className="fas fa-sign-out-alt"></i>
                            Sign Out
                        </span>
                        <i className="fas fa-chevron-right"></i>
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
                                >
                                    {loading ? 'Updating...' : 'Update Password'}
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