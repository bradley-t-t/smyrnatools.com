import APIUtility from '../utils/APIUtility'
import {Tractor} from '../config/models/tractors/Tractor'
import {TractorUtility} from '../utils/TractorUtility'
import {TractorHistory} from '../config/models/tractors/TractorHistory'
import {UserService} from './UserService'
import {TractorComment} from '../config/models/tractors/TractorComment'
import {ValidationUtility} from '../utils/ValidationUtility'

export class TractorService {
    static async getAllTractors() {
        const {res, json} = await APIUtility.post('/tractor-service/fetch-all')
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch tractors')
        const data = json?.data ?? []
        return data.map(Tractor.fromApiFormat)
    }

    static async fetchTractors() {
        return this.getAllTractors()
    }

    static async getTractorById(id) {
        ValidationUtility.requireUUID(id, 'Tractor ID is required')
        const {res, json} = await APIUtility.post('/tractor-service/fetch-by-id', {id})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch tractor')
        const data = json?.data
        if (!data) return null
        return Tractor.fromApiFormat(data)
    }

    static async fetchTractorById(id) {
        ValidationUtility.requireUUID(id, 'Invalid tractor ID')
        const tractor = await this.getTractorById(id)
        if (!tractor) return null
        tractor.isVerified = function (latestHistoryDate) {
            return TractorUtility.isVerified(this.updatedLast, this.updatedAt, this.updatedBy, latestHistoryDate ?? this.latestHistoryDate)
        }
        return tractor
    }

    static async getLatestHistoryDate(tractorId) {
        if (!tractorId) return null
        const {res, json} = await APIUtility.post('/tractor-service/fetch-history', {tractorId, limit: 1})
        if (!res.ok) return null
        const first = (json?.data ?? [])[0]
        return first?.changed_at ?? null
    }

    static async getActiveTractors() {
        const {res, json} = await APIUtility.post('/tractor-service/fetch-active')
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch active tractors')
        return (json?.data ?? []).map(Tractor.fromApiFormat)
    }

    static async getTractorHistory(tractorId, limit = null) {
        ValidationUtility.requireUUID(tractorId, 'Tractor ID is required')
        const payload = {tractorId}
        if (limit && Number.isInteger(limit) && limit > 0) payload.limit = limit
        const {res, json} = await APIUtility.post('/tractor-service/fetch-history', payload)
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch tractor history')
        return (json?.data ?? []).map(TractorHistory.fromApiFormat)
    }

    static async addTractor(tractor, userId) {
        const {res, json} = await APIUtility.post('/tractor-service/create', {userId, tractor})
        if (!res.ok) throw new Error(json?.error || 'Failed to create tractor')
        return Tractor.fromApiFormat(json?.data)
    }

    static async createTractor(tractor, userId) {
        if (!userId) {
            const user = await UserService.getCurrentUser()
            userId = typeof user === 'object' && user !== null ? user.id : user
            if (!userId) throw new Error('Authentication required')
        }
        if (tractor.id) delete tractor.id
        return this.addTractor(tractor, userId)
    }

    static async updateTractor(tractorId, tractor, userId, _prevTractorState = null) {
        const id = typeof tractorId === 'object' ? tractorId.id : tractorId
        ValidationUtility.requireUUID(id, 'Tractor ID is required')
        if (!userId) {
            const user = await UserService.getCurrentUser()
            userId = typeof user === 'object' && user !== null ? user.id : user
        }
        if (!userId) throw new Error('User ID is required')
        const {res, json} = await APIUtility.post('/tractor-service/update', {id, tractor, userId})
        if (!res.ok) throw new Error(json?.error || 'Failed to update tractor')
        return Tractor.fromApiFormat(json?.data)
    }

    static async deleteTractor(id) {
        ValidationUtility.requireUUID(id, 'Tractor ID is required')
        const {res, json} = await APIUtility.post('/tractor-service/delete', {id})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete tractor')
        return true
    }

