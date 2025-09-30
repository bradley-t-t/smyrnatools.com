import MixerUtility from '../../../utils/MixerUtility'
import {DateUtility} from '../../../utils/DateUtility'

export class Mixer {
    constructor(data = {}) {
        this.id = data.id ?? null
        this.truckNumber = data.truck_number ?? ''
        this.assignedPlant = data.assigned_plant ?? ''
        this.assignedOperator = data.assigned_operator ?? ''
        this.lastServiceDate = data.last_service_date ?? null
        this.lastChipDate = data.last_chip_date ?? null
        this.cleanlinessRating = data.cleanliness_rating ?? 0
        this.status = data.status ?? 'Active'
        this.createdAt = data.created_at ?? new Date().toISOString()
        this.updatedAt = data.updated_at ?? new Date().toISOString()
        this.updatedLast = data.updated_last ?? new Date().toISOString()
        this.updatedBy = data.updated_by ?? null
        this.vin = (data.vin ?? '').toUpperCase()
        this.make = data.make ?? ''
        this.model = data.model ?? ''
        this.year = data.year ?? ''
        this.latestHistoryDate = data.latestHistoryDate ?? null
        this.openIssuesCount = data.openIssuesCount ?? 0
        this.commentsCount = data.commentsCount ?? 0
    }

    static fromApiFormat(data) {
        if (!data) return null;
        return new Mixer(data);
    }

    static fromRow(row) {
        return this.fromApiFormat(row);
    }

    static ensureInstance(obj) {
        if (obj instanceof Mixer) return obj;
        return Mixer.fromApiFormat(obj);
    }

    toApiFormat() {
        const apiObject = {
            truck_number: this.truckNumber,
            assigned_plant: this.assignedPlant,
            assigned_operator: this.assignedOperator || null,
            last_service_date: DateUtility.toDbTimestamp(this.lastServiceDate),
            last_chip_date: DateUtility.toDbTimestamp(this.lastChipDate),
            cleanliness_rating: this.cleanlinessRating,
            status: this.status,
            created_at: DateUtility.toDbTimestamp(this.createdAt) || DateUtility.nowDb(),
            updated_at: DateUtility.toDbTimestamp(this.updatedAt) || DateUtility.nowDb(),
            updated_last: DateUtility.toDbTimestamp(this.updatedLast),
            updated_by: this.updatedBy,
            vin: (this.vin || '').toUpperCase(),
            make: this.make,
            model: this.model,
            year: this.year
        };

        if (this.id) apiObject.id = this.id;
        return apiObject;
    }

    toRow() {
        return this.toApiFormat();
    }

    getDaysSinceService() {
        if (!this.lastServiceDate) return null;
        return Math.ceil((new Date() - new Date(this.lastServiceDate)) / 86400000);
    }

    getDaysSinceChip() {
        if (!this.lastChipDate) return null;
        return Math.ceil((new Date() - new Date(this.lastChipDate)) / 86400000);
    }

    getStatus() {
        return this.status || 'Unknown';
    }

    setStatus(newStatus) {
        if (!newStatus) return this;
        this.status = newStatus;
        if (['In Shop', 'Retired', 'Spare'].includes(newStatus)) {
            this.assignedOperator = null;
        }
        return this;
    }

    assignOperator(operatorId) {
        this.assignedOperator = operatorId || null;
        if (this.assignedOperator && this.status !== 'Active') {
            this.status = 'Active';
        }
        return this;
    }

    getFormattedServiceDate() {
        return this.lastServiceDate ? new Date(this.lastServiceDate).toLocaleDateString() : 'Not available';
    }

    getFormattedChipDate() {
        return this.lastChipDate ? new Date(this.lastChipDate).toLocaleDateString() : 'Not available';
    }

    isVerified(latestHistoryDate) {
        return MixerUtility.isVerified(
            this.updatedLast,
            this.updatedAt,
            this.updatedBy,
            latestHistoryDate
        );
    }

    verify(userId) {
        const now = new Date().toISOString();
        this.updatedLast = now;
        this.updatedBy = userId;
        return this;
    }
}