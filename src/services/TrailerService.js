import APIUtility from '../utils/APIUtility';
import Trailer from '../config/models/trailers/Trailer';
import {isValidUUID} from '../utils/UserUtility';
import {UserService} from './UserService';

const TrailerService = {
    async fetchTrailers() {
        const {res, json} = await APIUtility.post('/trailer-service/fetch-all');
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch trailers');
        const data = json?.data ?? [];
        return data.map(Trailer.fromApiFormat);
    },

    async fetchTrailerById(trailerId) {
        if (!trailerId) throw new Error('Trailer ID is required');
        if (typeof trailerId === 'object') trailerId = trailerId.id || trailerId.trailerId || '';
        if (!isValidUUID(trailerId)) throw new Error(`Invalid trailer ID format: ${trailerId}`);
        const {res, json} = await APIUtility.post('/trailer-service/fetch-by-id', {id: trailerId});
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch trailer');
        const data = json?.data;
        return data ? Trailer.fromApiFormat(data) : null;
    },

    async createTrailer(trailer, userId) {
        const {res, json} = await APIUtility.post('/trailer-service/create', {userId, trailer});
        if (!res.ok) throw new Error(json?.error || 'Failed to create trailer');
        return json?.data ? Trailer.fromApiFormat(json.data) : null;
    },

    async updateTrailer(trailerId, updatedTrailer, userId, _oldTrailer) {
        const id = typeof trailerId === 'object' ? trailerId.id : trailerId;
        if (!isValidUUID(id)) throw new Error(`Invalid trailer ID format: ${id}`);
        const trailer = updatedTrailer instanceof Trailer ? updatedTrailer : Trailer.ensureInstance(updatedTrailer);
        const {res, json} = await APIUtility.post('/trailer-service/update', {id, trailer, userId});
        if (!res.ok) throw new Error(json?.error || 'Failed to update trailer');
        return json?.data ? Trailer.fromApiFormat(json.data) : null;
    },

    async deleteTrailer(id) {
        if (!isValidUUID(id)) throw new Error(`Invalid trailer ID format: ${id}`);
        const {res, json} = await APIUtility.post('/trailer-service/delete', {id});
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete trailer');
        return true;
    },

    async getTrailerHistory(trailerId, limit = null) {
        if (!isValidUUID(trailerId)) throw new Error(`Invalid trailer ID format: ${trailerId}`);
        const payload = {trailerId};
        if (limit && Number.isInteger(limit)) payload.limit = limit;
        const {res, json} = await APIUtility.post('/trailer-service/fetch-history', payload);
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch trailer history');
        return json?.data ?? [];
    },

    async createHistoryEntry(trailerId, fieldName, oldValue, newValue, changedBy) {
        if (!isValidUUID(trailerId)) throw new Error('Trailer ID is required');
        if (!fieldName) throw new Error('Field name required');
        let userId = changedBy;
        if (!userId) {
            const user = await UserService.getCurrentUser();
            userId = typeof user === 'object' && user !== null ? user.id : user;
        }
        if (!userId) userId = '00000000-0000-0000-0000-000000000000';
        const {res, json} = await APIUtility.post('/trailer-service/add-history', {
            trailerId,
            fieldName,
            oldValue,
            newValue,
            changedBy: userId
        });
        if (!res.ok) throw new Error(json?.error || 'Failed to create history entry');
        return json?.data;
    },

    async getCleanlinessHistory(trailerId = null, months = 6) {
        const payload = {};
        if (trailerId) {
            if (!isValidUUID(trailerId)) throw new Error(`Invalid trailer ID format: ${trailerId}`);
            payload.trailerId = trailerId;
        }
        if (months) payload.months = months;
        const {res, json} = await APIUtility.post('/trailer-service/fetch-cleanliness-history', payload);
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch cleanliness history');
        return json?.data ?? [];
    },

    async getActiveTrailers() {
        const {res, json} = await APIUtility.post('/trailer-service/fetch-active');
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch active trailers');
        return (json?.data ?? []).map(Trailer.fromApiFormat);
    },

    async getTrailersByStatus(status) {
        if (!status) throw new Error('Status is required');
        const {res, json} = await APIUtility.post('/trailer-service/fetch-by-status', {status});
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch trailers by status');
        return (json?.data ?? []).map(Trailer.fromApiFormat);
    },

    async searchTrailersByTrailerNumber(query) {
        if (!query?.trim()) throw new Error('Search query is required');
        const {res, json} = await APIUtility.post('/trailer-service/search-by-trailer-number', {query: query.trim()});
        if (!res.ok) throw new Error(json?.error || 'Failed to search trailers');
        return (json?.data ?? []).map(Trailer.fromApiFormat);
    },

    async fetchComments(trailerId) {
        if (!isValidUUID(trailerId)) throw new Error(`Invalid trailer ID format: ${trailerId}`);
        const {res, json} = await APIUtility.post('/trailer-service/fetch-comments', {trailerId});
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch comments');
        return json?.data ?? [];
    },

    async addComment(trailerId, commentText, userId) {
        if (!isValidUUID(trailerId)) throw new Error(`Invalid trailer ID format: ${trailerId}`);
        if (!commentText?.trim()) throw new Error('Comment text is required');
        if (!userId?.trim?.()) throw new Error('Author is required');
        const {res, json} = await APIUtility.post('/trailer-service/add-comment', {
            trailerId,
            text: commentText.trim(),
            author: userId.trim()
        });
        if (!res.ok) throw new Error(json?.error || 'Failed to add comment');
        return json?.data ?? null;
    },

    async deleteComment(commentId) {
        if (!isValidUUID(commentId)) throw new Error(`Invalid comment ID format: ${commentId}`);
        const {res, json} = await APIUtility.post('/trailer-service/delete-comment', {commentId});
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete comment');
        return true;
    },

    async fetchIssues(trailerId) {
        if (!isValidUUID(trailerId)) throw new Error(`Invalid trailer ID format: ${trailerId}`);
        const {res, json} = await APIUtility.post('/trailer-service/fetch-issues', {trailerId});
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch issues');
        return json?.data ?? [];
    },

    async addIssue(trailerId, issueText, severity) {
        if (!isValidUUID(trailerId)) throw new Error(`Invalid trailer ID format: ${trailerId}`);
        if (!issueText?.trim()) throw new Error('Issue description is required');
        const allowed = ['Low', 'Medium', 'High'];
        const finalSeverity = allowed.includes(severity) ? severity : 'Medium';
        const {res, json} = await APIUtility.post('/trailer-service/add-issue', {
            trailerId,
            issue: issueText.trim(),
            severity: finalSeverity
        });
        if (!res.ok) throw new Error(json?.error || 'Failed to add issue');
        return json?.data ?? null;
    },

    async completeIssue(issueId) {
        if (!isValidUUID(issueId)) throw new Error(`Invalid issue ID format: ${issueId}`);
        const {res, json} = await APIUtility.post('/trailer-service/complete-issue', {issueId});
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to complete issue');
        return true;
    },

    async deleteIssue(issueId) {
        if (!isValidUUID(issueId)) throw new Error(`Invalid issue ID format: ${issueId}`);
        const {res, json} = await APIUtility.post('/trailer-service/delete-issue', {issueId});
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete issue');
        return true;
    }
};

export {TrailerService};
export default TrailerService;