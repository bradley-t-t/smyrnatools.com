/**
 * Utility functions for date operations
 */
export const DateUtils = {
    /**
     * Format date as MM/DD/YYYY
     * @param {string|Date} date - The date to format
     * @returns {string} Formatted date string or empty string if invalid
     */
    formatDate: (date) => {
        if (!date) return '';

        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return '';

            return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
        } catch (error) {
            console.error('Error formatting date:', error);
            return '';
        }
    },

    /**
     * Check if a date is in the past
     * @param {string|Date} date - The date to check
     * @returns {boolean} True if date is in the past, false otherwise
     */
    isPast: (date) => {
        if (!date) return false;

        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return false;

            return d < new Date();
        } catch (error) {
            console.error('Error checking if date is past:', error);
            return false;
        }
    },

    /**
     * Calculate days between two dates
     * @param {string|Date} date1 - First date
     * @param {string|Date} date2 - Second date (defaults to current date)
     * @returns {number} Number of days between dates or null if invalid
     */
    daysBetween: (date1, date2 = new Date()) => {
        if (!date1) return null;

        try {
            const d1 = new Date(date1);
            const d2 = new Date(date2);

            if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;

            // Convert to UTC to avoid DST issues
            const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
            const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());

            const MS_PER_DAY = 1000 * 60 * 60 * 24;
            return Math.floor((utc2 - utc1) / MS_PER_DAY);
        } catch (error) {
            console.error('Error calculating days between:', error);
            return null;
        }
    }
};
