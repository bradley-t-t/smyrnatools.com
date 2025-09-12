import React, {useEffect, useState} from 'react';
import {TrailerService} from '../../services/TrailerService';
import {TractorService} from '../../services/TractorService';
import LoadingScreen from '../common/LoadingScreen';
import UserLabel from '../common/UserLabel';
import './styles/TrailerHistoryView.css';
import {FormatUtility} from '../../utils/FormatUtility';

function TrailerHistoryView({trailer, onClose}) {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tractors, setTractors] = useState([]);

    useEffect(() => {
        fetchHistory();
        fetchTractors();
    }, [trailer.id]);

    const fetchTractors = async () => {
        try {
            const list = await TractorService.fetchTractors();
            setTractors(list);
        } catch (_) {
        }
    };

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

    const formatTimestamp = (dateString) => {
        if (!dateString) return 'Not Assigned';
        return FormatUtility.formatDateTime(dateString);
    };

    const getHistoryItemColor = () => {
        return 'var(--bg-secondary)';
    };

    const getTractorLabel = (tractorId) => {
        if (!tractorId) return 'Not Assigned';
        const t = tractors.find(tr => tr.id === tractorId);
        if (!t) return 'Unknown';
        return t.truckNumber ? `Truck #${t.truckNumber}` : 'Unknown';
    };

    const formatValue = (fieldName, value) => {
        const key = fieldName && fieldName.includes('_') ? fieldName : String(fieldName || '').replace(/([A-Z])/g, '_$1').toLowerCase();
        if (value === null || value === undefined || value === '') return 'Not Assigned';
        if (key === 'cleanliness_rating') {
            const n = parseInt(value, 10);
            return Number.isFinite(n) && n > 0 ? '★'.repeat(n) : String(value);
        }
        if (key === 'assigned_tractor') {
            return getTractorLabel(value);
        }
        return value;
    };

    return (
        <div className="history-modal-backdrop">
            <div className="history-modal">
                <div className="history-modal-header"
                     style={{backgroundColor: 'var(--accent)'}}>
                    <h2>History for Trailer #{trailer.trailerNumber}</h2>
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
                            <p>No history records found for this trailer.</p>
                            <p className="empty-subtext">History entries will appear here when changes are made to this
                                trailer.</p>
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
                                            className="history-timestamp">{formatTimestamp(entry.changedAt || entry.changed_at)}</div>
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

export default TrailerHistoryView;

