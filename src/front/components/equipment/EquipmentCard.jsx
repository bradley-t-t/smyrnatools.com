import React, { useState, useEffect } from 'react';
import EquipmentUtility from '../../../utils/EquipmentUtility';
import { usePreferences } from '../../../app/context/PreferencesContext';
import { EquipmentService } from '../../../services/EquipmentService';
import './styles/EquipmentCard.css';

function EquipmentCard({ equipment, plantName, onSelect }) {
    const isServiceOverdue = EquipmentUtility.isServiceOverdue(equipment.lastServiceDate);
    const { preferences } = usePreferences();
    const [openIssuesCount, setOpenIssuesCount] = useState(0);
    const [commentsCount, setCommentsCount] = useState(0);

    useEffect(() => {
        const fetchOpenIssues = async () => {
            try {
                const issues = await EquipmentService.fetchIssues(equipment.id);
                const openIssues = issues.filter(issue => !issue.time_completed);
                setOpenIssuesCount(openIssues.length);
            } catch (error) {
                setOpenIssuesCount(0);
            }
        };

        const fetchComments = async () => {
            try {
                const comments = await EquipmentService.fetchComments(equipment.id);
                setCommentsCount(comments.length);
            } catch (error) {
                setCommentsCount(0);
            }
        };

        if (equipment?.id) {
            fetchOpenIssues();
            fetchComments();
        }
    }, [equipment?.id]);

    const handleCardClick = () => {
        if (onSelect && typeof onSelect === 'function') {
            onSelect(equipment.id);
        }
    };

    const cardProps = onSelect ? { onClick: handleCardClick } : {};

    const accentColor = 'var(--accent)';

    let statusColor = 'var(--accent)';
    if (equipment.status === 'Active') statusColor = 'var(--status-active)';
    else if (equipment.status === 'Spare') statusColor = 'var(--status-spare)';
    else if (equipment.status === 'In Shop') statusColor = 'var(--status-inshop)';
    else if (equipment.status === 'Retired') statusColor = 'var(--status-retired)';
    else if (EquipmentUtility.isServiceOverdue(equipment.lastServiceDate)) statusColor = 'var(--error)';

    return (
        <div className="equipment-card" {...cardProps}>
            <div style={{
                height: 4,
                width: '100%',
                background: statusColor,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10
            }} />
            {openIssuesCount > 0 && (
                <div
                    className="equipment-issues-badge"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        zIndex: 4,
                        right: '20px'
                    }}
                    title={`${openIssuesCount} open issue${openIssuesCount !== 1 ? 's' : ''}`}>
                    <i className="fas fa-tools" style={{ marginRight: '4px', fontSize: '0.9rem' }}></i>
                    <span>{openIssuesCount}</span>
                </div>
            )}
            {commentsCount > 0 && (
                <div
                    className="equipment-comments-badge"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: openIssuesCount > 0 ? '72px' : '20px',
                        zIndex: 4
                    }}
                    title={`${commentsCount} comment${commentsCount !== 1 ? 's' : ''}`}
                >
                    <i className="fas fa-comments equipment-comment-icon"></i>
                    <span>{commentsCount}</span>
                </div>
            )}
            <div className="card-content">
                <div className="card-header">
                    <h3 className="equipment-name" style={{ color: accentColor }}>
                        {equipment.equipmentType} #{equipment.identifyingNumber || 'Not Assigned'}
                    </h3>
                </div>
                <div className="card-details">
                    <div className="detail-row">
                        <div className="detail-label">Plant</div>
                        <div className="detail-value">{plantName}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Status</div>
                        <div className="detail-value">{equipment.status || 'Unknown'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Type</div>
                        <div className="detail-value">{equipment.equipmentType || 'Not Assigned'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Last Service</div>
                        <div className={`detail-value ${equipment.lastServiceDate && isServiceOverdue ? 'overdue' : ''}`}>
                            {equipment.lastServiceDate ? (
                                <>
                                    {new Date(equipment.lastServiceDate).toLocaleDateString()}
                                </>
                            ) : (
                                'Unknown'
                            )}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Hours/Mileage</div>
                        <div className="detail-value">{equipment.hoursMileage ? equipment.hoursMileage : 'Not Recorded'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Cleanliness</div>
                        <div className="detail-value">
                            {equipment.cleanlinessRating ? (
                                <div className="stars-container">
                                    {[...Array(5)].map((_, i) => (
                                        <i
                                            key={i}
                                            className={`fas fa-star ${i < equipment.cleanlinessRating ? 'filled-star' : 'empty-star'}`}
                                            style={i < equipment.cleanlinessRating ? { color: accentColor } : {}}
                                            aria-hidden="true"
                                        ></i>
                                    ))}
                                </div>
                            ) : 'Not Rated'}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Condition</div>
                        <div className="detail-value">
                            {equipment.conditionRating ? (
                                <div className="stars-container">
                                    {[...Array(5)].map((_, i) => (
                                        <i
                                            key={i}
                                            className={`fas fa-star ${i < equipment.conditionRating ? 'filled-star' : 'empty-star'}`}
                                            style={i < equipment.conditionRating ? { color: accentColor } : {}}
                                            aria-hidden="true"
                                        ></i>
                                    ))}
                                </div>
                            ) : 'Not Rated'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EquipmentCard;