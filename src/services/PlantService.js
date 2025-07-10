import supabase from '../core/clients/SupabaseClient';
import {Plant} from '../models/Plant';

class PlantServiceImpl {
    constructor() {
        this.allPlants = [];
    }

    /**
     * Fetch all plants
     */
    async fetchAllPlants() {
        try {
            // Check for cached plants first
            const cachedData = localStorage.getItem('cachedPlants');

            if (cachedData) {
                const {plants, timestamp} = JSON.parse(cachedData);
                const cacheAge = Date.now() - timestamp;

                // Use cache if it's less than 1 hour old
                if (plants && plants.length > 0 && cacheAge < 3600000) {
                    console.log(`[PlantService] Using ${plants.length} cached plants`);
                    this.allPlants = plants;
                    return plants;
                }
            }

            // Fetch from database
            const {data: plants, error} = await supabase
                .from('plants')
                .select();

            if (error) throw error;

            // Update cache
            localStorage.setItem('cachedPlants', JSON.stringify({
                plants: plants || [],
                timestamp: Date.now()
            }));

            console.log(`[PlantService] Fetched ${plants?.length || 0} plants`);
            this.allPlants = plants || [];
            return plants || [];
        } catch (error) {
            console.error('Fetch plants error:', error);

            // Try to use cache as fallback if available
            const cachedData = localStorage.getItem('cachedPlants');
            if (cachedData) {
                const {plants} = JSON.parse(cachedData);
                if (plants && plants.length > 0) {
                    console.log(`[PlantService] Using ${plants.length} cached plants as fallback`);
                    this.allPlants = plants;
                    return plants;
                }
            }

            throw error;
        }
    }

    /**
     * Create a new plant
     */
    async createPlant(plantCode, plantName) {
        try {
            const now = new Date().toISOString();

            const plant = {
                plant_code: plantCode,
                plant_name: plantName,
                created_at: now,
                updated_at: now
            };

            const {error} = await supabase
                .from('plants')
                .insert(plant);

            if (error) throw error;

            // Invalidate cache
            localStorage.removeItem('cachedPlants');

            // Refresh plants
            await this.fetchAllPlants();

            return true;
        } catch (error) {
            console.error('Create plant error:', error);
            throw error;
        }
    }

    /**
     * Update a plant
     */
    async updatePlant(plantCode, plantName) {
        try {
            const {error} = await supabase
                .from('plants')
                .update({
                    plant_name: plantName,
                    updated_at: new Date().toISOString()
                })
                .eq('plant_code', plantCode);

            if (error) throw error;

            // Invalidate cache
            localStorage.removeItem('cachedPlants');

            // Refresh plants
            await this.fetchAllPlants();

            return true;
        } catch (error) {
            console.error('Update plant error:', error);
            throw error;
        }
    }

    /**
     * Delete a plant
     */
    async deletePlant(plantCode) {
        try {
            // Delete todos with this plant code
            const {error: todosError} = await supabase
                .from('todos')
                .delete()
                .eq('plant_code', plantCode);

            if (todosError) throw todosError;

            // Update profiles to remove this plant code
            const {error: profilesError} = await supabase
                .from('profiles')
                .update({
                    plant_code: '',
                    updated_at: new Date().toISOString()
                })
                .eq('plant_code', plantCode);

            if (profilesError) throw profilesError;

            // Delete the plant
            const {error} = await supabase
                .from('plants')
                .delete()
                .eq('plant_code', plantCode);

            if (error) throw error;

            // Invalidate cache
            localStorage.removeItem('cachedPlants');

            // Refresh plants
            await this.fetchAllPlants();

            return true;
        } catch (error) {
            console.error('Delete plant error:', error);
            throw error;
        }
    }

    /**
     * Get plant by code
     */
    getPlantByCode(plantCode) {
        return this.allPlants.find(plant => plant.plant_code === plantCode);
    }

    /**
     * Get plant name by code
     */
    getPlantName(plantCode) {
        const plant = this.getPlantByCode(plantCode);
        return plant ? plant.plant_name : plantCode;
    }
}

// Create singleton instance
const singleton = new PlantServiceImpl();

// Add fetchPlants method for compatibility with existing code
singleton.fetchPlants = async function (options = {}) {
    try {
        const data = await this.fetchAllPlants();
        return data ? data.map(row => Plant.fromRow({
            plant_code: row.plant_code,
            plant_name: row.plant_name,
            created_at: row.created_at,
            updated_at: row.updated_at
        })) : [];
    } catch (error) {
        console.error('Error in fetchPlants:', error);
        throw error;
    }
};

export const PlantService = singleton;

// Add fetchPlantByCode method for compatibility
singleton.fetchPlantByCode = async function (plantCode) {
    try {
        const plant = this.getPlantByCode(plantCode);
        if (plant) {
            return Plant.fromRow({
                plant_code: plant.plant_code,
                plant_name: plant.plant_name,
                created_at: plant.created_at,
                updated_at: plant.updated_at
            });
        }

        // If not in cached plants, fetch directly
        const {data, error} = await supabase
            .from('plants')
            .select('*')
            .eq('plant_code', plantCode)
            .single();

        if (error) throw error;
        return data ? Plant.fromRow(data) : null;
    } catch (error) {
        console.error(`Error fetching plant with code ${plantCode}:`, error);
        throw error;
    }
};

// Add getPlantWithRegions method for compatibility
singleton.getPlantWithRegions = async function (plantCode) {
    try {
        // First, get the plant
        const plant = await this.fetchPlantByCode(plantCode);
        if (!plant) return null;

        // Then, get the regions associated with this plant
        const {data: regionPlants, error: regionPlantsError} = await supabase
            .from('region_plants')
            .select('*')
            .eq('plant_code', plantCode);

        if (regionPlantsError) throw regionPlantsError;

        // If we have associated regions, get the region details
        if (regionPlants && regionPlants.length > 0) {
            const regionIds = regionPlants.map(rp => rp.region_id);

            const {data: regions, error: regionsError} = await supabase
                .from('regions')
                .select('*')
                .in('id', regionIds);

            if (regionsError) throw regionsError;

            return {
                ...plant,
                regions: regions || []
            };
        }

        return {
            ...plant,
            regions: []
        };
    } catch (error) {
        console.error(`Error fetching plant with regions for code ${plantCode}:`, error);
        throw error;
    }
};
