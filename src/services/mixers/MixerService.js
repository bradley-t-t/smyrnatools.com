import supabase from '../../core/clients/SupabaseClient';
import {Mixer, MixerUtils} from '../../models/Mixer';
import {MixerHistory} from '../../models/MixerHistory';

const formatDateForSupabase = (date) => {
    if (!date) return null;
    if (date instanceof Date) return date.toISOString();
    return date;
};

const logSupabaseError = (action, error) => {
    console.error(`Supabase error while ${action}:`, error);
    return error;
};

const formatDate = (date) => {
    if (date === null || date === undefined) return null;
    if (date instanceof Date) return date.toISOString();
    if (typeof date === 'string') {
        try {
            const d = new Date(date);
            if (!isNaN(d.getTime())) return date;
            return null;
        } catch {
            return null;
        }
    }
    return null;
};

export class MixerService {
    static async getAllMixers() {
        try {
            const {data, error} = await supabase
                .from('mixers')
                .select('*')
                .order('truck_number', {ascending: true});

            if (error) throw error;
            return data.map(mixer => Mixer.fromApiFormat(mixer));
        } catch (error) {
            console.error('Error fetching mixers:', error);
            return [];
        }
    }

    static async fetchMixers() {
        return this.getAllMixers();
    }

    static async getMixerById(id) {
        try {
            if (!id) {
                console.error('Cannot fetch mixer: Invalid ID provided');
                return null;
            }

            const {data, error} = await supabase
                .from('mixers')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.error(`Mixer with ID ${id} not found in database`);
                } else {
                    console.error(`Error fetching mixer with ID ${id}:`, error);
                }
                return null;
            }

            if (!data) {
                console.error(`No data returned for mixer with ID ${id}`);
                return null;
            }

