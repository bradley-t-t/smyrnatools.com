import React, {createContext, useContext, useEffect, useState} from 'react';
import {isSupabaseConfigured, supabase} from '../services/DatabaseService';
import {AuthUtility} from '../utils/AuthUtility';
import {UserService} from '../services/UserService';

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

        async function checkAuthSession() {
            try {
                const {data} = await supabase.auth.getSession();
                if (data?.session?.user) {
                    sessionStorage.setItem('userId', data.session.user.id);
                }
            } finally {
                restoreSession();
            }
        }

        checkAuthSession();
    }, []);

    async function restoreSession() {
        const timeout = setTimeout(() => {
            setLoading(false);
            sessionStorage.removeItem('userId');
        }, 10000);

        try {
            setLoading(true);
            let userId = (await supabase.auth.getSession())?.data?.session?.user?.id || sessionStorage.getItem('userId');

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

            if (error || !users?.length) {
                sessionStorage.removeItem('userId');
                clearTimeout(timeout);
                setLoading(false);
                return false;
            }

            const {data: profile} = await supabase
                .from('users_profiles')
                .select('first_name, last_name, plant_code')
                .eq('id', userId)
                .single();

            setUser({...users[0], profile: profile || {}});
            clearTimeout(timeout);
            setLoading(false);
            return true;
        } catch {
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

            if (error || !users?.length) {
                throw new Error(error?.message || 'Invalid email or password');
            }

            const user = users[0];
            await new Promise(resolve => setTimeout(resolve, 200));

            const passwordMatched = (await AuthUtility.hashPassword(password, user.salt).catch(() => null)) === user.password_hash ||
                AuthUtility.hashPasswordSync(password, user.salt) === user.password_hash;

            if (!passwordMatched) {
                throw new Error('Invalid email or password');
            }

            const basicUser = {id: user.id, email: user.email};
            setUser(basicUser);
            sessionStorage.setItem('userId', user.id);
            clearTimeout(safetyTimeout);
            setLoading(false);

            window.dispatchEvent(new CustomEvent('authSuccess', {detail: {userId: user.id}}));
            setTimeout(() => loadUserProfile(user.id).catch(() => {}), 100);

            return basicUser;
        } catch (error) {
            setError(error.message || 'An unknown error occurred');
            clearTimeout(safetyTimeout);
            setLoading(false);
            throw error;
        }
    }

    async function loadUserProfile(userId) {
        if (!userId) return;

        const {data: profileData, error} = await supabase
            .from('users_profiles')
            .select('first_name, last_name, plant_code')
            .eq('id', userId)
            .single();

        if (!error && profileData) {
            setUser(currentUser => ({...currentUser, profile: profileData}));
        }
    }

    async function signUp(email, password, firstName, lastName) {
        setError(null);
        setLoading(true);

        try {
            if (!AuthUtility.emailIsValid(email)) throw new Error('Please enter a valid email address');
            if (AuthUtility.passwordStrength(password).value === 'weak') {
                throw new Error('Password must be at least 8 characters with a mix of letters, numbers, and special characters');
            }

            const trimmedEmail = email.trim().toLowerCase();
            const {data: existingUsers} = await supabase
                .from('users')
                .select('id')
                .eq('email', trimmedEmail);

            if (existingUsers?.length) throw new Error('Email is already registered');

            const {generateUUID} = await import('../utils/UUIDUtility');
            const userId = generateUUID();
            const now = new Date().toISOString();
            const salt = AuthUtility.generateSalt();
            const passwordHash = await AuthUtility.hashPassword(password, salt);

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

            const [{error: userError}, {error: profileError}] = await Promise.all([
                supabase.from('users').insert(user),
                supabase.from('users_profiles').insert(profile)
            ]);

            if (userError || profileError) throw new Error(userError?.message || profileError?.message || 'User creation error');

            const guestRole = await UserService.getRoleByName('Guest');
            if (!guestRole) throw new Error('Could not find Guest role');

            if (!(await UserService.assignRole(userId, guestRole.id))) {
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
        sessionStorage.removeItem('userId');
        localStorage.removeItem('cachedPlants');
        localStorage.removeItem('userRole');
        setUser(null);
        window.dispatchEvent(new CustomEvent('authSignOut'));
        return true;
    }

    async function checkBiometricSupport() {
        return navigator.credentials && window.PublicKeyCredential
            ? await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            : false;
    }

    async function signInWithBiometric() {
        setError(null);
        setLoading(true);

        try {
            if (!(await checkBiometricSupport())) {
                throw new Error('Biometric authentication is not supported on this device');
            }

            const {default: KeychainUtility} = await import('../utils/KeychainUtility');
            const credentials = KeychainUtility.shared.retrieveCredentials();

            if (!credentials) {
                throw new Error('No stored credentials found. Please sign in with email and password first.');
            }

            return await signIn(credentials.email, credentials.password);
        } catch (error) {
            setError(`Biometric authentication failed: ${error.message}`);
            setLoading(false);
            throw error;
        }
    }

    return (
        <AuthContext.Provider value={{user, loading, error, signIn, signUp, signOut, isAuthenticated: !!user}}>
            {children}
        </AuthContext.Provider>
    );
}