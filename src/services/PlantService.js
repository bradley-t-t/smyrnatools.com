import APIUtility from '../utils/APIUtility'
import {Plant} from '../config/models/plants/Plant'

const AUTH_FUNCTION = 'plant-service'

class PlantServiceImpl {
    allPlants = []

    async fetchAllPlants() {
        const {res, json} = await APIUtility.post(`/${AUTH_FUNCTION}/fetch-all`)
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch plants')
        const data = json?.data ?? []
        this.allPlants = data
        return data.map(row => Plant.fromRow(row))
    }

    async fetchPlants() {
        return this.fetchAllPlants()
    }

    async fetchPlantByCode(plantCode) {
        if (!plantCode) throw new Error('Plant code is required')
        const cached = this.getPlantByCode(plantCode)
        if (cached) return cached
        const {res, json} = await APIUtility.post(`/${AUTH_FUNCTION}/fetch-by-code`, {plantCode})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch plant')
        return json?.data ? Plant.fromRow(json.data) : null
    }

    async createPlant(plantCode, plantName) {
        if (!plantCode?.trim() || !plantName?.trim()) throw new Error('Plant code and name are required')
        const {res, json} = await APIUtility.post(`/${AUTH_FUNCTION}/create`, {plantCode, plantName})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to create plant')
        await this.fetchAllPlants()
        return true
    }

    async updatePlant(plantCode, plantName) {
        if (!plantCode?.trim() || !plantName?.trim()) throw new Error('Plant code and name are required')
        const {res, json} = await APIUtility.post(`/${AUTH_FUNCTION}/update`, {plantCode, plantName})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to update plant')
        await this.fetchAllPlants()
        return true
    }

    async deletePlant(plantCode) {
        if (!plantCode) throw new Error('Plant code is required')
        const {res, json} = await APIUtility.post(`/${AUTH_FUNCTION}/delete`, {plantCode})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete plant')
        await this.fetchAllPlants()
        return true
    }

    getPlantByCode(plantCode) {
        const plant = this.allPlants.find(p => p.plant_code === plantCode)
        return plant ? Plant.fromRow(plant) : null
    }

    getPlantName(plantCode) {
        return this.getPlantByCode(plantCode)?.plant_name ?? plantCode
    }

    async getPlantWithRegions(plantCode) {
        if (!plantCode) throw new Error('Plant code is required')
        const {res, json} = await APIUtility.post(`/${AUTH_FUNCTION}/get-with-regions`, {plantCode})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch plant with regions')
        const plantRow = json?.plant || null
        if (!plantRow) return null
        const plant = Plant.fromRow(plantRow)
        const regions = Array.isArray(json?.regions) ? json.regions : []
        return {...plant, regions}
    }
}

export const PlantService = new PlantServiceImpl()
