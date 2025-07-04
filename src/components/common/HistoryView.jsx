import React from 'react';
import './HistoryView.css';

function HistoryView({historyData, onClose, entityType}) {
    // Format the date to a more readable format
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    // Get a user-friendly field name
    const getFieldLabel = (fieldName) => {
        const fieldLabels = {
            name: 'Name',
            model: 'Model',
            serial_number: 'Serial Number',
            year: 'Year',
            status: 'Status',
            notes: 'Notes',
            last_maintenance: 'Last Maintenance',
            next_maintenance: 'Next Maintenance',
            // Add more field mappings as needed
        };

        return fieldLabels[fieldName] || fieldName;
    };

    return (
        <div className="history-view">
            <div className="history-header">
                <h2>{entityType.charAt(0).toUpperCase() + entityType.slice(1)} History</h2>
                <button className="close-button" onClick={onClose}>
                    <i className="fas fa-times"></i>
                </button>
            </div>

            {historyData.length === 0 ? (
                <div className="no-history">
                    <p>No history records found.</p>
                </div>
            ) : (
                <div className="history-entries">
                    {historyData.map((entry) => (
                        <div key={entry.id} className="history-entry">
                            <div className="history-entry-header">
                                <div className="timestamp">{formatDate(entry.changed_at)}</div>
                                <div className="user">
                                    {entry.profiles?.full_name || entry.profiles?.email || entry.changed_by || 'Unknown user'}
                                </div>
                            </div>
                            <div className="history-entry-content">
                                <div className="field-name">{getFieldLabel(entry.field_name)}</div>
                                <div className="change-details">
                                    <div className="old-value">
                                        <span>From:</span> {entry.old_value || '(empty)'}
                                    </div>
                                    <div className="new-value">
                                        <span>To:</span> {entry.new_value || '(empty)'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default HistoryView;
