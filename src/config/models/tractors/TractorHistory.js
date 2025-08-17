// TractorHistory.js
export class TractorHistory {
    constructor(data = {}) {
        this.id = data.id ?? null;
        this.tractorId = data.tractor_id ?? '';
        this.fieldName = data.field_name ?? '';
        this.oldValue = data.old_value ?? '';
        this.newValue = data.new_value ?? '';
        this.changedAt = data.changed_at ?? '';
        this.changedBy = data.changed_by ?? '';
    }

    static fromApiFormat(data) {
        if (!data) return null;

        let oldValue = data.old_value;
        let newValue = data.new_value;

        if (['last_service_date'].includes(data.field_name)) {
            try {
                if (oldValue?.includes('T')) oldValue = oldValue.split('T')[0];
                if (newValue?.includes('T')) newValue = newValue.split('T')[0];
            } catch (error) {
                console.error('Error formatting date in history:', error);
            }
        }

        return new TractorHistory({
            id: data.id,
            tractor_id: data.tractor_id,
            field_name: data.field_name,
            old_value: oldValue,
            new_value: newValue,
            changed_at: data.changed_at,
            changed_by: data.changed_by
        });
    }

    toApiFormat() {
        return {
            id: this.id,
            tractor_id: this.tractorId,
            field_name: this.fieldName,
            old_value: this.oldValue,
            new_value: this.newValue,
            changed_at: this.changedAt,
            changed_by: this.changedBy
        };
    }

    getFormattedOldValue() {
        return TractorHistoryUtils.formatValueForDisplay(this.fieldName, this.oldValue);
    }

    getFormattedNewValue() {
        return TractorHistoryUtils.formatValueForDisplay(this.fieldName, this.newValue);
    }
}

export class TractorHistoryUtils {
    static formatValueForDisplay(fieldName, value) {
        if (!value) return '';

        if (['last_service_date'].includes(fieldName)) {
            try {
                const date = new Date(value);
                if (!isNaN(date.getTime())) return date.toLocaleDateString();
            } catch (error) {
            }
        }

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

        if (['assigned_operator', 'assigned_plant'].includes(fieldName)) {
            if (['0', 'null', 'undefined'].includes(value)) return 'None';
        }

        if (fieldName === 'status' && value === '0') return 'None';

        if (fieldName === 'has_blower') {
            return value ? 'Yes' : 'No';
        }

        return value;
    }

    static areSameDates(date1, date2) {
        if (!date1 && !date2) return true;
        if (!date1 || !date2) return false;

        try {
            return new Date(date1).toISOString().split('T')[0] === new Date(date2).toISOString().split('T')[0];
        } catch (error) {
            console.error('Error comparing dates:', error);
            return false;
        }
    }
}