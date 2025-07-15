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

function ArchivedView({title = 'Archived Tasks', showSidebar, setShowSidebar, onSelectItem}) {
    const {preferences, updateListFilter, resetListFilters} = usePreferences();
    const [listItems, setListItems] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [selectedPlant, setSelectedPlant] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateRangeFilter, setDateRangeFilter] = useState('all');
    const [showOverview, setShowOverview] = useState(false);
    const [showDetailView, setShowDetailView] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [creatorProfiles, setCreatorProfiles] = useState({});
    const [completerProfiles, setCompleterProfiles] = useState({});

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
            fetchCompleterProfiles();
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
                fetchCreatorProfiles(),
                fetchCompleterProfiles()
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
                .select('*')
                .eq('completed', true);

            if (error) throw error;

            const formattedItems = data.map(item => new ListItem(item));
            setListItems(formattedItems);
        } catch (error) {
            console.error('Error fetching completed list items:', error);
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

    const fetchCompleterProfiles = async () => {
        try {
            // Get unique completer IDs from list items
            const completerIds = [...new Set(listItems.map(item => item.completedBy).filter(id => id))];
            const newProfiles = {...completerProfiles};

            // Fetch all profiles in a single batch request
            const {data, error} = await supabase
                .from('users_profiles')
                .select('id, first_name, last_name')
                .in('id', completerIds);

            if (!error && data) {
                // Add all fetched profiles to the cache
                data.forEach(profile => {
                    newProfiles[profile.id] = profile;
                });
            }

            // For any remaining users without profiles, get names individually
            const missingUserIds = completerIds.filter(id => id && !newProfiles[id]);

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

            setCompleterProfiles(newProfiles);
        } catch (error) {
            console.error('Error fetching completer profiles:', error);
        }
    };

    const recoverItem = async (item) => {
        try {
            const {error} = await supabase
                .from('list_items')
                .update({
                    completed: false,
                    completed_at: null,
                    completed_by: null
                })
                .eq('id', item.id);

            if (error) throw error;

            await fetchListItems();
        } catch (error) {
            console.error('Error recovering list item:', error);
        }
    };

    const deleteItem = async (item) => {
        if (!window.confirm('Are you sure you want to permanently delete this item?')) {
            return;
        }

        try {
            const {error} = await supabase
                .from('list_items')
                .delete()
                .eq('id', item.id);

            if (error) throw error;

            await fetchListItems();
        } catch (error) {
            console.error('Error deleting list item:', error);
        }
    };

    // Calculate the date for date range filtering
    const getDateRangeStart = () => {
        const now = new Date();
        switch (dateRangeFilter) {
            case 'today':
                return new Date(now.setHours(0, 0, 0, 0));
            case 'week':
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
                weekStart.setHours(0, 0, 0, 0);
                return weekStart;
            case 'month':
                return new Date(now.getFullYear(), now.getMonth(), 1); // Start of month
            default:
                return null; // All time
        }
    };

    const filteredItems = listItems
        .filter(item => {
            const matchesSearch = searchText.trim() === '' ||
                item.description.toLowerCase().includes(searchText.toLowerCase()) ||
                item.comments.toLowerCase().includes(searchText.toLowerCase());

            const matchesPlant = selectedPlant === '' || item.plantCode === selectedPlant;

            // Date range filtering
            let matchesDateRange = true;
            const rangeStart = getDateRangeStart();
            if (rangeStart && item.completedAt) {
                const completedDate = new Date(item.completedAt);
                matchesDateRange = completedDate >= rangeStart;
            }

            return matchesSearch && matchesPlant && matchesDateRange;
        })
        .sort((a, b) => {
            // Sort by completion date (newest first)
            const dateA = a.completedAt ? new Date(a.completedAt) : new Date(0);
            const dateB = b.completedAt ? new Date(b.completedAt) : new Date(0);
            return dateB - dateA;
        });

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plant_code === plantCode);
        return plant ? plant.plant_name : plantCode || 'No Plant';
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

    const getCompleterName = (userId) => {
        if (!userId) return 'Unknown';

        if (completerProfiles[userId]) {
            const profile = completerProfiles[userId];
            const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
            return name || userId.substring(0, 8);
        }

        // If we don't have the profile yet, trigger a fetch for next render
        // but still return a reasonable value immediately
        setTimeout(() => fetchCompleterProfiles(), 0);
        return userId.substring(0, 8);
    };

    const totalItems = filteredItems.length;
    const onTimeItems = filteredItems.filter(item => {
        if (!item.completedAt || !item.deadline) return false;
        return new Date(item.completedAt) <= new Date(item.deadline);
    }).length;
    const lateItems = totalItems - onTimeItems;

    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    };

    const OverviewPopup = () => (
        <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Archived Items Overview</h2>
                    <button className="close-button" onClick={() => setShowOverview(false)}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <ListOverview
                        totalItems={totalItems}
                        overdueItems={lateItems}
                        listItems={filteredItems}
                        selectedPlant={selectedPlant}
                        isArchived={true}
                        onTimeItems={onTimeItems}
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
        <div className="dashboard-container list-view archived-view">
            <div className="dashboard-header">
                <h1>
                    {title}
                </h1>
                <div className="dashboard-actions">
                    <button className="action-button primary" onClick={() => setShowOverview(true)}>
                        <i className="fas fa-chart-bar"></i>
                        Overview
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
                            value={dateRangeFilter}
                            onChange={(e) => setDateRangeFilter(e.target.value)}
                            aria-label="Filter by date range"
                            style={{
                                '--select-active-border': preferences.accentColor === 'red' ? '#b80017' : '#003896',
                                '--select-focus-border': preferences.accentColor === 'red' ? '#b80017' : '#003896'
                            }}
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                        </select>
                    </div>

                    {(searchText || selectedPlant || dateRangeFilter !== 'all') && (
                        <button
                            className="filter-reset-button"
                            onClick={() => {
                                setSearchText('');
                                setSelectedPlant('');
                                setDateRangeFilter('all');
                                resetListFilters && resetListFilters();
                            }}
                        >
                            <i className="fas fa-undo"></i>
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            <div className="content-container">
                {isLoading ? (
                    <div className="loading-container">
                        <div className="ios-spinner"></div>
                        <p>Loading archived items...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="no-results-container">
                        <div className="no-results-icon">
                            <i className="fas fa-archive"></i>
                        </div>
                        <h3>No Archived Items Found</h3>
                        <p>
                            {searchText || selectedPlant || dateRangeFilter !== 'all'
                                ? "No completed items match your search criteria."
                                : "There are no completed items in the archive."}
                        </p>
                    </div>
                ) : (
                    <div className="archived-items-list">
                        {filteredItems.map(item => (
                            <div key={item.id} className="archived-item-card">
                                <div className="archived-item-header">
                                    <h3>{item.description}</h3>
                                    <div className="archived-item-status">
                                        {new Date(item.completedAt) <= new Date(item.deadline) ? (
                                            <span className="status-badge on-time">Completed On Time</span>
                                        ) : (
                                            <span className="status-badge late">Completed Late</span>
                                        )}
                                    </div>
                                </div>
                                <div className="archived-item-details">
                                    <div className="detail-row">
                                        <div className="detail-label">Plant</div>
                                        <div className="detail-value">{getPlantName(item.plantCode)}</div>
                                    </div>
                                    <div className="detail-row">
                                        <div className="detail-label">Created By</div>
                                        <div className="detail-value">{getCreatorName(item.userId)}</div>
                                    </div>
                                    <div className="detail-row">
                                        <div className="detail-label">Created On</div>
                                        <div className="detail-value">{formatDate(item.createdAt)}</div>
                                    </div>
                                    <div className="detail-row">
                                        <div className="detail-label">Deadline</div>
                                        <div className="detail-value">{formatDate(item.deadline)}</div>
                                    </div>
                                    <div className="detail-row">
                                        <div className="detail-label">Completed By</div>
                                        <div className="detail-value">{getCompleterName(item.completedBy)}</div>
                                    </div>
                                    <div className="detail-row">
                                        <div className="detail-label">Completed On</div>
                                        <div className="detail-value">{formatDate(item.completedAt)}</div>
                                    </div>
                                    {item.comments && (
                                        <div className="detail-row comments-row">
                                            <div className="detail-label">Comments</div>
                                            <div className="detail-value comments">{item.comments}</div>
                                        </div>
                                    )}
                                </div>
                                <div className="archived-item-actions">
                                    <button 
                                        className="action-button recover" 
                                        onClick={() => recoverItem(item)}
                                        title="Recover Item"
                                    >
                                        <i className="fas fa-undo"></i> Recover
                                    </button>
                                    <button 
                                        className="action-button delete" 
                                        onClick={() => deleteItem(item)}
                                        title="Delete Item"
                                    >
                                        <i className="fas fa-trash"></i> Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showOverview && <OverviewPopup/>}
        </div>
    );
}

export default ArchivedView;
