export class EquipmentComment {
    constructor(data = {}) {
        this.id = data.id ?? null;
        this.equipmentId = data.equipment_id ?? '';
        this.text = data.text ?? '';
        this.author = data.author ?? '';
        this.createdAt = typeof data.created_at === 'string' && !isNaN(Date.parse(data.created_at))
            ? data.created_at
            : new Date().toISOString();
    }

    static fromRow(row) {
        if (!row) return null;
        return new EquipmentComment(row);
    }

    toRow() {
        return {
            id: this.id,
            equipment_id: this.equipmentId,
            text: this.text,
            author: this.author,
            created_at: this.createdAt
        };
    }
}
