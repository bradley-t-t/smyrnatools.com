import APIUtility from '../utils/APIUtility'
import {Mixer} from '../config/models/mixers/Mixer'
import MixerUtility from '../utils/MixerUtility'
import {MixerHistory} from '../config/models/mixers/MixerHistory'
import {UserService} from './UserService'
import {MixerComment} from '../config/models/mixers/MixerComment'
import {MixerImage} from '../config/models/mixers/MixerImage'
import {v4 as uuidv4} from 'uuid'
import {ValidationUtility} from '../utils/ValidationUtility'

class MixerServiceImpl {
    static async getAllMixers() {
        const {res, json} = await APIUtility.post('/mixer-service/fetch-all')
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch mixers')
        const data = json?.data ?? []
        return data.map(mixer => new Mixer(mixer))
    }

    static async fetchMixers() {
        return this.getAllMixers()
    }

    static async getMixerById(id) {
        ValidationUtility.requireUUID(id, 'Mixer ID is required')
        const {res, json} = await APIUtility.post('/mixer-service/fetch-by-id', {id})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch mixer')
        const data = json?.data
        if (!data) return null
        return new Mixer(data)
    }

    static async fetchMixerById(id) {
        ValidationUtility.requireUUID(id, 'Invalid mixer ID')
        const mixer = await this.getMixerById(id)
        if (!mixer) return null
        mixer.isVerified = function (latestHistoryDate) {
            return MixerUtility.isVerified(this.updatedLast, this.updatedAt, this.updatedBy, latestHistoryDate ?? this.latestHistoryDate)
        }
        return mixer
    }

    static async getLatestHistoryDate(mixerId) {
        if (!mixerId) return null
        const {res, json} = await APIUtility.post('/mixer-service/fetch-history', {mixerId, limit: 1})
        if (!res.ok) return null
        const first = (json?.data ?? [])[0]
        return first?.changed_at ?? null
    }

    static async getActiveMixers() {
        const {res, json} = await APIUtility.post('/mixer-service/fetch-active')
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch active mixers')
        return (json?.data ?? []).map(mixer => new Mixer(mixer))
    }

