export class Equipment {
    constructor(data = {}) {
        this.id = data.id ?? null
        this.identifyingNumber = data.identifying_number ?? data.identifyingNumber ?? data.truck_number ?? data.asset_number ?? data.equipment_number ?? data.number ?? ''
        this.assignedPlant = data.assigned_plant ?? data.assignedPlant ?? data.plant_code ?? data.plant ?? ''
        this.equipmentType = data.equipment_type ?? data.equipmentType ?? data.type ?? data.category ?? ''
        this.status = data.status ?? data.state ?? 'Active'
        this.lastServiceDate = data.last_service_date ?? data.lastServiceDate ?? data.service_date ?? null
        this.hoursMileage = data.hours_mileage ?? data.hoursMileage ?? data.hours ?? data.mileage ?? data.odometer ?? null
        this.cleanlinessRating = data.cleanliness_rating ?? data.cleanlinessRating ?? data.cleanliness ?? data.cleanliness_score ?? null
        this.conditionRating = data.condition_rating ?? data.conditionRating ?? data.condition ?? data.condition_score ?? null
        this.equipmentMake = data.equipment_make ?? data.equipmentMake ?? data.make ?? ''
        this.equipmentModel = data.equipment_model ?? data.equipmentModel ?? data.model ?? ''
        this.yearMade = data.year_made ?? data.yearMade ?? data.year ?? ''
        this.createdAt = data.created_at ?? data.createdAt ?? new Date().toISOString()
        this.updatedAt = data.updated_at ?? data.updatedAt ?? new Date().toISOString()
        this.updatedBy = data.updated_by ?? data.updatedBy ?? null
        this.latestHistoryDate = data.latestHistoryDate ?? null
        this.openIssuesCount = data.openIssuesCount ?? 0
        this.commentsCount = data.commentsCount ?? 0
        this.issues = data.issues ?? []
        this.comments = data.comments ?? []
        if (Object.keys(data).length) this.#heuristicFill(data)
    }

    static ensureInstance(obj) {
        return obj instanceof Equipment ? obj : new Equipment(obj || {})
    }

    #heuristicFill(data) {
        const lower = Object.keys(data).reduce((acc, k) => {
            acc[k.toLowerCase()] = k;
            return acc
        }, {})
        if (!this.identifyingNumber) {
            const key = Object.keys(lower).find(k => k.includes('ident') || (k.includes('equip') && k.includes('num')))
            if (key) this.identifyingNumber = data[lower[key]] || this.identifyingNumber
        }
        if (!this.lastServiceDate) {
            const key = Object.keys(lower).find(k => k.includes('service') && k.includes('date'))
            if (key) this.lastServiceDate = data[lower[key]] || this.lastServiceDate
        }
        if (this.hoursMileage == null) {
            const key = Object.keys(lower).find(k => (k.includes('hour') || k.includes('mile') || k.includes('odo')) && typeof data[lower[k]] !== 'object')
            if (key) this.hoursMileage = data[lower[key]]
        }
        if (this.cleanlinessRating == null) {
            const key = Object.keys(lower).find(k => k.includes('clean'))
            if (key) this.cleanlinessRating = Number(data[lower[key]]) || null
        }
        if (this.conditionRating == null) {
            const key = Object.keys(lower).find(k => k.includes('cond'))
            if (key) this.conditionRating = Number(data[lower[key]]) || null
        }
        if (!this.equipmentType) {
            const key = Object.keys(lower).find(k => k.includes('type'))
            if (key) this.equipmentType = data[lower[key]] || this.equipmentType
        }
    }

    getStatus() {
        return this.status || 'Unknown'
    }

    getFormattedServiceDate() {
        return this.lastServiceDate ? new Date(this.lastServiceDate).toLocaleDateString() : 'Not available'
    }
}