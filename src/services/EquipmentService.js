import supabase from './DatabaseService'
import {UserService} from './UserService'
import {Equipment} from '../config/models/equipment/Equipment'
import {EquipmentHistory} from '../config/models/equipment/EquipmentHistory'
import {EquipmentComment} from '../config/models/equipment/EquipmentComment'
import {v4 as uuidv4} from 'uuid'
import {DateUtility} from '../utils/DateUtility'
import {HistoryUtility} from '../utils/HistoryUtility'
import {ValidationUtility} from '../utils/ValidationUtility'

const EQUIPMENTS_TABLE = 'heavy_equipment'
const HISTORY_TABLE = 'heavy_equipment_history'
const EQUIPMENTS_COMMENTS_TABLE = 'heavy_equipment_comments'
const EQUIPMENT_MAINTENANCE_TABLE = 'heavy_equipment_maintenance'

class EquipmentServiceImpl {
    static async getAllEquipments() {
        const {data, error} = await supabase
            .from(EQUIPMENTS_TABLE)
            .select('*')
            .order('identifying_number', {ascending: true})
        if (error) throw error
        return data.map(row => new Equipment(row));
    }

    static async fetchEquipments() {
        return this.getAllEquipments()
    }

    static async getEquipmentById(id) {
        ValidationUtility.requireUUID(id, 'Equipment ID is required')
        const {data, error} = await supabase
            .from(EQUIPMENTS_TABLE)
            .select('*')
            .eq('id', id)
            .single()
        if (error) throw error
        if (!data) return null
        return new Equipment(data)
    }

    static async fetchEquipmentById(id) {
        ValidationUtility.requireUUID(id, 'Invalid equipment ID')
        return this.getEquipmentById(id)
    }

    static async getActiveEquipments() {
        const {data, error} = await supabase
            .from(EQUIPMENTS_TABLE)
            .select('*')
            .eq('status', 'Active')
            .order('identifying_number', {ascending: true})
        if (error) throw error
        return data.map(row => new Equipment(row))
    }

    static async getEquipmentHistory(equipmentId, limit = null) {
        ValidationUtility.requireUUID(equipmentId, 'Equipment ID is required')
        let query = supabase
            .from(HISTORY_TABLE)
            .select('*')
            .eq('equipment_id', equipmentId)
            .order('changed_at', {ascending: false})
        if (limit && Number.isInteger(limit) && limit > 0) query = query.limit(limit)
        const {data, error} = await query
        if (error) throw error
        return data.map(entry => new EquipmentHistory(entry))
    }

    static async addEquipment(equipment, userId) {
        const now = DateUtility.nowDb()
        const apiData = {
            identifying_number: equipment.identifyingNumber ?? equipment.identifying_number,
            assigned_plant: equipment.assignedPlant ?? equipment.assigned_plant,
            equipment_type: equipment.equipmentType ?? equipment.equipment_type,
            status: equipment.status ?? 'Active',
            last_service_date: DateUtility.toDbTimestamp(equipment.lastServiceDate ?? equipment.last_service_date),
            hours_mileage: equipment.hoursMileage ?? equipment.hours_mileage ?? null,
            cleanliness_rating: equipment.cleanlinessRating ?? equipment.cleanliness_rating ?? null,
            condition_rating: equipment.conditionRating ?? equipment.condition_rating ?? null,
            equipment_make: equipment.equipmentMake ?? equipment.equipment_make,
            equipment_model: equipment.equipmentModel ?? equipment.equipment_model,
            year_made: equipment.yearMade ?? equipment.year_made ?? null,
            created_at: now,
            updated_at: now,
            updated_by: userId
        }
        const {data, error} = await supabase
            .from(EQUIPMENTS_TABLE)
            .insert([apiData])
            .select()
            .single()
        if (error) throw error
        return new Equipment(data)
    }

    static async createEquipment(equipment, userId) {
        if (!userId) {
            const user = await UserService.getCurrentUser()
            userId = typeof user === 'object' && user !== null ? user.id : user
            if (!userId) throw new Error('Authentication required')
        }
        if (equipment.id) delete equipment.id
        return this.addEquipment(equipment, userId)
    }

