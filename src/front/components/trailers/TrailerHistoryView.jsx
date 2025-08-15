import React, { useEffect, useState } from 'react';
import { usePreferences } from '../../../app/context/PreferencesContext';
import { TrailerService } from '../../../services/TrailerService';
import LoadingScreen from '../common/LoadingScreen';
import UserLabel from '../common/UserLabel';
import './styles/TrailerHistoryView.css';

function TrailerHistoryView({ trailer, onClose }) {
    const { preferences } = usePreferences();
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortConfig, setSortConfig] = useState({
        key: 'changedAt',
        direction: 'descending'
    });

    useEffect(() => {
        fetchHistory();
    }, [trailer.id]);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const historyData = await TrailerService.getTrailerHistory(trailer.id);
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
            case 'trailer_number':
                return 'Trailer Number';
            case 'assigned_plant':
                return 'Plant';
            case 'trailer_type':
                return 'Trailer Type';
            case 'assigned_tractor':
                return 'Assigned Tractor';
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
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getHistoryItemColor = (fieldName) => {
        const normalizedFieldName = fieldName.includes('_') ? fieldName : fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
        const isDarkMode = preferences.themeMode === 'dark';
        switch (normalizedFieldName) {
            case 'trailer_type':
                return isDarkMode ? '#2d3142' : '#d9dbe6';
            case 'verification':
                return isDarkMode ? '#1a365d' : '#e1f5fe';
            case 'assigned_tractor':
                return isDarkMode ? '#1c3829' : '#e8f5e9';
            case 'assigned_plant':
                return isDarkMode ? '#3d2c1a' : '#fff3e0';
            default:
                return isDarkMode ? '#222222' : '#f8f8f8';
        }
    };

    const formatValue = (fieldName, value) => {
        if (value === null || value === undefined || value === '') return 'Not Assigned';
        if (fieldName === 'cleanliness_rating') {
            return '★'.repeat(parseInt(value));
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
        setSortConfig({ key, direction });
    };

    return (
        <div className="history-modal-backdrop">
            <div className="history-modal">
                <div className="history-modal-header"
                     style={{ backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}>
                    <h2>History for Trailer #{trailer.trailerNumber}</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                <div className="history-modal-content">
                    {isLoading ? (
                        <div className="loading-spinner-container">
                            <LoadingScreen message="Loading history..." inline={true} />
                        </div>
                    ) : error ? (
                        <div className="error-message">
                            <p>{error}</p>
                            <button className="retry-button" onClick={fetchHistory}>Retry</button>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="empty-history">
                            <p>No history records found for this trailer.</p>
                            <p className="empty-subtext">History entries will appear here when changes are made to this trailer.</p>
                        </div>
                    ) : (
                        <div className="history-timeline">
                            {sortedHistory.map((entry, index) => (
                                <div
                                    key={entry.id || index}
                                    className="history-item"
                                    style={{ backgroundColor: getHistoryItemColor(entry.fieldName || entry.field_name) }}
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
                                        <UserLabel userId={entry.changedBy || entry.changed_by} showInitials={true} />
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

export default TrailerHistoryView;