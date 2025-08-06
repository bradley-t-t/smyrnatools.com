import UUIDUtility from '../../../utils/UUIDUtility';

export class Operator {
    constructor(data = {}) {
        this.employeeId = data.employee_id ?? data.employeeId ?? UUIDUtility.generateUUID();
        this.smyrnaId = data.smyrna_id ?? data.smyrnaId ?? null;
        this.name = data.name?.trim() ?? '';
        this.plantCode = data.plant_code ?? data.plantCode ?? null;
        this.status = data.status ?? 'Active';
        this.isTrainer = data.is_trainer === true || String(data.is_trainer).toLowerCase() === 'true';
        this.assignedTrainer = data.assigned_trainer ?? data.assignedTrainer ?? null;
        this.position = data.position ?? null;
        this.createdAt = data.created_at ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        this.updatedAt = data.updated_at ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        this.pendingStartDate = data.pending_start_date ?? data.pendingStartDate ?? null;
    }

    static fromApiFormat(data) {
        if (!data) return null;
        return new Operator({
            employee_id: data.employee_id ?? data.employeeId ?? UUIDUtility.generateUUID(),
            smyrna_id: data.smyrna_id ?? data.smyrnaId ?? null,
            name: data.name ?? '',
            plant_code: data.plant_code ?? data.plantCode ?? null,
            status: data.status ?? 'Active',
            is_trainer: data.is_trainer ?? data.isTrainer ?? false,
            assigned_trainer: data.assigned_trainer ?? data.assignedTrainer ?? null,
            position: data.position ?? null,
            created_at: data.created_at ?? data.createdAt ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            updated_at: data.updated_at ?? data.updatedAt ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            pending_start_date: data.pending_start_date ?? data.pendingStartDate ?? null
        });
    }

    static fromRow(row) {
        return this.fromApiFormat(row);
    }

    toApiFormat() {
        if (!UUIDUtility.isValidUUID(this.employeeId)) {
            throw new Error('Invalid employee_id: Must be a valid UUID');
        }
        if (this.smyrnaId && UUIDUtility.isValidUUID(this.smyrnaId)) {
            throw new Error('smyrna_id cannot be a UUID');
        }
        return {
            employee_id: this.employeeId,
            smyrna_id: this.smyrnaId ?? null,
            name: this.name?.trim() || '',
            plant_code: this.plantCode ?? null,
            status: this.status || 'Active',
            is_trainer: this.isTrainer ?? false,
            assigned_trainer: UUIDUtility.safeUUID(this.assignedTrainer),
            position: this.position ?? null,
            created_at: this.createdAt ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            updated_at: this.updatedAt ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            pending_start_date: this.pendingStartDate ?? null
        };
    }
}