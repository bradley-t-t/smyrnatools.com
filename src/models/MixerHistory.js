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
     * Convert database format (snake_case) to model instance (camelCase)
     */
    static fromApiFormat(data) {
        return new MixerHistory(
            data.id,
            data.mixer_id,
            data.field_name,
            data.old_value,
            data.new_value,
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

export {MixerHistory};