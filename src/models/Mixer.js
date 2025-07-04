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
        return {
            id: this.id,
            truck_number: this.truckNumber,
            assigned_plant: this.assignedPlant,
            assigned_operator: this.assignedOperator,
            last_service_date: this.lastServiceDate,
            last_chip_date: this.lastChipDate,
            cleanliness_rating: this.cleanlinessRating,
            status: this.status,
            created_at: this.createdAt,
            updated_at: new Date().toISOString(),
            updated_last: new Date().toISOString(),
            updated_by: this.updatedBy
        };
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
     * Get a status label with emoji indicator
     */
    getStatusLabel() {
        switch (this.status) {
            case 'Active':
                return '🟢 Active';
            case 'Maintenance':
                return '🔧 Maintenance';
            case 'Out of Service':
                return '🔴 Out of Service';
            case 'Scheduled':
                return '🟡 Scheduled';
            default:
                return this.status;
        }
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
}

/**
 * Mixer utilities class for static helper methods
 */
export class MixerUtils {
    /**
     * Check if service is overdue (more than 90 days)
     */
    static isServiceOverdue(date) {
        if (!date) return true; // No service date means it's overdue

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
        if (!date) return true; // No chip date means it's overdue

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
     * Get color for status display
     */
    static statusColor(status) {
        switch (status) {
            case 'Active':
                return '#34c759';
            case 'Spare':
                return '#ffcc00';
            case 'In Shop':
                return '#ff9500';
            case 'Retired':
                return '#ff3b30';
            default:
                return '#8e8e93';
        }
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
        return '⭐'.repeat(rating);
    }
}
