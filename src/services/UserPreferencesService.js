import APIUtility from '../utils/APIUtility'

class UserPreferencesService {
    static async getUserPreferences(userId) {
        if (!userId) throw new Error('User ID is required');
        const {res, json} = await APIUtility.post('/user-preferences-service/get', {userId});
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch user preferences');
        return json?.data ?? null;
    }

    static async saveMixerFilters(userId, filters) {
        if (!userId) throw new Error('User ID is required');
        if (!filters) throw new Error('Filters are required');
        const response = await APIUtility.post('/user-preferences-service/save-mixer-filters', {userId, filters});
        if (!response.res.ok || response.json?.success !== true) throw new Error(response.json?.error || 'Failed to save mixer filters');
        return true;
    }

    static async saveLastViewedFilters(userId, filters) {
        if (!userId) throw new Error('User ID is required');
        if (!filters) throw new Error('Filters are required');
        const response = await APIUtility.post('/user-preferences-service/save-last-viewed-filters', {userId, filters});
        if (!response.res.ok || response.json?.success !== true) throw new Error(response.json?.error || 'Failed to save last viewed filters');
        return true;
    }
}

export {UserPreferencesService};
