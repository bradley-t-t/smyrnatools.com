import {AuthService} from '../../services/AuthService';
import {ProfileService} from '../../services/ProfileService';
import {PlantService} from '../../services/PlantService';
import {OperatorService} from '../../services/OperatorService';
import {ListService} from '../../services/ListService';
import {NetworkUtility} from '../../utils/NetworkUtility';

export class AppState {
    constructor() {
        this.isAuthenticated = false;
        this.isLoading = false;
        this.isDataLoaded = false;
        this.errorMessage = '';
        this.showBiometricPrompt = false;
        this.email = '';
        this.password = '';
        this.confirmPassword = '';
        this.firstName = '';
        this.lastName = '';
        this.plantCode = '';
        this.isEmailValid = false;
        this.passwordsMatch = true;
        this.passwordStrength = {value: '', color: ''};
        this.currentUser = null;
        this.userProfile = null;
        this.currentUserRole = '';
        this.allProfiles = [];
        this.allPlants = [];
        this.operators = [];
        this.listItems = [];
        this.filterType = 'none';
        this.archiveFilterType = 'none';
        this.searchTerm = '';
        this.isOnline = true;

        this._initNetworkListeners();
    }

    _initNetworkListeners() {
        NetworkUtility.addNetworkListeners(
            () => this.isOnline = true,
            () => this.isOnline = false
        );
    }

    async initialize() {
        try {
            this.isLoading = true;
            this.isAuthenticated = await AuthService.restoreSession();

            if (this.isAuthenticated) {
                await Promise.all([
                    this.fetchUserProfile(),
                    this.fetchUserRole(),
                    this.fetchAllPlants(),
                    this.fetchAllProfiles(),
                    this.fetchOperators(),
                    this.fetchListItems()
                ]);
                this.isDataLoaded = true;
            }

            this.isLoading = false;
            return this.isAuthenticated;
        } catch (error) {
            console.error('Initialization error:', error);
            this.errorMessage = 'Failed to initialize application';
            this.isLoading = false;
            return false;
        }
    }

    updateValidations() {
        this.isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
        this.passwordsMatch = this.password === this.confirmPassword;

        let score = 0;
        if (this.password.length >= 8) score++;
        if (this.password.length >= 12) score++;
        if (/[A-Z]/.test(this.password)) score++;
        if (/[a-z]/.test(this.password)) score++;
        if (/[0-9]/.test(this.password)) score++;
        if (/[^A-Za-z0-9]/.test(this.password)) score++;

        this.passwordStrength = this.password.length === 0
            ? {value: '', color: ''}
            : score < 3
                ? {value: 'weak', color: '#e53e3e'}
                : score < 5
                    ? {value: 'medium', color: '#ecc94b'}
                    : {value: 'strong', color: '#38a169'};
    }

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
            await AuthService.signUp(this.email, this.password, this.firstName, this.lastName);
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

    async fetchUserProfile() {
        const profile = await ProfileService.fetchUserProfile();
        this.userProfile = profile;
        if (profile) {
            this.firstName = profile.first_name;
            this.lastName = profile.last_name;
            this.plantCode = profile.plant_code;
        }
        return profile;
    }

    async fetchUserRole() {
        const role = await ProfileService.fetchUserRole();
        this.currentUserRole = role;
        return role;
    }

    async fetchAllProfiles() {
        const profiles = await ProfileService.fetchAllProfiles();
        this.allProfiles = profiles;
        return profiles;
    }

    async updateProfile() {
        try {
            this.isLoading = true;
            this.errorMessage = '';
            await ProfileService.updateProfile(this.firstName, this.lastName, this.plantCode);
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
            await Promise.all([this.fetchAllProfiles(), this.fetchListItems()]);
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
            if (this.isAuthenticated) await this.fetchAllProfiles();
            this.isLoading = false;
            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to delete profile';
            this.isLoading = false;
            return false;
        }
    }

    async fetchAllPlants() {
        const plants = await PlantService.fetchAllPlants();
        this.allPlants = plants;
        return plants;
    }

    async createPlant(plantCode, plantName) {
        try {
            this.isLoading = true;
            this.errorMessage = '';
            await PlantService.createPlant(plantCode, plantName);
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
            await Promise.all([this.fetchAllPlants(), this.fetchAllProfiles(), this.fetchListItems()]);
            this.isLoading = false;
            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to delete plant';
            this.isLoading = false;
            return false;
        }
    }

    async fetchOperators() {
        const operators = await OperatorService.fetchOperators();
        this.operators = operators;
        return operators;
    }

    async fetchListItems() {
        const items = await ListService.fetchListItems();
        this.listItems = items;
        return items;
    }

    async createListItem(plantCode, description, deadline, comments) {
        try {
            this.isLoading = true;
            this.errorMessage = '';
            await ListService.createListItem(plantCode, description, deadline, comments);
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
            await ListService.updateListItem(item);
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
            await ListService.toggleCompletion(item);
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
            await ListService.deleteListItem(id);
            await this.fetchListItems();
            this.isLoading = false;
            return true;
        } catch (error) {
            this.errorMessage = error.message || 'Failed to delete list item';
            this.isLoading = false;
            return false;
        }
    }

    getFilteredItems(showCompleted = false) {
        return ListService.getFilteredItems(this.filterType, this.plantCode, this.searchTerm, showCompleted);
    }
}