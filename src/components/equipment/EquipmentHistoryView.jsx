import React, {useEffect, useState} from 'react';
import {supabase} from '../../services/DatabaseService';
import UserLabel from '../common/UserLabel';
import './styles/EquipmentHistoryView.css';

function EquipmentHistoryView({equipment, onClose}) {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortConfig] = useState({
        key: 'changedAt',
        direction: 'descending'
    });

    useEffect(() => {
        fetchHistory();
    }, [equipment?.id]);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const {data, error} = await supabase
                .from('heavy_equipment_history')
                .select('*')
                .eq('equipment_id', equipment.id)
                .order('changed_at', {ascending: false});
            if (error) setError('Failed to load history. Please try again.');
            else setHistory(data || []);
        } catch (err) {
            setError('Failed to load history. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const formatFieldName = (fieldName) => {
        switch (fieldName) {
            case 'identifying_number':
                return 'Identifying Number';
            case 'assigned_plant':
                return 'Plant';
            case 'assigned_operator':
                return 'Operator';
            case 'equipment_type':
                return 'Equipment Type';
            case 'status':
                return 'Status';
            case 'last_service_date':
                return 'Service Date';
            case 'year_made':
                return 'Year';
            case 'equipment_make':
                return 'Make';
            case 'equipment_model':
                return 'Model';
            case 'hours_mileage':
                return 'Hours/Mileage';
            case 'condition_rating':
                return 'Condition';
            case 'cleanliness_rating':
                return 'Cleanliness';
            default:
                return fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    };

    const formatValue = (fieldName, value) => {
        if (value === null || value === undefined || value === '') return 'Not Assigned';
        if (fieldName === 'cleanliness_rating' || fieldName === 'condition_rating') {
            const rating = parseInt(value, 10);
            if (!isNaN(rating)) {
                const ratingLabels = {
                    1: 'Poor (1)',
                    2: 'Fair (2)',
                    3: 'Good (3)',
                    4: 'Very Good (4)',
                    5: 'Excellent (5)'
                };
                return ratingLabels[rating] || `${rating}`;
            }
        }
        if (fieldName === 'last_service_date') {
            return value ? new Date(value).toLocaleDateString() : 'Not Assigned';
        }
        return value;
    };

    const sortedHistory = React.useMemo(() => {
        let sortableItems = [...history];
        if (sortConfig) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;
                if (sortConfig.key === 'changedAt') {
                    aValue = a.changed_at;
                    bValue = b.changed_at;
                } else if (sortConfig.key === 'fieldName') {
                    aValue = a.field_name;
                    bValue = b.field_name;
                } else if (sortConfig.key === 'oldValue') {
                    aValue = a.old_value;
                    bValue = b.old_value;
                } else if (sortConfig.key === 'newValue') {
                    aValue = a.new_value;
                    bValue = b.new_value;
                } else if (sortConfig.key === 'changedBy') {
                    aValue = a.changed_by;
                    bValue = b.changed_by;
                }
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [history, sortConfig]);

    return (
        <div className="history-modal-backdrop">
            <div className="history-modal">
                <div className="history-modal-header"
                     style={{backgroundColor: 'var(--accent)'}}>
                    <h2>History for Equipment #{equipment.identifyingNumber}</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                <div className="history-modal-content">
                    {isLoading ? (
                        <div className="loading-spinner-container">
                            Loading...
                        </div>
                    ) : error ? (
                        <div className="error-message">
                            <p>{error}</p>
                            <button className="retry-button" onClick={fetchHistory}>Retry</button>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="empty-history">
                            <p>No history records found for this equipment.</p>
                            <p className="empty-subtext">History entries will appear here when changes are made to this
                                equipment.</p>
                        </div>
                    ) : (
                        <div className="history-timeline">
                            {sortedHistory.map((entry, index) => (
                                <div
                                    key={entry.id || index}
                                    className="history-item"
                                    style={{backgroundColor: 'var(--bg-secondary)'}}
                                >
                                    <div className="history-item-header">
                                        <div className="history-field-name">{formatFieldName(entry.field_name)}</div>
                                        <div className="history-timestamp">{formatDate(entry.changed_at)}</div>
                                    </div>
                                    <div className="history-change">
                                        <div className="history-old-value">
                                            <span
                                                className="value-label">From:</span> {formatValue(entry.field_name, entry.old_value)}
                                        </div>
                                        <div className="history-arrow">→</div>
                                        <div className="history-new-value">
                                            <span
                                                className="value-label">To:</span> {formatValue(entry.field_name, entry.new_value)}
                                        </div>
                                    </div>
                                    <div className="history-user">
                                        <UserLabel userId={entry.changed_by} showInitials={true}/>
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

export default EquipmentHistoryView;
