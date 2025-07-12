import React, {createContext, useContext, useEffect, useState} from 'react';
import {isSupabaseConfigured, supabase} from '../../core/clients/SupabaseClient';
import {AuthUtils} from '../../utils/AuthUtils';
import {AccountManager} from '../../core/managers/AccountManager';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({children}) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        console.log('Checking Supabase configuration...');
        if (!isSupabaseConfigured(supabase)) {
            console.error('Supabase is not properly configured');
            setError('Database connection not configured properly. Please check your environment variables.');
            setLoading(false);
            return;
        }
        console.log('Supabase configuration verified.');

        // First check Supabase auth session
        const checkAuthSession = async () => {
            try {
                const {data} = await supabase.auth.getSession();
                if (data?.session?.user) {
                    // We have a valid session, try to get user data
                    console.log('Authenticated session found:', data.session.user.id);
                    sessionStorage.setItem('userId', data.session.user.id);
                }
            } catch (error) {
                console.error('Error checking auth session:', error);
            } finally {
                // Continue with restoring session from storage
                restoreSession();
            }
        };

        checkAuthSession();
    }, []);

    async function restoreSession() {
        // Define timeout outside try/catch so it's accessible in both blocks
        let timeout;

        try {
            setLoading(true);

            // First check for Supabase session
            const {data} = await supabase.auth.getSession();
            let userId = data?.session?.user?.id;

            // If no active Supabase session, check sessionStorage
            if (!userId) {
                userId = sessionStorage.getItem('userId');
            }

            // Set a timeout to prevent infinite loading
            timeout = setTimeout(() => {
                console.warn('Session restore timed out');
                setLoading(false);
                sessionStorage.removeItem('userId');
            }, 10000); // 10 second timeout

            if (!userId) {
                clearTimeout(timeout);
                setLoading(false);
                return false;
            }

            if (!isSupabaseConfigured(supabase)) {
                clearTimeout(timeout);
                throw new Error('Database connection not configured properly');
            }

            const {data: users, error} = await supabase
                .from('users')
                .select('*, profiles(first_name, last_name, plant_code)')
                .eq('id', userId);

            if (error || !users || users.length === 0) {
                sessionStorage.removeItem('userId');
                clearTimeout(timeout);
                setLoading(false);
                return false;
            }

            setUser({...users[0], profile: users[0].profiles});
            clearTimeout(timeout);
            setLoading(false);
            return true;
        } catch (error) {
            console.error('Restore session error:', error.message);
            sessionStorage.removeItem('userId');
            clearTimeout(timeout);
            setLoading(false);
            return false;
        }
    }

    async function signIn(email, password) {
        // Reset state before attempting sign-in
        setError(null);
        setLoading(true);

        // Set a safety timeout to ensure loading state is never stuck
        const safetyTimeout = setTimeout(() => {
            console.warn('Auth sign-in safety timeout reached');
            setLoading(false);
            setError('The login process timed out. Please try again.');
        }, 15000); // 15 second safety timeout

        try {
            // Simple direct approach
            const trimmedEmail = email.trim().toLowerCase();
            console.log('Attempting to sign in with email:', trimmedEmail);

            // Add small delay to ensure UI updates happen (prevents freezing)
            await new Promise(resolve => setTimeout(resolve, 300));

            // Use a simple query to get just the essential user data
            const {data: users, error} = await supabase
                .from('users')
                .select('id, email, password_hash, salt')
                .eq('email', trimmedEmail);

            if (error) {
                console.error('Supabase error:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            if (!users || users.length === 0) {
                console.warn('No user found with email:', trimmedEmail);
                throw new Error('Invalid email or password');
            }

            const user = users[0];
            console.log('User found, verifying password...');

            // Add small delay to ensure UI updates between steps
            await new Promise(resolve => setTimeout(resolve, 200));

            // Try both hash methods
            let passwordMatched = false;

            // 1. First try async hash method
            try {
                console.log('Trying async hash method...');
                const asyncHash = await AuthUtils.hashPassword(password, user.salt);
                if (asyncHash === user.password_hash) {
                    console.log('Password matched with async hash method');
                    passwordMatched = true;
                }
            } catch (asyncError) {
                console.warn('Async hash method failed:', asyncError);
                // Continue to try sync method
            }

            // 2. If async didn't work, try sync hash method
            if (!passwordMatched) {
                console.log('Trying sync hash method...');
                const syncHash = AuthUtils.hashPasswordSync(password, user.salt);
                if (syncHash === user.password_hash) {
                    console.log('Password matched with sync hash method');
                    passwordMatched = true;
                }
            }

            // If no method worked, authentication fails
            if (!passwordMatched) {
                console.warn('Password verification failed with all methods');
                throw new Error('Invalid email or password');
            }

            console.log('Password verified successfully');

            // Set basic user info immediately
            const basicUser = {
                id: user.id,
                email: user.email
            };

            setUser(basicUser);
            sessionStorage.setItem('userId', user.id);

            // Clear timeout and update state
            clearTimeout(safetyTimeout);
            setLoading(false);

            // Explicitly trigger a DOM event that can be listened to
            const authEvent = new CustomEvent('authSuccess', {detail: {userId: user.id}});
            window.dispatchEvent(authEvent);
            console.log('Auth success event dispatched');

            // After successful authentication, try to load profiles in background
            setTimeout(() => {
                loadUserProfile(user.id).catch(e => {
                    console.warn('Background profiles load failed:', e);
                });
            }, 100);

            return basicUser;
        } catch (error) {
            console.error('Sign in error:', error.message);
            setError(error.message || 'An unknown error occurred');
            clearTimeout(safetyTimeout);
            setLoading(false);
            throw error;
        }
    }

    // Simple hash function as a fallback for compatibility
    function simpleHashMethod(password, salt) {
        try {
            // Very simple string-based hash as fallback
            const data = password + salt;
            let hash = 0;

            for (let i = 0; i < data.length; i++) {
                const char = data.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }

            // Convert to hex string and pad to match SHA-256 format
            const hashHex = (hash >>> 0).toString(16);
            return hashHex.padStart(64, '0');
        } catch (error) {
            console.error('Error in simple hash method:', error);
            return '';
        }
    }

    // Separate function to load user profiles
    async function loadUserProfile(userId) {
        if (!userId) return;

        try {
            console.log('Loading profiles for user:', userId);

            const {data: profileData, error: profileError} = await supabase
                .from('profiles')
                .select('first_name, last_name, plant_code')
                .eq('id', userId)
                .single();

            if (profileError) {
                console.warn('Error fetching profiles:', profileError);
                return;
            }

            // Update user with profiles data
            setUser(currentUser => ({
                ...currentUser,
                profile: profileData
            }));

            console.log('Profile loaded successfully');
        } catch (error) {
            console.error('Error in loadUserProfile:', error);
        }
    }

    async function signUp(email, password, firstName, lastName) {
        try {
            setError(null);
            setLoading(true);

            if (!AuthUtils.emailIsValid(email)) {
                throw new Error('Please enter a valid email address');
            }

            const passwordStrength = AuthUtils.passwordStrength(password);
            if (passwordStrength.value === 'weak') {
                throw new Error('Password must be at least 8 characters with a mix of letters, numbers, and special characters');
            }

            const trimmedEmail = email.trim().toLowerCase();

            const {data: existingUsers} = await supabase
                .from('users')
                .select('id')
                .eq('email', trimmedEmail);

            if (existingUsers && existingUsers.length > 0) {
                throw new Error('Email is already registered');
            }

            const salt = AuthUtils.generateSalt();
            const passwordHash = await AuthUtils.hashPassword(password, salt);

            // Generate UUID using our improved helper function that works across all environments
            const {generateUUID} = await import('../../utils/UUIDUtils');
            const userId = generateUUID();
            const now = new Date().toISOString();

            const user = {
                id: userId,
                email: trimmedEmail,
                password_hash: passwordHash,
                salt,
                created_at: now,
                updated_at: now
            };

            const profile = {
                id: userId,
                first_name: firstName,
                last_name: lastName,
                plant_code: '',
                created_at: now,
                updated_at: now
            };

            const {error: userError} = await supabase
                .from('users')
                .insert(user);

            if (userError) throw new Error(`User creation error: ${userError.message}`);

            const {error: profileError} = await supabase
                .from('profiles')
                .insert(profile);

            if (profileError) throw new Error(`Profile creation error: ${profileError.message}`);

            // Get the Guest role
            const guestRole = await AccountManager.getRoleByName('Guest');
            if (!guestRole) {
                throw new Error('Could not find Guest role for new user');
            }

            // Assign Guest role to the new user
            const roleAssigned = await AccountManager.assignRole(userId, guestRole.id);
            if (!roleAssigned) {
                throw new Error('Role assignment failed');
            }

            setUser({...user, profile});
            sessionStorage.setItem('userId', userId);
            setLoading(false);
            return user;
        } catch (error) {
            console.error('Sign up error:', error.message);
            setError(error.message);
            setLoading(false);
            throw error;
        }
    }

    async function signOut() {
        try {
            // Clear all relevant storage items
            sessionStorage.removeItem('userId');
            localStorage.removeItem('cachedPlants');
            localStorage.removeItem('userRole');

            // Clear authentication state
            setUser(null);

            // Log signout success
            console.log('User signed out successfully');

            // Notify listeners of signout
            const signOutEvent = new CustomEvent('authSignOut');
            window.dispatchEvent(signOutEvent);

            return true;
        } catch (error) {
            console.error('Error during sign out:', error);
            return false;
        }
    }

    async function checkBiometricSupport() {
        if (navigator.credentials && window.PublicKeyCredential) {
            return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        }
        return false;
    }

    async function signInWithBiometric() {
        try {
            setError(null);
            setLoading(true);

            const isBiometricSupported = await checkBiometricSupport();

            if (!isBiometricSupported) {
                throw new Error('Biometric authentication is not supported on this device');
            }

            const KeychainHelper = (await import('../../utils/KeychainUtils')).KeychainUtl;
            const credentials = KeychainHelper.shared.retrieveCredentials();

            if (!credentials) {
                throw new Error('No stored credentials found. Please sign in with email and password first.');
            }

            await signIn(credentials.email, credentials.password);
        } catch (error) {
            console.error('Biometric authentication error:', error);
            setError(`Biometric authentication failed: ${error.message}`);
            setLoading(false);
            throw error;
        }
    }

    const value = {
        user,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}