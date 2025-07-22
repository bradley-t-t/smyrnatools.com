import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/DatabaseService';
import LoadingScreen from '../../common/LoadingScreen';
import OperatorCard from '../OperatorCard';
import { UserService } from '../../../services/UserService';
import './OperatorScheduledOffView.css';

const OPERATORS_TABLE = 'operators';
const PLANTS_TABLE = 'plants';
const SCHEDULED_OFF_TABLE = 'operators_scheduled_off';

const statusOptions = ['All Statuses', 'Active', 'Light Duty', 'Pending Start', 'Terminated', 'Training'];

function RequestOffModal({ operator, daysOff, onClose, onSave }) {
    const [dates, setDates] = useState(daysOff || []);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleDateChange = (idx, value) => {
        const newDates = [...dates];
        newDates[idx] = value;
        setDates(newDates);
    };

    const addDateField = () => setDates([...dates, '']);
    const removeDateField = idx => setDates(dates.filter((_, i) => i !== idx));

    const handleClearDates = () => setDates([]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccess(false);

        const filteredDates = Array.from(new Set(dates.filter(d => d)));

        const { data: existing } = await supabase
            .from(SCHEDULED_OFF_TABLE)
            .select('uuid')
            .eq('id', operator.employee_id)
            .single();

        let result;
        if (existing && existing.uuid) {
            result = await supabase
                .from(SCHEDULED_OFF_TABLE)
                .update({ days_off: filteredDates, updated_at: new Date().toISOString() })
                .eq('uuid', existing.uuid);
        } else {
            result = await supabase
                .from(SCHEDULED_OFF_TABLE)
                .insert([{ id: operator.employee_id, days_off: filteredDates }]);
        }

        if (result.error) {
            setError('Failed to save days off.');
        } else {
            setSuccess(true);
            onSave(filteredDates);
        }
        setSubmitting(false);
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                        <span style={{
                            background: 'var(--accent-light, #63b3ed)',
                            borderRadius: '50%',
                            padding: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(49,130,206,0.10)'
                        }}>
                            <i className="fas fa-calendar-times" style={{ fontSize: 24, color: '#fff' }}></i>
                        </span>
                        <div style={{ flex: 1 }}>
                            <h2 style={{
                                margin: 0,
                                fontSize: 22,
                                fontWeight: 700,
                                color: '#fff',
                                letterSpacing: '0.5px'
                            }}>
                                Edit Time Off for {operator.name}
                            </h2>
                        </div>
                        <button className="close-button" onClick={onClose}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleSubmit} className="request-off-form" style={{ maxWidth: 400, margin: '0 auto' }}>
                        <div className="dates-list">
                            {dates.map((date, idx) => (
                                <div key={idx} className="date-input-row" style={{ marginBottom: 14 }}>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={e => handleDateChange(idx, e.target.value)}
                                        required
                                        style={{
                                            flex: 1,
                                            fontSize: 16,
                                            padding: '12px 16px',
                                            borderRadius: 10,
                                            border: '1.5px solid var(--accent-light, #63b3ed)',
                                            background: '#fff',
                                            color: '#222',
                                            boxShadow: '0 2px 8px rgba(49,130,206,0.06)'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="remove-date-btn"
                                        onClick={() => removeDateField(idx)}
                                        title="Remove date"
                                        style={{ marginLeft: 8 }}
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button type="button" className="add-date-btn" onClick={addDateField} style={{ width: '100%', marginBottom: 10 }}>
                            <i className="fas fa-plus"></i> Add Date
                        </button>
                        <button
                            type="button"
                            className="add-date-btn"
                            onClick={handleClearDates}
                            style={{ width: '100%', marginBottom: 10, background: '#f3f4f6', color: '#222', border: '1px solid #cbd5e1' }}
                        >
                            <i className="fas fa-eraser"></i> Clear Dates
                        </button>
                        <button type="submit" className="submit-btn" disabled={submitting} style={{ width: '100%', marginTop: 8 }}>
                            {submitting ? 'Submitting...' : 'Save Time Off'}
                        </button>
                        {error && <div className="error-message">{error}</div>}
                        {success && <div className="success-message">Saved!</div>}
                    </form>
                </div>
            </div>
        </div>
    );
}

function UpcomingDaysOffModal({ fetchUpcomingDaysOff, onClose }) {
    const [loading, setLoading] = useState(true);
    const [upcomingDaysOff, setUpcomingDaysOff] = useState([]);

    useEffect(() => {
        async function fetchLatest() {
            setLoading(true);
            const [{ data: ops }, { data: plantData }, { data: offData }] = await Promise.all([
                supabase.from(OPERATORS_TABLE).select('employee_id, name, plant_code, smyrna_id'),
                supabase.from(PLANTS_TABLE).select('plant_code, plant_name'),
                supabase.from(SCHEDULED_OFF_TABLE).select('id, days_off')
            ]);
            const today = new Date();
            today.setHours(0,0,0,0);
            const summary = [];
            (offData || []).forEach(row => {
                if (Array.isArray(row.days_off)) {
                    row.days_off.forEach(dateStr => {
                        const [year, month, day] = dateStr.split('-');
                        const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
                        dateObj.setHours(0,0,0,0);
                        if (dateObj >= today) {
                            const operator = (ops || []).find(op => op.employee_id === row.id);
                            if (operator) {
                                const plantName = (plantData || []).find(p => p.plant_code === operator.plant_code)?.plant_name || operator.plant_code;
                                summary.push({
                                    name: operator.name,
                                    plant: plantName,
                                    date: dateObj,
                                    smyrnaId: operator.smyrna_id
                                });
                            }
                        }
                    });
                }
            });
            summary.sort((a, b) => a.date - b.date);
            setUpcomingDaysOff(summary);
            setLoading(false);
        }
        fetchLatest();
    }, [fetchUpcomingDaysOff]);

    function groupUpcomingDaysOff(upcomingDaysOff) {
        const now = new Date();
        now.setHours(0,0,0,0);
        const today = new Date(now);
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const startOfNextWeek = new Date(endOfWeek);
        startOfNextWeek.setDate(endOfWeek.getDate() + 1);
        const endOfNextWeek = new Date(startOfNextWeek);
        endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);

        const sections = {
            Today: [],
            Tomorrow: [],
            'This Week': [],
            'Next Week': [],
            Future: []
        };

        upcomingDaysOff.forEach(item => {
            const d = new Date(item.date);
            d.setHours(0,0,0,0);
            if (d.getTime() === today.getTime()) {
                sections.Today.push(item);
            } else if (d.getTime() === tomorrow.getTime()) {
                sections.Tomorrow.push(item);
            } else if (d > tomorrow && d <= endOfWeek) {
                sections['This Week'].push(item);
            } else if (d >= startOfNextWeek && d <= endOfNextWeek) {
                sections['Next Week'].push(item);
            } else if (d > endOfNextWeek) {
                sections.Future.push(item);
            }
        });

        return sections;
    }

    const grouped = groupUpcomingDaysOff(upcomingDaysOff);

    const sectionIcons = {
        Today: <i className="fas fa-sun section-icon" />,
        Tomorrow: <i className="fas fa-arrow-right section-icon" />,
        'This Week': <i className="fas fa-calendar-week section-icon" />,
        'Next Week': <i className="fas fa-calendar-plus section-icon" />,
        Future: <i className="fas fa-forward section-icon" />
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: '#fff',
                        letterSpacing: '0.5px',
                        margin: 0
                    }}>
                        <i className="fas fa-calendar-alt" style={{ marginRight: 10 }} /> Upcoming Scheduled Days Off
                    </h2>
                    <button className="close-button" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    {loading ? (
                        <LoadingScreen message="Loading upcoming days off..." inline={true} />
                    ) : Object.keys(grouped).every(key => grouped[key].length === 0) ? (
                        <div className="no-days-off">No upcoming days off scheduled.</div>
                    ) : (
                        <div className="upcoming-days-list">
                            {Object.entries(grouped).map(([section, items]) =>
                                items.length > 0 && (
                                    <div key={section}>
                                        <div className="upcoming-section-header">
                                            {sectionIcons[section]}
                                            {section}
                                        </div>
                                        {items.map((item, idx) => (
                                            <div key={idx} className="upcoming-day-row">
                                                <span className="upcoming-day-date">
                                                    <i className="fas fa-calendar-day" style={{ color: '#3182ce' }} /> {item.date.toLocaleDateString()}
                                                </span>
                                                <span className="upcoming-day-operator">
                                                    <i className="fas fa-user" style={{ color: '#2563eb' }} /> {item.name}
                                                    {item.smyrnaId && <span className="upcoming-day-id">({item.smyrnaId})</span>}
                                                </span>
                                                <span className="upcoming-day-plant">
                                                    <i className="fas fa-industry" style={{ color: '#4a5568' }} /> {item.plant}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function OperatorScheduledOffView() {
    const [loading, setLoading] = useState(true);
    const [operators, setOperators] = useState([]);
    const [plants, setPlants] = useState([]);
    const [scheduledOff, setScheduledOff] = useState({});
    const [searchText, setSearchText] = useState('');
    const [selectedPlant, setSelectedPlant] = useState('');
    const [statusFilter, setStatusFilter] = useState('Active');
    const [selectedOperator, setSelectedOperator] = useState(null);
    const [modalDaysOff, setModalDaysOff] = useState([]);
    const [showUpcoming, setShowUpcoming] = useState(false);

    const [currentUser, setCurrentUser] = useState(null);
    const [userPlant, setUserPlant] = useState('');
    const [canBypassPlantRestriction, setCanBypassPlantRestriction] = useState(false);

    useEffect(() => {
        async function fetchUserAndPlant() {
            const user = await UserService.getCurrentUser();
            setCurrentUser(user);
            let plant = '';
            if (user && user.id) {
                plant = await UserService.getUserPlant(user.id);
                setUserPlant(plant || '');
                setSelectedPlant(plant || '');
                const hasBypass = await UserService.hasPermission(user.id, 'operator_scheduled_off.bypass.plantrestriction');
                setCanBypassPlantRestriction(!!hasBypass);
            }
        }
        fetchUserAndPlant();
    }, []);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            const [{ data: ops }, { data: plantData }, { data: offData }] = await Promise.all([
                supabase.from(OPERATORS_TABLE).select('employee_id, name, plant_code, status, is_trainer, assigned_trainer, position, smyrna_id, pending_start_date'),
                supabase.from(PLANTS_TABLE).select('plant_code, plant_name'),
                supabase.from(SCHEDULED_OFF_TABLE).select('id, days_off')
            ]);
            setOperators(ops || []);
            setPlants(plantData || []);
            const offMap = {};
            (offData || []).forEach(row => {
                offMap[row.id] = row.days_off || [];
            });
            setScheduledOff(offMap);
            setLoading(false);
        }
        fetchData();
    }, []);

    const canEditPlant = canBypassPlantRestriction || (selectedPlant === userPlant && selectedPlant !== '');

    const filteredOperators = operators
        .filter(op =>
            (!searchText ||
                op.name.toLowerCase().includes(searchText.toLowerCase()) ||
                (op.smyrna_id && op.smyrna_id.toLowerCase().includes(searchText.toLowerCase()))
            ) &&
            (!selectedPlant || op.plant_code === selectedPlant) &&
            (!statusFilter || statusFilter === 'All Statuses' || op.status === statusFilter)
        );

    const handleOperatorCardClick = (operator) => {
        if (!canEditPlant) return;
        setSelectedOperator(operator);
        setModalDaysOff(scheduledOff[operator.employee_id] || []);
    };

    const handleModalSave = (newDaysOff) => {
        setScheduledOff(prev => ({
            ...prev,
            [selectedOperator.employee_id]: newDaysOff
        }));
        setSelectedOperator(null);
    };

    if (loading) {
        return (
            <>
                <div className="scheduled-off-header">
                    <h1 className="scheduled-off-title">Scheduled Off</h1>
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
                                <option value="">All Plants</option>
                                {/* Option list will be empty while loading */}
                            </select>
                        </div>
                        <div className="filter-wrapper">
                            <select
                                className="ios-select"
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                            >
                                {statusOptions.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                        {(searchText || selectedPlant || (statusFilter && statusFilter !== 'Active')) && (
                            <button className="filter-reset-button" onClick={() => {
                                setSearchText('');
                                setSelectedPlant(userPlant || '');
                                setStatusFilter('Active');
                            }}>
                                <i className="fas fa-undo"></i> Reset Filters
                            </button>
                        )}
                        <button className="ios-button" disabled>
                            <i className="fas fa-calendar-alt"></i> Upcoming
                        </button>
                    </div>
                </div>
                <LoadingScreen message="Loading scheduled days off..." inline={true} />
            </>
        );
    }

    return (
        <>
            <div className="scheduled-off-header">
                <h1 className="scheduled-off-title">Scheduled Off</h1>
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
                            <option value="">All Plants</option>
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
                            {statusOptions.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    {(searchText || selectedPlant || (statusFilter && statusFilter !== 'Active')) && (
                        <button className="filter-reset-button" onClick={() => {
                            setSearchText('');
                            setSelectedPlant(userPlant || '');
                            setStatusFilter('Active');
                        }}>
                            <i className="fas fa-undo"></i> Reset Filters
                        </button>
                    )}
                    {/* Upcoming button, placed like Overview in MixersView */}
                    <button className="ios-button" onClick={() => setShowUpcoming(prev => !prev)}>
                        <i className="fas fa-calendar-alt"></i> Upcoming
                    </button>
                </div>
            </div>
            {!canEditPlant && selectedPlant !== userPlant && (
                <div style={{
                    background: '#fffbe6',
                    color: '#b7791f',
                    border: '1px solid #f6e05e',
                    borderRadius: 8,
                    padding: '10px 16px',
                    margin: '12px 0',
                    fontSize: 15,
                    fontWeight: 500
                }}>
                    <i className="fas fa-lock" style={{ marginRight: 8 }}></i>
                    You can only edit time off for your assigned plant.
                </div>
            )}
            <div className="operators-grid">
                {filteredOperators.length === 0 ? (
                    <div className="no-days-off">No operators found.</div>
                ) : (
                    filteredOperators.map(op => (
                        <div
                            key={op.employee_id}
                            className="operator-card-wrapper"
                            style={{ position: 'relative' }}
                            onClick={() => handleOperatorCardClick(op)}
                        >
                            <OperatorCard
                                operator={{
                                    ...op,
                                    employeeId: op.employee_id,
                                    smyrnaId: op.smyrna_id,
                                    pendingStartDate: op.pending_start_date,
                                    isTrainer: op.is_trainer
                                }}
                                plantName={plants.find(p => p.plant_code === op.plant_code)?.plant_name || op.plant_code}
                                trainers={filteredOperators}
                            >
                                {scheduledOff[op.employee_id] && scheduledOff[op.employee_id].length > 0 && (
                                    <span className="time-off-icon" title="Has upcoming days off">
                                        <i className="fas fa-calendar-day"></i>
                                    </span>
                                )}
                            </OperatorCard>
                        </div>
                    ))
                )}
                {selectedOperator && (
                    <RequestOffModal
                        operator={selectedOperator}
                        daysOff={modalDaysOff}
                        onClose={() => setSelectedOperator(null)}
                        onSave={handleModalSave}
                    />
                )}
                {showUpcoming && (
                    <UpcomingDaysOffModal
                        fetchUpcomingDaysOff={showUpcoming}
                        onClose={() => setShowUpcoming(false)}
                    />
                )}
            </div>
        </>
    );
}
