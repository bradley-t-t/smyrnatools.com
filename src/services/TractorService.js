import supabase from './DatabaseService';
import { Tractor } from '../config/models/tractors/Tractor';
import { TractorUtility } from '../utils/TractorUtility';
import { TractorHistory } from '../config/models/tractors/TractorHistory';
import { UserService } from './UserService';
import { TractorComment } from '../config/models/tractors/TractorComment';
import { v4 as uuidv4 } from 'uuid';

const TRACTORS_TABLE = 'tractors';
const HISTORY_TABLE = 'tractors_history';
const TRACTORS_COMMENTS_TABLE = 'tractors_comments';
const TRACTORS_MAINTENANCE_TABLE = 'tractors_maintenance';

const formatDate = date => {
    if (!date) return null;
    if (date instanceof Date) return date.toISOString();
    if (typeof date === 'string') {
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? null : date;
    }
    return null;
};

export class TractorService {
    static async getAllTractors() {
        const { data, error } = await supabase
            .from(TRACTORS_TABLE)
            .select('*')
            .order('truck_number', { ascending: true });
        if (error) throw error;
        const historyDates = await this._fetchHistoryDates();
        data.forEach(tractor => tractor.latestHistoryDate = historyDates[tractor.id] ?? null);
        return data.map(Tractor.fromApiFormat);
    }

    static async fetchTractors() {
        return this.getAllTractors();
    }

    static async getTractorById(id) {
        if (!id) throw new Error('Tractor ID is required');
        const { data, error } = await supabase
            .from(TRACTORS_TABLE)
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        if (!data) return null;
        data.latestHistoryDate = await this.getLatestHistoryDate(id);
        return Tractor.fromApiFormat(data);
    }

    static async fetchTractorById(id) {
        if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid tractor ID');
        const tractor = await this.getTractorById(id);
        if (!tractor) return null;
        tractor.isVerified = function (latestHistoryDate) {
            return TractorUtility.isVerified(this.updatedLast, this.updatedAt, this.updatedBy, latestHistoryDate ?? this.latestHistoryDate);
        };
        return tractor;
    }

    static async getLatestHistoryDate(tractorId) {
        if (!tractorId) return null;
        const { data, error } = await supabase
            .from(HISTORY_TABLE)
            .select('changed_at')
            .eq('tractor_id', tractorId)
            .order('changed_at', { ascending: false })
            .limit(1)
            .single();
        if (error || !data) return null;
        return data.changed_at;
    }

    static async getActiveTractors() {
        const { data, error } = await supabase
            .from(TRACTORS_TABLE)
            .select('*')
            .eq('status', 'Active')
            .order('truck_number', { ascending: true });
        if (error) throw error;
        return data.map(Tractor.fromApiFormat);
    }

    static async getTractorHistory(tractorId, limit = null) {
        if (!tractorId) throw new Error('Tractor ID is required');
        let query = supabase
            .from(HISTORY_TABLE)
            .select('*')
            .eq('tractor_id', tractorId)
            .order('changed_at', { ascending: false });
        if (limit && Number.isInteger(limit) && limit > 0) query = query.limit(limit);
        const { data, error } = await query;
        if (error) throw error;
        return data.map(TractorHistory.fromApiFormat);
    }

    static async addTractor(tractor, userId) {
        const apiData = {
            truck_number: tractor.truckNumber ?? tractor.truck_number,
            assigned_plant: tractor.assignedPlant ?? tractor.assigned_plant,
            assigned_operator: tractor.assignedOperator ?? tractor.assigned_operator ?? null,
            last_service_date: formatDate(tractor.lastServiceDate ?? tractor.last_service_date),
            cleanliness_rating: tractor.cleanlinessRating ?? tractor.cleanliness_rating ?? 0,
            has_blower: tractor.hasBlower ?? tractor.has_blower,
            vin: tractor.vin,
            make: tractor.make,
            model: tractor.model,
            year: tractor.year,
            status: tractor.status ?? 'Active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            updated_by: userId
        };
        const { data, error } = await supabase
            .from(TRACTORS_TABLE)
            .insert([apiData])
            .select()
            .single();
        if (error) throw error;
        return Tractor.fromApiFormat(data);
    }

    static async createTractor(tractor, userId) {
        if (!userId) {
            const user = await UserService.getCurrentUser();
            userId = typeof user === 'object' && user !== null ? user.id : user;
            if (!userId) throw new Error('Authentication required');
        }
        if (tractor.id) delete tractor.id;
        return this.addTractor(tractor, userId);
    }