    static async updateEquipment(equipmentId, equipment, userId, prevEquipmentState = null) {
        const id = typeof equipmentId === 'object' ? equipmentId.id : equipmentId
        ValidationUtility.requireUUID(id, 'Equipment ID is required')
        if (!userId) {
            const user = await UserService.getCurrentUser()
            userId = typeof user === 'object' && user !== null ? user.id : user
        }
        if (!userId) throw new Error('User ID is required')
        const currentEquipment = prevEquipmentState || await this.getEquipmentById(id)
        if (!currentEquipment) throw new Error(`Equipment with ID ${id} not found`)
        const apiData = {
            identifying_number: equipment.identifyingNumber,
            assigned_plant: equipment.assignedPlant,
            equipment_type: equipment.equipmentType,
            status: equipment.status,
            last_service_date: DateUtility.toDbTimestamp(equipment.lastServiceDate),
            hours_mileage: equipment.hoursMileage ? parseFloat(equipment.hoursMileage) : null,
            cleanliness_rating: equipment.cleanlinessRating,
            condition_rating: equipment.conditionRating,
            equipment_make: equipment.equipmentMake,
            equipment_model: equipment.equipmentModel,
            year_made: equipment.yearMade ? parseInt(equipment.yearMade) : null,
            updated_at: DateUtility.nowDb(),
            updated_by: userId
        }
        const {data, error} = await supabase
            .from(EQUIPMENTS_TABLE)
            .update(apiData)
            .eq('id', id)
            .select()
            .single()
        if (error) throw error
        const historyEntries = HistoryUtility.buildChanges(id,
            [
                {field: 'identifyingNumber', dbField: 'identifying_number'},
                {field: 'assignedPlant', dbField: 'assigned_plant'},
                {field: 'equipmentType', dbField: 'equipment_type'},
                {field: 'status', dbField: 'status'},
                {field: 'lastServiceDate', dbField: 'last_service_date', type: 'date'},
                {field: 'hoursMileage', dbField: 'hours_mileage', type: 'number'},
                {field: 'cleanlinessRating', dbField: 'cleanliness_rating', type: 'number'},
                {field: 'conditionRating', dbField: 'condition_rating', type: 'number'},
                {field: 'equipmentMake', dbField: 'equipment_make'},
                {field: 'equipmentModel', dbField: 'equipment_model'},
                {field: 'yearMade', dbField: 'year_made', type: 'number'}
            ],
            currentEquipment,
            equipment,
            userId
        )
        if (historyEntries.length) {
            await supabase.from(HISTORY_TABLE).insert(historyEntries)
        }
        return new Equipment(data)
    }

    static async deleteEquipment(id) {
        ValidationUtility.requireUUID(id, 'Equipment ID is required')
        await supabase.from(HISTORY_TABLE).delete().eq('equipment_id', id)
        await supabase.from(EQUIPMENTS_TABLE).delete().eq('id', id)
        return true
    }

