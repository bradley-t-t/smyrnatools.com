import React, {useEffect, useState} from 'react';
import './ListView.css';
import '../../styles/FilterStyles.css';
import {supabase} from '../../services/DatabaseService';
import LoadingScreen from '../common/LoadingScreen';
import {UserService} from '../../services/UserService';
import ListItemCard from './ListItemCard';
import ListOverview from './ListOverview';
import {usePreferences} from '../../context/PreferencesContext';
import {ListItem} from '../../models/list/ListItem';
import ListAddView from './ListAddView';
import ListDetailView from './ListDetailView';

function ListView({title = 'Tasks List', showSidebar, setShowSidebar, onSelectItem, onStatusFilterChange}) {
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
    const [creatorProfiles, setCreatorProfiles] = useState({});
    const [userPlantCode, setUserPlantCode] = useState(null);
    const [canBypassPlantRestriction, setCanBypassPlantRestriction] = useState(false);

    useEffect(() => {
        async function fetchCurrentUser() {
            const user = await UserService.getCurrentUser();
            if (user) {
                setCurrentUserId(user.id);
                const hasPermission = await UserService.hasPermission(user.id, 'list.bypass.plantrestriction');
                setCanBypassPlantRestriction(hasPermission);
                if (!hasPermission) {
                    try {
                        const {data: profileData} = await supabase
                            .from('users_profiles')
                            .select('plant_code')
                            .eq('id', user.id)
                            .single();
                        if (profileData?.plant_code) setUserPlantCode(profileData.plant_code);
                    } catch (error) {
                        console.error('Error fetching user plant code:', error);
                    }
                }
            }
        }
        fetchCurrentUser();
    }, []);

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        if (statusFilter === 'completed') {
            console.log('Completed items:', listItems.filter(item => item.completed).map(item => ({
                id: item.id,
                description: item.description,
                completedAt: item.completedAt,
                sortDate: new Date(item.completedAt || 0).toISOString()
            })));
        }

        // Update menu highlighting when statusFilter changes
        if (window.updateActiveMenuHighlight) {
            if (statusFilter === 'completed') {
                window.updateActiveMenuHighlight('Archive');
            } else {
                window.updateActiveMenuHighlight('List');
            }
        }

        // Notify parent when status filter changes
        if (onStatusFilterChange) {
            onStatusFilterChange(statusFilter);
        }
    }, [listItems, statusFilter, onStatusFilterChange]);

    useEffect(() => {
        if (listItems.length) fetchCreatorProfiles();
    }, [listItems]);

    useEffect(() => {
        if (preferences.listFilters) {
            setSearchText(preferences.listFilters.searchText || '');
            if (canBypassPlantRestriction || !userPlantCode) setSelectedPlant(preferences.listFilters.selectedPlant || '');
            setStatusFilter(preferences.listFilters.statusFilter || '');
        }
    }, [preferences.listFilters, canBypassPlantRestriction, userPlantCode]);

    useEffect(() => {
        if (!canBypassPlantRestriction && userPlantCode) {
            setSelectedPlant(userPlantCode);
            updateListFilter?.('selectedPlant', userPlantCode);
        }
    }, [canBypassPlantRestriction, userPlantCode, updateListFilter]);

    useEffect(() => {
        // Initialize with no filter when component is first mounted
        if (!document.documentElement.hasAttribute('data-list-initialized')) {
            document.documentElement.setAttribute('data-list-initialized', 'true');
            setStatusFilter('');
            updateListFilter?.('statusFilter', '');
            if (onStatusFilterChange) {
                onStatusFilterChange('');
            }
        }
    }, [updateListFilter, onStatusFilterChange]);

    async function fetchAllData() {
        setIsLoading(true);
        try {
            await Promise.all([fetchListItems(), fetchPlants(), fetchCreatorProfiles()]);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function fetchListItems() {
        try {
            const {data, error} = await supabase.from('list_items').select('*');
            if (error) throw error;
            const formattedItems = data.map(item => new ListItem(item));
            setListItems(formattedItems);
            localStorage.setItem('cachedListItems', JSON.stringify(formattedItems));
            localStorage.setItem('cachedListItemsDate', new Date().toISOString());
        } catch (error) {
            console.error('Error fetching list items:', error);
            const cachedData = localStorage.getItem('cachedListItems');
            const cacheDate = localStorage.getItem('cachedListItemsDate');
            if (cachedData && cacheDate && new Date(cacheDate).getTime() > new Date().getTime() - 3600000) {
                setListItems(JSON.parse(cachedData));
            }
        }
    }

    async function fetchPlants() {
        try {
            const {data, error} = await supabase.from('plants').select('*');
            if (error) throw error;
            setPlants(data);
        } catch (error) {
            console.error('Error fetching plants:', error);
        }
    }

    async function fetchCreatorProfiles() {
        try {
            const userIds = [...new Set(listItems.map(item => item.userId).filter(id => id))];
            const newProfiles = {...creatorProfiles};
            const {data, error} = await supabase
                .from('users_profiles')
                .select('id, first_name, last_name')
                .in('id', userIds);
            if (error) throw error;
            data?.forEach(profile => newProfiles[profile.id] = profile);
            for (const id of userIds.filter(id => !newProfiles[id])) {
                try {
                    const userName = await UserService.getUserDisplayName(id);
                    if (userName && userName !== 'Loading...') {
                        const nameParts = userName.split(' ');
                        newProfiles[id] = {id, first_name: nameParts[0] || '', last_name: nameParts.slice(1).join(' ') || ''};
                    }
                } catch {
                    newProfiles[id] = {id, first_name: 'Unknown', last_name: ''};
                }
            }
            setCreatorProfiles(newProfiles);
        } catch (error) {
            console.error('Error fetching creator profiles:', error);
        }
    }

    const filteredItems = listItems
        .filter(item => {
            const matchesSearch = !searchText.trim() ||
                item.description.toLowerCase().includes(searchText.toLowerCase()) ||
                item.comments.toLowerCase().includes(searchText.toLowerCase());
            const matchesPlant = !selectedPlant || item.plantCode === selectedPlant;
                            // Filter based on the status filter selection
                            const matchesStatus = statusFilter === 'completed' ? item.completed :
                statusFilter === 'overdue' ? item.isOverdue && !item.completed :
                    statusFilter === 'pending' ? !item.isOverdue && !item.completed :
                        !item.completed; // Default to showing only pending items
            return matchesSearch && matchesPlant && matchesStatus;
        })
        .sort((a, b) => {
            // Sort completed items by completion date
            if (statusFilter === 'completed') {
                const dateA = new Date(a.completedAt || 0);
                const dateB = new Date(b.completedAt || 0);
                return dateB - dateA;
            }
            if (a.isOverdue && !b.isOverdue) return -1;
            if (!a.isOverdue && b.isOverdue) return 1;
            return new Date(a.deadline) - new Date(b.deadline);
        });

    const getPlantName = plantCode => {
        const plant = plants.find(p => p.plant_code === plantCode);
        return plant ? plant.plant_name : plantCode || 'No Plant';
    };

    const truncateText = (text, maxLength, byWords = false) => {
        if (!text) return '';
        if (byWords) {
            const words = text.split(' ');
            return words.length > maxLength ? `${words.slice(0, maxLength).join(' ')}...` : text;
        }
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    };

    const handleSelectItem = item => {
        setSelectedItem(item);
        onSelectItem ? onSelectItem(item.id) : setShowDetailView(true);
    };

    const getCreatorName = userId => {
        if (!userId) return 'Unknown';
        const profile = creatorProfiles[userId];
        if (profile) {
            const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
            return name || userId.slice(0, 8);
        }
        if (!window.profileFetchTriggered) {
            window.profileFetchTriggered = true;
            setTimeout(() => {
                window.profileFetchTriggered = false;
                fetchCreatorProfiles();
            }, 100);
        }
        return userId.slice(0, 8);
    };

    const totalItems = filteredItems.length;
    const overdueItems = filteredItems.filter(item => item.isOverdue && !item.completed).length;

    const OverviewPopup = () => (
        <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{statusFilter === 'completed' ? 'Completed Items Overview' : 'List Overview'}</h2>
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
                        isArchived={statusFilter === 'completed'}
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
                <h1>{title}</h1>
                <div className="dashboard-actions">
                    <button className="action-button primary" onClick={() => setShowAddSheet(true)}>
                        <i className="fas fa-plus"></i> Add Item
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
                        onChange={e => {
                            setSearchText(e.target.value);
                            updateListFilter?.('searchText', e.target.value);
                        }}
                    />
                    {searchText && (
                        <button className="clear" onClick={() => {
                            setSearchText('');
                            updateListFilter?.('searchText', '');
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
                            onChange={e => {
                                setSelectedPlant(e.target.value);
                                updateListFilter?.('selectedPlant', e.target.value);
                            }}
                            disabled={!canBypassPlantRestriction && userPlantCode}
                            aria-label="Filter by plant"
                            style={{'--select-active-border': preferences.accentColor === 'red' ? '#b80017' : '#003896', '--select-focus-border': preferences.accentColor === 'red' ? '#b80017' : '#003896'}}
                        >
                            <option value="">All Plants</option>
                            {plants.sort((a, b) => parseInt(a.plant_code?.replace(/\D/g, '') || '0') - parseInt(b.plant_code?.replace(/\D/g, '') || '0')).map(plant => (
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
                            onChange={e => {
                                const newValue = e.target.value;
                                setStatusFilter(newValue);
                                updateListFilter?.('statusFilter', newValue);

                                // We've now combined List and Archive views, so no need to switch views

                                // Dispatch a custom event to notify other components about status filter change
                                window.dispatchEvent(new CustomEvent('list-status-filter-change', {
                                    detail: { statusFilter: newValue }
                                }));

                                // If we've switched to 'completed', we want to force a navigation state update
                                if (newValue === 'completed' && window.updateActiveMenuHighlight) {
                                    window.updateActiveMenuHighlight('Archive');
                                } else if (newValue !== 'completed' && window.updateActiveMenuHighlight) {
                                    window.updateActiveMenuHighlight('List');
                                }

                                if (onStatusFilterChange) {
                                    onStatusFilterChange(newValue);
                                }
                            }}
                            aria-label="Filter by status"
                            style={{'--select-active-border': preferences.accentColor === 'red' ? '#b80017' : '#003896', '--select-focus-border': preferences.accentColor === 'red' ? '#b80017' : '#003896'}}
                        >
                            <option value="">All Status</option>
                            <option value="overdue">Overdue</option>
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    {(searchText || selectedPlant || statusFilter) && (
                        <button
                            className="filter-reset-button"
                            onClick={() => {
                                setSearchText('');
                                if (canBypassPlantRestriction) setSelectedPlant('');
                                else if (userPlantCode) setSelectedPlant(userPlantCode);
                                setStatusFilter('');
                                resetListFilters?.();
                                if (!canBypassPlantRestriction && userPlantCode) updateListFilter?.('selectedPlant', userPlantCode);

                                // Just ensure the status filter is cleared
                                if (window.updateActiveMenuHighlight) {
                                    window.updateActiveMenuHighlight('List');
                                }

                                if (onStatusFilterChange) {
                                    onStatusFilterChange('');
                                }
                            }}
                        >
                            <i className="fas fa-undo"></i> Reset Filters
                        </button>
                    )}
                    <button className="ios-button" onClick={() => setShowOverview(true)}>
                        <i className="fas fa-chart-bar"></i> Overview
                    </button>
                </div>
            </div>
            <div className="content-container">
                {isLoading ? (
                    <div className="loading-container">
                        <LoadingScreen message="Loading list items..." inline={true} />
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="no-results-container">
                        <div className="no-results-icon">
                            <i className="fas fa-clipboard-list"></i>
                        </div>
                        <h3>{statusFilter === 'completed' ? 'No Completed Items Found' : 'No List Items Found'}</h3>
                        <p>
                            {searchText || selectedPlant ? "No items match your search criteria." :
                                statusFilter === 'completed' ? "There are no completed items to show." :
                                    "There are no items in the list yet."}
                        </p>
                        {
                            <button className="primary-button" onClick={() => setShowAddSheet(true)}>
                                Add Item
                            </button>
                            }
                    </div>
                ) : (
                    <div className="list-view-table">
                        <div className="list-view-header">
                            <div className="list-column description">Description</div>
                            <div className="list-column plant">Plant</div>
                            <div className="list-column deadline">Deadline</div>
                            {statusFilter === 'completed' && (
                                <div className="list-column completed-date">Completed</div>
                            )}
                            <div className="list-column creator">Created By</div>
                            <div className="list-column status">Status</div>
                        </div>
                        <div className="list-view-rows">
                            {filteredItems.map(item => (
                                <div 
                                    key={item.id} 
                                    className={`list-view-row ${item.completed ? 'completed' : ''}`}
                                    onClick={() => handleSelectItem(item)}
                                >
                                    <div className="list-column description" title={item.description}>
                                        <div className="item-status-dot" style={{
                                            backgroundColor: item.completed ? '#38a169' : item.isOverdue ? '#e53e3e' : '#3182ce',
                                        }}></div>
                                        {truncateText(item.description, 60)}
                                    </div>
                                    <div className="list-column plant" title={getPlantName(item.plantCode)}>
                                        {truncateText(getPlantName(item.plantCode), 20)}
                                    </div>
                                    <div className="list-column deadline">
                                        <span className={item.isOverdue && !item.completed ? 'deadline-overdue' : ''}>
                                            {new Date(item.deadline).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {statusFilter === 'completed' && (
                                        <div className="list-column completed-date">
                                            {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : 'N/A'}
                                        </div>
                                    )}
                                    <div className="list-column creator" title={getCreatorName(item.userId)}>
                                        {truncateText(getCreatorName(item.userId), 20)}
                                    </div>
                                    <div className="list-column status">
                                        {item.completed ? (
                                            <span className="status-badge completed">Completed</span>
                                        ) : item.isOverdue ? (
                                            <span className="status-badge overdue">Overdue</span>
                                        ) : (
                                            <span className="status-badge pending">Pending</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
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
                    <div className="modal-detail-content" onClick={e => e.stopPropagation()} style={{height: '90vh', overflow: 'hidden'}}>
                        <ListDetailView
                            itemId={selectedItem.id}
                            onClose={() => {
                                setShowDetailView(false);
                                setSelectedItem(null);
                                fetchListItems();
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default ListView;