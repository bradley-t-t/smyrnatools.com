export class User {
    constructor(data = {}) {
        this.id = data.id ?? '';
        this.email = data.email ?? '';
        this.passwordHash = data.password_hash ?? '';
        this.salt = data.salt ?? '';
        this.createdAt = data.created_at ?? '';
        this.updatedAt = data.updated_at ?? '';
    }
}

export class Profile {
    constructor(data = {}) {
        this.id = data.id ?? '';
        this.firstName = data.first_name ?? '';
        this.lastName = data.last_name ?? '';
        this.plantCode = data.plant_code ?? '';
        this.createdAt = data.created_at ?? '';
        this.updatedAt = data.updated_at ?? '';
    }

    get fullName() {
        return `${this.firstName} ${this.lastName}`.trim();
    }
}

export class UserRole {
    constructor(data = {}) {
        this.userId = data.user_id ?? '';
        this.roleName = data.role_name ?? 'Guest';
        this.createdAt = data.created_at ?? '';
        this.updatedAt = data.updated_at ?? '';
    }
}

export class Plant {
    constructor(data = {}) {
        this.plantCode = data.plant_code ?? '';
        this.plantName = data.plant_name ?? '';
        this.createdAt = data.created_at ?? '';
        this.updatedAt = data.updated_at ?? '';
    }

    static fromRow(data) {
        return new Plant(data);
    }
}

export class ListItem {
    constructor(data = {}) {
        this.id = data.id ?? '';
        this.userId = data.user_id ?? '';
        this.plantCode = data.plant_code ?? '';
        this.description = data.description ?? '';
        this.deadline = data.deadline ?? '';
        this.comments = data.comments ?? '';
        this.createdAt = data.created_at ?? '';
        this.completed = data.completed ?? false;
        this.completedAt = data.completed_at ?? null;
        this.completedBy = data.completed_by ?? null;
    }

    get formattedDeadline() {
        return this.deadline ? new Date(this.deadline).toLocaleDateString() : '';
    }

    get isOverdue() {
        return this.deadline && !this.completed && new Date(this.deadline) < new Date();
    }

    get daysRemaining() {
        if (!this.deadline) return null;
        return Math.ceil((new Date(this.deadline) - new Date()) / (1000 * 60 * 60 * 24));
    }
}

export class Operator {
    constructor(data = {}) {
        this.id = data.id ?? '';
        this.firstName = data.first_name ?? '';
        this.lastName = data.last_name ?? '';
        this.phoneNumber = data.phone_number ?? '';
        this.employeeId = data.employee_id ?? '';
        this.plantCode = data.plant_code ?? '';
        this.status = data.status ?? 'available';
        this.createdAt = data.created_at ?? '';
        this.updatedAt = data.updated_at ?? '';
    }

    get fullName() {
        return `${this.firstName} ${this.lastName}`.trim();
    }

    static fromApiFormat(data) {
        return new Operator({
            id: data.employee_id,
            first_name: data.name?.split(' ')[0],
            last_name: data.name?.split(' ').slice(1).join(' '),
            phone_number: data.phone_number,
            employee_id: data.employee_id,
            plant_code: data.plant_code,
            status: data.status,
            created_at: data.created_at,
            updated_at: data.updated_at
        });
    }

    toApiFormat() {
        return {
            employee_id: this.id,
            name: this.fullName,
            phone_number: this.phoneNumber,
            plant_code: this.plantCode,
            status: this.status,
            created_at: this.createdAt,
            updated_at: this.updatedAt
        };
    }
}

export class Tractor {
    constructor(data = {}) {
        this.id = data.id ?? '';
        this.truckNumber = data.truck_number ?? '';
        this.assignedPlant = data.assigned_plant ?? '';
        this.assignedOperator = data.assigned_operator ?? '';
        this.cleanlinessRating = data.cleanliness_rating ?? 0;
        this.status = data.status ?? 'available';
        this.hasBlower = data.has_blower ?? false;
        this.lastServiceDate = data.last_service_date ?? '';
        this.createdAt = data.created_at ?? '';
        this.updatedAt = data.updated_at ?? '';
        this.updatedLast = data.updated_last ?? '';
        this.updatedBy = data.updated_by ?? '';
    }

    get daysSinceService() {
        if (!this.lastServiceDate) return null;
        return Math.ceil((new Date() - new Date(this.lastServiceDate)) / (1000 * 60 * 60 * 24));
    }
}

export class Message {
    constructor(data = {}) {
        this.id = data.id ?? '';
        this.senderId = data.sender_id ?? '';
        this.recipientId = data.recipient_id ?? '';
        this.content = data.content ?? '';
        this.attachments = data.attachments ?? null;
        this.createdAt = data.created_at ?? '';
        this.updatedAt = data.updated_at ?? '';
    }

    get formattedDate() {
        return this.createdAt ? new Date(this.createdAt).toLocaleString() : '';
    }
}

export class MixerMaintenance {
    constructor(data = {}) {
        this.id = data.id ?? '';
        this.mixerId = data.mixer_id ?? '';
        this.issue = data.issue ?? '';
        this.severity = data.severity ?? 'Low';
        this.timeCreated = data.time_created ?? '';
        this.timeCompleted = data.time_completed ?? null;
    }

    get formattedTimeCreated() {
        return this.timeCreated ? new Date(this.timeCreated).toLocaleString() : '';
    }

    get formattedTimeCompleted() {
        return this.timeCompleted ? new Date(this.timeCompleted).toLocaleString() : '';
    }

    get isCompleted() {
        return !!this.timeCompleted;
    }
}

export class OperatorHistory {
    constructor(data = {}) {
        this.id = data.id ?? '';
        this.employeeId = data.employee_id ?? '';
        this.fieldName = data.field_name ?? '';
        this.oldValue = data.old_value ?? '';
        this.newValue = data.new_value ?? '';
        this.changedAt = data.changed_at ?? '';
        this.changedBy = data.changed_by ?? '';
    }

    static fromApiFormat(data) {
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