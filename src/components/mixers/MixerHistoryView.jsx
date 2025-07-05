import React, {useEffect, useState} from 'react';
import {MixerService} from '../../services/mixers/MixerService';
import {OperatorService} from '../../services/operators/OperatorService';
import UserLabel from '../UserLabel';
import './MixerHistoryView.css';

function MixerHistoryView({mixer, onClose}) {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [operators, setOperators] = useState([]);

    useEffect(() => {
        fetchHistory();
        fetchOperators();
    }, [mixer.id]);

    const fetchOperators = async () => {
        try {
            const operatorsData = await OperatorService.fetchOperators();
            setOperators(operatorsData);
        } catch (err) {
            console.error('Error fetching operators:', err);
        }
    };

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const historyData = await MixerService.getMixerHistory(mixer.id);
            setHistory(historyData);
            setError(null);
        } catch (err) {
            console.error('Error fetching history:', err);
            setError('Failed to load history. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Format field names for display
    const formatFieldName = (fieldName) => {
        // Convert camelCase to snake_case if needed
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
            case 'last_chip_date':
                return 'Chip Date';
            case 'cleanliness_rating':
                return 'Cleanliness';
            case 'verification':
                return 'Verification';
            default:
                return snakeCaseField.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
    };

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    };

    // Get the appropriate background color for the history entry based on the field name
    const getHistoryItemColor = (fieldName) => {
        // Normalize the field name to handle both camelCase and snake_case
        const normalizedFieldName = fieldName.includes('_') ? fieldName : fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();

        switch (normalizedFieldName) {
            case 'status':
                return '#d9dbe6'; // Light gray
            case 'verification':
                return '#e1f5fe'; // Light blue
            case 'assigned_operator':
                return '#e8f5e9'; // Light green
            case 'assigned_plant':
                return '#fff3e0'; // Light orange
            default:
                return '#f8f8f8'; // Very light gray instead of white
        }
    };

    // Get operator name from ID
    const getOperatorName = (operatorId) => {
        if (!operatorId || operatorId === '0') return 'None';
        const operator = operators.find(op => op.employeeId === operatorId);

        if (operator) {
            return `${operator.name} (${operatorId})`;
        }

        return `Unknown (${operatorId})`;
    };

    // Format old and new values for display
    const formatValue = (fieldName, value) => {
        if (value === null || value === undefined) return 'N/A';

        // For operators, show name and ID
        if (fieldName === 'assigned_operator') {
            return getOperatorName(value);
        }

        if (fieldName === 'cleanliness_rating') {
            return '★'.repeat(parseInt(value));
        }

        if (fieldName === 'last_service_date' || fieldName === 'last_chip_date') {
            return value ? new Date(value).toLocaleDateString() : 'N/A';
        }

        return value;
    };

    return (
        <div className="history-modal-backdrop">
            <div className="history-modal">
                <div className="history-modal-header" style={{backgroundColor: '#003896'}}>
                    <h2>History for Truck #{mixer.truckNumber}</h2>
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
                            <p>No history records found for this mixer.</p>
                            <p className="empty-subtext">History entries will appear here when changes are made to this
                                mixer.</p>
                        </div>
                    ) : (
                        <div className="history-timeline">
                            {history.map((entry, index) => (
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

export default MixerHistoryView;
