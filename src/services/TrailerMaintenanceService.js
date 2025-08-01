import { supabase } from './DatabaseService';

export const TrailerMaintenanceService = {
    async fetchIssues(trailerId) {
        const { data, error } = await supabase
            .from('trailers_maintenance')
            .select('*')
            .eq('trailer_id', trailerId)
            .order('time_created', { ascending: false });
        if (error) throw new Error(`Error fetching issues: ${error.message}`);
        return data || [];
    },

    async addIssue(trailerId, issueText, severity, userId) {
        const { data, error } = await supabase
            .from('trailers_maintenance')
            .insert([{
                id: crypto.randomUUID(),
                trailer_id: trailerId,
                issue: issueText,
                severity,
                time_created: new Date().toISOString(),
                time_completed: null
            }])
            .select();
        if (error) throw new Error(`Error adding issue: ${error.message}`);
        return data?.length ? data[0] : null;
    },

    async completeIssue(issueId) {
        const { data, error } = await supabase
            .from('trailers_maintenance')
            .update({ time_completed: new Date().toISOString() })
            .eq('id', issueId)
            .select();
        if (error) throw new Error(`Error completing issue: ${error.message}`);
        return data?.length ? data[0] : null;
    },

    async deleteIssue(issueId) {
        const { error } = await supabase
            .from('trailers_maintenance')
            .delete()
            .eq('id', issueId);
        if (error) throw new Error(`Error deleting issue: ${error.message}`);
    }
};

export default TrailerMaintenanceService;