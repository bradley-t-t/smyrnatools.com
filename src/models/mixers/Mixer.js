// Mixer model that matches your Swift app's Mixer model
import { MixerUtils } from '../../utils/MixerUtils';

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
        this.vin = data.vin || '';
        this.make = data.make || '';
        this.model = data.model || '';
        this.year = data.year || '';
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
            updated_by: data.updated_by,
            vin: data.vin,
            make: data.make,
            model: data.model,
            year: data.year
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
            updated_at: now, // Always use current timestamp for updated_at
            updated_last: this.updatedLast ? formatDateForDb(this.updatedLast) : null,
            updated_by: this.updatedBy,
            vin: this.vin,
            make: this.make,
            model: this.model,
            year: this.year
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
     * Set mixer status and handle related business rules
     * @param {string} newStatus - New status value
     * @returns {Mixer} - Returns this for method chaining
     */
    setStatus(newStatus) {
        // Ensure status is valid
        if (!newStatus) return this;

        this.status = newStatus;

        // If setting to In Shop, Retired, or Spare, automatically unassign operator
        if (['In Shop', 'Retired', 'Spare'].includes(newStatus)) {
            this.assignedOperator = null;
        }

        return this;
    }

    /**
     * Assign operator to this mixer and handle related business rules
     * @param {string} operatorId - The ID of the operator to assign
     * @returns {Mixer} - Returns this for method chaining
     */
    assignOperator(operatorId) {
        this.assignedOperator = operatorId || null;

        // If assigning an operator, ensure status is Active
        if (this.assignedOperator && this.status !== 'Active') {
            this.status = 'Active';
        }

        return this;
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
            isVerified(latestHistoryDate) {
        // Import moved to the top of the file
        try {
            // This will use the MixerUtils.isVerified implementation with history date if provided
            return MixerUtils.isVerified(this.updatedLast, this.updatedAt, this.updatedBy, latestHistoryDate);
        } catch (e) {
            console.error('Error checking verification status:', e);
            // Basic fallback implementation
            if (!this.updatedLast || !this.updatedBy) return false;

            const lastVerified = new Date(this.updatedLast);
            const today = new Date();

            // Rule 1: Check if there has been a Sunday between verification and today
            const checkForSunday = (startDate, endDate) => {
                // Clone start date and increment by one day to start checking
                const currentDate = new Date(startDate);
                currentDate.setDate(currentDate.getDate() + 1);

                while (currentDate <= endDate) {
                    // Sunday is day 0 in JavaScript
                    if (currentDate.getDay() === 0) {
                        return true; // Found a Sunday
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                return false; // No Sunday found
            };

            // If there's been a Sunday since verification, the mixer is not verified
            if (checkForSunday(lastVerified, today)) return false;

            // Rule 2: Check if there's history data that is newer than the verification date
            if (latestHistoryDate) {
                const historyDate = new Date(latestHistoryDate);
                if (historyDate > lastVerified) return false;
            }

            return true;
        }
    }
}