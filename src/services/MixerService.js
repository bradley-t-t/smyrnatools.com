import supabase from './DatabaseService';
import {Mixer} from '../models/mixers/Mixer';
import {MixerUtility} from '../utils/MixerUtility';
import {MixerHistory} from '../models/mixers/MixerHistory';
import AuthUtility from "../utils/AuthUtility";

const MIXERS_TABLE = 'mixers';
const HISTORY_TABLE = 'mixers_history';

const formatDate = date => {
    if (!date) return null;
    if (date instanceof Date) return date.toISOString();
    if (typeof date === 'string') {
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? null : date;
    }
    return null;
};

export class MixerService {
    static async getAllMixers() {
        const {data, error} = await supabase
            .from(MIXERS_TABLE)
            .select('*')
            .order('truck_number', {ascending: true});

        if (error) {
            console.error('Error fetching mixers:', error);
            throw error;
        }

        const historyDates = await this._fetchHistoryDates();
        data.forEach(mixer => mixer.latestHistoryDate = historyDates[mixer.id] ?? null);

        return data.map(mixer => Mixer.fromApiFormat(mixer));
    }

    static async fetchMixers() {
        return this.getAllMixers();
    }

    static async getMixerById(id) {
        if (!id) throw new Error('Mixer ID is required');

        const {data, error} = await supabase
            .from(MIXERS_TABLE)
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error(`Error fetching mixer with ID ${id}:`, error);
            throw error;
        }

        if (!data) return null;

