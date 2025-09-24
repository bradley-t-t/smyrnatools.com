import React, {useEffect, useState} from 'react';
import './styles/ManagersView.css';
import {DatabaseService, supabase} from '../../services/DatabaseService';
import {UserService} from '../../services/UserService';
import LoadingScreen from '../common/LoadingScreen';
import ManagerDetailView from './ManagerDetailView';
import ManagerCard from './ManagerCard';
import {usePreferences} from '../../app/context/PreferencesContext';
import {RegionService} from '../../services/RegionService'

function ManagersView({title = 'Managers', onSelectManager}) {
    const {preferences, updateManagerFilter, resetManagerFilters} = usePreferences()
    const [managers, setManagers] = useState([])
    const [plants, setPlants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState(preferences.managerFilters?.searchText || '')
    const [selectedPlant, setSelectedPlant] = useState(preferences.managerFilters?.selectedPlant || '')
    const [roleFilter, setRoleFilter] = useState(preferences.managerFilters?.roleFilter || '')
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
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)

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

    useEffect(() => {
        const prefCode = preferences.selectedRegion?.code || ''
        let cancelled = false
        async function loadRegionPlants() {
            let regionCode = prefCode
            try {
                if (!regionCode) {
                    const user = await UserService.getCurrentUser()
                    const uid = user?.id || ''
                    if (uid) {
                        const profilePlant = await UserService.getUserPlant(uid)
                        const plantCode = typeof profilePlant === 'string' ? profilePlant : (profilePlant?.plant_code || profilePlant?.plantCode || '')
                        if (plantCode) {
                            const regions = await RegionService.fetchRegionsByPlantCode(plantCode)
                            const r = Array.isArray(regions) && regions.length ? regions[0] : null
                            regionCode = r ? (r.regionCode || r.region_code || '') : ''
                        }
                    }
                }
                if (!regionCode) {
                    setRegionPlantCodes(null)
                    return
                }
                const regionPlants = await RegionService.fetchRegionPlants(regionCode)
                if (cancelled) return
                const codes = new Set(regionPlants.map(p => String(p.plantCode || p.plant_code || '').trim().toUpperCase()).filter(Boolean))
                setRegionPlantCodes(codes)
                const sel = String(selectedPlant || '').trim().toUpperCase()
                if (sel && !codes.has(sel)) {
                    setSelectedPlant('')
                    updateManagerFilter('selectedPlant', '')
                }
            } catch {
                if (!cancelled) setRegionPlantCodes(null)
            }
        }
        loadRegionPlants()
        return () => {
            cancelled = true
        }
    }, [preferences.selectedRegion?.code])

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
            const [{data: users, error: usersError}, {data: profiles, error: profilesError}, {data: permissions, error: permissionsError}, {data: rolesList, error: rolesError}] = await Promise.all([
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
            const matchesSearch = !searchText.trim() || `${manager.firstName} ${manager.lastName}`.toLowerCase().includes(searchText.toLowerCase()) || manager.email.toLowerCase().includes(searchText.toLowerCase());
            const matchesPlant = !selectedPlant || manager.plantCode === selectedPlant;
            const matchesRole = !roleFilter || (manager.roleName && manager.roleName.toLowerCase() === roleFilter.toLowerCase());
            const matchesRegion = !regionPlantCodes || regionPlantCodes.size === 0 || regionPlantCodes.has(String(manager.plantCode || '').trim().toUpperCase());
            return matchesSearch && matchesPlant && matchesRole && matchesRegion;
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
                    <div className="managers-sticky-header">
                        <div className="dashboard-header">
                            <h1>{title}</h1>
                            <div className="dashboard-actions"></div>
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
                                        {plants
                                            .filter(p => {
                                                const code = String(p.plant_code || p.plantCode || '').trim().toUpperCase()
                                                return regionPlantCodes && regionPlantCodes.size > 0 ? regionPlantCodes.has(code) : true
                                            })
                                            .sort((a, b) => parseInt((a.plant_code || a.plantCode || '').replace(/\D/g, '') || '0') - parseInt((b.plant_code || b.plantCode || '').replace(/\D/g, '') || '0'))
                                            .map(plant => (
                                                <option key={plant.plant_code || plant.plantCode} value={plant.plant_code || plant.plantCode}>
                                                    ({plant.plant_code || plant.plantCode}) {plant.plant_name || plant.plantName}
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
                            </div>
                        </div>
                        {viewMode === 'list' && (
                            <div className="managers-list-header-row">
                                <div>Plant</div>
                                <div>Email</div>
                                <div>First Name</div>
                                <div>Last Name</div>
                                <div>Role</div>
                            </div>
                        )}
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
                                    <colgroup>
                                        <col style={{width: '12%'}}/>
                                        <col style={{width: '28%'}}/>
                                        <col style={{width: '18%'}}/>
                                        <col style={{width: '18%'}}/>
                                        <col style={{width: '24%'}}/>
                                    </colgroup>
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
                                    <colgroup>
                                        <col style={{width: '12%'}}/>
                                        <col style={{width: '28%'}}/>
                                        <col style={{width: '18%'}}/>
                                        <col style={{width: '18%'}}/>
                                        <col style={{width: '24%'}}/>
                                    </colgroup>
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
                </>
            )}
        </div>
    );
}

export default ManagersView;