/**
 * Utility functions for formatting data for the API
 */
/**
 * Helper utilities for data formatting
 */

/**
 * Convert object from camelCase to snake_case for Supabase
 */
export const formatForSupabase = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;

    const formatted = {};

    Object.keys(obj).forEach(key => {
        // Convert camelCase to snake_case
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

        // Handle dates
        let value = obj[key];
        if (value instanceof Date) {
            value = value.toISOString();
        }

        formatted[snakeKey] = value;
    });

    return formatted;
};

/**
 * Format a date for display
 */
export const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';

    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid date';
    }
};

/**
 * Format date with time
 */
export const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Unknown';

    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (error) {
        console.error('Error formatting date time:', error);
        return 'Invalid date';
    }
};

// Format a Supabase object to JavaScript (snake_case to camelCase)
export const formatFromSupabase = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;

    const formatted = {};

    Object.keys(obj).forEach(key => {
        // Convert snake_case to camelCase
        const camelKey = key.replace(/_([a-z])/g, (match, p1) => p1.toUpperCase());
        formatted[camelKey] = obj[key];
    });

    return formatted;
};

// Format a date for display
export const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString();
};

// Format a date for input
export const formatDateForInput = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return ''; // Invalid date

    return d.toISOString().split('T')[0]; // YYYY-MM-DD format
};
