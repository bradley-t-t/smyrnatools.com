import supabase from '../core/Supabase';
import {AuthService} from './auth/AuthService';

class ProfileServiceImpl {
    constructor() {
        this.currentProfile = null;
        this.currentUserRole = '';
        this.allProfiles = [];
    }

    /**
     * Update user profile
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
            console.error('Update profile error:', error);
            throw error;
        }
    }

    /**
     * Update user role and plant
     */
    async updateUserRoleAndPlant(userId, roleName, plantCode) {
        try {
            const now = new Date().toISOString();

            const userRole = {
                user_id: userId,
                role_name: roleName || 'Guest',
                created_at: now,
                updated_at: now
            };

            // Update user role
            const {error: roleError} = await supabase
                .from('user_roles')
                .upsert(userRole, {onConflict: 'user_id'});

            if (roleError) throw roleError;

            // Update profile plant code
            const {error: profileError} = await supabase
                .from('profiles')
                .update({
                    plant_code: plantCode || '',
                    updated_at: now
                })
                .eq('id', userId);

            if (profileError) throw profileError;

            // If this is the current user, refresh their profile
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
     * Delete a user profile
     */
    async deleteProfile(userId) {
        try {
            // Delete profile
            const {error: profileError} = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (profileError) throw profileError;

            // Delete user role
            const {error: roleError} = await supabase
                .from('user_roles')
                .delete()
                .eq('user_id', userId);

            if (roleError) throw roleError;

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
            console.error('Delete profile error:', error);
            throw error;
        }
    }

    /**
     * Fetch current user profile
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
            console.error('Fetch user profile error:', error);
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

            const {data: roles, error} = await supabase
                .from('user_roles')
                .select()
                .eq('user_id', userId);

            if (error) throw error;

            if (!roles || roles.length === 0) {
                this.currentUserRole = '';
                return '';
            }

            this.currentUserRole = roles[0].role_name;
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
