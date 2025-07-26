import supabase from './DatabaseService';
import {Plant} from '../config/models/plants/Plant';

const PLANTS_TABLE = 'plants';
const PROFILES_TABLE = 'users_profiles';
const REGION_PLANTS_TABLE = 'region_plants';
const REGIONS_TABLE = 'regions';

class PlantServiceImpl {
    constructor() {
        this.allPlants = [];
    }

    async fetchAllPlants() {
        const {data, error} = await supabase
            .from(PLANTS_TABLE)
            .select('*')
            .order('plant_code');

        if (error) {
            console.error('Error fetching plants:', error);
            throw error;
        }

        this.allPlants = data ?? [];
        return data?.map(row => Plant.fromRow(row)) ?? [];
    }

    async createPlant(plantCode, plantName) {
        if (!plantCode?.trim() || !plantName?.trim()) throw new Error('Plant code and name are required');

        const now = new Date().toISOString();
        const plant = {
            plant_code: plantCode.trim(),
            plant_name: plantName.trim(),
            created_at: now,
            updated_at: now
        };

        const {error} = await supabase
            .from(PLANTS_TABLE)
            .insert(plant);

        if (error) {
            console.error('Error creating plant:', error);
            throw error;
        }

        await this.fetchAllPlants();
        return true;
    }

    async updatePlant(plantCode, plantName) {
        if (!plantCode?.trim() || !plantName?.trim()) throw new Error('Plant code and name are required');

        const {error} = await supabase
            .from(PLANTS_TABLE)
            .update({
                plant_name: plantName.trim(),
                updated_at: new Date().toISOString()
            })
            .eq('plant_code', plantCode);

        if (error) {
            console.error('Error updating plant:', error);
            throw error;
        }

        await this.fetchAllPlants();
        return true;
    }

    async deletePlant(plantCode) {
        if (!plantCode) throw new Error('Plant code is required');

        const [{error: profilesError}, {error}] = await Promise.all([
            supabase.from(PROFILES_TABLE).update({
                plant_code: '',
                updated_at: new Date().toISOString()
            }).eq('plant_code', plantCode),
            supabase.from(PLANTS_TABLE).delete().eq('plant_code', plantCode)
        ]);

        if (profilesError || error) {
            console.error('Error deleting plant:', profilesError || error);
            throw profilesError || error;
        }

        await this.fetchAllPlants();
        return true;
    }

    getPlantByCode(plantCode) {
        const plant = this.allPlants.find(plant => plant.plant_code === plantCode);
        return plant ? Plant.fromRow(plant) : null;
    }

    getPlantName(plantCode) {
        return this.getPlantByCode(plantCode)?.plant_name ?? plantCode;
    }

    async fetchPlants() {
        return this.fetchAllPlants();
    }

    async fetchPlantByCode(plantCode) {
        if (!plantCode) throw new Error('Plant code is required');

        const plant = this.getPlantByCode(plantCode);
        if (plant) return plant;

        const {data, error} = await supabase
            .from(PLANTS_TABLE)
            .select('*')
            .eq('plant_code', plantCode)
            .single();

        if (error) {
            console.error(`Error fetching plant ${plantCode}:`, error);
            throw error;
        }

        return data ? Plant.fromRow(data) : null;
    }

    async getPlantWithRegions(plantCode) {
        if (!plantCode) throw new Error('Plant code is required');

        const plant = await this.fetchPlantByCode(plantCode);
        if (!plant) return null;

        const {data: regionPlants, error: regionPlantsError} = await supabase
            .from(REGION_PLANTS_TABLE)
            .select('region_id')
            .eq('plant_code', plantCode);

        if (regionPlantsError) {
            console.error(`Error fetching regions for plant ${plantCode}:`, regionPlantsError);
            throw regionPlantsError;
        }

        const regions = regionPlants?.length
            ? await this._fetchRegions(regionPlants.map(rp => rp.region_id))
            : [];

        return {...plant, regions};
    }

    async _fetchRegions(regionIds) {
        const {data, error} = await supabase
            .from(REGIONS_TABLE)
            .select('*')
            .in('id', regionIds);

        if (error) {
            console.error('Error fetching regions:', error);
            throw error;
        }

        return data ?? [];
    }
}

export const PlantService = new PlantServiceImpl();