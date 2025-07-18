import React, { useState, useEffect } from 'react';
import {MixerUtility} from '../../utils/MixerUtility';
import ThemeUtility from '../../utils/ThemeUtility';
import {usePreferences} from '../../context/PreferencesContext';
import {MixerMaintenanceService} from '../../services/MixerMaintenanceService';
import {MixerCommentService} from '../../services/MixerCommentService';
import './MixerCard.css';

function MixerCard({mixer, operatorName, plantName, showOperatorWarning, onSelect, onDelete}) {
    const isServiceOverdue = MixerUtility.isServiceOverdue(mixer.lastServiceDate);
    const isChipOverdue = MixerUtility.isChipOverdue(mixer.lastChipDate);
    const isVerified = typeof mixer.isVerified === 'function'
        ? mixer.isVerified(mixer.latestHistoryDate)
        : MixerUtility.isVerified(mixer.updatedLast, mixer.updatedAt, mixer.updatedBy, mixer.latestHistoryDate);
    const statusColor = ThemeUtility.statusColor(mixer.status);
    const {preferences} = usePreferences();
    const [openIssuesCount, setOpenIssuesCount] = useState(0);
    const [commentsCount, setCommentsCount] = useState(0);

    useEffect(() => {
        const fetchOpenIssues = async () => {
            try {
                const issues = await MixerMaintenanceService.fetchIssues(mixer.id);
                const openIssues = issues.filter(issue => !issue.time_completed);
                setOpenIssuesCount(openIssues.length);
            } catch (error) {
                setOpenIssuesCount(0);
            }
        };

        const fetchComments = async () => {
            try {
                const comments = await MixerCommentService.fetchComments(mixer.id);
                setCommentsCount(comments.length);
            } catch (error) {
                setCommentsCount(0);
            }
        };

        if (mixer?.id) {
            fetchOpenIssues();
            fetchComments();
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

    // Helper for icon margin
    const getIconMargin = () => {
        let margin = 0;
        if (openIssuesCount > 0) margin += 30;
        if (commentsCount > 0) margin += 30;
        return margin > 0 ? `${margin}px` : undefined;
    };

    return (
        <div className="mixer-card" {...cardProps}>
            <div className="card-status-indicator"
                 style={{backgroundColor: statusColor, top: 0, left: 0, right: 0, height: '4px', position: 'absolute'}}
                 title={mixer.status || 'Unknown'}></div>
            {/* Comments icon - leftmost or in issues spot if no issues */}
            {commentsCount > 0 && (
                <div
                    className="comments-badge"
                    style={{
                        position: 'absolute',
                        top: '12px', // moved up 2px
                        right: openIssuesCount > 0 ? '92px' : '42px',
                        zIndex: 4,
                        background: '#FFD600', // yellow background
                        color: '#7a5c00',      // dark yellow/brown text
                        borderRadius: '12px',
                        padding: '2px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.95rem',
                        fontWeight: 'bold'
                    }}
                    title={`${commentsCount} comment${commentsCount !== 1 ? 's' : ''}`}
                >
                    <i className="fas fa-comments" style={{marginRight: '4px', fontSize: '0.9rem'}}></i>
                    <span>{commentsCount}</span>
                </div>
            )}
            {/* Issues icon - middle */}
            {openIssuesCount > 0 && (
                <div
                    className="issues-badge"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '42px', // moved 5px more to the right
                        zIndex: 4,
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        borderRadius: '12px',
                        padding: '2px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.95rem',
                        fontWeight: 'bold'
                    }}
                    title={`${openIssuesCount} open issue${openIssuesCount !== 1 ? 's' : ''}`}>
                    <i className="fas fa-tools" style={{marginRight: '4px', fontSize: '0.9rem'}}></i>
                    <span>{openIssuesCount}</span>
                </div>
            )}
            {/* Flag/check - rightmost */}
            {isVerified ? (
                <div
                    className="verification-flag"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        color: '#10b981',
                        fontSize: '1.2rem',
                        zIndex: 5
                    }}
                    title="Verified"
                >
                    <i className="fas fa-check-circle" style={{color: '#10b981'}}></i>
                </div>
            ) : (
                <div
                    className="verification-flag"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        color: '#dc2626',
                        fontSize: '1.2rem',
                        zIndex: 5
                    }}
                    title={!mixer.updatedLast || !mixer.updatedBy ? 'Mixer never verified' :
                        mixer.latestHistoryDate && new Date(mixer.latestHistoryDate) > new Date(mixer.updatedLast) ? 'Changes recorded in history since last verification' :
                            'Mixer not verified since last Sunday'}
                >
                    <i className="fas fa-flag" style={{color: '#e74c3c'}}></i>
                </div>
            )}
            <div className="card-content">
                <div className="card-header">
                    <h3 className="mixer-name"
                        style={{color: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>Truck
                        #{mixer.truckNumber || 'Not Assigned'}</h3>
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