        data.latestHistoryDate = await this.getLatestHistoryDate(id);
        return Mixer.fromApiFormat(data);
    }

    static async fetchMixerById(id) {
        if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            console.error(`Invalid mixer ID: ${id}`);
            throw new Error('Invalid mixer ID');
        }

        const mixer = await this.getMixerById(id);
        if (!mixer) return null;

        mixer.isVerified = function(latestHistoryDate) {
            return MixerUtility.isVerified(this.updatedLast, this.updatedAt, this.updatedBy, latestHistoryDate ?? this.latestHistoryDate);
        };
        return mixer;
    }

    static async getLatestHistoryDate(mixerId) {
        if (!mixerId) return null;

        const {data, error} = await supabase
            .from(HISTORY_TABLE)
            .select('changed_at')
            .eq('mixer_id', mixerId)
            .order('changed_at', {ascending: false})
            .limit(1)
            .single();

        if (error || !data) return null;
        return data.changed_at;
    }

    static async getActiveMixers() {
        const {data, error} = await supabase
            .from(MIXERS_TABLE)
            .select('*')
            .eq('status', 'Active')
            .order('truck_number', {ascending: true});

        if (error) {
            console.error('Error fetching active mixers:', error);
            throw error;
        }

        return data.map(mixer => Mixer.fromApiFormat(mixer));
    }

    static async getMixerHistory(mixerId, limit = null) {
        if (!mixerId) throw new Error('Mixer ID is required');

        let query = supabase
            .from(HISTORY_TABLE)
            .select('*')
            .eq('mixer_id', mixerId)
            .order('changed_at', {ascending: false});

        if (limit && Number.isInteger(limit) && limit > 0) {
            query = query.limit(limit);
        }

        const {data, error} = await query;
        if (error) {
            console.error(`Error fetching history for mixer ${mixerId}:`, error);
            throw error;
        }

        return data.map(entry => MixerHistory.fromApiFormat(entry));
    }

    static async addMixer(mixer, userId) {
        const apiData = {
            truck_number: mixer.truckNumber ?? mixer.truck_number,
            assigned_plant: mixer.assignedPlant ?? mixer.assigned_plant,
            assigned_operator: mixer.assignedOperator ?? mixer.assigned_operator ?? null,
            last_service_date: formatDate(mixer.lastServiceDate ?? mixer.last_service_date),
            last_chip_date: formatDate(mixer.lastChipDate ?? mixer.last_chip_date),
            cleanliness_rating: mixer.cleanlinessRating ?? mixer.cleanliness_rating ?? 0,
            vin: mixer.vin,
            make: mixer.make,
            model: mixer.model,
            year: mixer.year,
            status: mixer.status ?? 'Active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            updated_by: userId
        };

        const {data, error} = await supabase
            .from(MIXERS_TABLE)
            .insert([apiData])
            .select()
            .single();

        if (error) {
            console.error('Error adding mixer:', error);
            throw error;
        }

        return Mixer.fromApiFormat(data);
    }

    static async createMixer(mixer, userId) {
        if (!userId) {
            const {data} = await supabase.auth.getUser();
            userId = data?.user?.id;
            if (!userId) throw new Error('Authentication required');
        }

        if (mixer.id) delete mixer.id;
        return this.addMixer(mixer, userId);
    }

    static async updateMixer(mixerId, mixer, userId) {
        const id = typeof mixerId === 'object' ? mixerId.id : mixerId;
        if (!id) throw new Error('Mixer ID is required');
        if (!userId) {
            const {data} = await AuthUtility.getUserId();
            userId = data?.user?.id;
        }

        const currentMixer = await this.getMixerById(id);
        if (!currentMixer) throw new Error(`Mixer with ID ${id} not found`);

        const apiData = {
            truck_number: mixer.truckNumber,
            assigned_plant: mixer.assignedPlant,
            assigned_operator: mixer.assignedOperator ?? null,
            last_service_date: formatDate(mixer.lastServiceDate),
            last_chip_date: formatDate(mixer.lastChipDate),
            cleanliness_rating: mixer.cleanlinessRating,
            vin: mixer.vin,
            make: mixer.make,
            model: mixer.model,
            year: mixer.year,
            status: mixer.status,
            updated_at: new Date().toISOString(),
            updated_by: userId,
            updated_last: mixer.updatedLast ?? currentMixer.updatedLast
        };

        if (apiData.assigned_operator && apiData.assigned_operator !== currentMixer.assignedOperator && apiData.status !== 'Active') {
            apiData.status = 'Active';
        }

        if (['In Shop', 'Retired', 'Spare'].includes(apiData.status) && apiData.assigned_operator) {
            apiData.assigned_operator = null;
        }

        const {data, error} = await supabase
            .from(MIXERS_TABLE)
            .update(apiData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error(`Error updating mixer with ID ${id}:`, error);
            throw error;
        }

        const historyEntries = this._createHistoryEntries(id, currentMixer, mixer, userId);
        if (historyEntries.length) {
            const {error: historyError} = await supabase
                .from(HISTORY_TABLE)
                .insert(historyEntries);
            if (historyError) console.error('Error saving mixer history:', historyError);
        }

        return Mixer.fromApiFormat(data);
    }

    static async deleteMixer(id) {
        if (!id) throw new Error('Mixer ID is required');

        const {error: historyError} = await supabase
            .from(HISTORY_TABLE)
            .delete()
            .eq('mixer_id', id);

        if (historyError) console.error(`Error deleting history for mixer ${id}:`, historyError);

        const {error} = await supabase
            .from(MIXERS_TABLE)
            .delete()
            .eq('id', id);

        if (error) {
            console.error(`Error deleting mixer with ID ${id}:`, error);
            throw error;
        }

        return true;
    }

    static async createHistoryEntry(mixerId, fieldName, oldValue, newValue, changedBy) {
        if (!mixerId || !fieldName) throw new Error('Mixer ID and field name are required');

        const userId = changedBy ?? (await supabase.auth.getUser())?.data?.user?.id ?? '00000000-0000-0000-0000-000000000000';

        const {data, error} = await supabase
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
            .single();

        if (error) {
            console.error(`Error creating history entry for mixer ${mixerId}:`, error);
            throw error;
        }

        return data;
    }

    static async getCleanlinessHistory(mixerId = null, months = 6) {
        const threshold = new Date();
        threshold.setMonth(threshold.getMonth() - months);

        let query = supabase
            .from(HISTORY_TABLE)
            .select('*')
            .eq('field_name', 'cleanliness_rating')
            .gte('changed_at', threshold.toISOString())
            .order('changed_at', {ascending: true})
            .abortSignal(AbortSignal.timeout(5000))
            .limit(200);

        if (mixerId) query = query.eq('mixer_id', mixerId);

        const {data, error} = await query;
        if (error) {
            console.error('Error fetching cleanliness history:', error);
            throw error;
        }

        return data;
    }

    static async getMixersByOperator(operatorId) {
        if (!operatorId) throw new Error('Operator ID is required');

        const {data, error} = await supabase
            .from(MIXERS_TABLE)
            .select('*')
            .eq('assigned_operator', operatorId)
            .order('truck_number', {ascending: true});

        if (error) {
            console.error(`Error fetching mixers for operator ${operatorId}:`, error);
            throw error;
        }

        return data.map(mixer => Mixer.fromApiFormat(mixer));
    }

    static async getMixersByStatus(status) {
        if (!status) throw new Error('Status is required');

        const {data, error} = await supabase
            .from(MIXERS_TABLE)
            .select('*')
            .eq('status', status)
            .order('truck_number', {ascending: true});

        if (error) {
            console.error(`Error fetching mixers with status ${status}:`, error);
            throw error;
        }

        return data.map(mixer => Mixer.fromApiFormat(mixer));
    }

    static async searchMixersByTruckNumber(query) {
        if (!query?.trim()) throw new Error('Search query is required');

        const {data, error} = await supabase
            .from(MIXERS_TABLE)
            .select('*')
            .ilike('truck_number', `%${query.trim()}%`)
            .order('truck_number', {ascending: true});

        if (error) {
            console.error(`Error searching mixers with query ${query}:`, error);
            throw error;
        }

        return data.map(mixer => Mixer.fromApiFormat(mixer));
    }

    static async getMixersNeedingService(dayThreshold = 30) {
        const {data, error} = await supabase
            .from(MIXERS_TABLE)
            .select('*')
            .order('truck_number', {ascending: true});

        if (error) {
            console.error('Error fetching mixers needing service:', error);
            throw error;
        }

        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - dayThreshold);

        return data
            .filter(mixer => !mixer.last_service_date || new Date(mixer.last_service_date) < thresholdDate)
            .map(mixer => Mixer.fromApiFormat(mixer));
    }

    static async _fetchHistoryDates() {
        const {data, error} = await supabase
            .from(HISTORY_TABLE)
            .select('mixer_id, changed_at')
            .order('changed_at', {ascending: false});

        if (error) {
            console.error('Error fetching history dates:', error);
            return {};
        }

        const historyDates = {};
        data.forEach(entry => {
            if (!historyDates[entry.mixer_id] || new Date(entry.changed_at) > new Date(historyDates[entry.mixer_id])) {
                historyDates[entry.mixer_id] = entry.changed_at;
            }
        });
        return historyDates;
    }

    static _createHistoryEntries(mixerId, currentMixer, newMixer, userId) {
        const fieldsToTrack = [
            {field: 'truckNumber', dbField: 'truck_number'},
            {field: 'assignedPlant', dbField: 'assigned_plant'},
            {field: 'assignedOperator', dbField: 'assigned_operator'},
            {field: 'lastServiceDate', dbField: 'last_service_date'},
            {field: 'lastChipDate', dbField: 'last_chip_date'},
            {field: 'cleanlinessRating', dbField: 'cleanliness_rating'},
            {field: 'vin', dbField: 'vin'},
            {field: 'make', dbField: 'make'},
            {field: 'model', dbField: 'model'},
            {field: 'year', dbField: 'year'},
            {field: 'status', dbField: 'status'}
        ];

        return fieldsToTrack.reduce((entries, {field, dbField}) => {
            let oldValue = currentMixer[field];
            let newValue = newMixer[field];

            if (field === 'lastServiceDate' || field === 'lastChipDate') {
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
                    mixer_id: mixerId,
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
}