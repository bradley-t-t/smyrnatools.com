import supabase from './DatabaseService'
import { Mixer } from '../config/models/mixers/Mixer'
import MixerUtility from '../utils/MixerUtility'
import { MixerHistory } from '../config/models/mixers/MixerHistory'
import { UserService } from './UserService'
import { MixerComment } from '../config/models/mixers/MixerComment'
import { MixerImage } from '../config/models/mixers/MixerImage'
import { v4 as uuidv4 } from 'uuid'
import { DateUtility } from '../utils/DateUtility'
import { HistoryUtility } from '../utils/HistoryUtility'
import { ValidationUtility } from '../utils/ValidationUtility'

const MIXERS_TABLE = 'mixers'
const HISTORY_TABLE = 'mixers_history'
const MIXERS_COMMENTS_TABLE = 'mixers_comments'
const MIXERS_IMAGES_TABLE = 'mixers_images'
const MIXERS_MAINTENANCE_TABLE = 'mixers_maintenance'
const BUCKET_NAME = 'smyrna'

class MixerServiceImpl {
    static async getAllMixers() {
        const { data, error } = await supabase
            .from(MIXERS_TABLE)
            .select('*')
            .order('truck_number', { ascending: true })
        if (error) throw error
        const historyDates = await this._fetchHistoryDates()
        data.forEach(mixer => mixer.latestHistoryDate = historyDates[mixer.id] ?? null)
        return data.map(mixer => new Mixer(mixer))
    }

    static async fetchMixers() {
        return this.getAllMixers()
    }

    static async getMixerById(id) {
        ValidationUtility.requireUUID(id, 'Mixer ID is required')
        const { data, error } = await supabase
            .from(MIXERS_TABLE)
            .select('*')
            .eq('id', id)
            .single()
        if (error) throw error
        if (!data) return null
        data.latestHistoryDate = await this.getLatestHistoryDate(id)
        return new Mixer(data)
    }

    static async fetchMixerById(id) {
        ValidationUtility.requireUUID(id, 'Invalid mixer ID')
        const mixer = await this.getMixerById(id)
        if (!mixer) return null
        mixer.isVerified = function(latestHistoryDate) { return MixerUtility.isVerified(this.updatedLast, this.updatedAt, this.updatedBy, latestHistoryDate ?? this.latestHistoryDate) }
        return mixer
    }

    static async getLatestHistoryDate(mixerId) {
        if (!mixerId) return null
        const { data, error } = await supabase
            .from(HISTORY_TABLE)
            .select('changed_at')
            .eq('mixer_id', mixerId)
            .order('changed_at', { ascending: false })
            .limit(1)
            .single()
        if (error || !data) return null
        return data.changed_at
    }

    static async getActiveMixers() {
        const { data, error } = await supabase
            .from(MIXERS_TABLE)
            .select('*')
            .eq('status', 'Active')
            .order('truck_number', { ascending: true })
        if (error) throw error
        return data.map(mixer => new Mixer(mixer))
    }

