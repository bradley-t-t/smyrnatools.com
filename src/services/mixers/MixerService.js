import supabase from '../../core/SupabaseClient';
import {Mixer} from '../../models/Mixer';
import {MixerHistory} from '../../models/MixerHistory';

// Define helper functions directly in this file since SupabaseHelpers is not available
const formatDateForSupabase = (date) => {
    if (!date) return null;
    if (date instanceof Date) return date.toISOString();
    return date;
};

const logSupabaseError = (action, error) => {
    console.error(`Supabase error while ${action}:`, error);
    return error;
};

// Helper function to format dates properly
const formatDate = (date) => {
    if (date === null || date === undefined) return null;
    if (date instanceof Date) return date.toISOString();
    if (typeof date === 'string') {
        try {
            // Ensure it's a valid date string
            const d = new Date(date);
            if (!isNaN(d.getTime())) return date;
            return null;
        } catch {
            return null;
        }
    }
    return null;
};

/**
 * Service for Mixer-related operations
 */
export class MixerService {
    /**
     * Fetch all mixers from the database
     */
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

    /**
     * Alias for getAllMixers for backward compatibility
     */
    static async fetchMixers() {
        return this.getAllMixers();
    }

    /**
     * Fetch a single mixer by ID
     */
    static async getMixerById(id) {
        try {
            const {data, error} = await supabase
                .from('mixers')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            return Mixer.fromApiFormat(data);
        } catch (error) {
            console.error(`Error fetching mixer with ID ${id}:`, error);
            return null;
        }
    }

    /**
     * Alias for getMixerById for backward compatibility
     */
    static async fetchMixerById(id) {
        return this.getMixerById(id);
    }

    /**
     * Fetch active mixers
     */
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

    /**
     * Add a new mixer
     */
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
                status: mixer.status || 'Active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                updated_last: new Date().toISOString(),
                updated_by: userId
            };

            // Log data being sent to help debug
            console.log('Adding mixer with data:', JSON.stringify(apiData));

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

    /**
     * Alias for addMixer for backward compatibility
     */
    static async createMixer(mixer, userId) {
        // If userId is not provided, try to get it from current auth session
        if (!userId) {
            try {
                const { data } = await supabase.auth.getUser();
                userId = data?.user?.id;
                if (!userId) {
                    console.warn('No user ID available when creating mixer');
                }
            } catch (error) {
                console.error('Error getting current user:', error);
            }
        }
        return this.addMixer(mixer, userId);
    }

    /**
     * Update an existing mixer
     */
    static async updateMixer(mixer, userId) {
        try {
            // Get current mixer data for history tracking
            const currentMixer = await this.getMixerById(mixer.id);
            if (!currentMixer) {
                throw new Error(`Mixer with ID ${mixer.id} not found`);
            }

            // Update mixer
            const apiData = mixer.toApiFormat ? mixer.toApiFormat() : {
                truck_number: mixer.truckNumber,
                assigned_plant: mixer.assignedPlant,
                assigned_operator: mixer.assignedOperator || null,
                last_service_date: formatDate(mixer.lastServiceDate),
                last_chip_date: formatDate(mixer.lastChipDate),
                cleanliness_rating: mixer.cleanlinessRating,
                status: mixer.status,
                updated_at: new Date().toISOString(),
                updated_last: new Date().toISOString(),
                updated_by: userId
            };

            // Set the updated_by field to the current user and update timestamps
            apiData.updated_by = userId;
            apiData.updated_at = new Date().toISOString();
            apiData.updated_last = new Date().toISOString();

            const {data, error} = await supabase
                .from('mixers')
                .update(apiData)
                .eq('id', mixer.id)
                .select();

            if (error) {
                if (logSupabaseError) {
                    logSupabaseError(`updating mixer with id ${mixer.id}`, error);
                } else {
                    console.error(`Error updating mixer with ID ${mixer.id}:`, error);
                }
                throw new Error(`Failed to update mixer: ${error.message}`);
            }

            // Track history for changed fields
            const historyEntries = [];

            // Compare fields and create history entries
            const fieldsToTrack = [
                {field: 'truckNumber', dbField: 'truck_number'},
                {field: 'assignedPlant', dbField: 'assigned_plant'},
                {field: 'assignedOperator', dbField: 'assigned_operator'},
                {field: 'lastServiceDate', dbField: 'last_service_date'},
                {field: 'lastChipDate', dbField: 'last_chip_date'},
                {field: 'cleanlinessRating', dbField: 'cleanliness_rating'},
                {field: 'status', dbField: 'status'}
            ];

            for (const {field, dbField} of fieldsToTrack) {
                if (currentMixer[field] !== mixer[field]) {
                    const historyEntry = {
                        mixer_id: mixer.id,
                        field_name: dbField,
                        old_value: currentMixer[field]?.toString() || '',
                        new_value: mixer[field]?.toString() || '',
                        changed_at: new Date().toISOString(),
                        changed_by: userId
                    };

                    historyEntries.push(historyEntry);
                }
            }

            // Save history entries if there are changes
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
            console.error(`Error updating mixer with ID ${mixer.id}:`, error);
            throw error;
        }
    }

    /**
     * Delete a mixer
     */
    static async deleteMixer(id) {
        try {
            // First delete all history records for this mixer
            const {error: historyError} = await supabase
                .from('mixer_history')
                .delete()
                .eq('mixer_id', id);

            if (historyError) {
                console.error(`Error deleting history for mixer with ID ${id}:`, historyError);
            }

            // Then delete the mixer itself
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

    /**
     * Create history entry for a mixer
     */
    static async createHistoryEntry(mixerId, fieldName, oldValue, newValue, changedBy = null) {
        try {
            // Get current user if not provided
            let userId = changedBy;
            if (!userId) {
                // Get the current authenticated user
                const {data, error} = await supabase.auth.getUser();

                if (error) {
                    console.error('Error getting current user:', error);
                    userId = 'anonymous';
                } else {
                    userId = data.user?.id || 'anonymous';
                    console.log('Current user ID for history entry:', userId);
                }
            }

            // Format values as strings
            const oldValueStr = oldValue?.toString() || null;
            const newValueStr = newValue?.toString() || null;

            // Insert history entry
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

    /**
     * Get mixer history
     */
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

    /**
     * Get mixers by operators ID
     */
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

    /**
     * Get mixers by status
     */
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

    /**
     * Search mixers by truck number
     */
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

    /**
     * Get mixers needing service (service date older than specified days)
     */
    static async getMixersNeedingService(dayThreshold = 30) {
        try {
            // Get all mixers and filter in JavaScript for date comparison
            const {data, error} = await supabase
                .from('mixers')
                .select('*')
                .order('truck_number', {ascending: true});

            if (error) throw error;

            const now = new Date();
            const thresholdDate = new Date(now.setDate(now.getDate() - dayThreshold));

            return data
                .filter(mixer => {
                    if (!mixer.last_service_date) return true; // No service date means needs service
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
