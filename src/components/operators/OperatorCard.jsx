import React from 'react';
import './OperatorCard.css';
import ThemeUtils from '../../utils/ThemeUtils';
import {usePreferences} from '../../context/preferences/PreferencesContext';

function OperatorCard({operator, plantName, onSelect, onDelete}) {
    const {preferences} = usePreferences();
    const statusColor = ThemeUtils.operatorStatusColors[operator.status] || ThemeUtils.operatorStatusColors.default;

    const handleCardClick = () => {
        if (onSelect && typeof onSelect === 'function') {
            onSelect(operator);
        }
    };

    const cardProps = onSelect ? {onClick: handleCardClick} : {};

    const trainerName = operator.assignedTrainer && operator.assignedTrainer !== '0'
        ? 'View details to see trainer'
        : 'None';

    return (
        <div className="operator-card" {...cardProps}>
            <div className="card-status-indicator"
                 style={{backgroundColor: statusColor, top: 0, left: 0, right: 0, height: '4px', position: 'absolute'}}
                 title={operator.status || 'Unknown'}>
            </div>
            <div className="card-content">
                <div className="card-header">
                    <h3 className="operator-name"
                        style={{color: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>
                        {operator.name}
                    </h3>
                </div>
                <div className="card-details">
                    <div className="detail-row">
                        <div className="detail-label">Employee ID</div>
                        <div className="detail-value">{operator.smyrnaId || 'Not Assigned'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Plant</div>
                        <div className="detail-value">{plantName || 'None'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Status</div>
                        <div className="detail-value">{operator.status || 'Unknown'}</div>
                    </div>
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
                    {!operator.isTrainer && (
                        <div className="detail-row">
                            <div className="detail-label">Trainer</div>
                            <div className="detail-value">{trainerName}</div>
                        </div>
                    )}
                </div>
                {/* Delete button removed */}
            </div>
        </div>
    );
}

export default OperatorCard;