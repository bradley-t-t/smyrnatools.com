import React, {useEffect, useState} from 'react';
import './ManagersView.css';
import {supabase} from '../../core/clients/SupabaseClient';
import {UserService} from '../../services/auth/UserService';
import {DatabaseService} from '../../core/services/DatabaseService';
import ManagerDetailView from './ManagerDetailView';
import MultiSelect from '../common/MultiSelect';
import ManagerCard from './ManagerCard';
import {usePreferences} from '../../context/preferences/PreferencesContext';

function ManagersView({title = 'Manager Roster', showSidebar, setShowSidebar, onSelectManager}) {
    const {preferences, updateManagerFilter, resetManagerFilters} = usePreferences();
    const [managers, setManagers] = useState([]);
    const [plants, setPlants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchText, setSearchText] = useState(preferences.managerFilters?.searchText || '');
    const [selectedPlant, setSelectedPlant] = useState(preferences.managerFilters?.selectedPlant || '');
    const [roleFilter, setRoleFilter] = useState(preferences.managerFilters?.roleFilter || '');
    const [showOverview, setShowOverview] = useState(false);
    const [showDetailView, setShowDetailView] = useState(false);
    const [selectedManager, setSelectedManager] = useState(null);
    // eslint-disable-next-line no-unused-vars
    const [currentUserId, setCurrentUserId] = useState(null);
    const [availableRoles, setAvailableRoles] = useState([]);

    // Keep this for backward compatibility with any other references
    const filterOptions = ['All Roles'];

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Log when roles are updated
    useEffect(() => {
        console.log('Available roles updated:', availableRoles);
    }, [availableRoles]);


    const fetchRoles = async () => {
        try {
            console.log('MANAGERS VIEW: Fetching roles with multiple approaches');

            // 1. Try DatabaseService first (raw SQL)
            try {
                console.log('MANAGERS VIEW: Using DatabaseService to get roles');
                const rolesData = await DatabaseService.getAllRecords('users_roles');
                console.log('MANAGERS VIEW: Roles from DatabaseService:', rolesData);

                if (rolesData && rolesData.length > 0) {
                    console.log('MANAGERS VIEW: Using roles from DatabaseService');
                    setAvailableRoles(rolesData);
                    return; // Exit if this approach worked
                }
            } catch (dbServiceError) {
                console.error('MANAGERS VIEW: DatabaseService error:', dbServiceError.message);
                // Continue to next approach if this failed
            }

            // 2. Try direct Supabase query as fallback
            console.log('MANAGERS VIEW: Directly querying with Supabase');
            const { data, error } = await supabase
                .from('users_roles')
                .select('*');

            if (error) {
                console.error('MANAGERS VIEW: Supabase error:', error);
                throw error;
            }

            console.log('MANAGERS VIEW: Roles from direct Supabase query:', data);

            if (data && Array.isArray(data) && data.length > 0) {
                console.log('MANAGERS VIEW: Using roles from Supabase query');
                setAvailableRoles(data);
            } else {
                console.warn('MANAGERS VIEW: No roles found in database');
                setAvailableRoles([]);
            }
        } catch (error) {
            console.error('MANAGERS VIEW: Error fetching roles:', error.message);
            setAvailableRoles([]);
        }
    };

    // Load filters from preferences when they change
    useEffect(() => {
        if (preferences.managerFilters) {
            setSearchText(preferences.managerFilters.searchText || '');
            setSelectedPlant(preferences.managerFilters.selectedPlant || '');
            setRoleFilter(preferences.managerFilters.roleFilter || '');
        }
    }, [preferences.managerFilters]);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                fetchManagers(),
                fetchPlants(),
                fetchRoles()
            ]);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchManagers = async () => {
        try {
            // First get all users
            const {data: users, error: usersError} = await supabase
                .from('users')
                .select('id, email, created_at, updated_at');

            if (usersError) throw usersError;

            // Then get profiles for those users
            const {data: profiles, error: profilesError} = await supabase
                .from('users_profiles')
                .select('id, first_name, last_name, plant_code, created_at, updated_at');

            if (profilesError) throw profilesError;

            // Then get permissions and roles for those users
            const {data: permissions, error: permissionsError} = await supabase
                .from('users_permissions')
                .select('user_id, role_id');

            if (permissionsError) throw permissionsError;

            // Get all available roles
            const {data: rolesList, error: rolesError} = await supabase
                .from('users_roles')
                .select('id, name, weight');

            if (rolesError) throw rolesError;

            // Combine the data
            const managersData = users.map(user => {
                const profile = profiles.find(p => p.id === user.id) || {};
                const permission = permissions.find(p => p.user_id === user.id) || {};

                // Find the role name and weight from the role_id
                let roleName = 'User'; // Default role
                let roleWeight = 0; // Default weight

                if (permission.role_id) {
                    const role = rolesList.find(r => r.id === permission.role_id);
                    if (role) {
                        roleName = role.name;
                        roleWeight = role.weight || 0;
                    }
                }

                return {
                    id: user.id,
                    email: user.email,
                    firstName: profile.first_name || '',
                    lastName: profile.last_name || '',
                    plantCode: profile.plant_code || '',
                    roleName: roleName,
                    roleWeight: roleWeight,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                };
            });

            setManagers(managersData);
            localStorage.setItem('cachedManagers', JSON.stringify(managersData));
            localStorage.setItem('cachedManagersDate', new Date().toISOString());
        } catch (error) {
            console.error('Error fetching managers:', error);
            const cachedData = localStorage.getItem('cachedManagers');
            const cacheDate = localStorage.getItem('cachedManagersDate');
            if (cachedData && cacheDate) {
                const cachedTime = new Date(cacheDate).getTime();
                const hourAgo = new Date().getTime() - 3600000;
                if (cachedTime > hourAgo) {
                    setManagers(JSON.parse(cachedData));
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


    const filteredManagers = managers
        .filter(manager => {
            const matchesSearch = searchText.trim() === '' ||
                `${manager.firstName} ${manager.lastName}`.toLowerCase().includes(searchText.toLowerCase()) ||
                manager.email.toLowerCase().includes(searchText.toLowerCase());

                const matchesPlant = selectedPlant === '' || manager.plantCode === selectedPlant;

            // Role filter logic
            let matchesRole = true;
            if (roleFilter && roleFilter !== '') {
                // Case insensitive match for role name
                matchesRole = manager.roleName && 
                    manager.roleName.toLowerCase() === roleFilter.toLowerCase();
            }

            return matchesSearch && matchesPlant && matchesRole;
        })
        .sort((a, b) => {
            // Sort by role weight first
            const roleWeights = { 'Admin': 4, 'Manager': 3, 'Supervisor': 2, 'User': 1 };
            const weightA = roleWeights[a.roleName] || 0;
            const weightB = roleWeights[b.roleName] || 0;

            if (weightA !== weightB) return weightB - weightA;

            // Then sort by last name
            return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
        });

    const getPlantName = (plantCode) => {
        const plant = plants.find(p => p.plant_code === plantCode);
        return plant ? plant.plant_name : plantCode || 'No Plant';
    };

    const handleSelectManager = (manager) => {
        setSelectedManager(manager);
        if (onSelectManager) {
            onSelectManager(manager.id);
        } else {
            setShowDetailView(true);
        }
    };

    const roleCounts = availableRoles.map(role => ({
        role: role.name,
        count: managers.filter(m => m.roleName === role.name).length
    }));

    const OverviewPopup = () => (
        <div className="modal-backdrop" onClick={() => setShowOverview(false)}>
            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Managers Overview</h2>
                    <button className="close-button" onClick={() => setShowOverview(false)}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <div className="overview-metrics">
                        <h3>Role Breakdown</h3>
                        <div className="metrics-row">
                            {roleCounts.map(({role, count}) => (
                                <div className="metric-card" key={role}>
                                    <div className="metric-title">{role}</div>
                                    <div className="metric-value">{count}</div>
                                </div>
                            ))}
                        </div>
                        <h3 className="section-title">Plants</h3>
                        <div className="metrics-row">
                            {plants.map(plant => {
                                const count = managers.filter(m => m.plantCode === plant.plant_code).length;
                                return (
                                    <div className="metric-card" key={plant.plant_code}>
                                        <div className="metric-title">{plant.plant_name}</div>
                                        <div className="metric-value">{count}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
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
        <div className="dashboard-container operators-view">
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
                            {(searchText || selectedPlant || (roleFilter && roleFilter !== 'All Roles')) && (
                                <span className="filtered-indicator">(Filtered)</span>
                            )}
                        </h1>
                        <div className="dashboard-actions">
                        </div>
                    </div>

                    <div className="search-filters">
                        <div className="search-bar">
                            <input
                                type="text"
                                className="ios-search-input"
                                placeholder="Search by name or email..."
                                value={searchText}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSearchText(value);
                                    updateManagerFilter('searchText', value);
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
                            <div className="filter-wrapper">
                                <select
                                    className="ios-select"
                                    value={selectedPlant}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSelectedPlant(value);
                                        updateManagerFilter('selectedPlant', value);
                                    }}
                                    aria-label="Filter by plant"
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
                                    value={roleFilter}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setRoleFilter(value);
                                        if (updateManagerFilter) {
                                            updateManagerFilter('roleFilter', value);
                                        } else {
                                            console.warn('updateManagerFilter is not available');
                                        }
                                    }}
                                >
                                    <option value="">All Roles</option>
                                    {availableRoles.map(role => (
                                        <option key={role.id} value={role.name}>
                                            {role.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="debug-info" style={{display: 'none'}}>
                                    Available roles: {JSON.stringify(availableRoles.map(r => r.name))}
                                </div>
                            </div>

                                {(searchText || selectedPlant || (roleFilter && roleFilter !== 'All Roles')) && (
                                <button
                                    className="filter-reset-button"
                                    onClick={() => {
                                        setSearchText('');
                                        setSelectedPlant('');
                                        setRoleFilter('');
                                        if (resetManagerFilters) {
                                            resetManagerFilters();
                                        } else {
                                            console.warn('resetManagerFilters is not available');
                                        }
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
                                <p>Loading managers...</p>
                            </div>
                        ) : filteredManagers.length === 0 ? (
                            <div className="no-results-container">
                                <div className="no-results-icon">
                                    <i className="fas fa-user-tie"></i>
                                </div>
                                <h3>No Managers Found</h3>
                                <p>
                                    {searchText || selectedPlant || (roleFilter && roleFilter !== 'All Roles')
                                        ? "No managers match your search criteria."
                                        : "There are no managers in the system yet."}
                                </p>
                            </div>
                        ) : (
                            <div className={`operators-grid ${searchText ? 'search-results' : ''}`}>
                                {filteredManagers.map(manager => (
                                    <ManagerCard
                                        key={manager.id}
                                        manager={manager}
                                        plantName={getPlantName(manager.plantCode)}
                                        onSelect={handleSelectManager}
                                    />
                                ))}
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
