import React from 'react';
import './ManagerCard.css';
import ThemeUtils from '../../utils/ThemeUtils';
import { usePreferences } from '../../context/PreferencesContext';

function ManagerCard({ manager, plantName, onSelect }) {
    const { preferences } = usePreferences();

    console.log('Manager role:', manager.roleName, 'weight:', manager.roleWeight);

    const roleColor = ThemeUtils.getRoleColor(manager.roleName, manager.roleWeight);

    const handleCardClick = () => {
        if (onSelect && typeof onSelect === 'function') {
            onSelect(manager);
        }
    };

    const cardProps = onSelect ? { onClick: handleCardClick } : {};

    return (
        <div className="manager-card" {...cardProps}>
            <div
                className="card-status-indicator"
                style={{
                    backgroundColor: roleColor,
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    position: 'absolute',
                }}
                title={manager.roleName || 'Unknown'}
            ></div>
            <div className="card-content">
                <div className="card-header">
                    <h3
                        className="manager-name"
                        style={{
                            color: preferences.accentColor === 'red' ? '#b80017' : '#003896',
                        }}
                    >
                        {manager.firstName} {manager.lastName}
                    </h3>
                </div>
                <div className="card-details">
                    <div className="detail-row">
                        <div className="detail-label">Email</div>
                        <div className="detail-value">{manager.email || 'Not Assigned'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Plant</div>
                        <div className="detail-value">{plantName || 'None'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Role</div>
                        <div className="detail-value">
                            <span
                                className="manager-role-badge"
                                style={{
                                    backgroundColor: roleColor,
                                    color: '#ffffff',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.85em',
                                    fontWeight: '500',
                                    position: 'relative'
                                }}
                                title={`Role: ${manager.roleName}, Weight: ${manager.roleWeight || 0}`}
                            >
                                {manager.roleName || 'Unknown'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ManagerCard;