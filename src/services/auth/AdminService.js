import supabase from '../../core/SupabaseClient';

export class AdminService {
    // Cache for user email lookups
    static userEmailCache = {};

    // Try to fetch a user's email from auth.users if possible
    // This works only if you have a custom auth.users view set up in Supabase
    static async getUserEmail(userId) {
        if (!userId) return null;

        // Return from cache if available
        if (this.userEmailCache[userId]) {
            return this.userEmailCache[userId];
        }

        try {
            // Try to query a users view or table if it exists
            // This assumes you might have a custom setup in Supabase
            const {data, error} = await supabase
                .from('users') // This could be a view that exposes auth.users safely
                .select('email')
                .eq('id', userId)
                .single();

            if (error) {
                console.log('Could not access users table/view:', error);
                return null;
            }

            if (data && data.email) {
                // Cache the result
                this.userEmailCache[userId] = data.email;
                return data.email;
            }

            return null;
        } catch (error) {
            console.error(`Error fetching user email for ${userId}:`, error);
            return null;
        }
    }
}
