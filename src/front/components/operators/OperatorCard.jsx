import React from 'react';
import './styles/OperatorCard.css';
import ThemeUtility from '../../../utils/ThemeUtility';
import {usePreferences} from "../../../app/context/PreferencesContext";

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    const formatted = date.toLocaleDateString('en-US', options);
    const day = date.getDate();
    let suffix = 'th';
    if (day % 10 === 1 && day !== 11) suffix = 'st';
    else if (day % 10 === 2 && day !== 12) suffix = 'nd';
    else if (day % 10 === 3 && day !== 13) suffix = 'rd';
    return formatted.replace(`${day}`, `${day}${suffix}`);
}

function OperatorCard({operator, plantName, onSelect, onDelete, trainers, children, rating}) {
    const {preferences} = usePreferences();
    if (!operator) return null;
    const statusColor = ThemeUtility.operatorStatusColors[operator.status] || ThemeUtility.operatorStatusColors.default;
    const handleCardClick = () => {
        if (onSelect && typeof onSelect === 'function') {
            onSelect(operator);
        }
    };
    let trainerName = 'None';
    if (
        operator.assignedTrainer &&
        operator.assignedTrainer !== '0' &&
        Array.isArray(trainers)
    ) {
        const trainerObj = trainers.find(t => t.employeeId === operator.assignedTrainer);
        trainerName = trainerObj ? trainerObj.name : 'Unknown';
    }
    const cardProps = onSelect ? {onClick: handleCardClick} : {};
    const hasScheduledOff = Array.isArray(operator.daysOff) && operator.daysOff.length > 0;
    const displayRating = typeof rating === 'number' ? rating : (typeof operator.rating === 'number' ? operator.rating : Number(operator.rating) || 0);

    return (
        <div
            className="operator-card"
            {...cardProps}
            style={{
                position: 'relative',
                ...cardProps?.style
            }}
        >
            <div className="card-status-indicator"
                 style={{backgroundColor: statusColor, top: 0, left: 0, right: 0, height: '4px', position: 'absolute'}}
                 title={operator.status || 'Unknown'}>
            </div>
            <div className="card-content">
                {hasScheduledOff && (
                    <span className="operator-scheduledoff-icon">
                        <i className="fas fa-calendar-alt"></i>
                    </span>
                )}
                {children}
                <div className="card-header">
                    <h3 className="operator-name"
                        style={{color: 'var(--accent)'}}>
                        {operator.name}
                    </h3>
                </div>
                <div className="card-details">
                    <div className="detail-row">
                        <div className="detail-label">Plant</div>
                        <div className="detail-value">{plantName || 'None'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Status</div>
                        <div className="detail-value">{operator.status || 'Unknown'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Employee ID</div>
                        <div className="detail-value">{operator.smyrnaId || 'Not Assigned'}</div>
                    </div>
                    {operator.status === 'Pending Start' && (
                        <div className="detail-row">
                            <div className="detail-label">Pending Start Date</div>
                            <div className="detail-value">
                                {operator.pendingStartDate
                                    ? formatDate(operator.pendingStartDate)
                                    : 'Not Set'}
                            </div>
                        </div>
                    )}
                    <div className="detail-row">
                        <div className="detail-label">Role</div>
                        <div className="detail-value">
                            {operator.isTrainer ? (
                                <span className="trainer-badge">Trainer</span>
                            ) : 'Operator'}
                        </div>
                    </div>
                    {operator.position && (
                        <div className="detail-row">
                            <div className="detail-label">Position</div>
                            <div className="detail-value">{operator.position || 'Not Specified'}</div>
                        </div>
                    )}
                    {!operator.isTrainer && operator.status !== 'Active' && (
                        <div className="detail-row">
                            <div className="detail-label">Trainer</div>
                            <div className="detail-value">{trainerName}</div>
                        </div>
                    )}
                    <div className="detail-row">
                        <div className="detail-label">Rating</div>
                        <div className="detail-value">
                            <div className="stars-container">
                                {[...Array(5)].map((_, i) => (
                                    <i
                                        key={i}
                                        className={`fas fa-star ${i < displayRating ? 'filled-star' : 'empty-star'}`}
                                        aria-hidden="true"
                                    ></i>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OperatorCard;