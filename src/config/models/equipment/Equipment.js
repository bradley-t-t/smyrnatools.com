export class Equipment {
    constructor({
                    id,
                    identifyingNumber,
                    assignedPlant,
                    equipmentType,
                    status,
                    lastServiceDate,
                    hoursMileage,
                    cleanlinessRating,
                    conditionRating,
                    equipmentMake,
                    equipmentModel,
                    yearMade,
                    createdAt,
                    updatedAt,
                    updatedBy,
                    issues = []
                }) {
        this.id = id;
        this.identifyingNumber = identifyingNumber;
        this.assignedPlant = assignedPlant;
        this.equipmentType = equipmentType;
        this.status = status;
        this.lastServiceDate = lastServiceDate ? new Date(lastServiceDate) : null;
        this.hoursMileage = hoursMileage;
        this.cleanlinessRating = cleanlinessRating;
        this.conditionRating = conditionRating;
        this.equipmentMake = equipmentMake;
        this.equipmentModel = equipmentModel;
        this.yearMade = yearMade;
        this.createdAt = createdAt ? new Date(createdAt) : null;
        this.updatedAt = updatedAt ? new Date(updatedAt) : null;
        this.updatedBy = updatedBy;
        this.issues = issues;
    }

    static fromApiFormat(data) {
        return new Equipment({
            id: data.id,
            identifyingNumber: data.identifying_number,
            assignedPlant: data.assigned_plant,
            equipmentType: data.equipment_type,
            status: data.status,
            lastServiceDate: data.last_service_date,
            hoursMileage: data.hours_mileage,
            cleanlinessRating: data.cleanliness_rating,
            conditionRating: data.condition_rating,
            equipmentMake: data.equipment_make,
            equipmentModel: data.equipment_model,
            yearMade: data.year_made,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            updatedBy: data.updated_by,
            issues: data.issues || []
        });
    }
}