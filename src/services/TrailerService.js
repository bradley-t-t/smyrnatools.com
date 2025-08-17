import {supabase} from './DatabaseService';
import Trailer from '../config/models/trailers/Trailer';
import {isValidUUID} from '../utils/UserUtility';

const TRAILERS = 'trailers';
const HISTORY = 'trailers_history';
const COMMENTS = 'trailers_comments';
const MAINTENANCE = 'trailers_maintenance';

export const TrailerService = {
    async fetchTrailers() {
        const {data, error} = await supabase
            .from(TRAILERS)
            .select('*')
            .order('trailer_number', {ascending: true});
        if (error) throw new Error(error.message);
        return data ? data.map(Trailer.fromApiFormat) : [];
    },

    async fetchTrailerById(trailerId) {
        if (!trailerId) throw new Error('Trailer ID is required');
        if (typeof trailerId === 'object') {
            trailerId = trailerId.id || trailerId.trailerId || '';
        }
        if (!isValidUUID(trailerId)) throw new Error(`Invalid trailer ID format: ${trailerId}`);
        const {data, error} = await supabase
            .from(TRAILERS)
            .select('*')
            .eq('id', trailerId)
            .single();
        if (error) throw new Error(error.message);
        return data ? Trailer.fromApiFormat(data) : null;
    },

    async createTrailer(trailer, userId) {
        const trailerData = {
            ...trailer.toApiFormat(),
            updated_by: userId,
            updated_last: trailer.updatedLast || null,
            status: trailer.status
        };
        const {data, error} = await supabase
            .from(TRAILERS)
            .insert([trailerData])
            .select();
        if (error) throw new Error(error.message);
        return data?.length ? Trailer.fromApiFormat(data[0]) : null;
    },

    async updateTrailer(trailerId, updatedTrailer, userId, oldTrailer) {
        const trailerInstance = updatedTrailer instanceof Trailer
            ? updatedTrailer
            : Trailer.ensureInstance(updatedTrailer);
        const updateUserId = userId || trailerInstance.updatedBy;
        const trailerData = {
            ...trailerInstance.toApiFormat(),
            updated_at: new Date().toISOString(),
            updated_by: updateUserId,
            trailer_number: trailerInstance.trailerNumber,
            status: trailerInstance.status
        };
        const {data, error} = await supabase
            .from(TRAILERS)
            .update(trailerData)
            .eq('id', trailerId)
            .select();
        if (error) throw new Error(error.message);
        if (data?.length && oldTrailer) {
            const fields = [
                'trailer_number',
                'assigned_plant',
                'trailer_type',
                'assigned_tractor',
                'cleanliness_rating',
                'status'
            ];
            const changes = fields.reduce((arr, field) => {
                if (oldTrailer[field] !== trailerData[field]) {
                    arr.push({
                        trailer_id: trailerId,
                        field_name: field,
                        old_value: oldTrailer[field] || null,
                        new_value: trailerData[field] || null,
                        changed_at: new Date().toISOString(),
                        changed_by: userId
                    });
                }
                return arr;
            }, []);
            if (changes.length) {
                await supabase.from(HISTORY).insert(changes);
            }
        }
        return data?.length ? Trailer.fromApiFormat(data[0]) : null;
    },

    async getTrailerHistory(trailerId, limit = null) {
        let query = supabase
            .from(HISTORY)
            .select('*')
            .eq('trailer_id', trailerId)
            .order('changed_at', {ascending: false});
        if (limit) query = query.limit(limit);
        const {data, error} = await query;
        if (error) throw new Error(error.message);
        return data || [];
    },

    async fetchComments(trailerId) {
        const {data, error} = await supabase
            .from(COMMENTS)
            .select('*')
            .eq('trailer_id', trailerId)
            .order('created_at', {ascending: false});
        if (error) throw new Error(error.message);
        return data || [];
    },

    async addComment(trailerId, commentText, userId) {
        const {data, error} = await supabase
            .from(COMMENTS)
            .insert([{
                trailer_id: trailerId,
                text: commentText,
                author: userId,
                created_at: new Date().toISOString()
            }])
            .select();
        if (error) throw new Error(error.message);
        return data?.length ? data[0] : null;
    },

    async deleteComment(commentId) {
        const {error} = await supabase
            .from(COMMENTS)
            .delete()
            .eq('id', commentId);
        if (error) throw new Error(error.message);
    },

    async fetchIssues(trailerId) {
        const {data, error} = await supabase
            .from(MAINTENANCE)
            .select('*')
            .eq('trailer_id', trailerId)
            .order('time_created', {ascending: false});
        if (error) throw new Error(error.message);
        return data || [];
    },

    async addIssue(trailerId, issueText, severity) {
        const {data, error} = await supabase
            .from(MAINTENANCE)
            .insert([{
                id: crypto.randomUUID(),
                trailer_id: trailerId,
                issue: issueText,
                severity,
                time_created: new Date().toISOString(),
                time_completed: null
            }])
            .select();
        if (error) throw new Error(error.message);
        return data?.length ? data[0] : null;
    },

    async completeIssue(issueId) {
        const {data, error} = await supabase
            .from(MAINTENANCE)
            .update({time_completed: new Date().toISOString()})
            .eq('id', issueId)
            .select();
        if (error) throw new Error(error.message);
        return data?.length ? data[0] : null;
    },

    async deleteIssue(issueId) {
        const {error} = await supabase
            .from(MAINTENANCE)
            .delete()
            .eq('id', issueId);
        if (error) throw new Error(error.message);
    }
};

export default TrailerService;