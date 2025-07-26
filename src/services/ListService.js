import supabase from './DatabaseService';
import {AuthService} from './AuthService';
import {UserService} from './UserService';

const LIST_ITEMS_TABLE = 'list_items';

class ListServiceImpl {
    constructor() {
        this.listItems = [];
        this.creatorProfiles = {};
        this.plants = [];
        this.plantDistribution = {};
    }

    async fetchListItems() {
        const user = await UserService.getCurrentUser();
        if (!user) throw new Error('No authenticated user');
        const {data, error} = await supabase
            .from(LIST_ITEMS_TABLE)
            .select('*')
            .order('created_at', {ascending: false});
        if (error) throw error;
        this.listItems = data ?? [];
        await this.fetchCreatorProfiles(this.listItems);
        return this.listItems;
    }

    async fetchPlants() {
        const {data, error} = await supabase.from('plants').select('*').order('plant_code');
        if (error) throw error;
        this.plants = data ?? [];
        return this.plants;
    }

    async fetchCreatorProfiles(listItems) {
        const userIds = [...new Set(listItems.map(item => item.user_id).filter(id => id))];
        const newProfiles = {...this.creatorProfiles};
        if (userIds.length === 0) {
            this.creatorProfiles = newProfiles;
            return this.creatorProfiles;
        }
        const {data, error} = await supabase
            .from('users_profiles')
            .select('id, first_name, last_name')
            .in('id', userIds);
        if (error) throw error;
        data?.forEach(profile => newProfiles[profile.id] = profile);
        this.creatorProfiles = newProfiles;
        return this.creatorProfiles;
    }

    async createListItem(plantCode, description, deadline, comments) {
        const user = await UserService.getCurrentUser();
        if (!user) throw new Error('No authenticated user');
        if (!description?.trim()) throw new Error('Description is required');
        const userId = user.id;
        if (!userId) throw new Error('User ID is required');
        const now = new Date().toISOString();
        const deadlineString = deadline instanceof Date ? deadline.toISOString() : deadline;
        const item = {
            id: crypto.randomUUID(),
            user_id: userId,
            plant_code: plantCode?.trim() ?? '',
            description: description.trim(),
            deadline: deadlineString,
            comments: comments?.trim() ?? '',
            created_at: now,
            completed: false,
            completed_at: null,
            completed_by: null
        };
        const {error} = await supabase
            .from(LIST_ITEMS_TABLE)
            .insert(item);
        if (error) throw error;
        await this.fetchListItems();
        return true;
    }

    async updateListItem(item) {
        if (!item?.id) throw new Error('Item ID is required');
        if (!item.description?.trim()) throw new Error('Description is required');
        const update = {
            plant_code: item.plant_code?.trim() ?? '',
            description: item.description.trim(),
            deadline: item.deadline,
            comments: item.comments?.trim() ?? '',
            completed: item.completed ?? false,
            completed_at: item.completed_at
        };
        const {error} = await supabase
            .from(LIST_ITEMS_TABLE)
            .update(update)
            .eq('id', item.id);
        if (error) throw error;
        await this.fetchListItems();
        return true;
    }

    async toggleCompletion(item, currentUserId) {
        if (!item?.id) throw new Error('Item ID is required');
        if (!currentUserId) throw new Error('No authenticated user');
        const now = new Date().toISOString();
        const newCompletionStatus = !item.completed;
        const update = {
            completed: newCompletionStatus,
            completed_at: newCompletionStatus ? now : null,
            completed_by: newCompletionStatus ? currentUserId : null
        };
        const {error} = await supabase
            .from(LIST_ITEMS_TABLE)
            .update(update)
            .eq('id', item.id);
        if (error) throw error;
        await this.fetchListItems();
        return true;
    }

    async deleteListItem(id) {
        if (!id) throw new Error('Item ID is required');
        const {error} = await supabase
            .from(LIST_ITEMS_TABLE)
            .delete()
            .eq('id', id);
        if (error) throw error;
        await this.fetchListItems();
        return true;
    }

