import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../services/DatabaseService';
import ThemeUtility from '../../../utils/ThemeUtility';
import OperatorCard from '../operators/OperatorCard';
import { UserService } from '../../../services/UserService';
import '../../styles/FilterStyles.css';
import './styles/TeamsView.css';
import LoadingScreen from '../common/LoadingScreen';
import TeamsOverview from './TeamsOverview';

const PLANTS_TABLE = 'plants';
const OPERATORS_TABLE = 'operators';
const TEAMS_TABLE = 'operators_teams';
const OPERATORS_TEAMS_TABLE = 'operators_teams';
const SCHEDULED_OFF_TABLE = 'operators_scheduled_off';

const filterOptions = ['Active', 'Light Duty', 'Pending Start', 'Terminated', 'Training'];

function getUpcomingSaturday(date = new Date()) {
    const day = date.getDay();
    const diff = (6 - day + 7) % 7;
    const saturday = new Date(date);
    saturday.setDate(date.getDate() + diff);
    saturday.setHours(0, 0, 0, 0);
    return saturday;
}

function getTeamWorkingThisSaturday() {
    const referenceSaturday = new Date(2025, 6, 26);
    referenceSaturday.setHours(0, 0, 0, 0);
    const upcomingSaturday = getUpcomingSaturday();
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const diffWeeks = Math.floor((upcomingSaturday - referenceSaturday) / msPerWeek);
    if (diffWeeks % 2 === 0) {
        return {
            A: 'Required to Work this Saturday',
            B: 'Not Required to Work this Saturday'
        };
    } else {
        return {
            A: 'Not Required to Work this Saturday',
            B: 'Required to Work this Saturday'
        };
    }
}