    static async getMixerHistory(mixerId, limit = null) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        let query = supabase
            .from(HISTORY_TABLE)
            .select('*')
            .eq('mixer_id', mixerId)
            .order('changed_at', { ascending: false })
        if (limit && Number.isInteger(limit) && limit > 0) query = query.limit(limit)
        const { data, error } = await query
        if (error) throw error
        return data.map(entry => new MixerHistory(entry))
    }

    static async addMixer(mixer, userId) {
        const now = DateUtility.nowDb()
        const apiData = {
            truck_number: mixer.truckNumber ?? mixer.truck_number,
            assigned_plant: mixer.assignedPlant ?? mixer.assigned_plant,
            assigned_operator: mixer.assignedOperator ?? mixer.assigned_operator ?? null,
            last_service_date: DateUtility.toDbTimestamp(mixer.lastServiceDate ?? mixer.last_service_date),
            last_chip_date: DateUtility.toDbTimestamp(mixer.lastChipDate ?? mixer.last_chip_date),
            cleanliness_rating: mixer.cleanlinessRating ?? mixer.cleanliness_rating ?? 0,
            vin: mixer.vin,
            make: mixer.make,
            model: mixer.model,
            year: mixer.year,
            status: mixer.status ?? 'Active',
            created_at: now,
            updated_at: now,
            updated_by: userId
        }
        const { data, error } = await supabase
            .from(MIXERS_TABLE)
            .insert([apiData])
            .select()
            .single()
        if (error) throw error
        return new Mixer(data)
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

    static async updateMixer(mixerId, mixer, userId, prevMixerState = null) {
        const id = typeof mixerId === 'object' ? mixerId.id : mixerId
        ValidationUtility.requireUUID(id, 'Mixer ID is required')
        if (!userId) {
            const user = await UserService.getCurrentUser()
            userId = typeof user === 'object' && user !== null ? user.id : user
        }
        if (!userId) throw new Error('User ID is required')
        const currentMixer = prevMixerState || await this.getMixerById(id)
        if (!currentMixer) throw new Error(`Mixer with ID ${id} not found`)
        let assignedOperator = mixer.assignedOperator ?? null
        let status = mixer.status
        if ((!assignedOperator || assignedOperator === '' || assignedOperator === '0') && status === 'Active') status = 'Spare'
        if (assignedOperator && status !== 'Active') status = 'Active'
        if (['In Shop', 'Retired', 'Spare'].includes(status) && assignedOperator) assignedOperator = null
        const apiData = {
            truck_number: mixer.truckNumber,
            assigned_plant: mixer.assignedPlant,
            assigned_operator: assignedOperator,
            last_service_date: DateUtility.toDbTimestamp(mixer.lastServiceDate),
            last_chip_date: DateUtility.toDbTimestamp(mixer.lastChipDate),
            cleanliness_rating: mixer.cleanlinessRating,
            vin: mixer.vin,
            make: mixer.make,
            model: mixer.model,
            year: mixer.year,
            status,
            updated_at: DateUtility.nowDb(),
            updated_by: userId,
            updated_last: mixer.updatedLast ?? currentMixer.updatedLast
        }
        const { data, error } = await supabase
            .from(MIXERS_TABLE)
            .update(apiData)
            .eq('id', id)
            .select()
            .single()
        if (error) throw error
        const historyEntries = HistoryUtility.buildChanges(id,
            [
                { field: 'truckNumber', dbField: 'truck_number', entityIdColumn: 'mixer_id' },
                { field: 'assignedPlant', dbField: 'assigned_plant', entityIdColumn: 'mixer_id' },
                { field: 'assignedOperator', dbField: 'assigned_operator', entityIdColumn: 'mixer_id' },
                { field: 'lastServiceDate', dbField: 'last_service_date', type: 'date', entityIdColumn: 'mixer_id' },
                { field: 'lastChipDate', dbField: 'last_chip_date', type: 'date', entityIdColumn: 'mixer_id' },
                { field: 'cleanlinessRating', dbField: 'cleanliness_rating', type: 'number', entityIdColumn: 'mixer_id' },
                { field: 'vin', dbField: 'vin', entityIdColumn: 'mixer_id' },
                { field: 'make', dbField: 'make', entityIdColumn: 'mixer_id' },
                { field: 'model', dbField: 'model', entityIdColumn: 'mixer_id' },
                { field: 'year', dbField: 'year', type: 'number', entityIdColumn: 'mixer_id' },
                { field: 'status', dbField: 'status', entityIdColumn: 'mixer_id' }
            ],
            currentMixer,
            { ...mixer, assignedOperator, status },
            userId
        )
        if (historyEntries.length) await supabase.from(HISTORY_TABLE).insert(historyEntries)
        return new Mixer(data)
    }

    static async deleteMixer(id) {
        ValidationUtility.requireUUID(id, 'Mixer ID is required')
        await supabase.from(HISTORY_TABLE).delete().eq('mixer_id', id)
        await supabase.from(MIXERS_TABLE).delete().eq('id', id)
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
        const { data, error } = await supabase
            .from(HISTORY_TABLE)
            .insert({
                mixer_id: mixerId,
                field_name: fieldName,
                old_value: oldValue?.toString() ?? null,
                new_value: newValue?.toString() ?? null,
                changed_at: new Date().toISOString(),
                changed_by: userId
            })
            .select()
            .single()
        if (error) throw error
        return data
    }

    static async getCleanlinessHistory(mixerId = null, months = 6) {
        const threshold = new Date()
        threshold.setMonth(threshold.getMonth() - months)
        let query = supabase
            .from(HISTORY_TABLE)
            .select('*')
            .eq('field_name', 'cleanliness_rating')
            .gte('changed_at', threshold.toISOString())
            .order('changed_at', { ascending: true })
            .abortSignal(AbortSignal.timeout(5000))
            .limit(200)
        if (mixerId) query = query.eq('mixer_id', mixerId)
        const { data, error } = await query
        if (error) throw error
        return data
    }

    static async getMixersByOperator(operatorId) {
        ValidationUtility.requireUUID(operatorId, 'Operator ID is required')
        const { data, error } = await supabase
            .from(MIXERS_TABLE)
            .select('*')
            .eq('assigned_operator', operatorId)
            .order('truck_number', { ascending: true })
        if (error) throw error
        return data.map(mixer => new Mixer(mixer))
    }

    static async getMixersByStatus(status) {
        if (!status) throw new Error('Status is required')
        const { data, error } = await supabase
            .from(MIXERS_TABLE)
            .select('*')
            .eq('status', status)
            .order('truck_number', { ascending: true })
        if (error) throw error
        return data.map(mixer => new Mixer(mixer))
    }

    static async searchMixersByTruckNumber(query) {
        if (!query?.trim()) throw new Error('Search query is required')
        const { data, error } = await supabase
            .from(MIXERS_TABLE)
            .select('*')
            .ilike('truck_number', `%${query.trim()}%`)
            .order('truck_number', { ascending: true })
        if (error) throw error
        return data.map(mixer => new Mixer(mixer))
    }

    static async getMixersNeedingService(dayThreshold = 30) {
        const { data, error } = await supabase
            .from(MIXERS_TABLE)
            .select('*')
            .order('truck_number', { ascending: true })
        if (error) throw error
        const thresholdDate = new Date()
        thresholdDate.setDate(thresholdDate.getDate() - dayThreshold)
        return data
            .filter(mixer => !mixer.last_service_date || new Date(mixer.last_service_date) < thresholdDate)
            .map(mixer => new Mixer(mixer))
    }

    static async fetchComments(mixerId) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        const { data, error } = await supabase
            .from(MIXERS_COMMENTS_TABLE)
            .select('*')
            .eq('mixer_id', mixerId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return data?.map(row => MixerComment.fromRow(row)) ?? []
    }

    static async addComment(mixerId, text, author) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        if (!text?.trim()) throw new Error('Comment text is required')
        if (!author?.trim()) throw new Error('Author is required')
        const comment = {
            mixer_id: mixerId,
            text: text.trim(),
            author: author.trim(),
            created_at: new Date().toISOString()
        }
        const { data, error } = await supabase
            .from(MIXERS_COMMENTS_TABLE)
            .insert([comment])
            .select()
            .single()
        if (error) throw error
        return data ? MixerComment.fromRow(data) : null
    }

    static async deleteComment(commentId) {
        ValidationUtility.requireUUID(commentId, 'Comment ID is required')
        const { error } = await supabase
            .from(MIXERS_COMMENTS_TABLE)
            .delete()
            .eq('id', commentId)
        if (error) throw error
        return true
    }

    static async _fetchHistoryDates() {
        const { data, error } = await supabase
            .from(HISTORY_TABLE)
            .select('mixer_id, changed_at')
            .order('changed_at', { ascending: false })
        if (error) return {}
        const historyDates = {}
        data.forEach(entry => { if (!historyDates[entry.mixer_id] || new Date(entry.changed_at) > new Date(historyDates[entry.mixer_id])) historyDates[entry.mixer_id] = entry.changed_at })
        return historyDates
    }

    static async fetchMixerImages(mixerId) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        const { data, error } = await supabase
            .from(MIXERS_IMAGES_TABLE)
            .select('*')
            .eq('mixer_id', mixerId)
        if (error) throw error
        return data ? data.map(image => MixerImage.fromRow(image)) : []
    }

    static async uploadMixerImage(mixerId, file) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        if (!file) throw new Error('File is required')
        const fileExt = file.name.split('.').pop()
        const fileName = `mixer_${mixerId}_${uuidv4()}.${fileExt}`
        const filePath = `${BUCKET_NAME}/mixer_images/${fileName}`
        const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(`mixer_images/${fileName}`, file)
        if (uploadError) throw uploadError
        const { data, error } = await supabase
            .from(MIXERS_IMAGES_TABLE)
            .insert({ mixer_id: mixerId, image_url: filePath, created_at: new Date().toISOString() })
            .select()
            .single()
        if (error) throw error
        return MixerImage.fromRow(data)
    }

    static async deleteMixerImage(imageId) {
        ValidationUtility.requireUUID(imageId, 'Image ID is required')
        const { data: imageData, error: fetchError } = await supabase
            .from(MIXERS_IMAGES_TABLE)
            .select('image_url')
            .eq('id', imageId)
            .single()
        if (fetchError) throw fetchError
        if (imageData) {
            const { error: deleteFileError } = await supabase.storage.from(BUCKET_NAME).delete([imageData.image_url])
            if (deleteFileError) throw deleteFileError
        }
        const { error } = await supabase
            .from(MIXERS_IMAGES_TABLE)
            .delete()
            .eq('id', imageId)
        if (error) throw error
        return true
    }

    static async fetchIssues(mixerId) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        const { data, error } = await supabase
            .from(MIXERS_MAINTENANCE_TABLE)
            .select('*')
            .eq('mixer_id', mixerId)
            .order('time_created', { ascending: false })
        if (error) throw error
        return data ?? []
    }

    static async completeIssue(issueId) {
        ValidationUtility.requireUUID(issueId, 'Issue ID is required')
        const { error } = await supabase
            .from(MIXERS_MAINTENANCE_TABLE)
            .update({ time_completed: new Date().toISOString() })
            .eq('id', issueId)
        if (error) throw error
        return true
    }

    static async addIssue(mixerId, issue, severity) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        if (!issue?.trim()) throw new Error('Issue description is required')
        if (!['Low', 'Medium', 'High'].includes(severity)) throw new Error('Severity must be Low, Medium, or High')
        const { data, error } = await supabase
            .from(MIXERS_MAINTENANCE_TABLE)
            .insert({ id: uuidv4(), mixer_id: mixerId, issue: issue.trim(), severity, time_created: new Date().toISOString() })
            .select()
            .single()
        if (error) throw error
        return data
    }

    static async deleteIssue(issueId) {
        ValidationUtility.requireUUID(issueId, 'Issue ID is required')
        const { error, count } = await supabase
            .from(MIXERS_MAINTENANCE_TABLE)
            .delete({ count: 'exact' })
            .eq('id', issueId)
        if (error) throw error
        if (count === 0) throw new Error('Issue not found or already deleted')
        return true
    }
}

export const MixerService = MixerServiceImpl