    static async updateTractor(tractorId, tractor, userId, prevTractorState = null) {
        const id = typeof tractorId === 'object' ? tractorId.id : tractorId;
        if (!id) throw new Error('Tractor ID is required');
        if (!userId) {
            const user = await UserService.getCurrentUser();
            userId = typeof user === 'object' && user !== null ? user.id : user;
        }
        if (!userId) throw new Error('User ID is required');
        const currentTractor = prevTractorState || await this.getTractorById(id);
        if (!currentTractor) throw new Error(`Tractor with ID ${id} not found`);
        let assignedOperator = tractor.assignedOperator ?? null;
        let status = tractor.status;
        if ((!assignedOperator || assignedOperator === '' || assignedOperator === '0') && status === 'Active') status = 'Spare';
        if (assignedOperator && status !== 'Active') status = 'Active';
        if (['In Shop', 'Retired', 'Spare'].includes(status) && assignedOperator) assignedOperator = null;
        const apiData = {
            truck_number: tractor.truckNumber,
            assigned_plant: tractor.assignedPlant,
            assigned_operator: assignedOperator,
            last_service_date: formatDate(tractor.lastServiceDate),
            cleanliness_rating: tractor.cleanlinessRating,
            has_blower: tractor.hasBlower,
            vin: tractor.vin,
            make: tractor.make,
            model: tractor.model,
            year: tractor.year,
            status: status,
            updated_at: new Date().toISOString(),
            updated_by: userId,
            updated_last: tractor.updatedLast ?? currentTractor.updatedLast
        };
        const { data, error } = await supabase
            .from(TRACTORS_TABLE)
            .update(apiData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        const historyEntries = this._createHistoryEntries(id, currentTractor, { ...tractor, assignedOperator, status }, userId);
        if (historyEntries.length) {
            const { error: historyError } = await supabase
                .from(HISTORY_TABLE)
                .insert(historyEntries);
        }
        return Tractor.fromApiFormat(data);
    }

    static async deleteTractor(id) {
        if (!id) throw new Error('Tractor ID is required');
        await supabase.from(HISTORY_TABLE).delete().eq('tractor_id', id);
        const { error } = await supabase
            .from(TRACTORS_TABLE)
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    }

    static async createHistoryEntry(tractorId, fieldName, oldValue, newValue, changedBy) {
        if (!tractorId || !fieldName) throw new Error('Tractor ID and field name are required');
        let userId = changedBy;
        if (!userId) {
            const user = await UserService.getCurrentUser();
            userId = typeof user === 'object' && user !== null ? user.id : user;
        }
        if (!userId) userId = '00000000-0000-0000-0000-000000000000';
        const { data, error } = await supabase
            .from(HISTORY_TABLE)
            .insert({
                tractor_id: tractorId,
                field_name: fieldName,
                old_value: oldValue?.toString() ?? null,
                new_value: newValue?.toString() ?? null,
                changed_at: new Date().toISOString(),
                changed_by: userId
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    static async getCleanlinessHistory(tractorId = null, months = 6) {
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
        if (tractorId) query = query.eq('tractor_id', tractorId);
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    static async getTractorsByOperator(operatorId) {
        if (!operatorId) throw new Error('Operator ID is required');
        const { data, error } = await supabase
            .from(TRACTORS_TABLE)
            .select('*')
            .eq('assigned_operator', operatorId)
            .order('truck_number', { ascending: true });
        if (error) throw error;
        return data.map(Tractor.fromApiFormat);
    }

    static async getTractorsByStatus(status) {
        if (!status) throw new Error('Status is required');
        const { data, error } = await supabase
            .from(TRACTORS_TABLE)
            .select('*')
            .eq('status', status)
            .order('truck_number', { ascending: true });
        if (error) throw error;
        return data.map(Tractor.fromApiFormat);
    }

    static async searchTractorsByTruckNumber(query) {
        if (!query?.trim()) throw new Error('Search query is required');
        const { data, error } = await supabase
            .from(TRACTORS_TABLE)
            .select('*')
            .ilike('truck_number', `%${query.trim()}%`)
            .order('truck_number', { ascending: true });
        if (error) throw error;
        return data.map(Tractor.fromApiFormat);
    }

    static async getTractorsNeedingService(dayThreshold = 30) {
        const { data, error } = await supabase
            .from(TRACTORS_TABLE)
            .select('*')
            .order('truck_number', { ascending: true });
        if (error) throw error;
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - dayThreshold);
        return data
            .filter(tractor => !tractor.last_service_date || new Date(tractor.last_service_date) < thresholdDate)
            .map(Tractor.fromApiFormat);
    }

    static async fetchComments(tractorId) {
        if (!tractorId) throw new Error('Tractor ID is required');
        const { data, error } = await supabase
            .from(TRACTORS_COMMENTS_TABLE)
            .select('*')
            .eq('tractor_id', tractorId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data?.map(TractorComment.fromRow) ?? [];
    }

    static async addComment(tractorId, text, author) {
        if (!tractorId) throw new Error('Tractor ID is required');
        if (!text?.trim()) throw new Error('Comment text is required');
        if (!author?.trim()) throw new Error('Author is required');
        const comment = {
            tractor_id: tractorId,
            text: text.trim(),
            author: author.trim(),
            created_at: new Date().toISOString()
        };
        const { data, error } = await supabase
            .from(TRACTORS_COMMENTS_TABLE)
            .insert([comment])
            .select()
            .single();
        if (error) throw error;
        return data ? TractorComment.fromRow(data) : null;
    }

    static async deleteComment(commentId) {
        if (!commentId) throw new Error('Comment ID is required');
        const { error } = await supabase
            .from(TRACTORS_COMMENTS_TABLE)
            .delete()
            .eq('id', commentId);
        if (error) throw error;
        return true;
    }

    static async _fetchHistoryDates() {
        const { data, error } = await supabase
            .from(HISTORY_TABLE)
            .select('tractor_id, changed_at')
            .order('changed_at', { ascending: false });
        if (error) return {};
        const historyDates = {};
        data.forEach(entry => {
            if (!historyDates[entry.tractor_id] || new Date(entry.changed_at) > new Date(historyDates[entry.tractor_id])) {
                historyDates[entry.tractor_id] = entry.changed_at;
            }
        });
        return historyDates;
    }

    static _createHistoryEntries(tractorId, currentTractor, newTractor, userId) {
        const fieldsToTrack = [
            { field: 'truckNumber', dbField: 'truck_number' },
            { field: 'assignedPlant', dbField: 'assigned_plant' },
            { field: 'assignedOperator', dbField: 'assigned_operator' },
            { field: 'lastServiceDate', dbField: 'last_service_date' },
            { field: 'cleanlinessRating', dbField: 'cleanliness_rating' },
            { field: 'hasBlower', dbField: 'has_blower' },
            { field: 'vin', dbField: 'vin' },
            { field: 'make', dbField: 'make' },
            { field: 'model', dbField: 'model' },
            { field: 'year', dbField: 'year' },
            { field: 'status', dbField: 'status' }
        ];
        return fieldsToTrack.reduce((entries, { field, dbField }) => {
            let oldValue = currentTractor[field];
            let newValue = newTractor[field];
            if (field === 'lastServiceDate') {
                oldValue = oldValue ? new Date(oldValue).toISOString().split('T')[0] : null;
                newValue = newValue ? new Date(newValue).toISOString().split('T')[0] : null;
            } else if (field === 'cleanlinessRating' || field === 'year') {
                oldValue = oldValue != null ? Number(oldValue) : null;
                newValue = newValue != null ? Number(newValue) : null;
            } else {
                oldValue = oldValue?.toString().trim() ?? null;
                newValue = newValue?.toString().trim() ?? null;
            }

            if (oldValue !== newValue) {
                entries.push({
                    tractor_id: tractorId,
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

    static async fetchIssues(tractorId) {
        const { data, error } = await supabase
            .from(TRACTORS_MAINTENANCE_TABLE)
            .select('*')
            .eq('tractor_id', tractorId)
            .order('time_created', { ascending: false });
        if (error) throw error;
        return data ?? [];
    }

    static async addIssue(tractorId, issueText, severity) {
        if (!tractorId) throw new Error('Tractor ID is required');
        if (!issueText?.trim()) throw new Error('Issue description is required');
        const validSeverities = ['Low', 'Medium', 'High'];
        const finalSeverity = validSeverities.includes(severity) ? severity : 'Medium';
        const payload = {
            id: uuidv4(),
            tractor_id: tractorId,
            issue: issueText.trim(),
            severity: finalSeverity,
            time_completed: null
        };
        const { data, error } = await supabase
            .from(TRACTORS_MAINTENANCE_TABLE)
            .insert([payload])
            .select()
            .single();
        if (error) throw error;
        if (!data) throw new Error('Database insert succeeded but no data was returned');
        return data;
    }

    static async deleteIssue(issueId) {
        const { error } = await supabase
            .from(TRACTORS_MAINTENANCE_TABLE)
            .delete()
            .eq('id', issueId);
        if (error) throw error;
        return true;
    }

    static async completeIssue(issueId) {
        const { data, error } = await supabase
            .from(TRACTORS_MAINTENANCE_TABLE)
            .update({ time_completed: new Date().toISOString() })
            .eq('id', issueId)
            .select()
            .single();
        if (error) throw error;
        return data;
    }
}