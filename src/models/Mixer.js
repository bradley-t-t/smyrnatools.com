// Mixer model that matches your Swift app's Mixer model
/**
 * Mixer model class
 */
export class Mixer {
    constructor(data = {}) {
        this.id = data.id || null;
        this.truckNumber = data.truck_number || '';
        this.assignedPlant = data.assigned_plant || '';
        this.assignedOperator = data.assigned_operator || '';
        this.lastServiceDate = data.last_service_date || null;
        this.lastChipDate = data.last_chip_date || null;
        this.cleanlinessRating = data.cleanliness_rating || 0;
        this.status = data.status || 'Active';
        this.createdAt = data.created_at || new Date().toISOString();
        this.updatedAt = data.updated_at || new Date().toISOString();
        this.updatedLast = data.updated_last || new Date().toISOString();
        this.updatedBy = data.updated_by || null;
    }

    /**
     * Create a Mixer instance from API data
     */
    static fromApiFormat(data) {
        if (!data) return null;

        return new Mixer({
            id: data.id,
            truck_number: data.truck_number,
            assigned_plant: data.assigned_plant,
            assigned_operator: data.assigned_operator,
            last_service_date: data.last_service_date,
            last_chip_date: data.last_chip_date,
            cleanliness_rating: data.cleanliness_rating,
            status: data.status,
            created_at: data.created_at,
            updated_at: data.updated_at,
            updated_last: data.updated_last,
            updated_by: data.updated_by
        });
    }

    /**
     * Convert database row to Mixer object (alias for fromApiFormat)
     */
    static fromRow(row) {
        return this.fromApiFormat(row);
    }

