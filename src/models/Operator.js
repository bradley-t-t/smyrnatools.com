/**
 * Operator model class
 */
export class Operator {
    constructor(data = {}) {
        this.id = data.id || null;
        this.employeeId = data.employee_id || '';
        this.name = data.name || '';
        this.plantCode = data.plant_code || null;
        this.status = data.status || 'Active';
        this.isTrainer = data.is_trainer || false;
        this.assignedTrainer = data.assigned_trainer || '0';
        this.position = data.position || '';
        this.createdAt = data.created_at || new Date().toISOString();
        this.updatedAt = data.updated_at || new Date().toISOString();
    }

    /**
     * Create an Operator instance from API data
     */
    static fromApiFormat(data) {
        return new Operator({
            id: data.id,
            employee_id: data.employee_id,
            name: data.name,
            plant_code: data.plant_code,
            status: data.status,
            is_trainer: data.is_trainer,
            assigned_trainer: data.assigned_trainer,
            position: data.position,
            created_at: data.created_at,
            updated_at: data.updated_at
        });
    }

    /**
     * Convert database row to Operator object (alias for fromApiFormat)
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
            employee_id: this.employeeId,
            name: this.name,
            plant_code: this.plantCode,
            status: this.status,
            is_trainer: this.isTrainer,
            assigned_trainer: this.assignedTrainer,
            position: this.position,
            created_at: this.createdAt,
            updated_at: this.updatedAt
        };
    }
}

/**
 * Operator History model class
 */
export class OperatorHistory {
    constructor(data = {}) {
        this.id = data.id || null;
        this.employeeId = data.employee_id || '';
        this.fieldName = data.field_name || '';
        this.oldValue = data.old_value || '';
        this.newValue = data.new_value || '';
        this.changedAt = data.changed_at || new Date().toISOString();
        this.changedBy = data.changed_by || null;
    }

    /**
     * Create an OperatorHistory instance from API data
     */
    static fromApiFormat(data) {
        return new OperatorHistory({
            id: data.id,
            employee_id: data.employee_id,
            field_name: data.field_name,
            old_value: data.old_value,
            new_value: data.new_value,
            changed_at: data.changed_at,
            changed_by: data.changed_by
        });
    }

    /**
     * Convert to API format for database operations
     */
    toApiFormat() {
        return {
            id: this.id,
            employee_id: this.employeeId,
            field_name: this.fieldName,
            old_value: this.oldValue,
            new_value: this.newValue,
            changed_at: this.changedAt,
            changed_by: this.changedBy
        };
    }
}
