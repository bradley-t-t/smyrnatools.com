import React from 'react';
import './OperatorCard.css';
import Theme from '../../utils/Theme';
import {usePreferences} from '../../context/PreferencesContext';

function OperatorCard({ operator, plantName, onSelect }) {
    const {preferences} = usePreferences();
    const statusColor = Theme.operatorStatusColors[operator.status] || Theme.operatorStatusColors.default;

    const handleCardClick = () => {
        if (onSelect && typeof onSelect === 'function') {
            onSelect(operator);
        }
    };

    // Get trainer name if operator has one assigned
    const trainerName = operator.assignedTrainer && operator.assignedTrainer !== '0' ? 
        'View details to see trainer' : 'None';

    return (
        <div className="operator-card" onClick={handleCardClick}>
            <div className="card-content">
                <div className="status-dot" 
                     style={{backgroundColor: statusColor, width: '20px', height: '20px', top: '16px', right: '16px', position: 'absolute', borderRadius: '50%', border: '2px solid var(--bg-primary)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)', zIndex: 2}} 
                     title={operator.status || 'Unknown'}>
                </div>
                <div className="card-header">
                    <h3 className="operator-name" style={{ color: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}>{operator.name}</h3>
                </div>
                <div className="card-details">
                    <div className="detail-row">
                        <div className="detail-label">Employee ID</div>
                        <div className="detail-value">{operator.employeeId}</div>
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
                        <div className="detail-value">{operator.isTrainer ? 'Trainer' : 'Operator'}</div>
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
            </div>
        </div>
    );
}

export default OperatorCard;
