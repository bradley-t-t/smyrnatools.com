/**
 * Data models for the application
 */

// User Model
export class User {
    constructor(data = {}) {
        this.id = data.id || '';
        this.email = data.email || '';
        this.passwordHash = data.password_hash || '';
        this.salt = data.salt || '';
        this.createdAt = data.created_at || '';
        this.updatedAt = data.updated_at || '';
    }
}

// Profile Model
export class Profile {
    constructor(data = {}) {
        this.id = data.id || '';
        this.firstName = data.first_name || '';
        this.lastName = data.last_name || '';
        this.plantCode = data.plant_code || '';
        this.createdAt = data.created_at || '';
        this.updatedAt = data.updated_at || '';
    }

    // Get full name
    get fullName() {
        return `${this.firstName} ${this.lastName}`.trim();
    }
}

// User Role Model
export class UserRole {
    constructor(data = {}) {
        this.userId = data.user_id || '';
        this.roleName = data.role_name || 'Guest';
        this.createdAt = data.created_at || '';
        this.updatedAt = data.updated_at || '';
    }
}

// Plant Model
export class Plant {
    constructor(data = {}) {
        this.plantCode = data.plant_code || '';
        this.plantName = data.plant_name || '';
        this.createdAt = data.created_at || '';
        this.updatedAt = data.updated_at || '';
    }
}

// List Item (Todo) Model
export class ListItem {
    constructor(data = {}) {
        this.id = data.id || '';
        this.userId = data.user_id || '';
        this.plantCode = data.plant_code || '';
        this.description = data.description || '';
        this.deadline = data.deadline || '';
        this.comments = data.comments || '';
        this.createdAt = data.created_at || '';
        this.completed = data.completed || false;
        this.completedAt = data.completed_at || null;
        this.completedBy = data.completed_by || null;
    }

    // Get formatted deadline date
    get formattedDeadline() {
        if (!this.deadline) return '';
        return new Date(this.deadline).toLocaleDateString();
    }

    // Check if deadline is in the past
    get isOverdue() {
        if (!this.deadline || this.completed) return false;
        return new Date(this.deadline) < new Date();
    }

    // Get days remaining until deadline
    get daysRemaining() {
        if (!this.deadline) return null;
        const today = new Date();
        const deadlineDate = new Date(this.deadline);
        const diffTime = deadlineDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
}

// Operator Model
export class Operator {
    constructor(data = {}) {
        this.id = data.id || '';
        this.firstName = data.first_name || '';
        this.lastName = data.last_name || '';
        this.phoneNumber = data.phone_number || '';
        this.employeeId = data.employee_id || '';
        this.plantCode = data.plant_code || '';
        this.status = data.status || 'available';
        this.createdAt = data.created_at || '';
        this.updatedAt = data.updated_at || '';
    }

    // Get full name
    get fullName() {
        return `${this.firstName} ${this.lastName}`.trim();
    }
}

// Mixer Model
// DataModels.js - Model classes for application data
// Note: The Mixer class is now imported from '../../models/mixers/Mixer'

// Tractor Model
export class Tractor {
    constructor(data = {}) {
        this.id = data.id || '';
        this.truckNumber = data.truck_number || '';
        this.assignedPlant = data.assigned_plant || '';
        this.assignedOperator = data.assigned_operator || '';
        this.cleanlinessRating = data.cleanliness_rating || 0;
        this.status = data.status || 'available';
        this.hasBlower = data.has_blower || false;
        this.lastServiceDate = data.last_service_date || '';
        this.createdAt = data.created_at || '';
        this.updatedAt = data.updated_at || '';
        this.updatedLast = data.updated_last || '';
        this.updatedBy = data.updated_by || '';
    }

    // Get days since last service
    get daysSinceService() {
        if (!this.lastServiceDate) return null;
        const today = new Date();
        const serviceDate = new Date(this.lastServiceDate);
        const diffTime = today - serviceDate;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
}

// Message Model
export class Message {
    constructor(data = {}) {
        this.id = data.id || '';
        this.senderId = data.sender_id || '';
        this.recipientId = data.recipient_id || '';
        this.content = data.content || '';
        this.attachments = data.attachments || null;
        this.createdAt = data.created_at || '';
        this.updatedAt = data.updated_at || '';
    }

    // Get formatted date
    get formattedDate() {
        if (!this.createdAt) return '';
        return new Date(this.createdAt).toLocaleString();
    }
}

// Mixer Maintenance Model
export class MixerMaintenance {
    constructor(data = {}) {
        this.id = data.id || '';
        this.mixerId = data.mixer_id || '';
        this.issue = data.issue || '';
        this.severity = data.severity || 'Low';
        this.timeCreated = data.time_created || '';
        this.timeCompleted = data.time_completed || null;
    }

    // Get formatted creation date
    get formattedTimeCreated() {
        if (!this.timeCreated) return '';
        return new Date(this.timeCreated).toLocaleString();
    }

    // Get formatted completion date
    get formattedTimeCompleted() {
        if (!this.timeCompleted) return '';
        return new Date(this.timeCompleted).toLocaleString();
    }

    // Check if maintenance issue is completed
    get isCompleted() {
        return !!this.timeCompleted;
    }
}
