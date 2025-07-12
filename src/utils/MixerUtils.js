/**
 * Utility functions for mixer operations
 */
export const MixerUtils = {
    /**
     * Check if a mixer's service is overdue (more than 30 days)
     * @param {string} lastServiceDate - The last service date string
     * @returns {boolean} - Whether service is overdue
     */
    isServiceOverdue(lastServiceDate) {
        if (!lastServiceDate) return false;

        const serviceDate = new Date(lastServiceDate);
        const today = new Date();
        const diffTime = Math.abs(today - serviceDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays > 30; // Service is overdue if more than 30 days
    },

    /**
     * Check if a mixer's chip is overdue (more than 90 days)
     * @param {string} lastChipDate - The last chip date string
     * @returns {boolean} - Whether chip is overdue
     */
    isChipOverdue(lastChipDate) {
        if (!lastChipDate) return false;

        const chipDate = new Date(lastChipDate);
        const today = new Date();
        const diffTime = Math.abs(today - chipDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays > 90; // Chip is overdue if more than 90 days
    },

    /**
     * Check if the mixer is verified (has been updated within the past week)
     * @param {string} updatedLast - Last updated timestamp
     * @param {string} updatedAt - Updated at timestamp
     * @param {string} updatedBy - User ID who updated
     * @returns {boolean} Whether the mixer is verified
     */
    isVerified(updatedLast, updatedAt, updatedBy) {
        // If any of the verification fields are missing, it's not verified
        if (!updatedLast || !updatedAt || !updatedBy) {
            return false;
        }

        // Check if the mixer has been updated within the past week
        const lastDate = new Date(updatedLast);
        const today = new Date();

        // Find last Sunday
        const lastSunday = new Date(today);
        lastSunday.setDate(today.getDate() - today.getDay());
        lastSunday.setHours(0, 0, 0, 0);

        // Mixer is verified if it was updated after the last Sunday
        return lastDate >= lastSunday;
    }
};
