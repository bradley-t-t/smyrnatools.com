import {createClient} from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
export {supabase};

export const getSupabaseErrorDetails = (error) => {
    if (!error) return 'Unknown error';

    if (error.message) {
        if (error.details || error.hint || error.code) {
            return `${error.message}\nDetails: ${error.details || 'none'}\nHint: ${error.hint || 'none'}\nCode: ${error.code || 'none'}`;
        }
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    try {
        return JSON.stringify(error);
    } catch {
        return 'Error object could not be stringified';
    }
};

export const logSupabaseError = (context, error) => {
    console.error(`Supabase error in ${context}:`, error);
    console.error('Details:', getSupabaseErrorDetails(error));
};

export const formatDateForSupabase = (date) => {
    if (!date) return null;

    if (date instanceof Date) {
        return date.toISOString();
    }

    if (typeof date === 'string') {
        try {
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                return d.toISOString();
            }
        } catch (e) {
        }
    }

    return null;
};

export const isSupabaseConfigured = (supabase) => {
    if (!supabase) return false;

    if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY) {
        return false;
    }

    const url = supabase?.supabaseUrl;
    if (!url || url.includes('example.supabase.co')) {
        return false;
    }

    const key = supabase?.supabaseKey;
    if (!key || key === 'your-public-anon-key') {
        return false;
    }

    return true;
};

export const extractSupabaseErrorMessage = (response) => {
    if (!response) return 'Empty response received';

    if (!response.error) return null;

    return getSupabaseErrorDetails(response.error);
};

export const createPartialTextFilter = (column, searchTerm) => {
    if (!searchTerm || !column) return {};

    return {[column]: {ilike: `%${searchTerm}%`}};
};

export const SupabaseUtils = {
    async fetchAll(table, columns = '*') {
        try {
            // Validate inputs
            if (!table) throw new Error('Table name is required');
            if (!columns) columns = '*';

            const {data, error} = await supabase
                .from(table)
                .select(columns);

            if (error) {
                console.error(`Error fetching from ${table}:`, error);
                throw error;
            }
            return data || [];
        } catch (error) {
            console.error(`Failed operation on table ${table}:`, error);
            throw error;
        }
    },

    async fetch(table, columns = '*', filterColumn, value) {
        try {
            const {data, error} = await supabase
                .from(table)
                .select(columns)
                .eq(filterColumn, value);

            if (error) throw error;
            return data;
        } catch (error) {
            throw error;
        }
    },

    async insert(table, item) {
        try {
            const {data, error} = await supabase
                .from(table)
                .insert(item);

            if (error) throw error;
            return data;
        } catch (error) {
            throw error;
        }
    },

    async update(table, filterColumn, value, data) {
        try {
            const {error} = await supabase
                .from(table)
                .update(data)
                .eq(filterColumn, value);

            if (error) throw error;
            return true;
        } catch (error) {
            throw error;
        }
    },

    async delete(table, filterColumn, value) {
        try {
            const {error} = await supabase
                .from(table)
                .delete()
                .eq(filterColumn, value);

            if (error) throw error;
            return true;
        } catch (error) {
            throw error;
        }
    }
};