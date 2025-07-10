import {createClient} from '@supabase/supabase-js';

// Initialize Supabase client with environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Create and export the Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
export {supabase};

/**
 * Helper utilities for working with Supabase
 */

/**
 * Get detailed information about a Supabase error
 * @param {Error} error - The error object from Supabase
 * @returns {string} - A human-readable error message
 */
export const getSupabaseErrorDetails = (error) => {
    if (!error) return 'Unknown error';

    // Handle standard error object
    if (error.message) {
        // For Supabase specific errors, there might be more details
        if (error.details || error.hint || error.code) {
            return `${error.message}\nDetails: ${error.details || 'none'}\nHint: ${error.hint || 'none'}\nCode: ${error.code || 'none'}`;
        }
        return error.message;
    }

    // If it's a string
    if (typeof error === 'string') {
        return error;
    }

    // Last resort, stringify the object
    try {
        return JSON.stringify(error);
    } catch {
        return 'Error object could not be stringified';
    }
};

/**
 * Logs Supabase errors to the console with context
 * @param {string} context - The operation context where the error occurred
 * @param {Error} error - The error object from Supabase
 */
export const logSupabaseError = (context, error) => {
    console.error(`Supabase error in ${context}:`, error);
    console.error('Details:', getSupabaseErrorDetails(error));
};

/**
 * Format a date for Supabase compatibility
 * @param {Date|string} date - The date to format
 * @returns {string|null} - ISO string format for Supabase or null if invalid
 */
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
            console.error('Error formatting date:', e);
        }
    }

    return null;
};

/**
 * Checks if the Supabase client is properly configured
 * @param {Object} supabase - The Supabase client instance
 * @returns {boolean} - True if properly configured, false otherwise
 */
export const isSupabaseConfigured = (supabase) => {
    if (!supabase) return false;

    // Check environment variables are set
    if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY) {
        console.error('Supabase environment variables are not properly configured');
        return false;
    }

    // Check URL format
    const url = supabase?.supabaseUrl;
    if (!url || url.includes('example.supabase.co')) {
        console.error('Supabase URL is not properly configured');
        return false;
    }

    // Check if key exists (without exposing the actual key in logs)
    const key = supabase?.supabaseKey;
    if (!key || key === 'your-public-anon-key') {
        console.error('Supabase key is not properly configured');
        return false;
    }

    return true;
};

/**
 * Extracts the user-friendly error message from a Supabase response
 * @param {Object} response - The response from a Supabase operation
 * @returns {string|null} - Error message or null if no error
 */
export const extractSupabaseErrorMessage = (response) => {
    if (!response) return 'Empty response received';

    if (!response.error) return null;

    return getSupabaseErrorDetails(response.error);
};

/**
 * Formats a Supabase query filter for partial text search
 * @param {string} column - The column to search in
 * @param {string} searchTerm - The term to search for
 * @returns {Object} - The formatted Supabase filter
 */
export const createPartialTextFilter = (column, searchTerm) => {
    if (!searchTerm || !column) return {};

    // Create an ilike filter (case-insensitive partial match)
    return {[column]: {ilike: `%${searchTerm}%`}};
};

// Utility functions for common database operations
export const SupabaseUtils = {
    // Fetch Operations
    async fetchAll(table, columns = '*') {
        try {
            const {data, error} = await supabase
                .from(table)
                .select(columns);

            if (error) throw error;
            return data;
        } catch (error) {
            console.error(`Error fetching from ${table}:`, error);
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
            console.error(`Error fetching from ${table} with filter:`, error);
            throw error;
        }
    },

    // Insert Operations
    async insert(table, item) {
        try {
            const {data, error} = await supabase
                .from(table)
                .insert(item);

            if (error) throw error;
            return data;
        } catch (error) {
            console.error(`Error inserting into ${table}:`, error);
            throw error;
        }
    },

    // Update Operations
    async update(table, filterColumn, value, data) {
        try {
            const {error} = await supabase
                .from(table)
                .update(data)
                .eq(filterColumn, value);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error(`Error updating ${table}:`, error);
            throw error;
        }
    },

    // Delete Operations
    async delete(table, filterColumn, value) {
        try {
            const {error} = await supabase
                .from(table)
                .delete()
                .eq(filterColumn, value);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error(`Error deleting from ${table}:`, error);
            throw error;
        }
    }
};
