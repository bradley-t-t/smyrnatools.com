import APIUtility from '../utils/APIUtility'
import {UserService} from './UserService'

class ListServiceImpl {
    listItems = []
    creatorProfiles = {}
    plants = []
    plantDistribution = {}

    async fetchListItems() {
        const user = await UserService.getCurrentUser()
        if (!user) throw new Error('No authenticated user')
        const {res, json} = await APIUtility.post('/list-service/fetch-items')
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch list items')
        this.listItems = json?.data ?? []
        await this.fetchCreatorProfiles(this.listItems)
        return this.listItems
    }

    async fetchPlants() {
        const {res, json} = await APIUtility.post('/list-service/fetch-plants')
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch plants')
        this.plants = json?.data ?? []
        return this.plants
    }

    async fetchCreatorProfiles(listItems) {
        const userIds = [...new Set(listItems.map(item => item.user_id).filter(id => id))]
        const newProfiles = {...this.creatorProfiles}
        if (userIds.length === 0) {
            this.creatorProfiles = newProfiles
            return this.creatorProfiles
        }
        const {res, json} = await APIUtility.post('/list-service/fetch-creator-profiles', {userIds})
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch creator profiles')
        const profiles = json?.profiles ?? []
        profiles.forEach(profile => newProfiles[profile.id] = profile)
        this.creatorProfiles = newProfiles
        return this.creatorProfiles
    }

    async createListItem(plantCode, description, deadline, comments) {
        const user = await UserService.getCurrentUser()
        if (!user) throw new Error('No authenticated user')
        if (!description?.trim()) throw new Error('Description is required')
        const userId = user.id
        if (!userId) throw new Error('User ID is required')
        const deadlineString = deadline instanceof Date ? deadline.toISOString() : deadline
        const {res, json} = await APIUtility.post('/list-service/create', {userId, plantCode, description, deadline: deadlineString, comments})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to create list item')
        await this.fetchListItems()
        return true
    }

    async updateListItem(item) {
        if (!item?.id) throw new Error('Item ID is required')
        if (!item.description?.trim()) throw new Error('Description is required')
        const update = {
            id: item.id,
            plant_code: item.plant_code?.trim() ?? '',
            description: item.description.trim(),
            deadline: item.deadline,
            comments: item.comments?.trim() ?? '',
            completed: item.completed ?? false,
            completed_at: item.completed_at
        }
        const {res, json} = await APIUtility.post('/list-service/update', {item: update})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to update list item')
        await this.fetchListItems()
        return true
    }

    async toggleCompletion(item, currentUserId) {
        if (!item?.id) throw new Error('Item ID is required')
        if (!currentUserId) throw new Error('No authenticated user')
        const newCompletionStatus = !item.completed
        const {res, json} = await APIUtility.post('/list-service/toggle-completion', {id: item.id, currentUserId, completed: newCompletionStatus})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to toggle completion')
        await this.fetchListItems()
        return true
    }

    async deleteListItem(id) {
        if (!id) throw new Error('Item ID is required')
        const {res, json} = await APIUtility.post('/list-service/delete', {id})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete list item')
        await this.fetchListItems()
        return true
    }

    getFilteredItems({plantCode, searchTerm, showCompleted, statusFilter}) {
        let items = [...this.listItems]
        if (plantCode) items = items.filter(item => item.plant_code === plantCode)
        if (searchTerm?.trim()) {
            const term = searchTerm.toLowerCase().trim()
            items = items.filter(item =>
                item.description.toLowerCase().includes(term) ||
                item.comments.toLowerCase().includes(term)
            )
        }
        if (!showCompleted) items = items.filter(item => !item.completed)
        if (statusFilter === 'completed') items = items.filter(item => item.completed)
        if (statusFilter === 'overdue') items = items.filter(item => this.isOverdue(item) && !item.completed)
        if (statusFilter === 'pending') items = items.filter(item => !this.isOverdue(item) && !item.completed)
        if (statusFilter === 'completed') {
            items.sort((a, b) => {
                const aCompletedAt = new Date(a.completed_at).getTime() || 0
                const bCompletedAt = new Date(b.completed_at).getTime() || 0
                return bCompletedAt - aCompletedAt
            })
        } else {
            items.sort((a, b) => {
                const aOverdue = this.isOverdue(a) && !a.completed
                const bOverdue = this.isOverdue(b) && !b.completed
                if (aOverdue && !bOverdue) return -1
                if (!aOverdue && bOverdue) return 1
                const aDeadline = new Date(a.deadline).getTime() || 0
                const bDeadline = new Date(b.deadline).getTime() || 0
                return aDeadline - bDeadline
            })
        }
        return items
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A'
        const date = new Date(dateString)
        if (isNaN(date.getTime())) return 'Invalid Date'
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    formatDateForInput(dateString) {
        if (!dateString) return ''
        const date = new Date(dateString)
        if (isNaN(date.getTime())) return ''
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }

    isOverdue(item) {
        return item.deadline && !item.completed && new Date(item.deadline) < new Date()
    }

    calculateStatusInfo(item) {
        if (!item) return {color: 'var(--gray-500)', label: 'Unknown', icon: 'question-circle'}
        if (item.completed) return {color: 'var(--success)', label: 'Completed', icon: 'check-circle'}
        const deadline = new Date(item.deadline)
        const now = new Date()
        if (isNaN(deadline.getTime())) return {color: 'var(--gray-500)', label: 'No Deadline', icon: 'calendar-times'}
        if (deadline < now) return {color: 'var(--danger)', label: 'Overdue', icon: 'exclamation-circle'}
        const hours = (deadline - now) / (1000 * 60 * 60)
        if (hours < 24) return {color: 'var(--warning)', label: 'Due Soon', icon: 'clock'}
        return {color: 'var(--primary)', label: 'Upcoming', icon: 'calendar-check'}
    }

    getPlantName(plantCode) {
        const plant = this.plants.find(p => p.plant_code === plantCode)
        return plant ? plant.plant_name : plantCode || 'No Plant'
    }

    truncateText(text, maxLength, byWords = false) {
        if (!text) return ''
        if (byWords) {
            const words = text.split(' ')
            return words.length > maxLength ? `${words.slice(0, maxLength).join(' ')}...` : text
        }
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }

    getCreatorName(userId) {
        if (!userId) return 'Unknown'
        const profile = this.creatorProfiles[userId]
        if (profile) {
            const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
            return name || userId.slice(0, 8)
        }
        return userId.slice(0, 8)
    }

    getPlantDistribution(listItems) {
        const distribution = {}
        const uniquePlants = [...new Set(listItems.map(item => item.plant_code || 'Unassigned'))]
        uniquePlants.forEach(plant => {
            distribution[plant] = {Total: 0, Pending: 0, Completed: 0, Overdue: 0}
        })
        listItems.forEach(item => {
            const plant = item.plant_code || 'Unassigned'
            distribution[plant].Total++
            if (item.completed) {
                distribution[plant].Completed++
            } else {
                distribution[plant].Pending++
                if (this.isOverdue(item)) distribution[plant].Overdue++
            }
        })
        this.plantDistribution = distribution
        return distribution
    }
}

export const ListService = new ListServiceImpl()
