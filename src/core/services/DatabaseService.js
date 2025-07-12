import { supabase } from '../clients/SupabaseClient';

export class DatabaseService {
    /**
     * Execute a raw SQL query against the database
     * @param {string} sql - The SQL query to execute
     * @param {Array} params - Parameters for the query
     * @returns {Promise<Object>} - Query results
     */
    static async executeRawQuery(sql, params = []) {
        try {
            console.log('Executing raw SQL query:', sql);
            const { data, error } = await supabase.rpc('execute_sql', { 
                query: sql, 
                params: params 
            });

            if (error) {
                console.error('Raw query error:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error executing raw query:', error);
            throw error;
        }
    }

    /**
     * Check if a table exists in the database
     * @param {string} tableName - The name of the table to check
     * @returns {Promise<boolean>} - True if table exists
     */
    static async tableExists(tableName) {
        try {
            const sql = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                ) as exists
            `;

            const result = await this.executeRawQuery(sql, [tableName]);
            return result && result[0] && result[0].exists === true;
        } catch (error) {
            console.error(`Error checking if table ${tableName} exists:`, error);
            return false;
        }
    }

    /**
     * Get all records from a table
     * @param {string} tableName - The name of the table
     * @returns {Promise<Array>} - Array of records
     */
    static async getAllRecords(tableName) {
        try {
            // First check if table exists
            const exists = await this.tableExists(tableName);
            if (!exists) {
                console.error(`Table ${tableName} does not exist`);
                return [];
            }

            const sql = `SELECT * FROM ${tableName}`;
            return await this.executeRawQuery(sql);
        } catch (error) {
            console.error(`Error getting all records from ${tableName}:`, error);
            return [];
        }
    }
}