function TeamsView() {
    const [plants, setPlants] = useState([]);
    const [selectedPlant, setSelectedPlant] = useState('');
    const [userPlant, setUserPlant] = useState('');
    const [operators, setOperators] = useState([]);
    const [teams, setTeams] = useState({ A: [], B: [] });
    const [draggedOperator, setDraggedOperator] = useState(null);
    const [dragOverTeam, setDragOverTeam] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('Active');
    const [canBypassPlantRestriction, setCanBypassPlantRestriction] = useState(false);
    const [currentUserId, setCurrentUserId] = useState('');
    const [showOverview, setShowOverview] = useState(false);
    const [scheduledOff, setScheduledOff] = useState({});
    const defaultPlantSet = useRef(false);

    useEffect(() => {
        async function fetchCurrentUser() {
            const user = await UserService.getCurrentUser();
            if (user && user.id) {
                setCurrentUserId(user.id);
            } else {
                setCurrentUserId('');
                console.warn('TeamsView: getCurrentUser() did not return a valid user');
            }
        }
        fetchCurrentUser();
    }, []);

    useEffect(() => {
        async function fetchPlantsAndUserPlant() {
            const { data: plantData } = await supabase.from(PLANTS_TABLE).select('plant_code, plant_name');
            setPlants(plantData || []);
            if (currentUserId) {
                const plant = await UserService.getUserPlant(currentUserId);
                setUserPlant(plant || '');
                setSelectedPlant(plant || '');
            }
        }
        fetchPlantsAndUserPlant();
    }, [currentUserId]);

    useEffect(() => {
        async function checkPermission() {
            if (currentUserId) {
                const hasBypass = await UserService.hasPermission(currentUserId, 'teams.bypass.plantrestriction');
                setCanBypassPlantRestriction(!!hasBypass);
            }
        }
        checkPermission();
    }, [currentUserId]);

    useEffect(() => {
        if (!selectedPlant) {
            setOperators([]);
            setTeams({ A: [], B: [] });
            return;
        }
        setLoading(true);
        async function fetchOperatorsAndTeams() {
            const { data: ops } = await supabase
                .from(OPERATORS_TABLE)
                .select('employee_id, name, plant_code, status, is_trainer, assigned_trainer, position, smyrna_id, pending_start_date')
                .eq('plant_code', selectedPlant);
            const filteredOps = (ops || [])
                .filter(op =>
                    (!statusFilter || op.status === statusFilter)
                )
                .filter(op => op.position && op.position.toLowerCase().includes('mixer'));
            const { data: teamData } = await supabase
                .from(OPERATORS_TEAMS_TABLE)
                .select('employee_id, team')
                .in('employee_id', filteredOps.map(o => o.employee_id));
            const opsWithoutTeam = filteredOps.filter(op => !(teamData || []).some(t => t.employee_id === op.employee_id));
            if (opsWithoutTeam.length > 0) {
                await supabase
                    .from(TEAMS_TABLE)
                    .insert(opsWithoutTeam.map(op => ({
                        employee_id: op.employee_id,
                        team: 'A'
                    })));
                const { data: newTeamData } = await supabase
                    .from(TEAMS_TABLE)
                    .select('employee_id, team')
                    .in('employee_id', filteredOps.map(o => o.employee_id));
                buildTeams(filteredOps, newTeamData);
            } else {
                buildTeams(filteredOps, teamData);
            }
            setOperators(filteredOps);
            setLoading(false);
        }
        function buildTeams(ops, teamData) {
            const teamsObj = { A: [], B: [] };
            ops.forEach(op => {
                const teamEntry = (teamData || []).find(t => t.employee_id === op.employee_id);
                if (teamEntry?.team === 'B') {
                    teamsObj.B.push(op);
                } else {
                    teamsObj.A.push(op);
                }
            });
            setTeams(teamsObj);
        }
        fetchOperatorsAndTeams();
    }, [selectedPlant, statusFilter]);

    useEffect(() => {
        async function fetchScheduledOff() {
            const { data: offData } = await supabase
                .from(SCHEDULED_OFF_TABLE)
                .select('id, days_off');
            const offMap = {};
            (offData || []).forEach(row => {
                offMap[row.id] = row.days_off || [];
            });
            setScheduledOff(offMap);
        }
        fetchScheduledOff();
    }, [selectedPlant]);

    const canEditPlant = canBypassPlantRestriction || (selectedPlant === userPlant && selectedPlant !== '');

    const handleDragStart = (operator, team) => {
        if (!canEditPlant) return;
        setDraggedOperator({ ...operator, fromTeam: team });
    };
    const handleDragEnd = () => { setDraggedOperator(null); setDragOverTeam(null); };
    const handleDragOver = (team) => {
        if (!canEditPlant) return;
        setDragOverTeam(team);
    };
    const handleDrop = async (toTeam) => {
        if (!canEditPlant || !draggedOperator) return;
        setLoading(true);
        await supabase
            .from(TEAMS_TABLE)
            .update({ team: toTeam })
            .eq('employee_id', draggedOperator.employee_id);
        setDraggedOperator(null);
        setDragOverTeam(null);
        const { data: ops } = await supabase
            .from(OPERATORS_TABLE)
            .select('employee_id, name, plant_code, status, is_trainer, assigned_trainer, position, smyrna_id, pending_start_date')
            .eq('plant_code', selectedPlant);
         const filteredOps = (ops || [])
            .filter(op =>
                (!statusFilter || op.status === statusFilter)
            )
            .filter(op => op.position && op.position.toLowerCase().includes('mixer'));
        const { data: teamData } = await supabase
            .from(TEAMS_TABLE)
            .select('employee_id, team')
            .in('employee_id', filteredOps.map(o => o.employee_id));
        const teamsObj = { A: [], B: [] };
        filteredOps.forEach(op => {
            const teamEntry = (teamData || []).find(t => t.employee_id === op.employee_id);
            if (teamEntry?.team === 'B') {
                teamsObj.B.push(op);
            } else {
                teamsObj.A.push(op);
            }
        });
        setOperators(filteredOps);
        setTeams(teamsObj);
        setLoading(false);
    };

    function hasTimeOffForSaturday(operator) {
        const daysOff = scheduledOff[operator.employee_id] || [];
        const saturday = getUpcomingSaturday();
        const saturdayStr = saturday.toISOString().slice(0, 10);
        return daysOff.includes(saturdayStr);
    }

    const filteredTeams = {
        A: teams.A.filter(op => !hasTimeOffForSaturday(op)),
        B: teams.B.filter(op => !hasTimeOffForSaturday(op))
    };

    const teamsForOverview = {
        A: filteredTeams.A,
        B: filteredTeams.B
    };

    const saturdayStatus = getTeamWorkingThisSaturday();

    return (
        <div className="dashboard-container teams-view">
            {}
            {!canEditPlant && selectedPlant !== '' && (
                <div style={{
                    background: '#fffbe6',
                    color: '#b7791f',
                    border: '1px solid #f6e05e',
                    borderRadius: 8,
                    padding: '10px 16px',
                    marginBottom: 12,
                    fontSize: 15,
                    fontWeight: 500
                }}>
                    <i className="fas fa-lock" style={{ marginRight: 8 }}></i>
                    You can only edit teams for your assigned plant.
                </div>
            )}
            <div className="dashboard-header">
                <h1 style={{
                    color: ThemeUtility.color,
                    fontSize: 28,
                    fontWeight: 700,
                    margin: 0
                }}>Teams</h1>
                <div className="dashboard-actions">
                    {}
                </div>
            </div>
            <div className="search-filters">
                <div className="search-bar">
                    <input
                        type="text"
                        className="ios-search-input"
                        placeholder="Search by name or ID..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                    />
                    {searchText && (
                        <button className="clear" onClick={() => setSearchText('')}>
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>
                <div className="filters">
                    <div className="filter-wrapper">
                        <select
                            className="ios-select"
                            value={selectedPlant}
                            onChange={e => setSelectedPlant(e.target.value)}
                            aria-label="Filter by plant"
                        >
                            {plants
                                .sort((a, b) => parseInt(a.plant_code?.replace(/\D/g, '') || '0') - parseInt(b.plant_code?.replace(/\D/g, '') || '0'))
                                .map(plant => (
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
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            {filterOptions.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    {(selectedPlant && selectedPlant !== userPlant) || (statusFilter && statusFilter !== 'Active') ? (
                        <button className="filter-reset-button" onClick={() => {
                            setSearchText('');
                            setSelectedPlant(userPlant || '');
                            setStatusFilter('Active');
                        }}>
                            <i className="fas fa-undo"></i> Reset Filters
                        </button>
                    ) : null}
                    <button className="ios-button" onClick={() => setShowOverview(true)}>
                        <i className="fas fa-chart-bar"></i>
                        Overview
                    </button>
                </div>
            </div>
            <div className="content-container teams-split-table">
                {loading ? (
                    <LoadingScreen message="Loading teams..." inline={true} />
                ) : !selectedPlant ? (
                    <LoadingScreen message="Loading teams..." inline={true} />
                ) : (
                    <>
                        <div className="teams-split-cards">
                            {}
                            <div
                                className={`team-card team-A${dragOverTeam === 'A' ? ' drag-over' : ''}`}
                                onDragOver={e => { e.preventDefault(); handleDragOver('A'); }}
                                onDrop={() => handleDrop('A')}
                                onDragLeave={() => setDragOverTeam(null)}
                            >
                                <div className="team-card-header">
                                    A Team
                                    <span
                                        className="team-saturday-status"
                                        style={{
                                            marginLeft: 12,
                                            fontSize: 14,
                                            fontWeight: 500
                                        }}
                                    >
                                        {saturdayStatus.A}
                                    </span>
                                </div>
                                <div className="team-card-body">
                                    {filteredTeams.A.filter(op =>
                                        (!searchText ||
                                            op.name.toLowerCase().includes(searchText.toLowerCase()) ||
                                            (op.smyrna_id && op.smyrna_id.toLowerCase().includes(searchText.toLowerCase())))
                                    ).length === 0 && (
                                        <div className="no-operators">
                                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                                <i className="fas fa-hand-pointer" style={{ fontSize: 28, color: '#3182ce' }}></i>
                                                No operators<br />
                                                <span style={{ fontSize: 13, color: '#3182ce' }}>Drag and drop cards to move operators between teams.</span>
                                            </span>
                                        </div>
                                    )}
                                    {filteredTeams.A.filter(op =>
                                        (!searchText ||
                                            op.name.toLowerCase().includes(searchText.toLowerCase()) ||
                                            (op.smyrna_id && op.smyrna_id.toLowerCase().includes(searchText.toLowerCase())))
                                    ).map(op => (
                                        <div
                                            key={op.employee_id}
                                            draggable={canEditPlant}
                                            onDragStart={() => handleDragStart(op, 'A')}
                                            onDragEnd={handleDragEnd}
                                            className="operator-card-wrapper"
                                            style={!canEditPlant ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                        >
                                            <OperatorCard
                                                operator={{
                                                    ...op,
                                                    employeeId: op.employee_id,
                                                    smyrnaId: op.smyrna_id,
                                                    pendingStartDate: op.pending_start_date,
                                                    isTrainer: op.is_trainer
                                                }}
                                                plantName={plants.find(p => p.plant_code === selectedPlant)?.plant_name || selectedPlant}
                                                trainers={teams.A.concat(teams.B)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {}
                            <div
                                className={`team-card team-B${dragOverTeam === 'B' ? ' drag-over' : ''}`}
                                onDragOver={e => { e.preventDefault(); handleDragOver('B'); }}
                                onDrop={() => handleDrop('B')}
                                onDragLeave={() => setDragOverTeam(null)}
                            >
                                <div className="team-card-header">
                                    B Team
                                    <span
                                        className="team-saturday-status"
                                        style={{
                                            marginLeft: 12,
                                            fontSize: 14,
                                            fontWeight: 500
                                        }}
                                    >
                                        {saturdayStatus.B}
                                    </span>
                                </div>
                                <div className="team-card-body">
                                    {filteredTeams.B.filter(op =>
                                        (!searchText ||
                                            op.name.toLowerCase().includes(searchText.toLowerCase()) ||
                                            (op.smyrna_id && op.smyrna_id.toLowerCase().includes(searchText.toLowerCase())))
                                    ).length === 0 && (
                                        <div className="no-operators">
                                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                                <i className="fas fa-hand-pointer" style={{ fontSize: 28, color: '#3182ce' }}></i>
                                                No operators<br />
                                                <span style={{ fontSize: 13, color: '#3182ce' }}>Drag and drop cards to move operators between teams.</span>
                                            </span>
                                        </div>
                                    )}
                                    {filteredTeams.B.filter(op =>
                                        (!searchText ||
                                            op.name.toLowerCase().includes(searchText.toLowerCase()) ||
                                            (op.smyrna_id && op.smyrna_id.toLowerCase().includes(searchText.toLowerCase())))
                                    ).map(op => (
                                        <div
                                            key={op.employee_id}
                                            draggable={canEditPlant}
                                            onDragStart={() => handleDragStart(op, 'B')}
                                            onDragEnd={handleDragEnd}
                                            className="operator-card-wrapper"
                                            style={!canEditPlant ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                        >
                                            <OperatorCard
                                                operator={{
                                                    ...op,
                                                    employeeId: op.employee_id,
                                                    smyrnaId: op.smyrna_id,
                                                    pendingStartDate: op.pending_start_date,
                                                    isTrainer: op.is_trainer
                                                }}
                                                plantName={plants.find(p => p.plant_code === selectedPlant)?.plant_name || selectedPlant}
                                                trainers={teams.A.concat(teams.B)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#888' }}>
                            <em>
                                Saturday rotation reference: <b>July 26, 2025</b> is an <b>A Team Required to Work</b> Saturday. Teams alternate weekly.
                            </em>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: '#888' }}>
                            <em>
                                Operators scheduled off for this Saturday will not be listed.
                            </em>
                        </div>
                    </>
                )}
            </div>
            {}
            {showOverview && (
                <TeamsOverview
                    onClose={() => setShowOverview(false)}
                    teams={teamsForOverview}
                />
            )}
        </div>
    );
}

export default TeamsView;
