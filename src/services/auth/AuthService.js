import supabase from '../../core/clients/SupabaseClient';
import {AuthUtils} from '../../utils/AuthUtils';
import {AccountManager} from '../../core/managers/AccountManager';

class AuthServiceImpl {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.observers = [];
        this.operatorCache = {}; // Cache for operator lookups
    }

    /**
     * Get operator information from the operators table
     * @param {string} employeeId - The employee ID to lookup
     * @returns {Promise<Object|null>} - The operator information or null
     */
    async getOperatorInfo(employeeId) {
        if (!employeeId) return null;

        if (this.operatorCache[employeeId]) {
            return this.operatorCache[employeeId];
        }

        try {
            const { data, error } = await supabase
                .from('operators')
                .select('*')
                .eq('employee_id', employeeId)
                .single();

            if (error) {
                console.error('Error fetching operator:', error);
                return null;
            }

            if (data) {
                // Cache the result
                this.operatorCache[employeeId] = data;
                return data;
            }

            return null;
        } catch (error) {
            console.error(`Error fetching operator info for ${employeeId}:`, error);
            return null;
        }
    }

    /**
     * Sign in a user with emails and password
     */
    async signIn(email, password) {
        try {
            const trimmedEmail = email.trim().toLowerCase();

            // Get user record with emails - only select necessary fields to optimize query
            const {data: users, error} = await supabase
                .from('users')
                .select('id, emails, password_hash, salt')
                .eq('email', trimmedEmail)
                .limit(1); // Limit to 1 record for performance

            if (error) throw error;

            if (!users || users.length === 0) {
                throw new Error('Invalid emails or password');
            }

            const user = users[0];

            // Calculate password hash and compare
            const computedHash = AuthUtils.hashPassword(password, user.salt);

            if (computedHash !== user.password_hash) {
                throw new Error('Invalid emails or password');
            }

            // Successful login
            this.currentUser = user;
            // Make sure userId is directly accessible on currentUser
            this.currentUser.userId = user.id;
            this.isAuthenticated = true;

            // Store authentication in session
            sessionStorage.setItem('userId', user.id);

            console.log('User logged in successfully:', user.id);

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
                throw new Error('Please enter a valid emails address');
            }

            const passwordStrength = AuthUtils.passwordStrength(password);
            if (passwordStrength.value === 'weak') {
                throw new Error('Password must be at least 8 characters with a mix of letters, numbers, and special characters');
            }

            const trimmedEmail = email.trim().toLowerCase();

            // Check if emails already exists
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

            // Create profiles record
            const profile = {
                id: userId,
                first_name: firstName,
                last_name: lastName,
                plant_code: '',
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

            // Insert profiles
            const {error: profileError} = await supabase
                .from('profiles')
                .insert(profile);

            if (profileError) throw profileError;

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
     * Update user emails
     */
    async updateEmail(newEmail) {
        try {
            if (!this.currentUser) {
                throw new Error('No authenticated user');
            }

            if (!AuthUtils.emailIsValid(newEmail)) {
                throw new Error('Please enter a valid emails address');
            }

            const trimmedEmail = newEmail.trim().toLowerCase();

            // Check if emails already exists (except for current user)
            const {data: existingUsers} = await supabase
                .from('users')
                .select('id')
                .eq('email', trimmedEmail)
                .neq('id', this.currentUser.id);

            if (existingUsers && existingUsers.length > 0) {
                throw new Error('Email is already registered');
            }

            // Update emails
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
            console.error('Update emails error:', error);
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

            // Get user record - only select necessary fields with timeout
            const {data: users, error} = await supabase
                .from('users')
                .select('id, emails')
                .eq('id', userId)
                .limit(1)
                .abortSignal(AbortSignal.timeout(3000)); // Add 3s timeout

            if (error) {
                console.error('Error restoring session:', error);
                // Don't remove userId from session on network errors
                // Only set isAuthenticated to false
                this.isAuthenticated = false;
                return false;
            }

            if (!users || users.length === 0) {
                console.warn('User not found when restoring session');
                sessionStorage.removeItem('userId');
                return false;
            }

            this.currentUser = users[0];
            // Make sure userId is directly accessible on currentUser
            this.currentUser.userId = users[0].id;
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
