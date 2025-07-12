import supabase from '../../core/database/Supabase';
import {AuthService} from '../auth/AuthService';
import {AccountManager} from '../../core/managers/AccountManager';

class ProfileServiceImpl {
    constructor() {
        this.currentProfile = null;
        this.currentUserRole = '';
        this.allProfiles = [];
    }

    /**
     * Update user profiles
     */
    async updateProfile(firstName, lastName, plantCode) {
        try {
            if (!AuthService.currentUser) {
                throw new Error('No authenticated user');
            }

            const userId = AuthService.currentUser.id;
            const now = new Date().toISOString();

            const profile = {
                id: userId,
                first_name: firstName,
                last_name: lastName,
                plant_code: plantCode || '',
                created_at: this.currentProfile?.created_at || now,
                updated_at: now
            };

            const {error} = await supabase
                .from('profiles')
                .upsert(profile, {onConflict: 'id'});

            if (error) throw error;

            this.currentProfile = profile;

            return true;
        } catch (error) {
            console.error('Update profiles error:', error);
            throw error;
        }
    }

    /**
     * Update user role and plant
     */
    async updateUserRoleAndPlant(userId, roleName, plantCode) {
        try {
            const now = new Date().toISOString();

            // First, get the role ID from the role name
            const role = await AccountManager.getRoleByName(roleName || 'Guest');
            if (!role) {
                throw new Error(`Role '${roleName || 'Guest'}' not found`);
            }

            // Clear any existing roles for this user
            // This replicates the previous behavior where a user could only have one role
            const existingRoles = await AccountManager.getUserRoles(userId);
            for (const existingRole of existingRoles) {
                await AccountManager.removeRole(userId, existingRole.id);
            }

            // Assign the new role to the user
            const roleAssigned = await AccountManager.assignRole(userId, role.id);
            if (!roleAssigned) {
                throw new Error(`Failed to assign role '${roleName}' to user`);
            }

            // Update profiles plant code
            const {error: profileError} = await supabase
                .from('profiles')
                .update({
                    plant_code: plantCode || '',
                    updated_at: now
                })
                .eq('id', userId);

            if (profileError) throw profileError;

            // If this is the current user, refresh their profiles
            if (AuthService.currentUser && userId === AuthService.currentUser.id) {
                await this.fetchUserProfile();
                await this.fetchUserRole();
            }

            return true;
        } catch (error) {
            console.error('Update user role error:', error);
            throw error;
        }
    }

    /**
     * Delete a user profiles
     */
    async deleteProfile(userId) {
        try {
            // Delete profiles
            const {error: profileError} = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (profileError) throw profileError;

            // Get user roles
            const roles = await AccountManager.getUserRoles(userId);

            // Remove all roles from the user
            for (const role of roles) {
                await AccountManager.removeRole(userId, role.id);
            }

            // Delete user
            const {error: userError} = await supabase
                .from('users')
                .delete()
                .eq('id', userId);

            if (userError) throw userError;

            // If this is the current user, sign them out
            if (AuthService.currentUser && userId === AuthService.currentUser.id) {
                await AuthService.signOut();
            }

            return true;
        } catch (error) {
            console.error('Delete profiles error:', error);
            throw error;
        }
    }

    /**
     * Fetch current user profiles
     */
    async fetchUserProfile() {
        try {
            if (!AuthService.currentUser) {
                this.currentProfile = null;
                return null;
            }

            const userId = AuthService.currentUser.id;

            const {data: profiles, error} = await supabase
                .from('profiles')
                .select()
                .eq('id', userId);

            if (error) throw error;

            if (!profiles || profiles.length === 0) {
                this.currentProfile = null;
                return null;
            }

            this.currentProfile = profiles[0];
            return this.currentProfile;
        } catch (error) {
            console.error('Fetch user profiles error:', error);
            this.currentProfile = null;
            return null;
        }
    }

    /**
     * Fetch current user role
     */
    async fetchUserRole() {
        try {
            if (!AuthService.currentUser) {
                this.currentUserRole = '';
                return '';
            }

            const userId = AuthService.currentUser.id;

            // Use AccountManager to get the highest weighted role
            const highestRole = await AccountManager.getHighestRole(userId);

            if (!highestRole) {
                this.currentUserRole = '';
                return '';
            }

            this.currentUserRole = highestRole.name;
            return this.currentUserRole;
        } catch (error) {
            console.error('Fetch user role error:', error);
            this.currentUserRole = '';
            return '';
        }
    }

    /**
     * Fetch all user profiles
     */
    async fetchAllProfiles() {
        try {
            const {data: profiles, error} = await supabase
                .from('profiles')
                .select();

            if (error) throw error;

            this.allProfiles = profiles || [];
            return this.allProfiles;
        } catch (error) {
            console.error('Fetch all profiles error:', error);
            return [];
        }
    }
}

// Create singleton instance
const singleton = new ProfileServiceImpl();
export const ProfileService = singleton;
