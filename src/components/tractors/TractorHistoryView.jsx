import React, {useEffect, useState} from 'react';
import {usePreferences} from '../../app/context/PreferencesContext';
import {TractorService} from '../../services/TractorService';
import {OperatorService} from '../../services/OperatorService';
import LoadingScreen from '../common/LoadingScreen';
import UserLabel from '../common/UserLabel';
import './styles/TractorHistoryView.css';

function TractorHistoryView({tractor, onClose}) {
    const {preferences} = usePreferences();
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [operators, setOperators] = useState([]);
    const [sortConfig] = useState({
        key: 'changedAt',
        direction: 'descending'
    });

    useEffect(() => {
        fetchHistory();
        fetchOperators();
    }, [tractor.id]);

    const fetchOperators = async () => {
        try {
            const operatorsData = await OperatorService.fetchOperators();
            setOperators(operatorsData);
        } catch (err) {
        }
    };

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const historyData = await TractorService.getTractorHistory(tractor.id);
            setHistory(historyData);
            setError(null);
        } catch (err) {
            setError('Failed to load history. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const formatFieldName = (fieldName) => {
        const snakeCaseField = fieldName.includes('_') ? fieldName : fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
        switch (snakeCaseField) {
            case 'truck_number':
                return 'Truck Number';
            case 'assigned_plant':
                return 'Plant';
            case 'assigned_operator':
                return 'Operator';
            case 'status':
                return 'Status';
            case 'last_service_date':
                return 'Service Date';
            case 'has_blower':
                return 'Has Blower';
            case 'cleanliness_rating':
                return 'Cleanliness';
            case 'verification':
                return 'Verification';
            default:
                return snakeCaseField.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not Assigned';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    };

    const getHistoryItemColor = (fieldName) => {
        const normalizedFieldName = fieldName.includes('_') ? fieldName : fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
        const isDarkMode = preferences.themeMode === 'dark';
        switch (normalizedFieldName) {
            case 'status':
                return isDarkMode ? '#2d3142' : '#d9dbe6';
            case 'verification':
                return isDarkMode ? '#1a365d' : '#e1f5fe';
            case 'assigned_operator':
                return isDarkMode ? '#1c3829' : '#e8f5e9';
            case 'assigned_plant':
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
        if (value === null || value === undefined || value === '') return 'Not Assigned';
        if (fieldName === 'assigned_operator') {
            return getOperatorName(value);
        }
        if (fieldName === 'cleanliness_rating') {
            return '★'.repeat(parseInt(value));
        }
        if (fieldName === 'last_service_date') {
            return value ? new Date(value).toLocaleDateString() : 'Not Assigned';
        }
        if (fieldName === 'has_blower') {
            return value ? 'Yes' : 'No';
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
    return (
        <div className="history-modal-backdrop">
            <div className="history-modal">
                <div className="history-modal-header"
                     style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>
                    <h2>History for Truck #{tractor.truckNumber}</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <div className="history-modal-content">
                    {isLoading ? (
                        <div className="loading-spinner-container">
                            <LoadingScreen message="Loading history..." inline={true}/>
                        </div>
                    ) : error ? (
                        <div className="error-message">
                            <p>{error}</p>
                            <button className="retry-button" onClick={fetchHistory}>Retry</button>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="empty-history">
                            <p>No history records found for this tractor.</p>
                            <p className="empty-subtext">History entries will appear here when changes are made to this
                                tractor.</p>
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
                                        <div
                                            className="history-field-name">{formatFieldName(entry.fieldName || entry.field_name)}</div>
                                        <div
                                            className="history-timestamp">{formatDate(entry.changedAt || entry.changed_at)}</div>
                                    </div>

                                    <div className="history-change">
                                        <div className="history-old-value">
                                            <span
                                                className="value-label">From:</span> {formatValue(entry.fieldName || entry.field_name, entry.oldValue || entry.old_value)}
                                        </div>
                                        <div className="history-arrow">→</div>
                                        <div className="history-new-value">
                                            <span
                                                className="value-label">To:</span> {formatValue(entry.fieldName || entry.field_name, entry.newValue || entry.new_value)}
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

export default TractorHistoryView;