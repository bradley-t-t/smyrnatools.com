import React from 'react';
import './ListItemCard.css';
import {usePreferences} from '../../context/PreferencesContext';

function ListItemCard({item, plantName, creatorName, onSelect, truncateText}) {
    const {preferences} = usePreferences();

    const handleCardClick = () => {
        onSelect?.(item);
    };

    const formatDate = dateString => {
        const date = new Date(dateString);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
    };

    const isOverdue = () => !item.completed && item.isOverdue;

    return (
        <div className={`list-item-card ${item.completed ? 'completed' : ''}`} onClick={onSelect && handleCardClick}>
            <div
                className="card-status-indicator"
                style={{
                    backgroundColor: item.completed ? '#38a169' : isOverdue() ? '#e53e3e' : '#3182ce',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    position: 'absolute'
                }}
                title={item.completed ? 'Completed' : isOverdue() ? 'Overdue' : 'Pending'}
            ></div>
            <div className="card-content">
                <div className="card-header">
                    <h3 className="item-description" style={{color: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>
                        {truncateText ? truncateText(item.description, 5, true) : item.description}
                    </h3>
                </div>
                <div className="card-details">
                    <div className="detail-row">
                        <div className="detail-label">Plant</div>
                        <div className="detail-value" title={plantName || 'None'}>
                            {truncateText ? truncateText(plantName || 'None', 25) : (plantName || 'None')}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Deadline</div>
                        <div className="detail-value deadline">
                            {formatDate(item.deadline)}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Created By</div>
                        <div className="detail-value" title={creatorName || 'Unknown'}>
                            {truncateText ? truncateText(creatorName || 'Unknown', 20) : (creatorName || 'Unknown')}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Status</div>
                        <div className="detail-value">
                            {item.completed ? (
                                <span className="completed-badge">Completed</span>
                            ) : isOverdue() ? (
                                <span className="overdue-badge">Overdue</span>
                            ) : (
                                <span className="pending-badge">Pending</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ListItemCard;