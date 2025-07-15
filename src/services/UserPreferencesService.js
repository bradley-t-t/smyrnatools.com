import {supabase} from './DatabaseService';

const PREFERENCES_TABLE = 'users_preferences';

export class UserPreferencesService {
    static async getUserPreferences(userId) {
        if (!userId) throw new Error('User ID is required');

        const {data, error} = await supabase
            .from(PREFERENCES_TABLE)
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error(`Error getting user preferences for user ${userId}:`, error);
            throw error;
        }

        return data ?? null;
    }

    static async saveMixerFilters(userId, filters) {
        if (!userId) throw new Error('User ID is required');
        if (!filters) throw new Error('Filters are required');

        const {data, error: selectError} = await supabase
            .from(PREFERENCES_TABLE)
            .select('id')
            .eq('user_id', userId);

        if (selectError) {
            console.error(`Error checking preferences for user ${userId}:`, selectError);
            throw selectError;
        }

        const now = new Date().toISOString();
        const {error} = data?.length
            ? await supabase
                .from(PREFERENCES_TABLE)
                .update({mixer_filters: filters, updated_at: now})
                .eq('user_id', userId)
            : await supabase
                .from(PREFERENCES_TABLE)
                .insert({user_id: userId, mixer_filters: filters, created_at: now, updated_at: now});

        if (error) {
            console.error(`Error saving mixer filters for user ${userId}:`, error);
            throw error;
        }

        return true;
    }

    static async saveLastViewedFilters(userId, filters) {
        if (!userId) throw new Error('User ID is required');
        if (!filters) throw new Error('Filters are required');

        const {error} = await supabase
            .from(PREFERENCES_TABLE)
            .upsert({
                user_id: userId,
                last_viewed_filters: filters,
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            }, {onConflict: 'user_id'});

        if (error) {
            console.error(`Error saving last viewed filters for user ${userId}:`, error);
            throw error;
        }

        return true;
    }
}