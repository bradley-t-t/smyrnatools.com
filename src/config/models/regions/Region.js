class Region {
    constructor({id, regionCode, regionName, createdAt, updatedAt}) {
        this.id = id
        this.regionCode = regionCode
        this.regionName = regionName
        this.createdAt = createdAt ? new Date(createdAt) : null
        this.updatedAt = updatedAt ? new Date(updatedAt) : null
    }

    static fromRow(row) {
        return new Region({
            id: row.id,
            regionCode: row.region_code,
            regionName: row.region_name,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        })
    }
}

export default Region