            return Mixer.fromApiFormat(data);
        } catch (error) {
            console.error(`Error fetching mixer with ID ${id}:`, error);
            return null;
        }
    }

    static async fetchMixerById(id) {
        try {
            if (!id) {
                console.error('fetchMixerById called with invalid ID:', id);
                return null;
            }

            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidPattern.test(id)) {
                console.error(`Invalid UUID format for ID: ${id}`);
                return null;
            }

            try {
                const {data, error} = await supabase
                    .from('mixers')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (!error && data) {
                    const mixer = Mixer.fromApiFormat(data);
                    if (typeof mixer.isVerified !== 'function') {
                        mixer.isVerified = function () {
                            return MixerUtils.isVerified(this.updatedLast, this.updatedAt, this.updatedBy);
                        };
                    }
                    return mixer;
                }

                console.error('Direct query failed:', error?.message || 'No data returned');
            } catch (directError) {
                console.error('Error in direct query:', directError);
            }

            const result = await this.getMixerById(id);
            if (!result) {
                try {
                    const {count, error} = await supabase
                        .from('mixers')
                        .select('id', {count: 'exact', head: true})
                        .eq('id', id);
                    if (!error) {
                        console.log(`ID existence check: count = ${count}`);
                    }
                } catch (e) {
                    console.error('Error in ID existence check:', e);
                }
                return null;
            }
            return result;
        } catch (error) {
            console.error(`Error in fetchMixerById for ID ${id}:`, error);
            return null;
        }
    }

    static async getActiveMixers() {
        try {
            const {data, error} = await supabase
                .from('mixers')
                .select('*')
                .eq('status', 'Active')
                .order('truck_number', {ascending: true});

            if (error) throw error;
            return data.map(mixer => Mixer.fromApiFormat(mixer));
        } catch (error) {
            console.error('Error fetching active mixers:', error);
            return [];
        }
    }

    static async addMixer(mixer, userId) {
        try {
            if (!userId) {
                console.error('No user ID provided when adding mixer');
                throw new Error('Authentication required to add mixer');
            }

            const apiData = mixer.toApiFormat ? mixer.toApiFormat() : {
                truck_number: mixer.truckNumber || mixer.truck_number,
                assigned_plant: mixer.assignedPlant || mixer.assigned_plant,
                assigned_operator: mixer.assignedOperator || mixer.assigned_operator || '0',
                last_service_date: formatDate(mixer.lastServiceDate || mixer.last_service_date),
                last_chip_date: formatDate(mixer.lastChipDate || mixer.last_chip_date),
                cleanliness_rating: mixer.cleanlinessRating !== undefined ? mixer.cleanlinessRating : (mixer.cleanliness_rating !== undefined ? mixer.cleanliness_rating : 0),
                vin: mixer.vin,
                make: mixer.make,
                model: mixer.model,
                year: mixer.year,
                status: mixer.status || 'Active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                updated_last: new Date().toISOString(),
                updated_by: userId
            };

            const {data, error} = await supabase
                .from('mixers')
                .insert([apiData])
                .select();

            if (error) {
                console.error('Supabase error when adding mixer:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            if (!data || data.length === 0) {
                throw new Error('No data returned after adding mixer');
            }

            return Mixer.fromApiFormat(data[0]);
        } catch (error) {
            console.error('Error adding mixer:', error);
            throw error;
        }
    }

    static async createMixer(mixer, userId) {
        if (!userId) {
            userId = sessionStorage.getItem('userId');
            if (!userId) {
                try {
                    const {data} = await supabase.auth.getUser();
                    userId = data?.user?.id;
                } catch (error) {
                    console.error('Error getting current user from auth:', error);
                }
            }

            if (!userId) {
                console.warn('No user ID available when creating mixer');
                throw new Error('Authentication required: Please log in again');
            }
        }

        if (mixer.id !== null && mixer.id !== undefined) {
            console.log('Removing existing ID to ensure database generates a new one');
            delete mixer.id;
        }

        return this.addMixer(mixer, userId);
    }

    static async updateMixer(mixerId, mixer, userId) {
        try {
            const id = typeof mixerId === 'object' ? mixerId.id : mixerId;
            if (!id) {
                throw new Error('Mixer ID is required for updates');
            }

            if (typeof mixer === 'object') {
                mixer.id = id;
            }

            if (!userId || userId === 'anonymous') {
                const sessionUserId = sessionStorage.getItem('userId');
                if (sessionUserId) {
                    userId = sessionUserId;
                } else {
                    try {
                        const {data} = await supabase.auth.getUser();
                        userId = data?.user?.id;
                    } catch (authError) {
                        console.error('Error getting user from Supabase auth:', authError);
                    }
                }

                if (!userId || userId === 'anonymous') {
                    throw new Error('Authentication required: Could not determine current user');
                }
            }

            const currentMixer = await this.getMixerById(id);
            if (!currentMixer) {
                throw new Error(`Mixer with ID ${id} not found`);
            }

            const apiData = mixer.toApiFormat ? mixer.toApiFormat() : {
                truck_number: mixer.truckNumber,
                assigned_plant: mixer.assignedPlant,
                assigned_operator: mixer.assignedOperator || null,
                last_service_date: formatDateForSupabase(mixer.lastServiceDate),
                last_chip_date: formatDateForSupabase(mixer.lastChipDate),
                cleanliness_rating: mixer.cleanlinessRating,
                vin: mixer.vin,
                make: mixer.make,
                model: mixer.model,
                year: mixer.year,
                status: mixer.status,
                updated_at: new Date().toISOString()
            };

            if (apiData.assigned_operator && apiData.assigned_operator !== currentMixer.assignedOperator && apiData.status !== 'Active') {
                console.log(`Automatically setting status to Active because operator ${apiData.assigned_operator} was assigned`);
                apiData.status = 'Active';
            }

            if (['In Shop', 'Retired', 'Spare'].includes(apiData.status) && apiData.assigned_operator) {
                console.log(`Automatically unassigning operator because status was set to ${apiData.status}`);
                apiData.assigned_operator = null;
            }

            apiData.updated_at = new Date().toISOString();
            delete apiData.updated_last;
            delete apiData.updated_by;

            const {data, error} = await supabase
                .from('mixers')
                .update(apiData)
                .eq('id', id)
                .select();

            if (error) {
                logSupabaseError(`updating mixer with id ${id}`, error);
                throw new Error(`Failed to update mixer: ${error.message}`);
            }

            const historyEntries = [];
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

            for (const {field, dbField} of fieldsToTrack) {
                let hasChanged = false;
                let oldValue = currentMixer[field];
                let newValue = mixer[field];

                // Special handling for different field types
                if (field === 'lastServiceDate' || field === 'lastChipDate') {
                    // Date fields - compare only the date part
                    const oldDate = oldValue ? new Date(oldValue).toISOString().split('T')[0] : null;
                    const newDate = newValue ? new Date(newValue).toISOString().split('T')[0] : null;
                    hasChanged = oldDate !== newDate;
                    oldValue = oldDate || '';
                    newValue = newDate || '';
                } else if (field === 'cleanlinessRating' || field === 'year') {
                    // Numeric fields - compare as numbers
                    const oldNum = oldValue !== null && oldValue !== undefined ? Number(oldValue) : null;
                    const newNum = newValue !== null && newValue !== undefined ? Number(newValue) : null;
                    hasChanged = oldNum !== newNum;
                    oldValue = oldValue?.toString() || '';
                    newValue = newValue?.toString() || '';
                } else if (field === 'make' || field === 'model' || field === 'vin' || field === 'truckNumber') {
                    // String fields with special comparison
                    const oldStr = oldValue?.toString().trim() || '';
                    const newStr = newValue?.toString().trim() || '';
                    hasChanged = oldStr !== newStr;
                    oldValue = oldStr;
                    newValue = newStr;
                } else {
                    // Other fields
                    hasChanged = oldValue !== newValue;
                    oldValue = oldValue?.toString() || '';
                    newValue = newValue?.toString() || '';
                }

                if (hasChanged) {
                    const historyEntry = {
                        mixer_id: id,
                        field_name: dbField,
                        old_value: oldValue,
                        new_value: newValue,
                        changed_at: new Date().toISOString(),
                        changed_by: userId
                    };
                    historyEntries.push(historyEntry);
                }
            }

            if (historyEntries.length > 0) {
                const {error: historyError} = await supabase
                    .from('mixer_history')
                    .insert(historyEntries);
                if (historyError) {
                    console.error('Error saving mixer history:', historyError);
                }
            }

            return data && data.length > 0 ? Mixer.fromApiFormat(data[0]) : mixer;
        } catch (error) {
            const errorId = typeof mixerId === 'object' ? mixerId.id : mixerId;
            console.error(`Error updating mixer with ID ${errorId}:`, error);
            throw error;
        }
    }

    static async deleteMixer(id) {
        try {
            const {error: historyError} = await supabase
                .from('mixer_history')
                .delete()
                .eq('mixer_id', id);

            if (historyError) {
                console.error(`Error deleting history for mixer with ID ${id}:`, historyError);
            }

            const {error} = await supabase
                .from('mixers')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error(`Error deleting mixer with ID ${id}:`, error);
            throw error;
        }
    }

    static async createHistoryEntry(mixerId, fieldName, oldValue, newValue, changedBy = null) {
        try {
            let userId = changedBy;
            if (!userId) {
                userId = sessionStorage.getItem('userId');
                if (!userId) {
                    try {
                        const {data} = await supabase.auth.getUser();
                        userId = data.user?.id;
                    } catch (authError) {
                        console.error('Error in supabase auth:', authError);
                    }
                }
                if (!userId) {
                    userId = '00000000-0000-0000-0000-000000000000';
                }
            }

            const oldValueStr = oldValue?.toString() || null;
            const newValueStr = newValue?.toString() || null;

            const {error: insertError, data: insertData} = await supabase
                .from('mixer_history')
                .insert({
                    mixer_id: mixerId,
                    field_name: fieldName,
                    old_value: oldValueStr,
                    new_value: newValueStr,
                    changed_at: new Date().toISOString(),
                    changed_by: userId
                })
                .select();

            if (insertError) {
                console.error('Error inserting history entry:', insertError);
                throw insertError;
            }

            return insertData && insertData.length > 0 ? insertData[0] : null;
        } catch (error) {
            console.error(`Error creating history entry for mixer ${mixerId}:`, error);
            throw error;
        }
    }

    static async getMixerHistory(id) {
        try {
            const {data, error} = await supabase
                .from('mixer_history')
                .select('*')
                .eq('mixer_id', id)
                .order('changed_at', {ascending: false});

            if (error) throw error;
            return data.map(history => MixerHistory.fromApiFormat(history));
        } catch (error) {
            console.error(`Error fetching history for mixer with ID ${id}:`, error);
            return [];
        }
    }

    static async getCleanlinessHistory(mixerId = null, months = 6) {
        try {
            const threshold = new Date();
            threshold.setMonth(threshold.getMonth() - months);

            let query = supabase
                .from('mixer_history')
                .select('mixer_id, field_name, old_value, new_value, changed_at, changed_by')
                .eq('field_name', 'cleanliness_rating')
                .gte('changed_at', threshold.toISOString())
                .order('changed_at', {ascending: true})
                .abortSignal(AbortSignal.timeout(5000));

            if (mixerId) {
                query = query.eq('mixer_id', mixerId);
            }

            query = query.select('*', {cache: 'default'});
            query = query.limit(200);

            const {data, error} = await query;
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching cleanliness history:', error);
            return [];
        }
    }

    static async getMixersByOperator(operatorId) {
        try {
            const {data, error} = await supabase
                .from('mixers')
                .select('*')
                .eq('assigned_operator', operatorId)
                .order('truck_number', {ascending: true});

            if (error) throw error;
            return data.map(mixer => Mixer.fromApiFormat(mixer));
        } catch (error) {
            console.error(`Error fetching mixers for operator ${operatorId}:`, error);
            return [];
        }
    }

    static async getMixersByStatus(status) {
        try {
            const {data, error} = await supabase
                .from('mixers')
                .select('*')
                .eq('status', status)
                .order('truck_number', {ascending: true});

            if (error) throw error;
            return data.map(mixer => Mixer.fromApiFormat(mixer));
        } catch (error) {
            console.error(`Error fetching mixers with status ${status}:`, error);
            return [];
        }
    }

    static async searchMixersByTruckNumber(query) {
        try {
            const {data, error} = await supabase
                .from('mixers')
                .select('*')
                .ilike('truck_number', `%${query}%`)
                .order('truck_number', {ascending: true});

            if (error) throw error;
            return data.map(mixer => Mixer.fromApiFormat(mixer));
        } catch (error) {
            console.error(`Error searching mixers with query ${query}:`, error);
            return [];
        }
    }

    static async getMixersNeedingService(dayThreshold = 30) {
        try {
            const {data, error} = await supabase
                .from('mixers')
                .select('*')
                .order('truck_number', {ascending: true});

            if (error) throw error;

            const now = new Date();
            const thresholdDate = new Date(now.setDate(now.getDate() - dayThreshold));

            return data
                .filter(mixer => {
                    if (!mixer.last_service_date) return true;
                    const serviceDate = new Date(mixer.last_service_date);
                    return serviceDate < thresholdDate;
                })
                .map(mixer => Mixer.fromApiFormat(mixer));
        } catch (error) {
            console.error(`Error fetching mixers needing service:`, error);
            return [];
        }
    }
}