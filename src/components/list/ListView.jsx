import React, {useEffect, useState} from 'react';
import './ListView.css';
import '../../styles/FilterStyles.css';
import {supabase} from '../../core/clients/SupabaseClient';
import {UserService} from '../../services/UserService';
import ListItemCard from './ListItemCard';
import ListOverview from './ListOverview';
import {usePreferences} from '../../context/PreferencesContext';
import {ListItem} from '../../models/app/DataModels';
import ListAddView from './ListAddView';
import ListDetailView from './ListDetailView';

function ListView({title = 'Tasks List', showSidebar, setShowSidebar, onSelectItem}) {
    const {preferences, updateListFilter, resetListFilters} = usePreferences();
    const [listItems, setListItems] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [selectedPlant, setSelectedPlant] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [showOverview, setShowOverview] = useState(false);
    const [showDetailView, setShowDetailView] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [lastToggledItem, setLastToggledItem] = useState(null);
    const [showUndo, setShowUndo] = useState(false);
    const [creatorProfiles, setCreatorProfiles] = useState({});

    useEffect(() => {
        const fetchCurrentUser = async () => {
            const user = await UserService.getCurrentUser();
            if (user) {
                setCurrentUserId(user.id);
            }
        };
        fetchCurrentUser();
    }, []);

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        if (listItems.length > 0) {
            fetchCreatorProfiles();
        }
    }, [listItems]);

    useEffect(() => {
        if (preferences.listFilters) {
            setSearchText(preferences.listFilters.searchText || '');
            setSelectedPlant(preferences.listFilters.selectedPlant || '');
            setStatusFilter(preferences.listFilters.statusFilter || '');
        }
    }, [preferences.listFilters]);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                fetchListItems(),
                fetchPlants(),
                fetchCreatorProfiles()
            ]);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchListItems = async () => {
        try {
            const {data, error} = await supabase
                .from('list_items')
                .select('*');

            if (error) throw error;

            const formattedItems = data.map(item => new ListItem(item));
            setListItems(formattedItems);
            localStorage.setItem('cachedListItems', JSON.stringify(formattedItems));
            localStorage.setItem('cachedListItemsDate', new Date().toISOString());
        } catch (error) {
            console.error('Error fetching list items:', error);
            const cachedData = localStorage.getItem('cachedListItems');
            const cacheDate = localStorage.getItem('cachedListItemsDate');
            if (cachedData && cacheDate) {
                const cachedTime = new Date(cacheDate).getTime();
                const hourAgo = new Date().getTime() - 3600000;
                if (cachedTime > hourAgo) {
                    setListItems(JSON.parse(cachedData));
                }
            }
        }
    };

    const fetchPlants = async () => {
        try {
            const {data, error} = await supabase
                .from('plants')
                .select('*');

            if (error) throw error;
            setPlants(data);
        } catch (error) {
            console.error('Error fetching plants:', error);
        }
    };

    const fetchCreatorProfiles = async () => {
        try {
            // Get unique user IDs from list items
            const userIds = [...new Set(listItems.map(item => item.userId))];
            const newProfiles = {...creatorProfiles};

            // Fetch all profiles in a single batch request
            const {data, error} = await supabase
                .from('users_profiles')
                .select('id, first_name, last_name')
                .in('id', userIds.filter(id => id));

            if (!error && data) {
                // Add all fetched profiles to the cache
                data.forEach(profile => {
                    newProfiles[profile.id] = profile;
                });
            }

            // For any remaining users without profiles, get names individually
            const missingUserIds = userIds.filter(id => id && !newProfiles[id]);

            for (const id of missingUserIds) {
                try {
                    const userName = await UserService.getUserDisplayName(id);
                    if (userName && userName !== 'Loading...') {
                        const nameParts = userName.split(' ');
                        newProfiles[id] = {
                            id: id,
                            first_name: nameParts[0] || '',
                            last_name: nameParts.slice(1).join(' ') || ''
                        };
                    }
                } catch (profileError) {
                    console.error('Error fetching profile:', profileError);
                    // Add a placeholder to prevent repeated requests
                    newProfiles[id] = { id, first_name: 'Unknown', last_name: '' };
                }
            }

            setCreatorProfiles(newProfiles);
        } catch (error) {
            console.error('Error fetching creator profiles:', error);
        }
    };

    const toggleCompletion = async (item) => {
        try {
            setLastToggledItem(item);
            const completed = !item.completed;
            const completedAt = completed ? new Date().toISOString() : null;
            const completedBy = completed ? currentUserId : null;

            const {data, error} = await supabase
                .from('list_items')
                .update({
                    completed,
                    completed_at: completedAt,
                    completed_by: completedBy
                })
                .eq('id', item.id);

            if (error) throw error;

            await fetchListItems();
            setShowUndo(true);

            // Auto-hide undo after 4 seconds
            setTimeout(() => {
                setShowUndo(false);
            }, 4000);
        } catch (error) {
            console.error('Error toggling completion:', error);
        }
    };

    const handleUndo = async () => {
        if (!lastToggledItem) return;

        try {
            const {error} = await supabase
                .from('list_items')
                .update({
                    completed: false,
                    completed_at: null,
                    completed_by: null
                })
                .eq('id', lastToggledItem.id);

            if (error) throw error;

            await fetchListItems();
            setShowUndo(false);
            setLastToggledItem(null);
        } catch (error) {
            console.error('Error undoing completion:', error);
        }
    };

    const filteredItems = listItems
        .filter(item => {
            const matchesSearch = searchText.trim() === '' ||
                item.description.toLowerCase().includes(searchText.toLowerCase()) ||
                item.comments.toLowerCase().includes(searchText.toLowerCase());

            const matchesPlant = selectedPlant === '' || item.plantCode === selectedPlant;

            // Status filter conditions
            let matchesStatus = true;
            if (statusFilter === 'overdue') {
                matchesStatus = item.isOverdue && !item.completed;
            } else if (statusFilter === 'pending') {
                matchesStatus = !item.isOverdue && !item.completed;
            } else {
                // Default: show all non-completed items
                matchesStatus = !item.completed;
            }

            return matchesSearch && matchesPlant && matchesStatus;
        })
        .sort((a, b) => {
            if (a.isOverdue && !b.isOverdue) return -1;
            if (!a.isOverdue && b.isOverdue) return 1;
            return new Date(a.deadline) - new Date(b.deadline);
        });

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plant_code === plantCode);
        return plant ? plant.plant_name : plantCode || 'No Plant';
    };

    // Function to truncate text with ellipsis
    const truncateText = (text, maxLength, byWords = false) => {
        if (!text) return '';
        if (byWords) {
            const words = text.split(' ');
            return words.length > maxLength ? `${words.slice(0, maxLength).join(' ')}...` : text;
        }
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    };

    const handleSelectItem = (item) => {
        setSelectedItem(item);
        if (onSelectItem) {
            onSelectItem(item.id);
        } else {
            setShowDetailView(true);
        }
    };

    const getCreatorName = (userId) => {
        if (!userId) return 'Unknown';

        if (creatorProfiles[userId]) {
            const profile = creatorProfiles[userId];
            const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
            return name || userId.substring(0, 8);
        }

        // If we don't have the profile yet, trigger a fetch for next render
        // but still return a reasonable value immediately
        setTimeout(() => fetchCreatorProfiles(), 0);
        return userId.substring(0, 8);
    };

    const totalItems = filteredItems.length;
    const overdueItems = filteredItems.filter(item => item.isOverdue).length;

    const OverviewPopup = () => (
        <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>List Overview</h2>
                    <button className="close-button" onClick={() => setShowOverview(false)}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <ListOverview
                        totalItems={totalItems}
                        overdueItems={overdueItems}
                        listItems={filteredItems}
                        selectedPlant={selectedPlant}
                    />
                </div>
                <div className="modal-footer">
                    <button className="primary-button" onClick={() => setShowOverview(false)}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="dashboard-container list-view">
            <div className="dashboard-header">
                <h1>
                    {title}
                </h1>
                <div className="dashboard-actions">
                    <button className="action-button primary" onClick={() => setShowAddSheet(true)}>
                        <i className="fas fa-plus"></i>
                        Add Item
                    </button>
                </div>
            </div>

            <div className="search-filters">
                <div className="search-bar">
                    <input
                        type="text"
                        className="ios-search-input"
                        placeholder="Search by description or comments..."
                        value={searchText}
                        onChange={(e) => {
                            const value = e.target.value;
                            setSearchText(value);
                            updateListFilter && updateListFilter('searchText', value);
                        }}
                    />
                    {searchText && (
                        <button className="clear" onClick={() => {
                            setSearchText('');
                            updateListFilter && updateListFilter('searchText', '');
                        }}>
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>

                <div className="filters">
                    <div className="filter-wrapper">
                        <select
                            className="ios-select"
                            value={selectedPlant}
                            onChange={(e) => {
                                const value = e.target.value;
                                setSelectedPlant(value);
                                updateListFilter && updateListFilter('selectedPlant', value);
                            }}
                            aria-label="Filter by plant"
                            style={{
                                '--select-active-border': preferences.accentColor === 'red' ? '#b80017' : '#003896',
                                '--select-focus-border': preferences.accentColor === 'red' ? '#b80017' : '#003896'
                            }}
                        >
                            <option value="">All Plants</option>
                            {plants.sort((a, b) => {
                                const aCode = parseInt(a.plant_code?.replace(/\D/g, '') || '0');
                                const bCode = parseInt(b.plant_code?.replace(/\D/g, '') || '0');
                                return aCode - bCode;
                            }).map(plant => (
                                <option key={plant.plant_code} value={plant.plant_code}>
                                    ({plant.plant_code}) {plant.plant_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-wrapper">
                        <select
                            className="ios-select"
                            value={statusFilter}
                            onChange={(e) => {
                                const value = e.target.value;
                                setStatusFilter(value);
                                updateListFilter && updateListFilter('statusFilter', value);
                            }}
                            aria-label="Filter by status"
                            style={{
                                '--select-active-border': preferences.accentColor === 'red' ? '#b80017' : '#003896',
                                '--select-focus-border': preferences.accentColor === 'red' ? '#b80017' : '#003896'
                            }}
                        >
                            <option value="">All Status</option>
                            <option value="overdue">Overdue</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>


                    {(searchText || selectedPlant || statusFilter) && (
                        <button
                            className="filter-reset-button"
                            onClick={() => {
                                setSearchText('');
                                setSelectedPlant('');
                                setStatusFilter('');
                                resetListFilters && resetListFilters();
                            }}
                        >
                            <i className="fas fa-undo"></i>
                            Reset Filters
                        </button>
                    )}

                    <button className="ios-button" onClick={() => setShowOverview(true)}>
                        <i className="fas fa-chart-bar"></i>
                        Overview
                    </button>
                </div>
            </div>

            <div className="content-container">
                {isLoading ? (
                    <div className="loading-container">
                        <div className="ios-spinner"></div>
                        <p>Loading list items...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="no-results-container">
                        <div className="no-results-icon">
                            <i className="fas fa-clipboard-list"></i>
                        </div>
                        <h3>No List Items Found</h3>
                        <p>
                            {searchText || selectedPlant
                                ? "No items match your search criteria."
                                : "There are no items in the list yet."}
                        </p>
                        <button className="primary-button" onClick={() => setShowAddSheet(true)}>
                            Add Item
                        </button>
                    </div>
                ) : (
                    <div className={`list-items-grid ${searchText ? 'search-results' : ''}`}>
                        {filteredItems.map(item => (
                            <ListItemCard
                                key={item.id}
                                item={item}
                                plantName={getPlantName(item.plantCode)}
                                creatorName={getCreatorName(item.userId)}
                                onSelect={handleSelectItem}
                                truncateText={truncateText}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Undo container removed - completion can only be toggled in detail view */}

            {showAddSheet && (
                <ListAddView
                    onClose={() => setShowAddSheet(false)}
                    onItemAdded={() => {
                        setShowAddSheet(false);
                        fetchListItems();
                    }}
                    plants={plants}
                    item={selectedItem}
                />
            )}

            {showOverview && <OverviewPopup/>}

            {showDetailView && selectedItem && (
                <div className="modal-backdrop">
                    <div className="modal-detail-content" onClick={e => e.stopPropagation()}>
                        <ListDetailView
                            itemId={selectedItem.id}
                            onClose={() => {
                                setShowDetailView(false);
                                setSelectedItem(null);
                                fetchListItems(); // Refresh list after potential changes
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default ListView;