import { supabase } from '../clients/SupabaseClient';

export class DatabaseService {
    static async executeRawQuery(sql, params = []) {
        try {
            const { data, error } = await supabase.rpc('execute_sql', {
                query: sql,
                params: params
            });

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            throw error;
        }
    }

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
            return false;
        }
    }

    static async getAllRecords(tableName) {
        try {
            const exists = await this.tableExists(tableName);
            if (!exists) {
                return [];
            }

            const sql = `SELECT * FROM ${tableName}`;
            return await this.executeRawQuery(sql);
        } catch (error) {
            return [];
        }
    }
}