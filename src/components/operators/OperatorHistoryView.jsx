import React, {useEffect, useState} from 'react';
import {usePreferences} from '../../context/PreferencesContext';
import {OperatorService} from '../../services/operators/OperatorService';
import UserLabel from '../UserLabel';
import './OperatorHistoryView.css';

function OperatorHistoryView({operator, onClose}) {
    const {preferences} = usePreferences();
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [operators, setOperators] = useState([]);
    const [sortConfig, setSortConfig] = useState({
        key: 'changedAt',
        direction: 'descending'
    });

    useEffect(() => {
        fetchHistory();
        fetchOperators();
    }, [operator.employeeId]);

    const fetchOperators = async () => {
        try {
            const operatorsData = await OperatorService.fetchOperators();
            setOperators(operatorsData);
        } catch (err) {
            console.error('Error fetching operators:', err);
        }
    };

    const fetchHistory = async () => {
        if (!operator || !operator.employeeId) return;

        setIsLoading(true);
        try {
            const historyData = await OperatorService.getOperatorHistory(operator.employeeId);
            setHistory(historyData);
            setError(null);
        } catch (err) {
            console.error('Error fetching operator history:', err);
            setError('Failed to load history. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const formatFieldName = (fieldName) => {
        const snakeCaseField = fieldName.includes('_') ? fieldName : fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
        switch (snakeCaseField) {
            case 'name':
                return 'Name';
            case 'plant_code':
                return 'Plant';
            case 'status':
                return 'Status';
            case 'is_trainer':
                return 'Trainer Status';
            case 'assigned_trainer':
                return 'Assigned Trainer';
            case 'position':
                return 'Position';
            default:
                return snakeCaseField.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    };

    const getHistoryItemColor = (fieldName) => {
        const normalizedFieldName = fieldName.includes('_') ? fieldName : fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
        const isDarkMode = preferences.themeMode === 'dark';

        switch (normalizedFieldName) {
            case 'status':
                return isDarkMode ? '#2d3142' : '#d9dbe6';
            case 'is_trainer':
                return isDarkMode ? '#1a365d' : '#e1f5fe';
            case 'assigned_trainer':
                return isDarkMode ? '#1c3829' : '#e8f5e9';
            case 'plant_code':
                return isDarkMode ? '#3d2c1a' : '#fff3e0';
            default:
                return isDarkMode ? '#222222' : '#f8f8f8';
        }
    };

    const getOperatorName = (operatorId) => {
        if (!operatorId || operatorId === '0') return 'None';
        const operator = operators.find(op => op.employeeId === operatorId);
        return operator ? `${operator.name} (${operatorId})` : `Unknown (${operatorId})`;
    };

    const formatValue = (fieldName, value) => {
        if (value === null || value === undefined || value === '') return 'N/A';
        if (fieldName === 'assigned_trainer') {
            return getOperatorName(value);
        }
        if (fieldName === 'is_trainer') {
            return value === 'true' || value === true ? 'Yes' : 'No';
        }
        return value;
    };

    const sortedHistory = React.useMemo(() => {
        let sortableItems = [...history];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;
                if (sortConfig.key === 'changedAt') {
                    aValue = a.changedAt || a.changed_at;
                    bValue = b.changedAt || b.changed_at;
                } else if (sortConfig.key === 'fieldName') {
                    aValue = a.fieldName || a.field_name;
                    bValue = b.fieldName || b.field_name;
                } else if (sortConfig.key === 'oldValue') {
                    aValue = a.oldValue || a.old_value;
                    bValue = b.oldValue || b.old_value;
                } else if (sortConfig.key === 'newValue') {
                    aValue = a.newValue || a.new_value;
                    bValue = b.newValue || b.new_value;
                } else if (sortConfig.key === 'changedBy') {
                    aValue = a.changedBy || a.changed_by;
                    bValue = b.changedBy || b.changed_by;
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [history, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({key, direction});
    };

    return (
        <div className="history-modal-backdrop">
            <div className="history-modal">
                <div className="history-modal-header" style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>
                    <h2>History for {operator.name}</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <div className="history-modal-content">
                    {isLoading ? (
                        <div className="loading-spinner-container">
                            <div className="ios-spinner"></div>
                            <p>Loading history...</p>
                        </div>
                    ) : error ? (
                        <div className="error-message">
                            <p>{error}</p>
                            <button className="retry-button" onClick={fetchHistory}>Retry</button>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="empty-history">
                            <div className="empty-icon">📜</div>
                            <p>No history records found for this operator.</p>
                            <p className="empty-subtext">History entries will appear here when changes are made to this operator.</p>
                        </div>
                    ) : (
                        <div className="history-timeline">
                            {sortedHistory.map((entry, index) => (
                                <div
                                    key={entry.id || index}
                                    className="history-item"
                                    style={{backgroundColor: getHistoryItemColor(entry.fieldName || entry.field_name)}}
                                >
                                    <div className="history-item-header">
                                        <div className="history-field-name">{formatFieldName(entry.fieldName || entry.field_name)}</div>
                                        <div className="history-timestamp">{formatDate(entry.changedAt || entry.changed_at)}</div>
                                    </div>

                                    <div className="history-change">
                                        <div className="history-old-value">
                                            <span className="value-label">From:</span> {formatValue(entry.fieldName || entry.field_name, entry.oldValue || entry.old_value)}
                                        </div>
                                        <div className="history-arrow">→</div>
                                        <div className="history-new-value">
                                            <span className="value-label">To:</span> {formatValue(entry.fieldName || entry.field_name, entry.newValue || entry.new_value)}
                                        </div>
                                    </div>

                                    <div className="history-user">
                                        <UserLabel userId={entry.changedBy || entry.changed_by} showInitials={true}/>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="history-modal-footer">
                    <button className="cancel-button" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

export default OperatorHistoryView;