    static async createHistoryEntry(equipmentId, fieldName, oldValue, newValue, changedBy) {
        ValidationUtility.requireUUID(equipmentId, 'Equipment ID and field name are required')
        if (!fieldName) throw new Error('Field name required')
        let userId = changedBy
        if (!userId) {
            const user = await UserService.getCurrentUser()
            userId = typeof user === 'object' && user !== null ? user.id : user
        }
        if (!userId) userId = '00000000-0000-0000-0000-000000000000'
        const {data, error} = await supabase
            .from(HISTORY_TABLE)
            .insert({
                equipment_id: equipmentId,
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

    static async getCleanlinessHistory(equipmentId = null, months = 6) {
        const threshold = new Date()
        threshold.setMonth(threshold.getMonth() - months)
        let query = supabase
            .from(HISTORY_TABLE)
            .select('*')
            .eq('field_name', 'cleanliness_rating')
            .gte('changed_at', threshold.toISOString())
            .order('changed_at', {ascending: true})
            .abortSignal(AbortSignal.timeout(5000))
            .limit(200)
        if (equipmentId) query = query.eq('equipment_id', equipmentId)
        const {data, error} = await query
        if (error) throw error
        return data
    }

    static async getConditionHistory(equipmentId = null, months = 6) {
        const threshold = new Date()
        threshold.setMonth(threshold.getMonth() - months)
        let query = supabase
            .from(HISTORY_TABLE)
            .select('*')
            .eq('field_name', 'condition_rating')
            .gte('changed_at', threshold.toISOString())
            .order('changed_at', {ascending: true})
            .abortSignal(AbortSignal.timeout(5000))
            .limit(200)
        if (equipmentId) query = query.eq('equipment_id', equipmentId)
        const {data, error} = await query
        if (error) throw error
        return data
    }

    static async getEquipmentsByStatus(status) {
        if (!status) throw new Error('Status is required')
        const {data, error} = await supabase
            .from(EQUIPMENTS_TABLE)
            .select('*')
            .eq('status', status)
            .order('identifying_number', {ascending: true})
        if (error) throw error
        return data.map(row => new Equipment(row))
    }

    static async searchEquipmentsByIdentifyingNumber(query) {
        if (!query?.trim()) throw new Error('Search query is required')
        const {data, error} = await supabase
            .from(EQUIPMENTS_TABLE)
            .select('*')
            .ilike('identifying_number', `%${query.trim()}%`)
            .order('identifying_number', {ascending: true})
        if (error) throw error
        return data.map(row => new Equipment(row))
    }

    static async getEquipmentsNeedingService(dayThreshold = 30) {
        const {data, error} = await supabase
            .from(EQUIPMENTS_TABLE)
            .select('*')
            .order('identifying_number', {ascending: true})
        if (error) throw error
        const thresholdDate = new Date()
        thresholdDate.setDate(thresholdDate.getDate() - dayThreshold)
        return data
            .filter(equipment => !equipment.last_service_date || new Date(equipment.last_service_date) < thresholdDate)
            .map(row => new Equipment(row))
    }

    static async fetchComments(equipmentId) {
        ValidationUtility.requireUUID(equipmentId, 'Equipment ID is required')
        const {data, error} = await supabase
            .from(EQUIPMENTS_COMMENTS_TABLE)
            .select('*')
            .eq('equipment_id', equipmentId)
            .order('created_at', {ascending: false})
        if (error) throw error
        return data?.map(row => EquipmentComment.fromRow(row)) ?? []
    }

    static async addComment(equipmentId, text, author) {
        ValidationUtility.requireUUID(equipmentId, 'Equipment ID is required')
        if (!text?.trim()) throw new Error('Comment text is required')
        if (!author?.trim()) throw new Error('Author is required')
        const comment = {
            id: uuidv4(),
            equipment_id: equipmentId,
            text: text.trim(),
            author: author.trim(),
            created_at: new Date().toISOString()
        }
        const {data, error} = await supabase
            .from(EQUIPMENTS_COMMENTS_TABLE)
            .insert([comment])
            .select()
            .single()
        if (error) throw error
        return data ? EquipmentComment.fromRow(data) : null
    }

    static async deleteComment(commentId) {
        ValidationUtility.requireUUID(commentId, 'Comment ID is required')
        const {error} = await supabase
            .from(EQUIPMENTS_COMMENTS_TABLE)
            .delete()
            .eq('id', commentId)
        if (error) throw error
        return true
    }

    static async _fetchHistoryDates() {
        const {data, error} = await supabase
            .from(HISTORY_TABLE)
            .select('equipment_id, changed_at')
            .order('changed_at', {ascending: false})
        if (error) return {}
        const historyDates = {}
        data.forEach(entry => {
            if (!historyDates[entry.equipment_id] || new Date(entry.changed_at) > new Date(historyDates[entry.equipment_id])) {
                historyDates[entry.equipment_id] = entry.changed_at
            }
        })
        return historyDates
    }

    static async fetchIssues(equipmentId) {
        ValidationUtility.requireUUID(equipmentId, 'Equipment ID is required')
        const {data, error} = await supabase
            .from(EQUIPMENT_MAINTENANCE_TABLE)
            .select('*')
            .eq('equipment_id', equipmentId)
            .order('time_created', {ascending: false})
        if (error) throw error
        return data ?? []
    }

    static async addIssue(equipmentId, issueText, severity) {
        ValidationUtility.requireUUID(equipmentId, 'Equipment ID is required')
        if (!issueText?.trim()) throw new Error('Issue description is required')
        const validSeverities = ['Low', 'Medium', 'High']
        const finalSeverity = validSeverities.includes(severity) ? severity : 'Medium'
        const payload = {
            id: uuidv4(),
            equipment_id: equipmentId,
            issue: issueText.trim(),
            severity: finalSeverity,
            time_created: new Date().toISOString(),
            time_completed: null
        }
        const {data, error} = await supabase
            .from(EQUIPMENT_MAINTENANCE_TABLE)
            .insert([payload])
            .select()
            .single()
        if (error) throw error
        if (!data) throw new Error('Database insert succeeded but no data was returned')
        return data
    }

    static async deleteIssue(issueId) {
        ValidationUtility.requireUUID(issueId, 'Issue ID is required')
        const {error} = await supabase
            .from(EQUIPMENT_MAINTENANCE_TABLE)
            .delete()
            .eq('id', issueId)
        if (error) throw error
        return true
    }

    static async completeIssue(issueId) {
        ValidationUtility.requireUUID(issueId, 'Issue ID is required')
        const {data, error} = await supabase
            .from(EQUIPMENT_MAINTENANCE_TABLE)
            .update({time_completed: new Date().toISOString()})
            .eq('id', issueId)
            .select()
            .single()
        if (error) throw error
        return data
    }
}

export const EquipmentService = EquipmentServiceImpl
