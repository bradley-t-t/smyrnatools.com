import supabase from './DatabaseService';
import { UserService } from './UserService';
import {Equipment} from "../config/models/equipment/Equipment";
import {EquipmentHistory} from "../config/models/equipment/EquipmentHistory";
import {EquipmentComment} from "../config/models/equipment/EquipmentComment";
import { DatabaseUtility } from '../utils/DatabaseUtility';
import { v4 as uuidv4 } from 'uuid';

const EQUIPMENTS_TABLE = 'heavy_equipment';
const HISTORY_TABLE = 'equipment_history';
const EQUIPMENTS_COMMENTS_TABLE = 'equipment_comments';
const EQUIPMENT_MAINTENANCE_TABLE = 'equipment_maintenance';

const formatDate = date => {
    if (!date) return null;
    if (date instanceof Date) return date.toISOString();
    if (typeof date === 'string') {
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? null : date;
    }
    return null;
};

export class EquipmentService {
    static async getAllEquipments() {
        const { data, error } = await supabase
            .from(EQUIPMENTS_TABLE)
            .select('*')
            .order('identifying_number', { ascending: true });

        if (error) {
            console.error('Error fetching equipments:', error);
            throw error;
        }

        return data.map(equipment => Equipment.fromApiFormat(equipment));
    }

    static async fetchEquipments() {
        return this.getAllEquipments();
    }

    static async getEquipmentById(id) {
        if (!id) throw new Error('Equipment ID is required');

        const { data, error } = await supabase
            .from(EQUIPMENTS_TABLE)
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error(`Error fetching equipment with ID ${id}:`, error);
            throw error;
        }

        if (!data) return null;

