import {DateUtility} from '../../../utils/DateUtility'

export class PickupTruck {
    constructor(data = {}) {
        this.id = data.id ?? null
        this.vin = data.vin ?? ''
        this.make = data.make ?? ''
        this.model = data.model ?? ''
        this.year = data.year ?? ''
        this.assigned = data.assigned ?? ''
        this.assignedPlant = data.assigned_plant ?? ''
        this.status = data.status ?? 'Active'
        this.mileage = typeof data.mileage === 'number' ? data.mileage : (typeof data.mileage === 'string' && data.mileage.trim() !== '' ? Number(data.mileage) : 0)
        this.comments = data.comments ?? ''
        this.createdAt = data.created_at ?? new Date().toISOString()
        this.updatedAt = data.updated_at ?? new Date().toISOString()
        this.updatedLast = data.updated_last ?? null
        this.updatedBy = data.updated_by ?? null
    }

    static fromApiFormat(data) {
        if (!data) return null
        return new PickupTruck(data)
    }

    toApiFormat() {
        const apiObject = {
            vin: this.vin || null,
            make: this.make || null,
            model: this.model || null,
            year: this.year || null,
            assigned: this.assigned || null,
            assigned_plant: this.assignedPlant || null,
            status: this.status || null,
            mileage: typeof this.mileage === 'number' && this.mileage >= 0 ? this.mileage : null,
            comments: this.comments || null,
            created_at: DateUtility.toDbTimestamp(this.createdAt) || DateUtility.nowDb(),
            updated_at: DateUtility.nowDb(),
            updated_last: DateUtility.toDbTimestamp(this.updatedLast),
            updated_by: this.updatedBy || null
        }
        if (this.id) apiObject.id = this.id
        return apiObject
    }
}

export default PickupTruck