    /**
     * Convert to API format for database operations
     */
    toApiFormat() {
        // Format date to YYYY-MM-DD HH:MM:SS+00 format
        const formatDateForDb = (date) => {
            if (!date) return null;
            const d = new Date(date);
            if (isNaN(d.getTime())) return null;

            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const seconds = String(d.getSeconds()).padStart(2, '0');

            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+00`;
        };

        const now = formatDateForDb(new Date());

        // Create the base object without id
        const apiObject = {
            truck_number: this.truckNumber,
            assigned_plant: this.assignedPlant,
            assigned_operator: this.assignedOperator,
            last_service_date: this.lastServiceDate ? formatDateForDb(this.lastServiceDate) : null,
            last_chip_date: this.lastChipDate ? formatDateForDb(this.lastChipDate) : null,
            cleanliness_rating: this.cleanlinessRating,
            status: this.status,
            created_at: this.createdAt ? formatDateForDb(this.createdAt) : now,
            updated_at: now,
            updated_last: now,
            updated_by: this.updatedBy
        };

        // Only include id if it exists to avoid setting null IDs
        if (this.id) {
            apiObject.id = this.id;
        }

        return apiObject;
    }

    /**
     * Convert Mixer object to database row (alias for toApiFormat)
     */
    toRow() {
        return this.toApiFormat();
    }

    /**
     * Get the days since last service
     */
    getDaysSinceService() {
        if (!this.lastServiceDate) return null;

        const serviceDate = new Date(this.lastServiceDate);
        const today = new Date();
        const diffTime = Math.abs(today - serviceDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    /**
     * Get the days since last chip date
     */
    getDaysSinceChip() {
        if (!this.lastChipDate) return null;

        const chipDate = new Date(this.lastChipDate);
        const today = new Date();
        const diffTime = Math.abs(today - chipDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    /**
     * Get the status value
     * @returns {string} The status string
     */
    getStatus() {
        return this.status || 'Unknown';
    }

    /**
     * Get a formatted last service date
     */
    getFormattedServiceDate() {
        if (!this.lastServiceDate) return 'Not available';
        return new Date(this.lastServiceDate).toLocaleDateString();
    }

    /**
     * Get a formatted last chip date
     */
    getFormattedChipDate() {
        if (!this.lastChipDate) return 'Not available';
        return new Date(this.lastChipDate).toLocaleDateString();
    }

    /**
     * Check if the mixer is verified
     * @returns {boolean} Whether the mixer is verified
     */
    isVerified() {
        return MixerUtils.isVerified(this.updatedLast, this.updatedAt, this.updatedBy);
    }
}

/**
 * Mixer utilities class for static helper methods
 */
export class MixerUtils {
    /**
     * Check if service is overdue (more than 90 days)
     */
    static isServiceOverdue(date) {
        if (!date) return false; // No service date means it's unknown, not overdue

        const serviceDate = new Date(date);
        const today = new Date();
        const diffTime = Math.abs(today - serviceDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays > 90; // Overdue if more than 90 days
    }

    /**
     * Check if chip is overdue (more than 180 days)
     */
    static isChipOverdue(date) {
        if (!date) return false; // No chip date means it's unknown, not overdue

        const chipDate = new Date(date);
        const today = new Date();
        const diffTime = Math.abs(today - chipDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays > 180; // Overdue if more than 180 days
    }

    /**
     * Get a count of mixers by status
     */
    static getStatusCounts(mixers = []) {
        const counts = {
            Active: 0,
            'In Shop': 0,
            Spare: 0,
            Retired: 0,
            Total: 0
        };

        mixers.forEach(mixer => {
            counts.Total++;
            if (mixer.status in counts) {
                counts[mixer.status]++;
            } else {
                counts.Active++; // Default to active if status is not recognized
            }
        });

        return counts;
    }

    /**
     * Get a count of mixers by plant
     */
    static getPlantCounts(mixers = []) {
        const counts = {};

        mixers.forEach(mixer => {
            const plant = mixer.assignedPlant || 'Unassigned';
            if (plant in counts) {
                counts[plant]++;
            } else {
                counts[plant] = 1;
            }
        });

        return counts;
    }

    /**
     * Calculate cleanliness average
     */
    static getCleanlinessAverage(mixers = []) {
        if (!mixers.length) return 0;

        const ratedMixers = mixers.filter(mixer => mixer.cleanlinessRating > 0);
        if (!ratedMixers.length) return 0;

        const sum = ratedMixers.reduce((total, mixer) => total + mixer.cleanlinessRating, 0);
        return (sum / ratedMixers.length).toFixed(1);
    }

    /**
     * Get count of mixers needing service
     */
    static getNeedServiceCount(mixers = []) {
        return mixers.filter(mixer => this.isServiceOverdue(mixer.lastServiceDate)).length;
    }

    /**
     * Get status display text
     */
    static getStatusDisplay(status) {
        return status || 'Unknown';
    }

    /**
     * Check if service is overdue (alternative implementation)
     */
    static isServiceOverdueAlt(lastServiceDateStr) {
        if (!lastServiceDateStr) return false;

        const lastServiceDate = new Date(lastServiceDateStr);
        const now = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);

        return lastServiceDate < threeMonthsAgo;
    }

    /**
     * Check if chip is overdue (alternative implementation)
     */
    static isChipOverdueAlt(lastChipDateStr) {
        if (!lastChipDateStr) return false;

        const lastChipDate = new Date(lastChipDateStr);
        const now = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(now.getMonth() - 6);

        return lastChipDate < sixMonthsAgo;
    }

    /**
     * Check if cleanliness rating is low
     */
    static isCleanlinessLow(rating) {
        return rating !== null && rating !== undefined && rating < 3;
    }

    /**
     * Format date for display
     */
    static formatDate(dateStr) {
        if (!dateStr) return 'Unknown';
        return new Date(dateStr).toLocaleDateString();
    }

    /**
     * Format date with time for display
     */
    static formatLongDate(dateStr) {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    /**
     * Get star representation of cleanliness rating
     */
    static cleanlinessText(rating) {
        if (rating === null || rating === undefined) return 'Unknown';
        return '★'.repeat(rating);
    }

    /**
     * Check if mixer is verified (updated_last after the last Sunday at noon)
     * and has not been modified since the last verification
     * 
     * This method returns false in these cases:
     * 1. If updated_last or updated_by is null/undefined
     * 2. If the last verification (updated_last) was before the last Sunday at noon
     * 3. If there have been changes (updated_at) since the last verification (updated_last)
     * 
     * @param {string} updatedLastTimestamp - The timestamp when the mixer was last verified
     * @param {string} updatedAtTimestamp - The timestamp when the mixer was last modified
     * @param {string} updatedBy - The user who last verified the mixer (optional)
     * @returns {boolean} Whether the mixer is considered verified
     */
    static isVerified(updatedLastTimestamp, updatedAtTimestamp, updatedBy) {
        // If updated_last or updated_by is null/undefined, mixer is not verified
        if (!updatedLastTimestamp || !updatedBy) return false;

        const updatedLastDate = new Date(updatedLastTimestamp);
        const today = new Date();
        const lastSunday = new Date();

        // Set to last Sunday
        lastSunday.setDate(today.getDate() - today.getDay());
        // Set to noon
        lastSunday.setHours(12, 0, 0, 0);

        // Check if verified after last Sunday
        const isAfterLastSunday = updatedLastDate > lastSunday;

        // If there's an updated_at timestamp, check if changes have been made since verification
        if (updatedAtTimestamp) {
            const updatedAtDate = new Date(updatedAtTimestamp);
            // Return false if changes have been made after verification
            if (updatedAtDate > updatedLastDate) {
                return false;
            }
        }

        return isAfterLastSunday;
    }
}
