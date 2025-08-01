export class EquipmentHistory {
    constructor({
                    id,
                    equipmentId,
                    fieldName,
                    oldValue,
                    newValue,
                    changedAt,
                    changedBy
                }) {
        this.id = id;
        this.equipmentId = equipmentId;
        this.fieldName = fieldName;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.changedAt = changedAt ? new Date(changedAt) : null;
        this.changedBy = changedBy;
    }

    static fromApiFormat(data) {
        return new EquipmentHistory({
            id: data.id,
            equipmentId: data.equipment_id,
            fieldName: data.field_name,
            oldValue: data.old_value,
            newValue: data.new_value,
            changedAt: data.changed_at,
            changedBy: data.changed_by
        });
    }
}