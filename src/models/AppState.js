import {AuthService} from '../services/auth/AuthService';
import {ProfileService} from '../services/ProfileService';
import {PlantService} from '../services/PlantService';
import {OperatorService} from '../services/operators/OperatorService';
import {TaskService} from '../services/TaskService';
import {NetworkUtils} from '../utils/NetworkUtils';

/**
 * Central app state that coordinates the application
 */
export class AppState {
    constructor() {
        // Authentication state
        this.isAuthenticated = false;
        this.isLoading = false;
        this.isDataLoaded = false;
        this.errorMessage = '';
        this.showBiometricPrompt = false;

        // User input state
        this.email = '';
        this.password = '';
        this.confirmPassword = '';
        this.firstName = '';
        this.lastName = '';
        this.plantCode = '';

        // Validation state
        this.isEmailValid = false;
        this.passwordsMatch = true;
        this.passwordStrength = {value: '', color: ''};

        // User and profile state
        this.currentUser = null;
        this.userProfile = null;
        this.currentUserRole = '';
        this.allProfiles = [];

        // Application data
        this.allPlants = [];
        this.operators = [];
        this.listItems = [];

        // Filter state
        this.filterType = 'none';
        this.archiveFilterType = 'none';
        this.searchTerm = '';

        // Network state
        this.isOnline = true;

        // Initialize event listeners
        this._initNetworkListeners();
    }

