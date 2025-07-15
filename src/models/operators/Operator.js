export class Operator {
    constructor(data = {}) {
        this.employeeId = data.employee_id ?? '';
        this.smyrnaId = data.smyrna_id ?? '';
        this.name = data.name ?? '';
        this.plantCode = data.plant_code ?? null;
        this.status = data.status ?? 'Active';
        this.isTrainer = data.is_trainer === true || String(data.is_trainer).toLowerCase() === 'true';
        this.assignedTrainer = data.assigned_trainer ?? null;
        this.position = data.position ?? '';
        this.createdAt = data.created_at ?? new Date().toISOString();
        this.updatedAt = data.updated_at ?? new Date().toISOString();
    }

    static fromApiFormat(data) {
        if (!data) return null;
        return new Operator(data);
    }

    static fromRow(row) {
        return this.fromApiFormat(row);
    }

    toApiFormat() {
        return {
            employee_id: this.employeeId,
            smyrna_id: this.smyrnaId,
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

export class OperatorHistory {
    constructor(data = {}) {
        this.id = data.id ?? null;
        this.employeeId = data.employee_id ?? '';
        this.fieldName = data.field_name ?? '';
        this.oldValue = data.old_value ?? '';
        this.newValue = data.new_value ?? '';
        this.changedAt = data.changed_at ?? new Date().toISOString();
        this.changedBy = data.changed_by ?? null;
    }

    static fromApiFormat(data) {
        if (!data) return null;
        return new OperatorHistory(data);
    }

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