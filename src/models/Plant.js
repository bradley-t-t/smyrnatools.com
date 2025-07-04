// Plant model that matches your Swift app's Plant model
export class Plant {
    constructor(data) {
        this.plantCode = data.plant_code;
        this.plantName = data.plant_name;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
    }

    // Convert database row to Plant object
    static fromRow(row) {
        return new Plant({
            plant_code: row.plant_code,
            plant_name: row.plant_name,
            created_at: row.created_at,
            updated_at: row.updated_at
        });
    }
}
