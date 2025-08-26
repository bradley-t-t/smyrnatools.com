import {TractorUtility} from '../../../utils/TractorUtility'
import {DateUtility} from '../../../utils/DateUtility'

export class Tractor {
    constructor(data = {}) {
        this.id = data.id ?? null
        this.truckNumber = data.truck_number ?? ''
        this.assignedPlant = data.assigned_plant ?? ''
        this.assignedOperator = data.assigned_operator ?? ''
        this.lastServiceDate = data.last_service_date ?? null
        this.cleanlinessRating = data.cleanliness_rating ?? 0
        this.status = data.status ?? 'Active'
        this.hasBlower = data.has_blower ?? false
        this.createdAt = data.created_at ?? new Date().toISOString()
        this.updatedAt = data.updated_at ?? new Date().toISOString()
        this.updatedLast = data.updated_last ?? new Date().toISOString()
        this.updatedBy = data.updated_by ?? null
        this.vin = data.vin ?? ''
        this.make = data.make ?? ''
        this.model = data.model ?? ''
        this.year = data.year ?? ''
        this.freight = data.freight ?? ''
        this.latestHistoryDate = data.latestHistoryDate ?? null
        this.openIssuesCount = data.openIssuesCount ?? 0
        this.commentsCount = data.commentsCount ?? 0
    }

    static fromApiFormat(data) {
        if (!data) return null
        return new Tractor(data)
    }

    static fromRow(row) {
        return this.fromApiFormat(row)
    }

    static ensureInstance(obj) {
        if (obj instanceof Tractor) return obj
        return Tractor.fromApiFormat(obj)
    }

    toApiFormat() {
        const apiObject = {
            truck_number: this.truckNumber,
            assigned_plant: this.assignedPlant,
            assigned_operator: this.assignedOperator || null,
            last_service_date: DateUtility.toDbTimestamp(this.lastServiceDate),
            cleanliness_rating: this.cleanlinessRating,
            status: this.status,
            has_blower: this.hasBlower,
            created_at: DateUtility.toDbTimestamp(this.createdAt) || DateUtility.nowDb(),
            updated_at: DateUtility.nowDb(),
            updated_last: DateUtility.toDbTimestamp(this.updatedLast),
            updated_by: this.updatedBy,
            vin: this.vin,
            make: this.make,
            model: this.model,
            year: this.year,
            freight: this.freight || null
        }

        if (this.id) apiObject.id = this.id
        return apiObject
    }

    toRow() {
        return this.toApiFormat()
    }

    getDaysSinceService() {
        if (!this.lastServiceDate) return null
        return Math.ceil((new Date() - new Date(this.lastServiceDate)) / 86400000)
    }

    getStatus() {
        return this.status || 'Unknown'
    }

    setStatus(newStatus) {
        if (!newStatus) return this
        this.status = newStatus
        if (['In Shop', 'Retired', 'Spare'].includes(newStatus)) {
            this.assignedOperator = null
        }
        return this
    }

    assignOperator(operatorId) {
        this.assignedOperator = operatorId || null
        if (this.assignedOperator && this.status !== 'Active') {
            this.status = 'Active'
        }
        return this
    }

    getFormattedServiceDate() {
        return this.lastServiceDate ? new Date(this.lastServiceDate).toLocaleDateString() : 'Not available'
    }

    isVerified(latestHistoryDate) {
        return TractorUtility.isVerified(
            this.updatedLast,
            this.updatedAt,
            this.updatedBy,
            latestHistoryDate
        )
    }
}