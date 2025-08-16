import supabase from './DatabaseService';
import Region from "../config/models/regions/Region";

const REGIONS_TABLE = 'regions';
const REGION_PLANTS_TABLE = 'regions_plants';
const PLANTS_TABLE = 'plants';

class RegionServiceImpl {
    constructor() {
        this.allRegions = [];
    }

    // Fetch all regions
    async fetchRegions() {
        const { data, error } = await supabase
            .from(REGIONS_TABLE)
            .select('*')
            .order('region_code');

        if (error) {
            console.error('Error fetching regions:', error);
            throw error;
        }

        this.allRegions = data ?? [];
        return data?.map(row => Region.fromRow(row)) ?? [];
    }

    // Create a new region
    async createRegion(regionCode, regionName) {
        if (!regionCode?.trim() || !regionName?.trim()) throw new Error('Region code and name are required');

        const now = new Date().toISOString();
        const region = {
            region_code: regionCode.trim(),
            region_name: regionName.trim(),
            created_at: now,
            updated_at: now
        };

        const { error } = await supabase
            .from(REGIONS_TABLE)
            .insert(region);

        if (error) {
            console.error('Error creating region:', error);
            throw error;
        }

        await this.fetchRegions();
        return true;
    }

    // Update a region's name and associated plants
    async updateRegion(regionCode, regionName, plantCodes = []) {
        if (!regionCode?.trim() || !regionName?.trim()) throw new Error('Region code and name are required');

        const client = await supabase.connect();
        try {
            await client.query('BEGIN');

            // Update region name
            const { error: updateError } = await supabase
                .from(REGIONS_TABLE)
                .update({
                    region_name: regionName.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('region_code', regionCode);

            if (updateError) {
                console.error('Error updating region:', updateError);
                throw updateError;
            }

            // Get region ID
            const { data: regionData, error: regionError } = await supabase
                .from(REGIONS_TABLE)
                .select('id')
                .eq('region_code', regionCode)
                .single();

            if (regionError || !regionData) {
                console.error('Error fetching region ID:', regionError);
                throw regionError || new Error('Region not found');
            }

            const regionId = regionData.id;

            // Delete existing plant associations
            const { error: deleteError } = await supabase
                .from(REGION_PLANTS_TABLE)
                .delete()
                .eq('region_id', regionId);

            if (deleteError) {
                console.error('Error deleting region plants:', deleteError);
                throw deleteError;
            }

            // Insert new plant associations
            if (plantCodes.length > 0) {
                const regionPlants = plantCodes.map(plantCode => ({
                    region_id: regionId,
                    plant_code: plantCode.trim(),
                    created_at: new Date().toISOString()
                }));

                const { error: insertError } = await supabase
                    .from(REGION_PLANTS_TABLE)
                    .insert(regionPlants);

                if (insertError) {
                    console.error('Error inserting region plants:', insertError);
                    throw insertError;
                }
            }

            await client.query('COMMIT');
            await this.fetchRegions();
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error in updateRegion transaction:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Delete a region
    async deleteRegion(regionCode) {
        if (!regionCode) throw new Error('Region code is required');

        const client = await supabase.connect();
        try {
            await client.query('BEGIN');

            // Get region ID
            const { data: regionData, error: regionError } = await supabase
                .from(REGIONS_TABLE)
                .select('id')
                .eq('region_code', regionCode)
                .single();

            if (regionError || !regionData) {
                console.error('Error fetching region ID:', regionError);
                throw regionError || new Error('Region not found');
            }

            const regionId = regionData.id;

            // Delete plant associations
            const { error: deletePlantsError } = await supabase
                .from(REGION_PLANTS_TABLE)
                .delete()
                .eq('region_id', regionId);

            if (deletePlantsError) {
                console.error('Error deleting region plants:', deletePlantsError);
                throw deletePlantsError;
            }

            // Delete region
            const { error: deleteRegionError } = await supabase
                .from(REGIONS_TABLE)
                .delete()
                .eq('region_code', regionCode);

            if (deleteRegionError) {
                console.error('Error deleting region:', deleteRegionError);
                throw deleteRegionError;
            }

            await client.query('COMMIT');
            await this.fetchRegions();
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error in deleteRegion transaction:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Fetch plants associated with a region
    async fetchRegionPlants(regionCode) {
        if (!regionCode) throw new Error('Region code is required');

        const { data: regionData, error: regionError } = await supabase
            .from(REGIONS_TABLE)
            .select('id')
            .eq('region_code', regionCode)
            .single();

        if (regionError || !regionData) {
            console.error(`Error fetching region ${regionCode}:`, regionError);
            throw regionError || new Error('Region not found');
        }

        const regionId = regionData.id;

        const { data, error } = await supabase
            .from(REGION_PLANTS_TABLE)
            .select('plant_code, plants!inner(plant_code, plant_name)')
            .eq('region_id', regionId);

        if (error) {
            console.error(`Error fetching plants for region ${regionCode}:`, error);
            throw error;
        }

        return data?.map(row => ({
            plantCode: row.plants.plant_code,
            plantName: row.plants.plant_name
        })) ?? [];
    }

    // Get region by code
    getRegionByCode(regionCode) {
        const region = this.allRegions.find(region => region.region_code === regionCode);
        return region ? Region.fromRow(region) : null;
    }

    // Get region name by code
    getRegionName(regionCode) {
        return this.getRegionByCode(regionCode)?.region_name ?? regionCode;
    }

    // Fetch region by code
    async fetchRegionByCode(regionCode) {
        if (!regionCode) throw new Error('Region code is required');

        const region = this.getRegionByCode(regionCode);
        if (region) return region;

        const { data, error } = await supabase
            .from(REGIONS_TABLE)
            .select('*')
            .eq('region_code', regionCode)
            .single();

        if (error) {
            console.error(`Error fetching region ${regionCode}:`, error);
            throw error;
        }

        return data ? Region.fromRow(data) : null;
    }

    // Fetch regions with their associated plants
    async getRegionWithPlants(regionCode) {
        if (!regionCode) throw new Error('Region code is required');

        const region = await this.fetchRegionByCode(regionCode);
        if (!region) return null;

        const plants = await this.fetchRegionPlants(regionCode);
        return { ...region, plants };
    }
}

export const RegionService = new RegionServiceImpl();