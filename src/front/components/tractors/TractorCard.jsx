import React, { useState, useEffect } from 'react';
import {TractorUtility} from '../../../utils/TractorUtility';
import {usePreferences} from '../../../app/context/PreferencesContext';
import {TractorService} from '../../../services/TractorService';
import './styles/TractorCard.css';

function TractorCard({tractor, operatorName, plantName, showOperatorWarning, onSelect, onDelete}) {
    const isServiceOverdue = TractorUtility.isServiceOverdue(tractor.lastServiceDate);
    const isVerified = typeof tractor.isVerified === 'function'
        ? tractor.isVerified(tractor.latestHistoryDate)
        : TractorUtility.isVerified(tractor.updatedLast, tractor.updatedAt, tractor.updatedBy, tractor.latestHistoryDate);
    const {preferences} = usePreferences();
    const [openIssuesCount, setOpenIssuesCount] = useState(0);
    const [commentsCount, setCommentsCount] = useState(0);

    useEffect(() => {
        const fetchOpenIssues = async () => {
            try {
                const issues = await TractorService.fetchIssues(tractor.id);
                const openIssues = issues.filter(issue => !issue.time_completed);
                setOpenIssuesCount(openIssues.length);
            } catch (error) {
                setOpenIssuesCount(0);
            }
        };

        const fetchComments = async () => {
            try {
                const comments = await TractorService.fetchComments(tractor.id);
                setCommentsCount(comments.length);
            } catch (error) {
                setCommentsCount(0);
            }
        };

        if (tractor?.id) {
            fetchOpenIssues();
            fetchComments();
        }
    }, [tractor?.id]);

    const handleCardClick = () => {
        if (onSelect && typeof onSelect === 'function') {
            onSelect(tractor.id);
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

    const daysSinceService = getDaysSince(tractor.lastServiceDate);

    const getIconMargin = () => {
        let margin = 0;
        if (openIssuesCount > 0) margin += 30;
        if (commentsCount > 0) margin += 30;
        return margin > 0 ? `${margin}px` : undefined;
    };

    const accentColor = preferences.accentColor === 'red'
        ? 'var(--accent)'
        : preferences.accentColor === 'darkgrey'
            ? 'var(--accent)'
            : 'var(--accent)';

    let statusColor = 'var(--accent)';
    if (tractor.status === 'Active') statusColor = 'var(--status-active)';
    else if (tractor.status === 'Spare') statusColor = 'var(--status-spare)';
    else if (tractor.status === 'In Shop') statusColor = 'var(--status-inshop)';
    else if (tractor.status === 'Retired') statusColor = 'var(--status-retired)';
    else if (TractorUtility.isServiceOverdue(tractor.lastServiceDate)) statusColor = 'var(--error)';

    return (
        <div className="tractor-card" {...cardProps}>
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
            {commentsCount > 0 && (
                <div
                    className="comments-badge"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: openIssuesCount > 0 ? '92px' : '42px',
                        zIndex: 4
                    }}
                    title={`${commentsCount} comment${commentsCount !== 1 ? 's' : ''}`}
                >
                    <i className="fas fa-comments comment-icon"></i>
                    <span>{commentsCount}</span>
                </div>
            )}
            {openIssuesCount > 0 && (
                <div
                    className="issues-badge"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '42px',
                        zIndex: 4
                    }}
                    title={`${openIssuesCount} open issue${openIssuesCount !== 1 ? 's' : ''}`}>
                    <i className="fas fa-tools" style={{marginRight: '4px', fontSize: '0.9rem'}}></i>
                    <span>{openIssuesCount}</span>
                </div>
            )}
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
                    title={!tractor.updatedLast || !tractor.updatedBy ? 'Tractor never verified' :
                        tractor.latestHistoryDate && new Date(tractor.latestHistoryDate) > new Date(tractor.updatedLast) ? 'Changes recorded in history since last verification' :
                            'Tractor not verified since last Sunday'}
                >
                    <i className="fas fa-flag" style={{color: '#e74c3c'}}></i>
                </div>
            )}
            <div className="card-content">
                <div className="card-header">
                    <h3 className="tractor-name"
                        style={{color: accentColor}}>
                        Tractor #{tractor.truckNumber || 'Not Assigned'}
                    </h3>
                </div>

                <div className="card-details">
                    <div className="detail-row">
                        <div className="detail-label">Plant</div>
                        <div className="detail-value">{plantName}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Status</div>
                        <div className="detail-value">{tractor.status || 'Unknown'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Operator</div>
                        <div className="detail-value">
                            {operatorName}
                            {showOperatorWarning && (
                                <span className="warning-badge" title="Assigned to multiple tractors">
                  <i className="fas fa-exclamation-triangle"></i>
                </span>
                            )}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Employee ID</div>
                        <div className="detail-value">{tractor.operatorSmyrnaId || 'Not Assigned'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Last Service</div>
                        <div className={`detail-value ${tractor.lastServiceDate && isServiceOverdue ? 'overdue' : ''}`}>
                            {tractor.lastServiceDate ? (
                                <>
                                    {new Date(tractor.lastServiceDate).toLocaleDateString()}
                                </>
                            ) : (
                                'Unknown'
                            )}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Has Blower</div>
                        <div className="detail-value">{tractor.hasBlower ? 'Yes' : 'No'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Cleanliness</div>
                        <div className="detail-value">
                            {tractor.cleanlinessRating ? (
                                <div className="stars-container">
                                    {[...Array(5)].map((_, i) => (
                                        <i key={i}
                                           className={`fas fa-star ${i < tractor.cleanlinessRating ? 'filled-star' : 'empty-star'}`}
                                           style={i < tractor.cleanlinessRating ? {color: accentColor} : {}}
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

export default TractorCard;