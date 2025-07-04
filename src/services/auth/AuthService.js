import supabase from '../core/Supabase';
import {AuthUtils} from '../../utils/AuthUtils';

class AuthServiceImpl {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.observers = [];
    }

    /**
     * Sign in a user with email and password
     */
    async signIn(email, password) {
        try {
            const trimmedEmail = email.trim().toLowerCase();

            // Get user record with email
            const {data: users, error} = await supabase
                .from('users')
                .select('*')
                .eq('email', trimmedEmail);

            if (error) throw error;

            if (!users || users.length === 0) {
                throw new Error('Invalid email or password');
            }

            const user = users[0];

            // Calculate password hash and compare
            const computedHash = AuthUtils.hashPassword(password, user.salt);

            if (computedHash !== user.password_hash) {
                throw new Error('Invalid email or password');
            }

            // Successful login
            this.currentUser = user;
            this.isAuthenticated = true;

            // Store authentication in session
            sessionStorage.setItem('userId', user.id);

            // Notify observers
            this._notifyObservers();

            return user;
        } catch (error) {
            console.error('Sign in error:', error);
            throw error;
        }
    }

    /**
     * Sign up a new user
     */
    async signUp(email, password, firstName, lastName) {
        try {
            if (!AuthUtils.emailIsValid(email)) {
                throw new Error('Please enter a valid email address');
            }

            const passwordStrength = AuthUtils.passwordStrength(password);
            if (passwordStrength.value === 'weak') {
                throw new Error('Password must be at least 8 characters with a mix of letters, numbers, and special characters');
            }

            const trimmedEmail = email.trim().toLowerCase();

            // Check if email already exists
            const {data: existingUsers} = await supabase
                .from('users')
                .select('id')
                .eq('email', trimmedEmail);

            if (existingUsers && existingUsers.length > 0) {
                throw new Error('Email is already registered');
            }

            // Generate salt and hash password
            const salt = AuthUtils.generateSalt();
            const passwordHash = AuthUtils.hashPassword(password, salt);

            // Create user record
            const userId = crypto.randomUUID();
            const now = new Date().toISOString();

            const user = {
                id: userId,
                email: trimmedEmail,
                password_hash: passwordHash,
                salt: salt,
                created_at: now,
                updated_at: now
            };

            // Create profile record
            const profile = {
                id: userId,
                first_name: firstName,
                last_name: lastName,
                plant_code: '',
                created_at: now,
                updated_at: now
            };

            // Create user role record
            const userRole = {
                user_id: userId,
                role_name: 'guest',
                created_at: now,
                updated_at: now
            };

            // Insert user
            const {error: userError} = await supabase
                .from('users')
                .insert(user);

            if (userError) throw userError;

            // Verify user was created
            const {data: createdUsers, error: verifyError} = await supabase
                .from('users')
                .select('id')
                .eq('id', userId);

            if (verifyError || !createdUsers || createdUsers.length === 0) {
                throw new Error('User creation failed');
            }

            // Insert profile
            const {error: profileError} = await supabase
                .from('profiles')
                .insert(profile);

            if (profileError) throw profileError;

            // Insert user role
            const {error: roleError} = await supabase
                .from('user_roles')
                .insert(userRole);

            if (roleError) throw roleError;

            // Set as current user
            this.currentUser = user;
            this.isAuthenticated = true;

            // Store authentication in session
            sessionStorage.setItem('userId', userId);

            // Notify observers
            this._notifyObservers();

            return user;
        } catch (error) {
            console.error('Sign up error:', error);
            throw error;
        }
    }

    /**
     * Sign out the current user
     */
    async signOut() {
        this.currentUser = null;
        this.isAuthenticated = false;
        sessionStorage.removeItem('userId');

        // Clear any cached data
        localStorage.removeItem('cachedPlants');

        // Notify observers
        this._notifyObservers();
    }

    /**
     * Update user email
     */
    async updateEmail(newEmail) {
        try {
            if (!this.currentUser) {
                throw new Error('No authenticated user');
            }

            if (!AuthUtils.emailIsValid(newEmail)) {
                throw new Error('Please enter a valid email address');
            }

            const trimmedEmail = newEmail.trim().toLowerCase();

            // Check if email already exists (except for current user)
            const {data: existingUsers} = await supabase
                .from('users')
                .select('id')
                .eq('email', trimmedEmail)
                .neq('id', this.currentUser.id);

            if (existingUsers && existingUsers.length > 0) {
                throw new Error('Email is already registered');
            }

            // Update email
            const {error} = await supabase
                .from('users')
                .update({
                    email: trimmedEmail,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentUser.id);

            if (error) throw error;

            // Update local user object
            this.currentUser.email = trimmedEmail;

            // Notify observers
            this._notifyObservers();

            return true;
        } catch (error) {
            console.error('Update email error:', error);
            throw error;
        }
    }

    /**
     * Update user password
     */
    async updatePassword(newPassword) {
        try {
            if (!this.currentUser) {
                throw new Error('No authenticated user');
            }

            const passwordStrength = AuthUtils.passwordStrength(newPassword);
            if (passwordStrength.value === 'weak') {
                throw new Error('Password must be at least 8 characters with a mix of letters, numbers, and special characters');
            }

            // Generate new salt and hash password
            const salt = AuthUtils.generateSalt();
            const passwordHash = AuthUtils.hashPassword(newPassword, salt);

            // Update password
            const {error} = await supabase
                .from('users')
                .update({
                    password_hash: passwordHash,
                    salt: salt,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentUser.id);

            if (error) throw error;

            return true;
        } catch (error) {
            console.error('Update password error:', error);
            throw error;
        }
    }

    /**
     * Try to restore session from storage
     */
    async restoreSession() {
        try {
            const userId = sessionStorage.getItem('userId');

            if (!userId) return false;

            // Get user record
            const {data: users, error} = await supabase
                .from('users')
                .select('*')
                .eq('id', userId);

            if (error || !users || users.length === 0) {
                sessionStorage.removeItem('userId');
                return false;
            }

            this.currentUser = users[0];
            this.isAuthenticated = true;

            // Notify observers
            this._notifyObservers();

            return true;
        } catch (error) {
            console.error('Restore session error:', error);
            sessionStorage.removeItem('userId');
            return false;
        }
    }

    /**
     * Observer pattern methods
     */
    addObserver(callback) {
        this.observers.push(callback);
    }

    removeObserver(callback) {
        this.observers = this.observers.filter(cb => cb !== callback);
    }

    _notifyObservers() {
        for (const callback of this.observers) {
            callback({
                isAuthenticated: this.isAuthenticated,
                currentUser: this.currentUser
            });
        }
    }
}

// Create singleton instance
const singleton = new AuthServiceImpl();
export const AuthService = singleton;
