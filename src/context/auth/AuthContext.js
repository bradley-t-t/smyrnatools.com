import React, {createContext, useContext, useEffect, useState} from 'react';
import {isSupabaseConfigured, supabase} from '../../core/clients/SupabaseClient';
import {AuthUtils} from '../../utils/AuthUtils';
import {AccountManager} from '../../core/accounts/AccountManager';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({children}) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isSupabaseConfigured(supabase)) {
            setError('Database connection not configured properly. Please check your environment variables.');
            setLoading(false);
            return;
        }

        const checkAuthSession = async () => {
            try {
                const {data} = await supabase.auth.getSession();
                if (data?.session?.user) {
                    sessionStorage.setItem('userId', data.session.user.id);
                }
            } catch (error) {
            } finally {
                restoreSession();
            }
        };

        checkAuthSession();
    }, []);

    async function restoreSession() {
        let timeout;

        try {
            setLoading(true);

            const {data} = await supabase.auth.getSession();
            let userId = data?.session?.user?.id;

            if (!userId) {
                userId = sessionStorage.getItem('userId');
            }

            timeout = setTimeout(() => {
                setLoading(false);
                sessionStorage.removeItem('userId');
            }, 10000);

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
                .select('*')
                .eq('id', userId);

            if (error || !users || users.length === 0) {
                sessionStorage.removeItem('userId');
                clearTimeout(timeout);
                setLoading(false);
                return false;
            }

            // Fetch profile separately
            const {data: profile, error: profileError} = await supabase
                .from('users_profiles')
                .select('first_name, last_name, plant_code')
                .eq('id', userId)
                .single();

            // Create user object with profile information
            const userWithProfile = { ...users[0], profile: profile || {} };
            setUser(userWithProfile);
            clearTimeout(timeout);
            setLoading(false);
            return true;
        } catch (error) {
            sessionStorage.removeItem('userId');
            clearTimeout(timeout);
            setLoading(false);
            return false;
        }
    }

    async function signIn(email, password) {
        setError(null);
        setLoading(true);

        const safetyTimeout = setTimeout(() => {
            setLoading(false);
            setError('The login process timed out. Please try again.');
        }, 15000);

        try {
            const trimmedEmail = email.trim().toLowerCase();

            await new Promise(resolve => setTimeout(resolve, 300));

            const {data: users, error} = await supabase
                .from('users')
                .select('id, email, password_hash, salt')
                .eq('email', trimmedEmail);

            if (error) {
                throw new Error(`Database error: ${error.message}`);
            }

            if (!users || users.length === 0) {
                throw new Error('Invalid email or password');
            }

            const user = users[0];

            await new Promise(resolve => setTimeout(resolve, 200));

            let passwordMatched = false;

            try {
                const asyncHash = await AuthUtils.hashPassword(password, user.salt);
                if (asyncHash === user.password_hash) {
                    passwordMatched = true;
                }
            } catch (asyncError) {
            }

            if (!passwordMatched) {
                const syncHash = AuthUtils.hashPasswordSync(password, user.salt);
                if (syncHash === user.password_hash) {
                    passwordMatched = true;
                }
            }

            if (!passwordMatched) {
                throw new Error('Invalid email or password');
            }

            const basicUser = {
                id: user.id,
                email: user.email
            };

            setUser(basicUser);
            sessionStorage.setItem('userId', user.id);

            clearTimeout(safetyTimeout);
            setLoading(false);

            const authEvent = new CustomEvent('authSuccess', {detail: {userId: user.id}});
            window.dispatchEvent(authEvent);

            setTimeout(() => {
                loadUserProfile(user.id).catch(e => {
                });
            }, 100);

            return basicUser;
        } catch (error) {
            setError(error.message || 'An unknown error occurred');
            clearTimeout(safetyTimeout);
            setLoading(false);
            throw error;
        }
    }

    function simpleHashMethod(password, salt) {
        try {
            const data = password + salt;
            let hash = 0;

            for (let i = 0; i < data.length; i++) {
                const char = data.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }

            const hashHex = (hash >>> 0).toString(16);
            return hashHex.padStart(64, '0');
        } catch (error) {
            return '';
        }
    }

    async function loadUserProfile(userId) {
        if (!userId) return;

        try {
            const {data: profileData, error: profileError} = await supabase
                .from('users_profiles')
                .select('first_name, last_name, plant_code')
                .eq('id', userId)
                .single();

            if (profileError) {
                console.error('Error loading profile:', profileError);
                return;
            }

            setUser(currentUser => ({
                ...currentUser,
                profile: profileData
            }));
        } catch (error) {
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
                .from('users_profiles')
                .insert(profile);

            if (profileError) throw new Error(`Profile creation error: ${profileError.message}`);

            const guestRole = await AccountManager.getRoleByName('Guest');
            if (!guestRole) {
                throw new Error('Could not find Guest role for new user');
            }

            const roleAssigned = await AccountManager.assignRole(userId, guestRole.id);
            if (!roleAssigned) {
                throw new Error('Role assignment failed');
            }

            setUser({...user, profile});
            sessionStorage.setItem('userId', userId);
            setLoading(false);
            return user;
        } catch (error) {
            setError(error.message);
            setLoading(false);
            throw error;
        }
    }

    async function signOut() {
        try {
            sessionStorage.removeItem('userId');
            localStorage.removeItem('cachedPlants');
            localStorage.removeItem('userRole');

            setUser(null);

            const signOutEvent = new CustomEvent('authSignOut');
            window.dispatchEvent(signOutEvent);

            return true;
        } catch (error) {
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