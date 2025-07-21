import supabase from '../app/database/Supabase';
import {AuthService} from './AuthService';
import {AccountManager} from '../app/accounts/AccountManager';

const PROFILES_TABLE = 'users_profiles';
const USERS_TABLE = 'users';

class ProfileServiceImpl {
    constructor() {
        this.currentProfile = null;
        this.currentUserRole = '';
        this.allProfiles = [];
    }

    async updateProfile(firstName, lastName, plantCode) {
        if (!AuthService.currentUser) throw new Error('No authenticated user');
        if (!firstName?.trim() || !lastName?.trim()) throw new Error('First and last name are required');

        const userId = AuthService.currentUser.id;
        const now = new Date().toISOString();
        const profile = {
            id: userId,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            plant_code: plantCode?.trim() ?? '',
            created_at: this.currentProfile?.created_at ?? now,
            updated_at: now
        };

        const {error} = await supabase
            .from(PROFILES_TABLE)
            .upsert(profile, {onConflict: 'id'});

        if (error) {
            console.error('Error updating profile:', error);
            throw error;
        }

        this.currentProfile = profile;
        return true;
    }

    async updateUserRoleAndPlant(userId, roleName, plantCode) {
        if (!userId) throw new Error('User ID is required');
        const now = new Date().toISOString();

        const role = await AccountManager.getRoleByName(roleName ?? 'Guest');
        if (!role) throw new Error(`Role '${roleName ?? 'Guest'}' not found`);

        const existingRoles = await AccountManager.getUserRoles(userId);
        await Promise.all(existingRoles.map(role => AccountManager.removeRole(userId, role.id)));

        const roleAssigned = await AccountManager.assignRole(userId, role.id);
        if (!roleAssigned) throw new Error(`Failed to assign role '${roleName}'`);

        const {error} = await supabase
            .from(PROFILES_TABLE)
            .update({
                plant_code: plantCode?.trim() ?? '',
                updated_at: now
            })
            .eq('id', userId);

        if (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }

        if (AuthService.currentUser?.id === userId) {
            await Promise.all([this.fetchUserProfile(), this.fetchUserRole()]);
        }

        return true;
    }

    async deleteProfile(userId) {
        if (!userId) throw new Error('User ID is required');

        const [{error: profileError}, roles] = await Promise.all([
            supabase.from(PROFILES_TABLE).delete().eq('id', userId),
            AccountManager.getUserRoles(userId)
        ]);

        if (profileError) {
            console.error('Error deleting profile:', profileError);
            throw profileError;
        }

        await Promise.all(roles.map(role => AccountManager.removeRole(userId, role.id)));

        const {error: userError} = await supabase
            .from(USERS_TABLE)
            .delete()
            .eq('id', userId);

        if (userError) {
            console.error('Error deleting user:', userError);
            throw userError;
        }

        if (AuthService.currentUser?.id === userId) {
            await AuthService.signOut();
        }

        return true;
    }

    async fetchUserProfile() {
        if (!AuthService.currentUser) {
            this.currentProfile = null;
            return null;
        }

        const userId = AuthService.currentUser.id;
        const {data, error} = await supabase
            .from(PROFILES_TABLE)
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !data) {
            console.error('Error fetching user profile:', error);
            this.currentProfile = null;
            return null;
        }

        this.currentProfile = data;
        return data;
    }

    async fetchUserRole() {
        if (!AuthService.currentUser) {
            this.currentUserRole = '';
            return '';
        }

        const userId = AuthService.currentUser.id;
        const highestRole = await AccountManager.getHighestRole(userId);

        this.currentUserRole = highestRole?.name ?? '';
        return this.currentUserRole;
    }

    async fetchAllProfiles() {
        const {data, error} = await supabase
            .from(PROFILES_TABLE)
            .select('id, first_name, last_name, plant_code, created_at, updated_at')
            .order('last_name');

        if (error) {
            console.error('Error fetching all profiles:', error);
            throw error;
        }

        this.allProfiles = data ?? [];
        return data;
    }
}

export const ProfileService = new ProfileServiceImpl();