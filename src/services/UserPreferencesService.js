import {supabase} from './DatabaseService';

const TABLE = 'users_preferences';

class UserPreferencesService {
    static async getUserPreferences(userId) {
        if (!userId) throw new Error('User ID is required');
        const {data, error} = await supabase
            .from(TABLE)
            .select('*')
            .eq('user_id', userId)
            .single();
        if (error) throw error;
        return data ?? null;
    }

    static async saveMixerFilters(userId, filters) {
        if (!userId) throw new Error('User ID is required');
        if (!filters) throw new Error('Filters are required');
        const now = new Date().toISOString();
        const {data, error: selectError} = await supabase
            .from(TABLE)
            .select('id')
            .eq('user_id', userId);
        if (selectError) throw selectError;
        const {error} = data?.length
            ? await supabase
                .from(TABLE)
                .update({mixer_filters: filters, updated_at: now})
                .eq('user_id', userId)
            : await supabase
                .from(TABLE)
                .insert({user_id: userId, mixer_filters: filters, created_at: now, updated_at: now});
        if (error) throw error;
        return true;
    }

    static async saveLastViewedFilters(userId, filters) {
        if (!userId) throw new Error('User ID is required');
        if (!filters) throw new Error('Filters are required');
        const now = new Date().toISOString();
        const {error} = await supabase
            .from(TABLE)
            .upsert({
                user_id: userId,
                last_viewed_filters: filters,
                updated_at: now,
                created_at: now
            }, {onConflict: 'user_id'});
        if (error) throw error;
        return true;
    }
}

export {UserPreferencesService};
