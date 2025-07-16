
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
