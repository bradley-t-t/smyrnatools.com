import supabase from '../core/Supabase';
import {AuthService} from './auth/AuthService';
import {ProfileService} from './ProfileService';

class TaskServiceImpl {
    constructor() {
        this.listItems = [];
    }

    /**
     * Fetch list items
     */
    async fetchListItems() {
        try {
            // Make sure we have profile data
            await ProfileService.fetchUserProfile();
            await ProfileService.fetchUserRole();

            const {data: items, error} = await supabase
                .from('todos')
                .select();

            if (error) throw error;

            this.listItems = items || [];
            return items || [];
        } catch (error) {
            console.error('Fetch list items error:', error);
            this.listItems = [];
            throw error;
        }
    }

    /**
     * Create a new list item
     */
    async createListItem(plantCode, description, deadline, comments) {
        try {
            if (!AuthService.currentUser) {
                throw new Error('No authenticated user');
            }

            const userId = AuthService.currentUser.id;
            const now = new Date().toISOString();
            const deadlineString = deadline instanceof Date ? deadline.toISOString() : deadline;

            const item = {
                id: crypto.randomUUID(),
                user_id: userId,
                plant_code: plantCode,
                description,
                deadline: deadlineString,
                comments,
                created_at: now,
                completed: false,
                completed_at: null,
                completed_by: null
            };

            const {error} = await supabase
                .from('todos')
                .insert(item);

            if (error) throw error;

            // Refresh list items
            await this.fetchListItems();

            return true;
        } catch (error) {
            console.error('Create list item error:', error);
            throw error;
        }
    }

    /**
     * Update a list item
     */
    async updateListItem(item) {
        try {
            const update = {
                plant_code: item.plant_code,
                description: item.description,
                deadline: item.deadline,
                comments: item.comments,
                completed: item.completed,
                completed_at: item.completed_at
            };

            const {error} = await supabase
                .from('todos')
                .update(update)
                .eq('id', item.id);

            if (error) throw error;

            // Refresh list items
            await this.fetchListItems();

            return true;
        } catch (error) {
            console.error('Update list item error:', error);
            throw error;
        }
    }

    /**
     * Toggle completion status of a list item
     */
    async toggleCompletion(item) {
        try {
            const now = new Date().toISOString();
            const newCompletionStatus = !item.completed;

            const update = {
                completed: newCompletionStatus,
                completed_at: newCompletionStatus ? now : null,
                completed_by: newCompletionStatus ? AuthService.currentUser?.id : null
            };

            const {error} = await supabase
                .from('todos')
                .update(update)
                .eq('id', item.id);

            if (error) throw error;

            // Refresh list items
            await this.fetchListItems();

            return true;
        } catch (error) {
            console.error('Toggle completion error:', error);
            throw error;
        }
    }

    /**
     * Delete a list item
     */
    async deleteListItem(id) {
        try {
            const {error} = await supabase
                .from('todos')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Refresh list items
            await this.fetchListItems();

            return true;
        } catch (error) {
            console.error('Delete list item error:', error);
            throw error;
        }
    }

    /**
     * Get filtered list items
     */
    getFilteredItems(filterType, plantCode, searchTerm, showCompleted) {
        let items = [...this.listItems];

        // Filter by plant if specified
        if (plantCode) {
            items = items.filter(item => item.plant_code === plantCode);
        }

        // Filter by search term if provided
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            items = items.filter(item =>
                item.description.toLowerCase().includes(term) ||
                item.comments.toLowerCase().includes(term)
            );
        }

        // Filter by completion status
        if (!showCompleted) {
            items = items.filter(item => !item.completed);
        }

        // Apply sorting based on filter type
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
                        return new Date(b.completed_at || 0) - new Date(a.completed_at || 0);
                    }
                    return a.completed ? 1 : -1;
                });
                break;
            default:
                // Default sort by created date, newest first
                items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        return items;
    }
}

// Create singleton instance
const singleton = new TaskServiceImpl();
export const TaskService = singleton;
