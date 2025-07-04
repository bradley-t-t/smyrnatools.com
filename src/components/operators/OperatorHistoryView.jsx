import React, {useEffect, useState} from 'react';
import supabase from '../../core/SupabaseClient';
import './OperatorsView.css';

function OperatorHistoryView({employeeId, onClose}) {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [operators, setOperators] = useState([]);
    const [profiles, setProfiles] = useState([]);

    // Map of operators employee IDs to names
    const operatorNameMap = operators.reduce((acc, op) => {
        acc[op.employee_id] = op.name;
        return acc;
    }, {});

    useEffect(() => {
        fetchHistory();
        fetchOperators();
        fetchProfiles();
    }, [employeeId]);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const {data, error} = await supabase
                .from('operator_history')
                .select('*')
                .eq('employee_id', employeeId)
                .order('changed_at', {ascending: false});

            if (error) throw error;

            setHistory(data);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchOperators = async () => {
        try {
            const {data, error} = await supabase
                .from('operators')
                .select('*');

            if (error) throw error;

            setOperators(data);
        } catch (error) {
            console.error('Error fetching operators:', error);
        }
    };

    const fetchProfiles = async () => {
        try {
            const {data, error} = await supabase
                .from('profiles')
                .select('*');

            if (error) throw error;

            setProfiles(data);
        } catch (error) {
            console.error('Error fetching profiles:', error);
        }
    };

    // Group history entries by date
    const groupedHistory = history.reduce((acc, entry) => {
        const date = new Date(entry.changed_at).toLocaleDateString();
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(entry);
        return acc;
    }, {});

    // Sort dates in descending order
    const sortedDates = Object.keys(groupedHistory).sort((a, b) => {
        return new Date(b) - new Date(a);
    });

    const formatFieldName = (field) => {
        return field.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const formatValue = (value, field) => {
        if (value === null || value === undefined || value === '') return 'N/A';

        if (field === 'is_trainer') {
            return value === 'true' ? 'Yes' : 'No';
        }

        if (field === 'assigned_trainer') {
            if (value === '0') return 'Unassigned';
            const name = operatorNameMap[value];
            return name ? `${name} (${value})` : value;
        }

        return value;
    };

    const getUserName = (userId) => {
        if (!userId) return 'System';

        const profile = profiles.find(p => p.id === userId);
        if (profile) {
            return `${profile.first_name} ${profile.last_name}`;
        }

        return 'Unknown User';
    };

    const formatDateTime = (dateTimeString) => {
        const date = new Date(dateTimeString);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '700px'}}>
                <div className="modal-header">
                    <h2>Operator History</h2>
                    <button className="close-button" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="modal-body">
                    {isLoading ? (
                        <div className="loading-container">
                            <div className="ios-spinner"></div>
                            <p>Loading history...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="no-results-container" style={{boxShadow: 'none', padding: '20px'}}>
                            <p>No history available for this operator.</p>
                        </div>
                    ) : (
                        <div className="history-timeline">
                            {sortedDates.map(date => (
                                <div key={date} className="history-date-group">
                                    <h3 className="history-date">{date}</h3>

                                    {groupedHistory[date].map(entry => (
                                        <div key={entry.id} className="history-entry">
                                            <div className="history-entry-header">
                                                <div className="field-name">{formatFieldName(entry.field_name)}</div>
                                                <div
                                                    className="timestamp">{formatDateTime(entry.changed_at).split(' ')[1]}</div>
                                            </div>

                                            <div className="history-entry-body">
                                                <div className="value-change">
                                                    <div className="old-value">
                                                        <span className="label">From:</span>
                                                        <span
                                                            className="value">{formatValue(entry.old_value, entry.field_name)}</span>
                                                    </div>
                                                    <div className="new-value">
                                                        <span className="label">To:</span>
                                                        <span
                                                            className="value">{formatValue(entry.new_value, entry.field_name)}</span>
                                                    </div>
                                                </div>

                                                <div className="changed-by">
                                                    Changed by: {getUserName(entry.changed_by)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="primary-button" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

export default OperatorHistoryView;
