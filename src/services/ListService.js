import supabase from './DatabaseService';
import {AuthService} from './AuthService';
import {ProfileService} from './ProfileService';

const LIST_ITEMS_TABLE = 'list_items';

class ListServiceImpl {
    constructor() {
        this.listItems = [];
    }

    async fetchListItems() {
        await Promise.all([ProfileService.fetchUserProfile(), ProfileService.fetchUserRole()]);

        const {data, error} = await supabase
            .from(LIST_ITEMS_TABLE)
            .select('*')
            .order('created_at', {ascending: false});

        if (error) {
            console.error('Error fetching list items:', error);
            throw error;
        }

        this.listItems = data ?? [];
        return this.listItems;
    }

    async createListItem(plantCode, description, deadline, comments) {
        if (!AuthService.currentUser) throw new Error('No authenticated user');
        if (!description?.trim()) throw new Error('Description is required');

        const userId = AuthService.currentUser.id;
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

        if (error) {
            console.error('Error creating list item:', error);
            throw error;
        }

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

        if (error) {
            console.error('Error updating list item:', error);
            throw error;
        }

        await this.fetchListItems();
        return true;
    }

    async toggleCompletion(item) {
        if (!item?.id) throw new Error('Item ID is required');
        if (!AuthService.currentUser) throw new Error('No authenticated user');

        const now = new Date().toISOString();
        const newCompletionStatus = !item.completed;

        const update = {
            completed: newCompletionStatus,
            completed_at: newCompletionStatus ? now : null,
            completed_by: newCompletionStatus ? AuthService.currentUser.id : null
        };

        const {error} = await supabase
            .from(LIST_ITEMS_TABLE)
            .update(update)
            .eq('id', item.id);

        if (error) {
            console.error('Error toggling completion:', error);
            throw error;
        }

        await this.fetchListItems();
        return true;
    }

    async deleteListItem(id) {
        if (!id) throw new Error('Item ID is required');

        const {error} = await supabase
            .from(LIST_ITEMS_TABLE)
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting list item:', error);
            throw error;
        }

        await this.fetchListItems();
        return true;
    }

    getFilteredItems(filterType, plantCode, searchTerm, showCompleted) {
        let items = [...this.listItems];

        if (plantCode) {
            items = items.filter(item => item.plant_code === plantCode);
        }

        if (searchTerm?.trim()) {
            const term = searchTerm.toLowerCase().trim();
            items = items.filter(item =>
                item.description.toLowerCase().includes(term) ||
                item.comments.toLowerCase().includes(term)
            );
        }

        if (!showCompleted) {
            items = items.filter(item => !item.completed);
        }

        switch (filterType) {
            case 'plant':
                items.sort((a, b) => a.plant_code.localeCompare(b.plant_code));
                break;
            case 'description':
                items.sort((a, b) => a.description.localeCompare(b.description));
                break;
            case 'deadline':
                items.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
                break;
            case 'completed':
                items.sort((a, b) => {
                    if (a.completed === b.completed) {
                        return new Date(b.completed_at ?? 0) - new Date(a.completed_at ?? 0);
                    }
                    return a.completed ? 1 : -1;
                });
                break;
            default:
                items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        return items;
    }
}

export const ListService = new ListServiceImpl();