export class EquipmentComment {
    constructor({
                    id,
                    equipmentId,
                    text,
                    author,
                    createdAt
                }) {
        this.id = id;
        this.equipmentId = equipmentId;
        this.text = text;
        this.author = author;
        this.createdAt = createdAt ? new Date(createdAt) : null;
    }

    static fromRow(data) {
        return new EquipmentComment({
            id: data.id,
            equipmentId: data.equipment_id,
            text: data.text,
            author: data.author,
            createdAt: data.created_at
        });
    }
}