        return Equipment.fromApiFormat(data);
    }

    static async fetchEquipmentById(id) {
        if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            console.error(`Invalid equipment ID: ${id}`);
            throw new Error('Invalid equipment ID');
        }

        const equipment = await this.getEquipmentById(id);
        if (!equipment) return null;

        return equipment;
    }

    static async getActiveEquipments() {
        const { data, error } = await supabase
            .from(EQUIPMENTS_TABLE)
            .select('*')
            .eq('status', 'Active')
            .order('identifying_number', { ascending: true });

        if (error) {
            console.error('Error fetching active equipments:', error);
            throw error;
        }

        return data.map(equipment => Equipment.fromApiFormat(equipment));
    }

    static async getEquipmentHistory(equipmentId, limit = null) {
        if (!equipmentId) throw new Error('Equipment ID is required');

        let query = supabase
            .from(HISTORY_TABLE)
            .select('*')
            .eq('equipment_id', equipmentId)
            .order('changed_at', { ascending: false });

        if (limit && Number.isInteger(limit) && limit > 0) {
            query = query.limit(limit);
        }

        const { data, error } = await query;
        if (error) {
            console.error(`Error fetching history for equipment ${equipmentId}:`, error);
            throw error;
        }

        return data.map(entry => EquipmentHistory.fromApiFormat(entry));
    }

    static async addEquipment(equipment, userId) {
        const apiData = {
            identifying_number: equipment.identifyingNumber ?? equipment.identifying_number,
            assigned_plant: equipment.assignedPlant ?? equipment.assigned_plant,
            equipment_type: equipment.equipmentType ?? equipment.equipment_type,
            status: equipment.status ?? 'Active',
            last_service_date: formatDate(equipment.lastServiceDate ?? equipment.last_service_date),
            hours_mileage: equipment.hoursMileage ?? equipment.hours_mileage ?? null,
            cleanliness_rating: equipment.cleanlinessRating ?? equipment.cleanliness_rating ?? null,
            condition_rating: equipment.conditionRating ?? equipment.condition_rating ?? null,
            equipment_make: equipment.equipmentMake ?? equipment.equipment_make,
            equipment_model: equipment.equipmentModel ?? equipment.equipment_model,
            year_made: equipment.yearMade ?? equipment.year_made ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            updated_by: userId
        };

        const { data, error } = await supabase
            .from(EQUIPMENTS_TABLE)
            .insert([apiData])
            .select()
            .single();

        if (error) {
            console.error('Error adding equipment:', error);
            throw error;
        }

        return Equipment.fromApiFormat(data);
    }

    static async createEquipment(equipment, userId) {
        if (!userId) {
            const user = await UserService.getCurrentUser();
            userId = typeof user === 'object' && user !== null ? user.id : user;
            if (!userId) throw new Error('Authentication required');
        }
        if (equipment.id) delete equipment.id;
        return this.addEquipment(equipment, userId);
    }

    static async updateEquipment(equipmentId, equipment, userId, prevEquipmentState = null) {
        const id = typeof equipmentId === 'object' ? equipmentId.id : equipmentId;
        if (!id) throw new Error('Equipment ID is required');
        if (!userId) {
            const user = await UserService.getCurrentUser();
            userId = typeof user === 'object' && user !== null ? user.id : user;
        }
        if (!userId) throw new Error('User ID is required');

        const currentEquipment = prevEquipmentState || await this.getEquipmentById(id);
        if (!currentEquipment) throw new Error(`Equipment with ID ${id} not found`);

        const apiData = {
            identifying_number: equipment.identifyingNumber,
            assigned_plant: equipment.assignedPlant,
            equipment_type: equipment.equipmentType,
            status: equipment.status,
            last_service_date: formatDate(equipment.lastServiceDate),
            hours_mileage: equipment.hoursMileage ? parseFloat(equipment.hoursMileage) : null,
            cleanliness_rating: equipment.cleanlinessRating,
            condition_rating: equipment.conditionRating,
            equipment_make: equipment.equipmentMake,
            equipment_model: equipment.equipmentModel,
            year_made: equipment.yearMade ? parseInt(equipment.yearMade) : null,
            updated_at: new Date().toISOString(),
            updated_by: userId
        };

        const { data, error } = await supabase
            .from(EQUIPMENTS_TABLE)
            .update(apiData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error(`Error updating equipment with ID ${id}:`, error);
            throw error;
        }

        const historyEntries = this._createHistoryEntries(id, currentEquipment, equipment, userId);
        if (historyEntries.length) {
            const { error: historyError } = await supabase
                .from(HISTORY_TABLE)
                .insert(historyEntries);
            if (historyError) console.error('Error saving equipment history:', historyError);
        }

        return Equipment.fromApiFormat(data);
    }

    static async deleteEquipment(id) {
        if (!id) throw new Error('Equipment ID is required');

        const { error: historyError } = await supabase
            .from(HISTORY_TABLE)
            .delete()
            .eq('equipment_id', id);

        if (historyError) console.error(`Error deleting history for equipment ${id}:`, historyError);

        const { error } = await supabase
            .from(EQUIPMENTS_TABLE)
            .delete()
            .eq('id', id);

        if (error) {
            console.error(`Error deleting equipment with ID ${id}:`, error);
            throw error;
        }

        return true;
    }

    static async createHistoryEntry(equipmentId, fieldName, oldValue, newValue, changedBy) {
        if (!equipmentId || !fieldName) throw new Error('Equipment ID and field name are required');
        let userId = changedBy;
        if (!userId) {
            const user = await UserService.getCurrentUser();
            userId = typeof user === 'object' && user !== null ? user.id : user;
        }
        if (!userId) userId = '00000000-0000-0000-0000-000000000000';

        const { data, error } = await supabase
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
            .single();

        if (error) {
            console.error(`Error creating history entry for equipment ${equipmentId}:`, error);
            throw error;
        }

        return data;
    }

    static async getCleanlinessHistory(equipmentId = null, months = 6) {
        const threshold = new Date();
        threshold.setMonth(threshold.getMonth() - months);

        let query = supabase
            .from(HISTORY_TABLE)
            .select('*')
            .eq('field_name', 'cleanliness_rating')
            .gte('changed_at', threshold.toISOString())
            .order('changed_at', { ascending: true })
            .abortSignal(AbortSignal.timeout(5000))
            .limit(200);

        if (equipmentId) query = query.eq('equipment_id', equipmentId);

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching cleanliness history:', error);
            throw error;
        }

        return data;
    }

    static async getConditionHistory(equipmentId = null, months = 6) {
        const threshold = new Date();
        threshold.setMonth(threshold.getMonth() - months);

        let query = supabase
            .from(HISTORY_TABLE)
            .select('*')
            .eq('field_name', 'condition_rating')
            .gte('changed_at', threshold.toISOString())
            .order('changed_at', { ascending: true })
            .abortSignal(AbortSignal.timeout(5000))
            .limit(200);

        if (equipmentId) query = query.eq('equipment_id', equipmentId);

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching condition history:', error);
            throw error;
        }

        return data;
    }

    static async getEquipmentsByStatus(status) {
        if (!status) throw new Error('Status is required');

        const { data, error } = await supabase
            .from(EQUIPMENTS_TABLE)
            .select('*')
            .eq('status', status)
            .order('identifying_number', { ascending: true });

        if (error) {
            console.error(`Error fetching equipments with status ${status}:`, error);
            throw error;
        }

        return data.map(equipment => Equipment.fromApiFormat(equipment));
    }

    static async searchEquipmentsByIdentifyingNumber(query) {
        if (!query?.trim()) throw new Error('Search query is required');

        const { data, error } = await supabase
            .from(EQUIPMENTS_TABLE)
            .select('*')
            .ilike('identifying_number', `%${query.trim()}%`)
            .order('identifying_number', { ascending: true });

        if (error) {
            console.error(`Error searching equipments with query ${query}:`, error);
            throw error;
        }

        return data.map(equipment => Equipment.fromApiFormat(equipment));
    }

    static async getEquipmentsNeedingService(dayThreshold = 30) {
        const { data, error } = await supabase
            .from(EQUIPMENTS_TABLE)
            .select('*')
            .order('identifying_number', { ascending: true });

        if (error) {
            console.error('Error fetching equipments needing service:', error);
            throw error;
        }

        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - dayThreshold);

        return data
            .filter(equipment => !equipment.last_service_date || new Date(equipment.last_service_date) < thresholdDate)
            .map(equipment => Equipment.fromApiFormat(equipment));
    }

    static async fetchComments(equipmentId) {
        if (!equipmentId) throw new Error('Equipment ID is required');
        const { data, error } = await supabase
            .from(EQUIPMENTS_COMMENTS_TABLE)
            .select('*')
            .eq('equipment_id', equipmentId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error(`Error fetching comments for equipment ${equipmentId}:`, error);
            throw error;
        }
        return data?.map(row => EquipmentComment.fromRow(row)) ?? [];
    }

    static async addComment(equipmentId, text, author) {
        if (!equipmentId) throw new Error('Equipment ID is required');
        if (!text?.trim()) throw new Error('Comment text is required');
        if (!author?.trim()) throw new Error('Author is required');
        const comment = {
            equipment_id: equipmentId,
            text: text.trim(),
            author: author.trim(),
            created_at: new Date().toISOString()
        };
        const { data, error } = await supabase
            .from(EQUIPMENTS_COMMENTS_TABLE)
            .insert([comment])
            .select()
            .single();
        if (error) {
            console.error(`Error adding comment to equipment ${equipmentId}:`, error);
            throw error;
        }
        return data ? EquipmentComment.fromRow(data) : null;
    }

    static async deleteComment(commentId) {
        if (!commentId) throw new Error('Comment ID is required');
        const { error } = await supabase
            .from(EQUIPMENTS_COMMENTS_TABLE)
            .delete()
            .eq('id', commentId);
        if (error) {
            console.error(`Error deleting comment ${commentId}:`, error);
            throw error;
        }
        return true;
    }

    static async _fetchHistoryDates() {
        const { data, error } = await supabase
            .from(HISTORY_TABLE)
            .select('equipment_id, changed_at')
            .order('changed_at', { ascending: false });

        if (error) {
            console.error('Error fetching history dates:', error);
            return {};
        }

        const historyDates = {};
        data.forEach(entry => {
            if (!historyDates[entry.equipment_id] || new Date(entry.changed_at) > new Date(historyDates[entry.equipment_id])) {
                historyDates[entry.equipment_id] = entry.changed_at;
            }
        });
        return historyDates;
    }

    static _createHistoryEntries(equipmentId, currentEquipment, newEquipment, userId) {
        const fieldsToTrack = [
            { field: 'identifyingNumber', dbField: 'identifying_number' },
            { field: 'assignedPlant', dbField: 'assigned_plant' },
            { field: 'equipmentType', dbField: 'equipment_type' },
            { field: 'status', dbField: 'status' },
            { field: 'lastServiceDate', dbField: 'last_service_date' },
            { field: 'hoursMileage', dbField: 'hours_mileage' },
            { field: 'cleanlinessRating', dbField: 'cleanliness_rating' },
            { field: 'conditionRating', dbField: 'condition_rating' },
            { field: 'equipmentMake', dbField: 'equipment_make' },
            { field: 'equipmentModel', dbField: 'equipment_model' },
            { field: 'yearMade', dbField: 'year_made' }
        ];

        return fieldsToTrack.reduce((entries, { field, dbField }) => {
            let oldValue = currentEquipment[field];
            let newValue = newEquipment[field];

            if (field === 'lastServiceDate') {
                oldValue = oldValue ? new Date(oldValue).toISOString().split('T')[0] : null;
                newValue = newValue ? new Date(newValue).toISOString().split('T')[0] : null;
            } else if (field === 'cleanlinessRating' || field === 'conditionRating' || field === 'yearMade' || field === 'hoursMileage') {
                oldValue = oldValue != null ? Number(oldValue) : null;
                newValue = newValue != null ? Number(newValue) : null;
            } else {
                oldValue = oldValue?.toString().trim() ?? null;
                newValue = newValue?.toString().trim() ?? null;
            }

            if (oldValue !== newValue) {
                entries.push({
                    equipment_id: equipmentId,
                    field_name: dbField,
                    old_value: oldValue?.toString() ?? null,
                    new_value: newValue?.toString() ?? null,
                    changed_at: new Date().toISOString(),
                    changed_by: userId
                });
            }
            return entries;
        }, []);
    }

    static async fetchIssues(equipmentId) {
        const { data, error } = await supabase
            .from(EQUIPMENT_MAINTENANCE_TABLE)
            .select('*')
            .eq('equipment_id', equipmentId)
            .order('time_created', { ascending: false });
        if (error) throw error;
        return data ?? [];
    }

    static async addIssue(equipmentId, issueText, severity) {
        if (!equipmentId) throw new Error('Equipment ID is required');
        if (!issueText?.trim()) throw new Error('Issue description is required');
        const validSeverities = ['Low', 'Medium', 'High'];
        const finalSeverity = validSeverities.includes(severity) ? severity : 'Medium';
        const payload = {
            id: uuidv4(),
            equipment_id: equipmentId,
            issue: issueText.trim(),
            severity: finalSeverity,
            time_created: new Date().toISOString(),
            time_completed: null
        };
        const { data, error } = await supabase
            .from(EQUIPMENT_MAINTENANCE_TABLE)
            .insert([payload])
            .select()
            .single();
        if (error) {
            const enhancedError = new Error(`Database error (${error.code}): ${error.message}${error.hint ? ' - ' + error.hint : ''}`);
            enhancedError.originalError = error;
            enhancedError.details = error.details;
            try {
                const schemaInfo = await DatabaseUtility.checkTableSchema(supabase, EQUIPMENT_MAINTENANCE_TABLE);
                localStorage.setItem('equipment_maintenance_error', JSON.stringify({
                    timestamp: new Date().toISOString(),
                    equipmentId,
                    severity,
                    error: error.message,
                    stack: error.stack,
                    originalError: {
                        message: error.message,
                        code: error.code,
                        details: error.details
                    },
                    schemaInfo
                }));
            } catch (e) {}
            throw enhancedError;
        }
        if (!data) throw new Error('Database insert succeeded but no data was returned');
        return data;
    }

    static async deleteIssue(issueId) {
        const { error } = await supabase
            .from(EQUIPMENT_MAINTENANCE_TABLE)
            .delete()
            .eq('id', issueId);
        if (error) throw error;
        return true;
    }

    static async completeIssue(issueId) {
        const { data, error } = await supabase
            .from(EQUIPMENT_MAINTENANCE_TABLE)
            .update({ time_completed: new Date().toISOString() })
            .eq('id', issueId)
            .select()
            .single();
        if (error) throw error;
        return data;
    }
}