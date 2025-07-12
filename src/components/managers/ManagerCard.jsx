import React from 'react';
import '../operators/OperatorCard.css';
import './ManagersView.css';
import ThemeUtils from '../../utils/ThemeUtils';
import {usePreferences} from '../../context/preferences/PreferencesContext';

function ManagerCard({manager, plantName, onSelect}) {
    const {preferences} = usePreferences();

    const handleCardClick = () => {
        if (onSelect && typeof onSelect === 'function') {
            onSelect(manager);
        }
    };

    const getRoleBadgeClass = (role) => {
        if (role.toLowerCase().includes('admin')) return 'admin';
        if (role.toLowerCase().includes('supervisor')) return 'supervisor';
        if (role.toLowerCase().includes('manager')) return 'manager';
        return '';
    };

    return (
        <div className="operator-card manager-card" onClick={handleCardClick}>
            <div className="card-content">
                <div className="card-header">
                    <h3 className="operator-name" 
                        style={{color: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>
                        {manager.firstName} {manager.lastName}
                    </h3>
                </div>
                <div className="card-details">
                    <div className="detail-row">
                        <div className="detail-label">Email</div>
                        <div className="detail-value">{manager.email || 'Not Available'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Plant</div>
                        <div className="detail-value">{plantName || 'None'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Role</div>
                        <div className="detail-value">
                            <span className={`manager-role-badge ${getRoleBadgeClass(manager.roleName)}`}>
                                {manager.roleName}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ManagerCard;