    getFilteredItems({filterType, plantCode, searchTerm, showCompleted, statusFilter}) {
        let items = [...this.listItems];
        if (plantCode) items = items.filter(item => item.plant_code === plantCode);
        if (searchTerm?.trim()) {
            const term = searchTerm.toLowerCase().trim();
            items = items.filter(item =>
                item.description.toLowerCase().includes(term) ||
                item.comments.toLowerCase().includes(term)
            );
        }
        if (!showCompleted) items = items.filter(item => !item.completed);
        if (statusFilter === 'completed') items = items.filter(item => item.completed);
        if (statusFilter === 'overdue') items = items.filter(item => this.isOverdue(item) && !item.completed);
        if (statusFilter === 'pending') items = items.filter(item => !this.isOverdue(item) && !item.completed);

        if (statusFilter === 'completed') {
            items.sort((a, b) => {
                const aCompletedAt = new Date(a.completed_at).getTime() || 0;
                const bCompletedAt = new Date(b.completed_at).getTime() || 0;
                return bCompletedAt - aCompletedAt;
            });
        } else {
            items.sort((a, b) => {
                const aOverdue = this.isOverdue(a) && !a.completed;
                const bOverdue = this.isOverdue(b) && !b.completed;
                if (aOverdue && !bOverdue) return -1;
                if (!aOverdue && bOverdue) return 1;
                const aDeadline = new Date(a.deadline).getTime() || 0;
                const bDeadline = new Date(b.deadline).getTime() || 0;
                return aDeadline - bDeadline;
            });
        }

        return items;
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleString(undefined, {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
    }

    formatDateForInput(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    getRelativeTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.round(diffMs / 1000);
        const diffMin = Math.round(diffSec / 60);
        const diffHr = Math.round(diffMin / 60);
        const diffDay = Math.round(diffHr / 24);
        if (diffSec < 60) return `${diffSec} second${diffSec !== 1 ? 's' : ''} ago`;
        if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
        if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
        if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
        return this.formatDate(dateString);
    }

    isOverdue(item) {
        return item.deadline && !item.completed && new Date(item.deadline) < new Date();
    }

    calculateStatusInfo(item) {
        if (!item) return {color: '#718096', label: 'Unknown', icon: 'question-circle'};
        if (item.completed) return {color: '#10B981', label: 'Completed', icon: 'check-circle'};
        const deadline = new Date(item.deadline);
        const now = new Date();
        if (isNaN(deadline.getTime())) return {color: '#718096', label: 'No Deadline', icon: 'calendar-times'};
        if (deadline < now) return {color: '#EF4444', label: 'Overdue', icon: 'exclamation-circle'};
        const hours = (deadline - now) / (1000 * 60 * 60);
        if (hours < 24) return {color: '#F59E0B', label: 'Due Soon', icon: 'clock'};
        return {color: '#3B82F6', label: 'Upcoming', icon: 'calendar-check'};
    }

    getPlantName(plantCode) {
        const plant = this.plants.find(p => p.plant_code === plantCode);
        return plant ? plant.plant_name : plantCode || 'No Plant';
    }

    truncateText(text, maxLength, byWords = false) {
        if (!text) return '';
        if (byWords) {
            const words = text.split(' ');
            return words.length > maxLength ? `${words.slice(0, maxLength).join(' ')}...` : text;
        }
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    }

    getCreatorName(userId) {
        if (!userId) return 'Unknown';
        const profile = this.creatorProfiles[userId];
        if (profile) {
            const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
            return name || userId.slice(0, 8);
        }
        return userId.slice(0, 8);
    }

    getPlantDistribution(listItems) {
        const distribution = {};
        const uniquePlants = [...new Set(listItems.map(item => item.plant_code || 'Unassigned'))];
        uniquePlants.forEach(plant => {
            distribution[plant] = {Total: 0, Pending: 0, Completed: 0, Overdue: 0};
        });
        listItems.forEach(item => {
            const plant = item.plant_code || 'Unassigned';
            distribution[plant].Total++;
            if (item.completed) {
                distribution[plant].Completed++;
            } else {
                distribution[plant].Pending++;
                if (this.isOverdue(item)) distribution[plant].Overdue++;
            }
        });
        this.plantDistribution = distribution;
        return distribution;
    }
}

export const ListService = new ListServiceImpl();