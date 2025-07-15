import supabase from './DatabaseService';
import { DatabaseUtility } from '../utils/DatabaseUtility';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = 'mixers_maintenance';

export class MixerMaintenanceService {
    static async fetchIssues(mixerId) {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('mixer_id', mixerId)
            .order('time_created', { ascending: false });

        if (error) {
            console.error(`Error fetching maintenance issues for mixer ${mixerId}:`, error);
            throw error;
        }

        return data ?? [];
    }

    static async addIssue(mixerId, issueText, severity) {
        if (!mixerId) throw new Error('Mixer ID is required');
        if (!issueText?.trim()) throw new Error('Issue description is required');

        const validSeverities = ['Low', 'Medium', 'High'];
        const finalSeverity = validSeverities.includes(severity) ? severity : 'Medium';
        const payload = {
            id: uuidv4(),
            mixer_id: mixerId,
            issue: issueText.trim(),
            severity: finalSeverity,
            time_completed: null
        };

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error(`Error adding maintenance issue for mixer ${mixerId}:`, error);
            const enhancedError = new Error(`Database error (${error.code}): ${error.message}${error.hint ? ' - ' + error.hint : ''}`);
            enhancedError.originalError = error;
            enhancedError.details = error.details;

            try {
                const schemaInfo = await DatabaseUtility.checkTableSchema(supabase, TABLE_NAME);
                localStorage.setItem('mixer_maintenance_error', JSON.stringify({
                    timestamp: new Date().toISOString(),
                    mixerId,
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
            } catch (e) {
                console.error('Could not save error details to localStorage:', e);
            }

            throw enhancedError;
        }

        if (!data) {
            console.error('No data returned from insert operation');
            throw new Error('Database insert succeeded but no data was returned');
        }

        return data;
    }

    static async deleteIssue(issueId) {
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq('id', issueId);

        if (error) {
            console.error(`Error deleting maintenance issue ${issueId}:`, error);
            throw error;
        }

        return true;
    }

    static async completeIssue(issueId) {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .update({ time_completed: new Date().toISOString() })
            .eq('id', issueId)
            .select()
            .single();

        if (error) {
            console.error(`Error completing maintenance issue ${issueId}:`, error);
            throw error;
        }

        return data;
    }
}