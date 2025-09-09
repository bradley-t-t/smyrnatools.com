import APIUtility from '../utils/APIUtility'
import PickupTruck from '../config/models/pickup-trucks/PickupTruck'
import {UserService} from './UserService'
import {ValidationUtility} from '../utils/ValidationUtility'

class PickupTruckServiceImpl {
    static async getAll() {
        const {res, json} = await APIUtility.post('/pickup-truck-service/fetch-all')
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch pickup trucks')
        const data = json?.data ?? []
        return data.map(PickupTruck.fromApiFormat)
    }

    static async fetchAll() {
        return this.getAll()
    }

    static async getById(id) {
        ValidationUtility.requireUUID(id, 'Pickup Truck ID is required')
        const {res, json} = await APIUtility.post('/pickup-truck-service/fetch-by-id', {id})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch pickup truck')
        const data = json?.data
        if (!data) return null
        return PickupTruck.fromApiFormat(data)
    }

    static async create(pickup, userId) {
        if (!userId) {
            const user = await UserService.getCurrentUser()
            userId = typeof user === 'object' && user !== null ? user.id : user
            if (!userId) throw new Error('Authentication required')
        }
        if (pickup && pickup.id) delete pickup.id
        const {res, json} = await APIUtility.post('/pickup-truck-service/create', {userId, pickup})
        if (!res.ok) throw new Error(json?.error || 'Failed to create pickup truck')
        return PickupTruck.fromApiFormat(json?.data)
    }

    static async update(id, pickup, userId) {
        const pickupId = typeof id === 'object' ? id.id : id
        ValidationUtility.requireUUID(pickupId, 'Pickup Truck ID is required')
        if (!userId) {
            const user = await UserService.getCurrentUser()
            userId = typeof user === 'object' && user !== null ? user.id : user
        }
        if (!userId) throw new Error('User ID is required')
        const {res, json} = await APIUtility.post('/pickup-truck-service/update', {id: pickupId, pickup, userId})
        if (!res.ok) throw new Error(json?.error || 'Failed to update pickup truck')
        return PickupTruck.fromApiFormat(json?.data)
    }

    static async remove(id) {
        ValidationUtility.requireUUID(id, 'Pickup Truck ID is required')
        const {res, json} = await APIUtility.post('/pickup-truck-service/delete', {id})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete pickup truck')
        return true
    }

    static async searchByVin(query) {
        if (!query?.trim()) throw new Error('Search query is required')
        const {res, json} = await APIUtility.post('/pickup-truck-service/search-by-vin', {query: query.trim()})
        if (!res.ok) throw new Error(json?.error || 'Failed to search pickup trucks by VIN')
        return (json?.data ?? []).map(PickupTruck.fromApiFormat)
    }

    static async searchByAssigned(query) {
        if (!query?.trim()) throw new Error('Search query is required')
        const {res, json} = await APIUtility.post('/pickup-truck-service/search-by-assigned', {query: query.trim()})
        if (!res.ok) throw new Error(json?.error || 'Failed to search pickup trucks by assignee')
        return (json?.data ?? []).map(PickupTruck.fromApiFormat)
    }

    static async verify(pickupId, userId) {
        const id = typeof pickupId === 'object' ? pickupId.id : pickupId
        ValidationUtility.requireUUID(id, 'Pickup Truck ID is required')
        if (!userId) {
            const user = await UserService.getCurrentUser()
            userId = typeof user === 'object' && user !== null ? user.id : user
        }
        if (!userId) throw new Error('User ID is required')
        const payload = {id, pickup: {updatedLast: new Date().toISOString()}, userId}
        const {res, json} = await APIUtility.post('/pickup-truck-service/update', payload)
        if (!res.ok) throw new Error(json?.error || 'Failed to verify pickup truck')
        return PickupTruck.fromApiFormat(json?.data)
    }
}

export const PickupTruckService = PickupTruckServiceImpl
export default PickupTruckServiceImpl

