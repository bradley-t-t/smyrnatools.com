import { MixerUtility } from '../../utils/MixerUtility';

export class Mixer {
    constructor(data = {}) {
        this.id = data.id ?? null;
        this.truckNumber = data.truck_number ?? '';
        this.assignedPlant = data.assigned_plant ?? '';
        this.assignedOperator = data.assigned_operator ?? '';
        this.lastServiceDate = data.last_service_date ?? null;
        this.lastChipDate = data.last_chip_date ?? null;
        this.cleanlinessRating = data.cleanliness_rating ?? 0;
        this.status = data.status ?? 'Active';
        this.createdAt = data.created_at ?? new Date().toISOString();
        this.updatedAt = data.updated_at ?? new Date().toISOString();
        this.updatedLast = data.updated_last ?? new Date().toISOString();
        this.updatedBy = data.updated_by ?? null;
        this.vin = data.vin ?? '';
        this.make = data.make ?? '';
        this.model = data.model ?? '';
        this.year = data.year ?? '';
    }

    static fromApiFormat(data) {
        if (!data) return null;
        return new Mixer(data);
    }

    static fromRow(row) {
        return this.fromApiFormat(row);
    }

    toApiFormat() {
        const formatDateForDb = date => {
            if (!date) return null;
            const d = new Date(date);
            if (isNaN(d.getTime())) return null;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const seconds = String(d.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+00`;
        };

        const apiObject = {
            truck_number: this.truckNumber,
            assigned_plant: this.assignedPlant,
            assigned_operator: this.assignedOperator || null,
            last_service_date: formatDateForDb(this.lastServiceDate),
            last_chip_date: formatDateForDb(this.lastChipDate),
            cleanliness_rating: this.cleanlinessRating,
            status: this.status,
            created_at: formatDateForDb(this.createdAt) || formatDateForDb(new Date()),
            updated_at: formatDateForDb(new Date()),
            updated_last: formatDateForDb(this.updatedLast),
            updated_by: this.updatedBy,
            vin: this.vin,
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
        return Math.ceil((new Date() - new Date(this.lastServiceDate)) / (1000 * 60 * 60 * 24));
    }

    getDaysSinceChip() {
        if (!this.lastChipDate) return null;
        return Math.ceil((new Date() - new Date(this.lastChipDate)) / (1000 * 60 * 60 * 24));
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
        try {
            return MixerUtility.isVerified(this.updatedLast, this.updatedAt, this.updatedBy, latestHistoryDate);
        } catch (error) {
            if (!this.updatedLast || !this.updatedBy) return false;

            const lastVerified = new Date(this.updatedLast);
            const today = new Date();
            const hasSunday = () => {
                const current = new Date(lastVerified);
                current.setDate(current.getDate() + 1);
                while (current <= today) {
                    if (current.getDay() === 0) return true;
                    current.setDate(current.getDate() + 1);
                }
                return false;
            };

            if (hasSunday()) return false;
            if (latestHistoryDate && new Date(latestHistoryDate) > lastVerified) return false;
            return true;
        }
    }
}