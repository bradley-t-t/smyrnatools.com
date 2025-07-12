import React, { useState, useEffect } from 'react';
import {MixerUtils} from '../../utils/MixerUtils';
import ThemeUtils from '../../utils/ThemeUtils';
import {usePreferences} from '../../context/preferences/PreferencesContext';
import {MixerMaintenanceService} from '../../services/mixers/MixerMaintenanceService';
import './MixerCard.css';

function MixerCard({mixer, operatorName, plantName, showOperatorWarning, onSelect, onDelete}) {
    const isServiceOverdue = MixerUtils.isServiceOverdue(mixer.lastServiceDate);
    const isChipOverdue = MixerUtils.isChipOverdue(mixer.lastChipDate);
    // Use MixerUtils directly instead of calling the method on the object
    const isVerified = MixerUtils.isVerified(mixer.updatedLast, mixer.updatedAt, mixer.updatedBy);
    const statusColor = ThemeUtils.statusColors[mixer.status] || ThemeUtils.statusColors.default;
    const {preferences} = usePreferences();
    const [openIssuesCount, setOpenIssuesCount] = useState(0);

    useEffect(() => {
        const fetchOpenIssues = async () => {
            try {
                const issues = await MixerMaintenanceService.fetchIssues(mixer.id);
                const openIssues = issues.filter(issue => !issue.time_completed);
                setOpenIssuesCount(openIssues.length);
            } catch (error) {
                console.error('Error fetching open issues count:', error);
                setOpenIssuesCount(0);
            }
        };

        if (mixer?.id) {
            fetchOpenIssues();
        }
    }, [mixer?.id]);

    const handleCardClick = () => {
        if (onSelect && typeof onSelect === 'function') {
            onSelect(mixer.id);
        }
    };

    const cardProps = onSelect ? {onClick: handleCardClick} : {};

    const getDaysSince = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const today = new Date();
        const diffTime = Math.abs(today - date);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const daysSinceService = getDaysSince(mixer.lastServiceDate);
    const daysSinceChip = getDaysSince(mixer.lastChipDate);

    return (
        <div className="mixer-card" {...cardProps}>
            <div className="card-status-indicator"
                 style={{backgroundColor: statusColor, top: 0, left: 0, right: 0, height: '4px', position: 'absolute'}}
                 title={mixer.status || 'Unknown'}></div>
            {!isVerified && (
                <div className="verification-flag"
                     title={!mixer.updatedLast || !mixer.updatedBy ? 'Mixer never verified' : 'Mixer not verified since last Sunday'}>
                    <i className="fas fa-flag" style={{color: '#e74c3c'}}></i>
                </div>
            )}
            <div className="card-content">
                <div className="card-header">
                    <h3 className="mixer-name"
                        style={{color: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>Truck
                        #{mixer.truckNumber || 'Not Assigned'}</h3>
                    {openIssuesCount > 0 && (
                        <div className={`issues-badge ${!isVerified ? 'with-verification-flag' : ''}`} 
                             title={`${openIssuesCount} open issue${openIssuesCount !== 1 ? 's' : ''}`}>
                            <i className="fas fa-tools"></i>
                            <span>{openIssuesCount}</span>
                        </div>
                    )}
                </div>
                <div className="card-details">
                    <div className="detail-row">
                        <div className="detail-label">Plant</div>
                        <div className="detail-value">{plantName}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Operator</div>
                        <div className="detail-value">
                            {operatorName}
                            {showOperatorWarning && (
                                <span className="warning-badge" title="Assigned to multiple mixers">
                  <i className="fas fa-exclamation-triangle"></i>
                </span>
                            )}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Employee ID</div>
                        <div className="detail-value">{mixer.operatorSmyrnaId || 'Not Assigned'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Last Service</div>
                        <div className={`detail-value ${mixer.lastServiceDate && isServiceOverdue ? 'overdue' : ''}`}>
                            {mixer.lastServiceDate ? (
                                <>
                                    {new Date(mixer.lastServiceDate).toLocaleDateString()}
                                </>
                            ) : (
                                'Unknown'
                            )}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Last Chip</div>
                        <div className={`detail-value ${mixer.lastChipDate && isChipOverdue ? 'overdue' : ''}`}>
                            {mixer.lastChipDate ? (
                                <>
                                    {new Date(mixer.lastChipDate).toLocaleDateString()}
                                </>
                            ) : (
                                'Unknown'
                            )}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Cleanliness</div>
                        <div className="detail-value">
                            {mixer.cleanlinessRating ? (
                                <div className="stars-container">
                                    {[...Array(5)].map((_, i) => (
                                        <i key={i}
                                           className={`fas fa-star ${i < mixer.cleanlinessRating ? 'filled-star' : 'empty-star'}`}
                                           style={i < mixer.cleanlinessRating ? {color: preferences.accentColor === 'red' ? '#b80017' : '#003896'} : {}}
                                           aria-hidden="true"
                                        ></i>
                                    ))}
                                </div>
                            ) : 'Not Rated'}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Status</div>
                        <div className="detail-value">{mixer.status || 'Unknown'}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MixerCard;