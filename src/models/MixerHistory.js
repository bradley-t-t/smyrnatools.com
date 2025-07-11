/**
 * Model representing a mixer history entry
 */
class MixerHistory {
    constructor(id, mixerId, fieldName, oldValue, newValue, changedAt, changedBy) {
        this.id = id;
        this.mixerId = mixerId;
        this.fieldName = fieldName;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.changedAt = changedAt;
        this.changedBy = changedBy;
    }

    /**
     * Get formatted old value based on field type
     */
    getFormattedOldValue() {
        return this.formatFieldValue(this.fieldName, this.oldValue);
    }

    /**
     * Get formatted new value based on field type
     */
    getFormattedNewValue() {
        return this.formatFieldValue(this.fieldName, this.newValue);
    }

    /**
     * Format a value based on field name
     */
    formatFieldValue(fieldName, value) {
        if (!value) return '';

        // Format dates for specific fields
        if (fieldName === 'last_service_date' || fieldName === 'last_chip_date') {
            try {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString();
                }
            } catch (e) {
                // If parsing fails, return the original value
            }
        }

        // Format numeric fields
        if (fieldName === 'cleanliness_rating') {
            const rating = parseInt(value, 10);
            if (!isNaN(rating)) {
                const ratingLabels = {
                    1: 'Poor (1)',
                    2: 'Fair (2)',
                    3: 'Good (3)',
                    4: 'Very Good (4)',
                    5: 'Excellent (5)'
                };
                return ratingLabels[rating] || `${rating}`;
            }
        }

        // Format status values
        if (fieldName === 'status') {
            if (value === '0') return 'None';
            return value;
        }

        return value;
    }

    /**
     * Convert database format (snake_case) to model instance (camelCase)
     */
    static fromApiFormat(data) {
        // Clean date strings if they exist
        let oldValue = data.old_value;
        let newValue = data.new_value;

        // For date fields, ensure consistent formatting
        if (data.field_name === 'last_service_date' || data.field_name === 'last_chip_date') {
            // Try to parse as date and get just the date part (no time)
            try {
                if (oldValue && oldValue.includes('T')) {
                    oldValue = oldValue.split('T')[0];
                }
                if (newValue && newValue.includes('T')) {
                    newValue = newValue.split('T')[0];
                }
            } catch (e) {
                console.error('Error formatting date in history:', e);
            }
        }

        return new MixerHistory(
            data.id,
            data.mixer_id,
            data.field_name,
            oldValue,
            newValue,
            data.changed_at,
            data.changed_by
        );
    }

    /**
     * Convert model instance (camelCase) to database format (snake_case)
     */
    toApiFormat() {
        return {
            id: this.id,
            mixer_id: this.mixerId,
            field_name: this.fieldName,
            old_value: this.oldValue,
            new_value: this.newValue,
            changed_at: this.changedAt,
            changed_by: this.changedBy
        };
    }
}

/**
 * Helper functions for mixer history
 */
export class MixerHistoryUtils {
    /**
     * Formats a value for display based on the field type
     * @param {string} fieldName - Database field name
     * @param {string} value - Value to format
     * @returns {string} Formatted value for display
     */
    static formatValueForDisplay(fieldName, value) {
        if (!value) return '';

        // Format date fields to show only the date part
        if (fieldName === 'last_service_date' || fieldName === 'last_chip_date') {
            try {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString();
                }
            } catch (e) {
                // Return original if parsing fails
            }
        }

        // Format cleanliness rating
        if (fieldName === 'cleanliness_rating') {
            const rating = parseInt(value, 10);
            if (!isNaN(rating)) {
                const ratingLabels = {
                    1: 'Poor (1)',
                    2: 'Fair (2)',
                    3: 'Good (3)',
                    4: 'Very Good (4)',
                    5: 'Excellent (5)'
                };
                return ratingLabels[rating] || `${rating}`;
            }
        }

        // Format assigned operator or plant
        if (fieldName === 'assigned_operator' || fieldName === 'assigned_plant') {
            if (value === '0' || value === 'null' || value === 'undefined') return 'None';
        }

        return value;
    }

    /**
     * Determines if two date strings represent the same date (ignoring time)
     * @param {string} date1 - First date string
     * @param {string} date2 - Second date string
     * @returns {boolean} True if dates are the same day
     */
    static areSameDates(date1, date2) {
        if (!date1 && !date2) return true;
        if (!date1 || !date2) return false;

        try {
            const d1 = new Date(date1).toISOString().split('T')[0];
            const d2 = new Date(date2).toISOString().split('T')[0];
            return d1 === d2;
        } catch (e) {
            console.error('Error comparing dates:', e);
            return false;
        }
    }
}

export {MixerHistory};