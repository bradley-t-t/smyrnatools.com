import supabase from './DatabaseService'
import Region from '../config/models/regions/Region'

const REGIONS_TABLE = 'regions'
const REGION_PLANTS_TABLE = 'regions_plants'

class RegionServiceImpl {
    allRegions = []

    async fetchRegions() {
        const {data, error} = await supabase
            .from(REGIONS_TABLE)
            .select('*')
            .order('region_code')
        if (error) throw error
        this.allRegions = data ?? []
        return data?.map(row => Region.fromRow(row)) ?? []
    }

    async fetchRegionByCode(regionCode) {
        if (!regionCode) throw new Error('Region code is required')
        const region = this.getRegionByCode(regionCode)
        if (region) return region
        const {data, error} = await supabase
            .from(REGIONS_TABLE)
            .select('*')
            .eq('region_code', regionCode)
            .single()
        if (error) throw error
        return data ? Region.fromRow(data) : null
    }

    getRegionByCode(regionCode) {
        const region = this.allRegions.find(r => r.region_code === regionCode)
        return region ? Region.fromRow(region) : null
    }

    getRegionName(regionCode) {
        return this.getRegionByCode(regionCode)?.region_name ?? regionCode
    }

    async createRegion(regionCode, regionName) {
        if (!regionCode?.trim() || !regionName?.trim()) throw new Error('Region code and name are required')
        const now = new Date().toISOString()
        const region = {
            region_code: regionCode.trim(),
            region_name: regionName.trim(),
            created_at: now,
            updated_at: now
        }
        const {error} = await supabase
            .from(REGIONS_TABLE)
            .insert(region)
        if (error) throw error
        await this.fetchRegions()
        return true
    }

    async updateRegion(regionCode, regionName, plantCodes = []) {
        if (!regionCode?.trim() || !regionName?.trim()) throw new Error('Region code and name are required')
        const {data: regionData, error: regionError} = await supabase
            .from(REGIONS_TABLE)
            .select('id')
            .eq('region_code', regionCode)
            .single()
        if (regionError || !regionData) throw regionError || new Error('Region not found')
        const regionId = regionData.id
        const {error: updateError} = await supabase
            .from(REGIONS_TABLE)
            .update({
                region_name: regionName.trim(),
                updated_at: new Date().toISOString()
            })
            .eq('region_code', regionCode)
        if (updateError) throw updateError
        const {error: deleteError} = await supabase
            .from(REGION_PLANTS_TABLE)
            .delete()
            .eq('region_id', regionId)
        if (deleteError) throw deleteError
        if (plantCodes.length > 0) {
            const regionPlants = plantCodes.map(plantCode => ({
                region_id: regionId,
                plant_code: plantCode.trim(),
                created_at: new Date().toISOString()
            }))
            const {error: insertError} = await supabase
                .from(REGION_PLANTS_TABLE)
                .insert(regionPlants)
            if (insertError) throw insertError
        }
        await this.fetchRegions()
        return true
    }

    async deleteRegion(regionCode) {
        if (!regionCode) throw new Error('Region code is required')
        const {data: regionData, error: regionError} = await supabase
            .from(REGIONS_TABLE)
            .select('id')
            .eq('region_code', regionCode)
            .single()
        if (regionError || !regionData) throw regionError || new Error('Region not found')
        const regionId = regionData.id
        const {error: deletePlantsError} = await supabase
            .from(REGION_PLANTS_TABLE)
            .delete()
            .eq('region_id', regionId)
        if (deletePlantsError) throw deletePlantsError
        const {error: deleteRegionError} = await supabase
            .from(REGIONS_TABLE)
            .delete()
            .eq('region_code', regionCode)
        if (deleteRegionError) throw deleteRegionError
        await this.fetchRegions()
        return true
    }

    async fetchRegionPlants(regionCode) {
        if (!regionCode) throw new Error('Region code is required')
        const {data: regionData, error: regionError} = await supabase
            .from(REGIONS_TABLE)
            .select('id')
            .eq('region_code', regionCode)
            .single()
        if (regionError || !regionData) throw regionError || new Error('Region not found')
        const regionId = regionData.id
        const {data, error} = await supabase
            .from(REGION_PLANTS_TABLE)
            .select('plant_code, plants!inner(plant_code, plant_name)')
            .eq('region_id', regionId)
        if (error) throw error
        return data?.map(row => ({
            plantCode: row.plants.plant_code,
            plantName: row.plants.plant_name
        })) ?? []
    }

    async getRegionWithPlants(regionCode) {
        if (!regionCode) throw new Error('Region code is required')
        const region = await this.fetchRegionByCode(regionCode)
        if (!region) return null
        const plants = await this.fetchRegionPlants(regionCode)
        return {...region, plants}
    }
}

export const RegionService = new RegionServiceImpl()