    static async createHistoryEntry(tractorId, fieldName, oldValue, newValue, changedBy) {
        ValidationUtility.requireUUID(tractorId, 'Tractor ID is required')
        if (!fieldName) throw new Error('Field name required')
        let userId = changedBy
        if (!userId) {
            const user = await UserService.getCurrentUser()
            userId = typeof user === 'object' && user !== null ? user.id : user
        }
        if (!userId) userId = '00000000-0000-0000-0000-000000000000'
        const {res, json} = await APIUtility.post('/tractor-service/add-history', {
            tractorId,
            fieldName,
            oldValue,
            newValue,
            changedBy: userId
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to create history entry')
        return json?.data
    }

    static async getCleanlinessHistory(tractorId = null, months = 6) {
        const payload = {}
        if (tractorId) payload.tractorId = tractorId
        if (months) payload.months = months
        const {res, json} = await APIUtility.post('/tractor-service/fetch-cleanliness-history', payload)
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch cleanliness history')
        return json?.data ?? []
    }

    static async getTractorsByOperator(operatorId) {
        ValidationUtility.requireUUID(operatorId, 'Operator ID is required')
        const {res, json} = await APIUtility.post('/tractor-service/fetch-by-operator', {operatorId})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch tractors by operator')
        return (json?.data ?? []).map(Tractor.fromApiFormat)
    }

    static async getTractorsByStatus(status) {
        if (!status) throw new Error('Status is required')
        const {res, json} = await APIUtility.post('/tractor-service/fetch-by-status', {status})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch tractors by status')
        return (json?.data ?? []).map(Tractor.fromApiFormat)
    }

    static async searchTractorsByTruckNumber(query) {
        if (!query?.trim()) throw new Error('Search query is required')
        const {res, json} = await APIUtility.post('/tractor-service/search-by-truck-number', {query: query.trim()})
        if (!res.ok) throw new Error(json?.error || 'Failed to search tractors')
        return (json?.data ?? []).map(Tractor.fromApiFormat)
    }

    static async getTractorsNeedingService(dayThreshold = 30) {
        const {res, json} = await APIUtility.post('/tractor-service/fetch-needing-service', {dayThreshold})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch tractors needing service')
        return (json?.data ?? []).map(Tractor.fromApiFormat)
    }

    static async fetchComments(tractorId) {
        ValidationUtility.requireUUID(tractorId, 'Tractor ID is required')
        const {res, json} = await APIUtility.post('/tractor-service/fetch-comments', {tractorId})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch comments')
        return (json?.data ?? []).map(TractorComment.fromRow)
    }

    static async addComment(tractorId, text, author) {
        ValidationUtility.requireUUID(tractorId, 'Tractor ID is required')
        if (!text?.trim()) throw new Error('Comment text is required')
        if (!author?.trim()) throw new Error('Author is required')
        const {res, json} = await APIUtility.post('/tractor-service/add-comment', {
            tractorId,
            text: text.trim(),
            author: author.trim()
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to add comment')
        return json?.data ? TractorComment.fromRow(json.data) : null
    }

    static async deleteComment(commentId) {
        ValidationUtility.requireUUID(commentId, 'Comment ID is required')
        const {res, json} = await APIUtility.post('/tractor-service/delete-comment', {commentId})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete comment')
        return true
    }

    static async _fetchHistoryDates() {
        const tractors = await this.getAllTractors()
        const map = {}
        tractors.forEach(t => {
            map[t.id] = t.latestHistoryDate ?? null
        })
        return map
    }

    static async fetchIssues(tractorId) {
        ValidationUtility.requireUUID(tractorId, 'Tractor ID is required')
        const {res, json} = await APIUtility.post('/tractor-service/fetch-issues', {tractorId})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch issues')
        return json?.data ?? []
    }

    static async addIssue(tractorId, issueText, severity) {
        ValidationUtility.requireUUID(tractorId, 'Tractor ID is required')
        if (!issueText?.trim()) throw new Error('Issue description is required')
        const validSeverities = ['Low', 'Medium', 'High']
        const finalSeverity = validSeverities.includes(severity) ? severity : 'Medium'
        const {res, json} = await APIUtility.post('/tractor-service/add-issue', {
            tractorId,
            issue: issueText.trim(),
            severity: finalSeverity
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to add issue')
        return json?.data
    }

    static async deleteIssue(issueId) {
        ValidationUtility.requireUUID(issueId, 'Issue ID is required')
        const {res, json} = await APIUtility.post('/tractor-service/delete-issue', {issueId})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete issue')
        return true
    }

    static async completeIssue(issueId) {
        ValidationUtility.requireUUID(issueId, 'Issue ID is required')
        const {res, json} = await APIUtility.post('/tractor-service/complete-issue', {issueId})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to complete issue')
        return true
    }
}