    static async getMixerHistory(mixerId, limit = null) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        const payload = {mixerId}
        if (limit && Number.isInteger(limit) && limit > 0) payload.limit = limit
        const {res, json} = await APIUtility.post('/mixer-service/fetch-history', payload)
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch mixer history')
        return (json?.data ?? []).map(entry => new MixerHistory(entry))
    }

    static async addMixer(mixer, userId) {
        const {res, json} = await APIUtility.post('/mixer-service/create', {userId, mixer})
        if (!res.ok) throw new Error(json?.error || 'Failed to create mixer')
        return new Mixer(json?.data)
    }

    static async createMixer(mixer, userId) {
        if (!userId) {
            const user = await UserService.getCurrentUser()
            userId = typeof user === 'object' && user !== null ? user.id : user
            if (!userId) throw new Error('Authentication required')
        }
        if (mixer.id) delete mixer.id
        return this.addMixer(mixer, userId)
    }

    static async updateMixer(mixerId, mixer, userId, _prevMixerState = null) {
        const id = typeof mixerId === 'object' ? mixerId.id : mixerId
        ValidationUtility.requireUUID(id, 'Mixer ID is required')
        if (!userId) {
            const user = await UserService.getCurrentUser()
            userId = typeof user === 'object' && user !== null ? user.id : user
        }
        if (!userId) throw new Error('User ID is required')
        const {res, json} = await APIUtility.post('/mixer-service/update', {id, mixer, userId})
        if (!res.ok) throw new Error(json?.error || 'Failed to update mixer')
        return new Mixer(json?.data)
    }

    static async deleteMixer(id) {
        ValidationUtility.requireUUID(id, 'Mixer ID is required')
        const {res, json} = await APIUtility.post('/mixer-service/delete', {id})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete mixer')
        return true
    }

    static async createHistoryEntry(mixerId, fieldName, oldValue, newValue, changedBy) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        if (!fieldName) throw new Error('Field name required')
        let userId = changedBy
        if (!userId) {
            const user = await UserService.getCurrentUser()
            userId = typeof user === 'object' && user !== null ? user.id : user
        }
        if (!userId) userId = '00000000-0000-0000-0000-000000000000'
        const {res, json} = await APIUtility.post('/mixer-service/add-history', {
            mixerId,
            fieldName,
            oldValue,
            newValue,
            changedBy: userId
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to create history entry')
        return json?.data
    }

    static async getCleanlinessHistory(mixerId = null, months = 6) {
        const payload = {}
        if (mixerId) payload.mixerId = mixerId
        if (months) payload.months = months
        const {res, json} = await APIUtility.post('/mixer-service/fetch-cleanliness-history', payload)
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch cleanliness history')
        return json?.data ?? []
    }

    static async getMixersByOperator(operatorId) {
        ValidationUtility.requireUUID(operatorId, 'Operator ID is required')
        const {res, json} = await APIUtility.post('/mixer-service/fetch-by-operator', {operatorId})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch mixers by operator')
        return (json?.data ?? []).map(mixer => new Mixer(mixer))
    }

    static async getMixersByStatus(status) {
        if (!status) throw new Error('Status is required')
        const {res, json} = await APIUtility.post('/mixer-service/fetch-by-status', {status})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch mixers by status')
        return (json?.data ?? []).map(mixer => new Mixer(mixer))
    }

    static async searchMixersByTruckNumber(query) {
        if (!query?.trim()) throw new Error('Search query is required')
        const {res, json} = await APIUtility.post('/mixer-service/search-by-truck-number', {query: query.trim()})
        if (!res.ok) throw new Error(json?.error || 'Failed to search mixers')
        return (json?.data ?? []).map(mixer => new Mixer(mixer))
    }

    static async getMixersNeedingService(dayThreshold = 30) {
        const {res, json} = await APIUtility.post('/mixer-service/fetch-needing-service', {dayThreshold})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch mixers needing service')
        return (json?.data ?? []).map(mixer => new Mixer(mixer))
    }

    static async fetchComments(mixerId) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        const {res, json} = await APIUtility.post('/mixer-service/fetch-comments', {mixerId})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch comments')
        return (json?.data ?? []).map(row => MixerComment.fromRow(row))
    }

    static async addComment(mixerId, text, author) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        if (!text?.trim()) throw new Error('Comment text is required')
        if (!author?.trim()) throw new Error('Author is required')
        const {res, json} = await APIUtility.post('/mixer-service/add-comment', {
            mixerId,
            text: text.trim(),
            author: author.trim()
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to add comment')
        return json?.data ? MixerComment.fromRow(json.data) : null
    }

    static async deleteComment(commentId) {
        ValidationUtility.requireUUID(commentId, 'Comment ID is required')
        const {res, json} = await APIUtility.post('/mixer-service/delete-comment', {commentId})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete comment')
        return true
    }

    static async _fetchHistoryDates() {
        const mixers = await this.getAllMixers()
        const map = {}
        mixers.forEach(m => {
            map[m.id] = m.latestHistoryDate ?? null
        })
        return map
    }

    static async fetchMixerImages(mixerId) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        const {res, json} = await APIUtility.post('/mixer-service/fetch-images', {mixerId})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch mixer images')
        return (json?.data ?? []).map(image => MixerImage.fromRow(image))
    }

    static async uploadMixerImage(mixerId, file) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        if (!file) throw new Error('File is required')
        const ext = (file.name?.split('.')?.pop() || '').trim()
        const fileName = `mixer_${mixerId}_${uuidv4()}${ext ? '.' + ext : ''}`
        const fileBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
                const result = reader.result
                if (typeof result === 'string') {
                    const idx = result.indexOf(',')
                    resolve(idx >= 0 ? result.substring(idx + 1) : result)
                } else {
                    const b64 = btoa(String.fromCharCode(...new Uint8Array(result)))
                    resolve(b64)
                }
            }
            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.readAsDataURL(file)
        })
        const contentType = file.type || 'application/octet-stream'
        const {res, json} = await APIUtility.post('/mixer-service/upload-image', {
            mixerId,
            fileName,
            fileBase64,
            contentType
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to upload mixer image')
        return MixerImage.fromRow(json?.data)
    }

    static async deleteMixerImage(imageId) {
        ValidationUtility.requireUUID(imageId, 'Image ID is required')
        const {res, json} = await APIUtility.post('/mixer-service/delete-image', {imageId})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete mixer image')
        return true
    }

    static async fetchIssues(mixerId) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        const {res, json} = await APIUtility.post('/mixer-service/fetch-issues', {mixerId})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch issues')
        return json?.data ?? []
    }

    static async completeIssue(issueId) {
        ValidationUtility.requireUUID(issueId, 'Issue ID is required')
        const {res, json} = await APIUtility.post('/mixer-service/complete-issue', {issueId})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to complete issue')
        return true
    }

    static async addIssue(mixerId, issue, severity) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        if (!issue?.trim()) throw new Error('Issue description is required')
        if (!['Low', 'Medium', 'High'].includes(severity)) throw new Error('Severity must be Low, Medium, or High')
        const {res, json} = await APIUtility.post('/mixer-service/add-issue', {mixerId, issue: issue.trim(), severity})
        if (!res.ok) throw new Error(json?.error || 'Failed to add issue')
        return json?.data
    }

    static async deleteIssue(issueId) {
        ValidationUtility.requireUUID(issueId, 'Issue ID is required')
        const {res, json} = await APIUtility.post('/mixer-service/delete-issue', {issueId})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete issue')
        return true
    }
}

export const MixerService = MixerServiceImpl
