import React, {useEffect, useState} from 'react';
import './styles/ManagersView.css';
import {DatabaseService, supabase} from '../../services/DatabaseService';
import {UserService} from '../../services/UserService';
import LoadingScreen from '../common/LoadingScreen';
import ManagerDetailView from './ManagerDetailView';
import ManagerCard from './ManagerCard';
import {usePreferences} from '../../app/context/PreferencesContext';

function ManagersView({title = 'Managers', onSelectManager}) {
    const {preferences, updateManagerFilter, resetManagerFilters} = usePreferences()
    const [managers, setManagers] = useState([])
    const [plants, setPlants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState(preferences.managerFilters?.searchText || '')
    const [selectedPlant, setSelectedPlant] = useState(preferences.managerFilters?.selectedPlant || '')
    const [roleFilter, setRoleFilter] = useState(preferences.managerFilters?.roleFilter || '')
    const [showOverview, setShowOverview] = useState(false)
    const [showDetailView, setShowDetailView] = useState(false)
    const [selectedManager, setSelectedManager] = useState(null)
    const [, setCurrentUserId] = useState(null)
    const [availableRoles, setAvailableRoles] = useState([])
    const [viewMode, setViewMode] = useState(() => {
        if (preferences.managerFilters?.viewMode !== undefined && preferences.managerFilters?.viewMode !== null) return preferences.managerFilters.viewMode
        if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) return preferences.defaultViewMode
        const lastUsed = localStorage.getItem('managers_last_view_mode')
        return lastUsed || 'grid'
    })

    useEffect(() => {
        async function fetchCurrentUser() {
            const user = await UserService.getCurrentUser();
            if (user) setCurrentUserId(user.id);
        }

        fetchCurrentUser();
    }, []);

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        if (preferences.managerFilters) {
            setSearchText(preferences.managerFilters.searchText || '');
            setSelectedPlant(preferences.managerFilters.selectedPlant || '');
            setRoleFilter(preferences.managerFilters.roleFilter || '');
            setViewMode(preferences.managerFilters.viewMode || preferences.defaultViewMode || 'grid');
        }
    }, [preferences.managerFilters, preferences.defaultViewMode]);

    useEffect(() => {
        if (preferences.managerFilters?.viewMode !== undefined && preferences.managerFilters?.viewMode !== null) {
            setViewMode(preferences.managerFilters.viewMode)
        } else if (preferences.defaultViewMode !== undefined && preferences.defaultViewMode !== null) {
            setViewMode(preferences.defaultViewMode)
        } else {
            const lastUsed = localStorage.getItem('managers_last_view_mode')
            if (lastUsed) setViewMode(lastUsed)
        }
    }, [preferences.managerFilters?.viewMode, preferences.defaultViewMode])

    function handleViewModeChange(mode) {
        if (viewMode === mode) {
            setViewMode(null)
            updateManagerFilter('viewMode', null)
            localStorage.removeItem('managers_last_view_mode')
        } else {
            setViewMode(mode)
            updateManagerFilter('viewMode', mode)
            localStorage.setItem('managers_last_view_mode', mode)
        }
    }

    async function fetchAllData() {
        setIsLoading(true);
        try {
            await Promise.all([fetchManagers(), fetchPlants(), fetchRoles()]);
        } catch (error) {
        } finally {
            setIsLoading(false);
        }
    }

    async function fetchManagers() {
        try {
            const [{data: users, error: usersError}, {data: profiles, error: profilesError}, {
                data: permissions,
                error: permissionsError
            }, {data: rolesList, error: rolesError}] = await Promise.all([
                supabase.from('users').select('id, email, created_at, updated_at'),
                supabase.from('users_profiles').select('id, first_name, last_name, plant_code, created_at, updated_at'),
                supabase.from('users_permissions').select('user_id, role_id'),
                supabase.from('users_roles').select('id, name, weight')
            ]);
            if (usersError) throw usersError;
            if (profilesError) throw profilesError;
            if (permissionsError) throw permissionsError;
            if (rolesError) throw rolesError;
            const managersData = users.map(user => {
                const profile = profiles.find(p => p.id === user.id) || {};
                const permission = permissions.find(p => p.user_id === user.id) || {};
                const role = permission.role_id ? rolesList.find(r => r.id === permission.role_id) : null;
                return {
                    id: user.id,
                    email: user.email,
                    firstName: profile.first_name || '',
                    lastName: profile.last_name || '',
                    plantCode: profile.plant_code || '',
                    roleName: role?.name || 'User',
                    roleWeight: role?.weight || 0,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                };
            });
            setManagers(managersData);
            localStorage.setItem('cachedManagers', JSON.stringify(managersData));
            localStorage.setItem('cachedManagersDate', new Date().toISOString());
        } catch (error) {
            const cachedData = localStorage.getItem('cachedManagers');
            const cacheDate = localStorage.getItem('cachedManagersDate');
            if (cachedData && cacheDate && new Date(cacheDate).getTime() > new Date().getTime() - 3600000) {
                setManagers(JSON.parse(cachedData));
            }
        }
    }

    async function fetchPlants() {
        try {
            const {data, error} = await supabase.from('plants').select('*');
            if (error) throw error;
            setPlants(data);
        } catch (error) {
        }
    }

    async function fetchRoles() {
        try {
            const rolesData = await DatabaseService.getAllRecords('users_roles');
            if (rolesData?.length) {
                setAvailableRoles(rolesData);
                return;
            }
            const {data, error} = await supabase.from('users_roles').select('*');
            if (error) throw error;
            setAvailableRoles(data || []);
        } catch (error) {
            setAvailableRoles([]);
        }
    }

    const filteredManagers = managers
        .filter(manager => {
            const matchesSearch = !searchText.trim() ||
                `${manager.firstName} ${manager.lastName}`.toLowerCase().includes(searchText.toLowerCase()) ||
                manager.email.toLowerCase().includes(searchText.toLowerCase());
            const matchesPlant = !selectedPlant || manager.plantCode === selectedPlant;
            const matchesRole = !roleFilter || (manager.roleName && manager.roleName.toLowerCase() === roleFilter.toLowerCase());
            return matchesSearch && matchesPlant && matchesRole;
        })
        .sort((a, b) => {
            const roleWeights = {'Admin': 4, 'Manager': 3, 'Supervisor': 2, 'User': 1};
            const weightA = roleWeights[a.roleName] || 0;
            const weightB = roleWeights[b.roleName] || 0;
            return weightA !== weightB ? weightB - weightA : `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
        });

    const getPlantName = plantCode => {
        const plant = plants.find(p => p.plant_code === plantCode);
        return plant ? plant.plant_name : plantCode || 'No Plant';
    };

    const handleSelectManager = manager => {
        setSelectedManager(manager);
        onSelectManager ? onSelectManager(manager.id) : setShowDetailView(true);
    };

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const pad = n => n.toString().padStart(2, '0');
        const yyyy = date.getFullYear();
        const mm = pad(date.getMonth() + 1);
        const dd = pad(date.getDate());
        const hh = pad(date.getHours());
        const min = pad(date.getMinutes());
        return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
    }

    function getFiltersAppliedString() {
        const filters = [];
        if (searchText) filters.push(`Search: ${searchText}`);
        if (selectedPlant) {
            const plant = plants.find(p => p.plant_code === selectedPlant);
            filters.push(`Plant: ${plant ? plant.plant_name : selectedPlant}`);
        }
        if (roleFilter) filters.push(`Role: ${roleFilter}`);
        return filters.length ? filters.join(', ') : 'No Filters';
    }

    function exportManagersToCSV(managersToExport) {
        if (!managersToExport || managersToExport.length === 0) return;
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const yyyy = now.getFullYear();
        const mm = pad(now.getMonth() + 1);
        const dd = pad(now.getDate());
        const hh = pad(now.getHours());
        const min = pad(now.getMinutes());
        const formattedNow = `${mm}-${dd}-${yyyy} ${hh}-${min}`;
        const filtersApplied = getFiltersAppliedString();
        const fileName = `Manager Export - ${formattedNow} - ${filtersApplied}.csv`;
        const topHeader = `Manager Export - ${formattedNow} - ${filtersApplied}`;
        const headers = [
            'Email',
            'First Name',
            'Last Name',
            'Plant',
            'Role',
            'Created At',
            'Updated At'
        ];
        const rows = managersToExport.map(m => [
            m.email || '',
            m.firstName || '',
            m.lastName || '',
            getPlantName(m.plantCode),
            m.roleName || '',
            formatDate(m.createdAt),
            formatDate(m.updatedAt)
        ]);
        const csvContent = [
            `"${topHeader}"`,
            headers.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','),
            ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], {type: 'text/csv'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    const OverviewPopup = () => (
        <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
            <div
                className="modal-content overview-modal managers-overview-modal"
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2>Managers Overview</h2>
                    <button className="close-button" onClick={() => setShowOverview(false)}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="overview-grid">
                    <div className="overview-card plant-card">
                        <h2 style={{marginLeft: 10}}>Plant Distribution</h2>
                        <div className="plant-distribution-table">
                            <table className="distribution-table">
                                <thead>
                                <tr>
                                    <th>Plant</th>
                                    <th>Managers</th>
                                </tr>
                                </thead>
                                <tbody>
                                {plants.map(plant => (
                                    <tr key={plant.plant_code}>
                                        <td className="plant-name">{plant.plant_name}</td>
                                        <td>{managers.filter(m => m.plantCode === plant.plant_code).length}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div className="modal-footer" style={{marginTop: 24, textAlign: 'right'}}>
                    <button className="primary-button" onClick={() => setShowOverview(false)}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="dashboard-container managers-view">
            {showDetailView && selectedManager && (
                <ManagerDetailView
                    managerId={selectedManager.id}
                    onClose={() => {
                        setShowDetailView(false);
                        fetchManagers();
                    }}
                />
            )}
            {!showDetailView && (
                <>
                    <div className="dashboard-header">
                        <h1>
                            {title}
                            {(searchText || selectedPlant || roleFilter) && (
                                <span className="filtered-indicator">(Filtered)</span>
                            )}
                        </h1>
                        <div className="dashboard-actions">
                            <button
                                className="action-button primary rectangular-button"
                                style={{marginRight: 8, minWidth: 210}}
                                onClick={() => exportManagersToCSV(filteredManagers)}
                            >
                                <i className="fas fa-file-export" style={{marginRight: 8}}></i> Export
                            </button>
                        </div>
                    </div>
                    <div className="search-filters">
                        <div className="search-bar">
                            <input
                                type="text"
                                className="ios-search-input"
                                placeholder="Search by name or email..."
                                value={searchText}
                                onChange={e => {
                                    setSearchText(e.target.value);
                                    updateManagerFilter('searchText', e.target.value);
                                }}
                            />
                            {searchText && (
                                <button className="clear" onClick={() => {
                                    setSearchText('');
                                    updateManagerFilter('searchText', '');
                                }}>
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>
                        <div className="filters">
                            <div className="view-toggle-icons">
                                <button
                                    className={`view-toggle-btn${viewMode === 'grid' ? ' active' : ''}`}
                                    onClick={() => handleViewModeChange('grid')}
                                    aria-label="Grid view"
                                    type="button"
                                >
                                    <i className="fas fa-th-large"></i>
                                </button>
                                <button
                                    className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
                                    onClick={() => handleViewModeChange('list')}
                                    aria-label="List view"
                                    type="button"
                                >
                                    <i className="fas fa-list"></i>
                                </button>
                            </div>
                            <div className="filter-wrapper">
                                <select
                                    className="ios-select"
                                    value={selectedPlant}
                                    onChange={e => {
                                        setSelectedPlant(e.target.value);
                                        updateManagerFilter('selectedPlant', e.target.value);
                                    }}
                                    aria-label="Filter by plant"
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
                                    value={roleFilter}
                                    onChange={e => {
                                        setRoleFilter(e.target.value);
                                        updateManagerFilter('roleFilter', e.target.value);
                                    }}
                                >
                                    <option value="">All Roles</option>
                                    {availableRoles.map(role => (
                                        <option key={role.id} value={role.name}>{role.name}</option>
                                    ))}
                                </select>
                            </div>
                            {(searchText || selectedPlant || roleFilter) && (
                                <button className="filter-reset-button" onClick={() => {
                                    const currentViewMode = viewMode
                                    setSearchText('')
                                    setSelectedPlant('')
                                    setRoleFilter('')
                                    resetManagerFilters?.({keepViewMode: true, currentViewMode})
                                }}>
                                    <i className="fas fa-undo"></i>
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
                                <LoadingScreen message="Loading managers..." inline={true}/>
                            </div>
                        ) : filteredManagers.length === 0 ? (
                            <div className="no-results-container">
                                <div className="no-results-icon">
                                    <i className="fas fa-user-tie"></i>
                                </div>
                                <h3>No Managers Found</h3>
                                <p>{searchText || selectedPlant || roleFilter ? "No managers match your search criteria." : "There are no managers in the system yet."}</p>
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className={`managers-grid ${searchText ? 'search-results' : ''}`}>
                                {filteredManagers.map(manager => (
                                    <ManagerCard key={manager.id} manager={manager}
                                                 plantName={getPlantName(manager.plantCode)}
                                                 onSelect={() => handleSelectManager(manager)}/>
                                ))}
                            </div>
                        ) : viewMode === 'list' ? (
                            <div className="managers-list-table-container">
                                <table className="managers-list-table">
                                    <thead>
                                    <tr>
                                        <th>Plant</th>
                                        <th>Email</th>
                                        <th>First Name</th>
                                        <th>Last Name</th>
                                        <th>Role</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {filteredManagers.map(manager => (
                                        <tr key={manager.id} onClick={() => handleSelectManager(manager)}
                                            style={{cursor: 'pointer'}}>
                                            <td>{manager.plantCode ? manager.plantCode : "---"}</td>
                                            <td>{manager.email ? manager.email : "---"}</td>
                                            <td>{manager.firstName ? manager.firstName : "---"}</td>
                                            <td>{manager.lastName ? manager.lastName : "---"}</td>
                                            <td>{manager.roleName ? manager.roleName : "---"}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="managers-list-table-container">
                                <table className="managers-list-table">
                                    <thead>
                                    <tr>
                                        <th>Plant</th>
                                        <th>Email</th>
                                        <th>First Name</th>
                                        <th>Last Name</th>
                                        <th>Role</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {filteredManagers.map(manager => (
                                        <tr key={manager.id} onClick={() => handleSelectManager(manager)}
                                            style={{cursor: 'pointer'}}>
                                            <td>{manager.plantCode ? manager.plantCode : "---"}</td>
                                            <td>{manager.email ? manager.email : "---"}</td>
                                            <td>{manager.firstName ? manager.firstName : "---"}</td>
                                            <td>{manager.lastName ? manager.lastName : "---"}</td>
                                            <td>{manager.roleName ? manager.roleName : "---"}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    {showOverview && <OverviewPopup/>}
                </>
            )}
        </div>
    );
}

export default ManagersView;