    /**
     * Initialize network listeners
     */
    _initNetworkListeners() {
        NetworkUtils.addNetworkListeners(
            () => {
                this.isOnline = true;
                console.log('App is online');
            },
            () => {
                this.isOnline = false;
                console.log('App is offline');
            }
        );
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            this.isLoading = true;

            // Try to restore session
            const sessionRestored = await AuthService.restoreSession();
            this.isAuthenticated = sessionRestored;

            if (sessionRestored) {
                // Fetch user data
                await this.fetchUserProfile();
                await this.fetchUserRole();

                // Fetch application data
                await this.fetchAllPlants();
                await this.fetchAllProfiles();
                await this.fetchOperators();
                await this.fetchListItems();

                this.isDataLoaded = true;
            }

            this.isLoading = false;
            return sessionRestored;
        } catch (error) {
            console.error('Initialization error:', error);
            this.errorMessage = 'Failed to initialize application';
            this.isLoading = false;
            return false;
        }
    }

    /**
     * Update form validations
     */
    updateValidations() {
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        this.isEmailValid = emailRegex.test(this.email);

        // Password validation
        this.passwordsMatch = this.password === this.confirmPassword;

        // Determine password strength
        let score = 0;
        if (this.password.length >= 8) score++;
        if (this.password.length >= 12) score++;
        if (/[A-Z]/.test(this.password)) score++;
        if (/[a-z]/.test(this.password)) score++;
        if (/[0-9]/.test(this.password)) score++;
        if (/[^A-Za-z0-9]/.test(this.password)) score++;

        if (this.password.length === 0) {
            this.passwordStrength = {value: '', color: ''};
        } else if (score < 3) {
            this.passwordStrength = {value: 'weak', color: '#e53e3e'};
        } else if (score < 5) {
            this.passwordStrength = {value: 'medium', color: '#ecc94b'};
        } else {
            this.passwordStrength = {value: 'strong', color: '#38a169'};
        }
    }

    /**
     * Authentication Methods
     */
    async signIn() {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            await AuthService.signIn(this.email, this.password);
            this.isAuthenticated = true;
            await this.initialize();

            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to sign in';
            this.isLoading = false;
            return false;
        }
    }


    async signUp() {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            await AuthService.signUp(
                this.email,
                this.password,
                this.firstName,
                this.lastName
            );

            this.isAuthenticated = true;
            await this.initialize();

            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to sign up';
            this.isLoading = false;
            return false;
        }
    }

    async signOut() {
        try {
            await AuthService.signOut();

            // Reset state
            this.isAuthenticated = false;
            this.isDataLoaded = false;
            this.listItems = [];
            this.userProfile = null;
            this.allProfiles = [];
            this.allPlants = [];
            this.operators = [];

            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to sign out';
            return false;
        }
    }

    clearSignUpFields() {
        this.email = '';
        this.password = '';
        this.confirmPassword = '';
        this.firstName = '';
        this.lastName = '';
        this.errorMessage = '';
        this.isEmailValid = false;
        this.passwordsMatch = true;
        this.passwordStrength = {value: '', color: ''};
    }

    /**
     * User profile methods
     */
    async fetchUserProfile() {
        try {
            const profile = await ProfileService.fetchUserProfile();
            this.userProfile = profile;

            if (profile) {
                this.firstName = profile.first_name;
                this.lastName = profile.last_name;
                this.plantCode = profile.plant_code;
            }

            return profile;
        } catch (error) {
            console.error('Fetch user profile error:', error);
            return null;
        }
    }

    async fetchUserRole() {
        try {
            const role = await ProfileService.fetchUserRole();
            this.currentUserRole = role;
            return role;
        } catch (error) {
            console.error('Fetch user role error:', error);
            return '';
        }
    }

    async fetchAllProfiles() {
        try {
            const profiles = await ProfileService.fetchAllProfiles();
            this.allProfiles = profiles;
            return profiles;
        } catch (error) {
            console.error('Fetch all profiles error:', error);
            return [];
        }
    }

    async updateProfile() {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            await ProfileService.updateProfile(
                this.firstName,
                this.lastName,
                this.plantCode
            );

            // Refresh data
            await this.fetchListItems();

            this.isLoading = false;
            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to update profile';
            this.isLoading = false;
            return false;
        }
    }

    async updateUserRoleAndPlant(userId, roleName, plantCode) {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            await ProfileService.updateUserRoleAndPlant(userId, roleName, plantCode);

            // Refresh data
            await this.fetchAllProfiles();
            await this.fetchListItems();

            this.isLoading = false;
            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to update user role';
            this.isLoading = false;
            return false;
        }
    }

    async deleteProfile(userId) {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            await ProfileService.deleteProfile(userId);

            // Refresh data if needed
            if (this.isAuthenticated) {
                await this.fetchAllProfiles();
            }

            this.isLoading = false;
            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to delete profile';
            this.isLoading = false;
            return false;
        }
    }

    /**
     * Plant methods
     */
    async fetchAllPlants() {
        try {
            const plants = await PlantService.fetchAllPlants();
            this.allPlants = plants;
            return plants;
        } catch (error) {
            console.error('Fetch plants error:', error);
            return [];
        }
    }

    async createPlant(plantCode, plantName) {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            await PlantService.createPlant(plantCode, plantName);

            // Refresh plants list
            await this.fetchAllPlants();

            this.isLoading = false;
            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to create plant';
            this.isLoading = false;
            return false;
        }
    }

    async updatePlant(plantCode, plantName) {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            await PlantService.updatePlant(plantCode, plantName);

            // Refresh plants list
            await this.fetchAllPlants();

            this.isLoading = false;
            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to update plant';
            this.isLoading = false;
            return false;
        }
    }

    async deletePlant(plantCode) {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            await PlantService.deletePlant(plantCode);

            // Refresh related data
            await this.fetchAllPlants();
            await this.fetchAllProfiles();
            await this.fetchListItems();

            this.isLoading = false;
            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to delete plant';
            this.isLoading = false;
            return false;
        }
    }

    /**
     * Operator methods
     */
    async fetchOperators() {
        try {
            const operators = await OperatorService.fetchOperators();
            this.operators = operators;
            return operators;
        } catch (error) {
            console.error('Fetch operators error:', error);
            return [];
        }
    }

    /**
     * Task/ListItem methods
     */
    async fetchListItems() {
        try {
            const items = await TaskService.fetchListItems();
            this.listItems = items;
            return items;
        } catch (error) {
            console.error('Fetch list items error:', error);
            return [];
        }
    }

    async createListItem(plantCode, description, deadline, comments) {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            await TaskService.createListItem(plantCode, description, deadline, comments);

            // Refresh list items
            await this.fetchListItems();

            this.isLoading = false;
            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to create list item';
            this.isLoading = false;
            return false;
        }
    }

    async updateListItem(item) {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            await TaskService.updateListItem(item);

            // Refresh list items
            await this.fetchListItems();

            this.isLoading = false;
            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to update list item';
            this.isLoading = false;
            return false;
        }
    }

    async toggleCompletion(item) {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            await TaskService.toggleCompletion(item);

            // Refresh list items
            await this.fetchListItems();

            this.isLoading = false;
            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to toggle completion';
            this.isLoading = false;
            return false;
        }
    }

    async deleteListItem(id) {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            await TaskService.deleteListItem(id);

            // Refresh list items
            await this.fetchListItems();

            this.isLoading = false;
            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to delete list item';
            this.isLoading = false;
            return false;
        }
    }

    /**
     * Get filtered list items based on current filters
     */
    getFilteredItems(showCompleted = false) {
        return TaskService.getFilteredItems(
            this.filterType,
            this.plantCode,
            this.searchTerm,
            showCompleted
        );
    }
}
