import { supabase } from '../../core/clients/SupabaseClient';

export class UserPreferencesService {
    /**
     * Get user preferences from the database
     * @param {string} userId - The user ID
     * @returns {Promise<object>} - The user preferences
     */
    static async getUserPreferences(userId) {
        try {
            const { data, error } = await supabase
                .from('users_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting user preferences:', error);
            return null;
        }
    }

    /**
     * Save mixer filters to the database
     * @param {string} userId - The user ID
     * @param {object} filters - The mixer filters
     * @returns {Promise<boolean>} - Success status
     */
    static async saveMixerFilters(userId, filters) {
        try {
            // Check if user preferences exist
            const { data } = await supabase
                .from('users_preferences')
                .select('id')
                .eq('user_id', userId);

            if (!data || data.length === 0) {
                // Create user preferences if they don't exist
                await supabase
                    .from('users_preferences')
                    .insert([{
                        user_id: userId,
                        mixer_filters: filters
                    }]);
            } else {
                // Update existing preferences
                await supabase
                    .from('users_preferences')
                    .update({
                        mixer_filters: filters,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId);
            }

            return true;
        } catch (error) {
            console.error('Error saving mixer filters:', error);
            return false;
        }
    }

    /**
     * Save the last viewed filters before navigating to detail view
     * @param {string} userId - The user ID
     * @param {object} filters - The current filters
     * @returns {Promise<boolean>} - Success status
     */
    static async saveLastViewedFilters(userId, filters) {
        try {
            const { error } = await supabase
                .from('users_preferences')
                .update({
                    last_viewed_filters: filters,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error saving last viewed filters:', error);
            return false;
        }
    }
}
