import supabase from '../../core/clients/SupabaseClient';
import { DatabaseHelper } from '../../utils/helpers/DatabaseHelper';
import { v4 as uuidv4 } from 'uuid';

export class MixerMaintenanceService {
    static async fetchIssues(mixerId) {
        try {
            const { data, error } = await supabase
                .from('mixers_maintenance')
                .select('*')
                .eq('mixer_id', mixerId)
                .order('time_created', { ascending: false });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error(`Error fetching maintenance issues for mixer ${mixerId}:`, error);
            throw error;
        }
    }

    static async addIssue(mixerId, issueText, severity) {
        try {
            // Log parameters for debugging
            console.log('Adding maintenance issue with params:', { 
                mixerId, 
                issueText: issueText?.substring(0, 20) + '...',
                severity 
            });

            // Basic validation with detailed errors
            if (!mixerId) throw new Error('Mixer ID is required');
            if (!issueText || !issueText.trim()) throw new Error('Issue description is required');

            // Default to Medium if severity is not provided or invalid
            const validSeverities = ['Low', 'Medium', 'High'];
            const finalSeverity = validSeverities.includes(severity) ? severity : 'Medium';

            console.log('Using severity:', finalSeverity);

            // Insert with payload matching exactly the table schema from database
            console.log('Preparing database insert for mixers_maintenance');
            const payload = {
                id: crypto.randomUUID(), // Use browser's UUID generator for the primary key
                mixer_id: mixerId,
                issue: issueText.trim(),
                severity: finalSeverity,
                // Let the database handle time_created with its default value
                time_completed: null
            };
            console.log('Insert payload:', payload);

            const { data, error } = await supabase
                .from('mixers_maintenance')
                .insert([payload])
                .select();

            if (error) {
                // Detailed error logging
                console.error('Database error details:', {
                    code: error.code,
                    message: error.message,
                    hint: error.hint,
                    details: error.details
                });

                // Create a more informative error
                const enhancedError = new Error(`Database error (${error.code}): ${error.message}${error.hint ? ' - ' + error.hint : ''}`);
                enhancedError.originalError = error;
                enhancedError.details = error.details;
                throw enhancedError;
            }

            if (!data || data.length === 0) {
                console.error('No data returned from insert operation');
                throw new Error('Database insert succeeded but no data was returned');
            }

            console.log('Successfully added maintenance issue, returned data:', data[0]);
            return data[0];
        } catch (error) {
            console.error(`Error adding maintenance issue for mixer ${mixerId}:`, error);
            // Store enhanced error details in localStorage for debugging
            try {
                // Check table schema to provide more helpful debugging information
                DatabaseHelper.checkTableSchema(supabase, 'mixers_maintenance')
                    .then(schemaInfo => {
                        const errorLog = {
                            timestamp: new Date().toISOString(),
                            mixerId,
                            severity,
                            error: error.message,
                            stack: error.stack,
                            originalError: error.originalError ? {
                                message: error.originalError.message,
                                code: error.originalError.code,
                                details: error.originalError.details
                            } : null,
                            schemaInfo: schemaInfo
                        };
                        localStorage.setItem('mixer_maintenance_error', JSON.stringify(errorLog));
                        console.log('Table schema information:', schemaInfo);
                    })
                    .catch(e => {
                        console.error('Error checking schema:', e);
                    });
            } catch (e) {
                console.error('Could not save error details to localStorage:', e);
            }
            throw error;
        }
    }

    static async deleteIssue(issueId) {
        try {
            const { error } = await supabase
                .from('mixers_maintenance')
                .delete()
                .eq('id', issueId);

            if (error) throw error;

            return true;
        } catch (error) {
            console.error(`Error deleting maintenance issue ${issueId}:`, error);
            throw error;
        }
    }

    static async completeIssue(issueId) {
        try {
            const { data, error } = await supabase
                .from('mixers_maintenance')
                .update({ time_completed: new Date().toISOString() })
                .eq('id', issueId)
                .select();

            if (error) throw error;

            return data[0];
        } catch (error) {
            console.error(`Error completing maintenance issue ${issueId}:`, error);
            throw error;
        }
    }
}
