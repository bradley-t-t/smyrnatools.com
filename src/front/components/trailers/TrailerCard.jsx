import React, {useEffect, useState} from 'react';
import {TrailerUtility} from '../../../utils/TrailerUtility';
import {TrailerService} from '../../../services/TrailerService';
import './styles/TrailerCard.css';

function TrailerCard({trailer, tractorName, plantName, showTractorWarning, onSelect}) {
    const isServiceOverdue = TrailerUtility.isServiceOverdue(trailer.lastServiceDate);
    const [openIssuesCount, setOpenIssuesCount] = useState(0);
    const [commentsCount, setCommentsCount] = useState(0);

    useEffect(() => {
        const fetchOpenIssues = async () => {
            try {
                const issues = await TrailerService.fetchIssues(trailer.id);
                const openIssues = issues.filter(issue => !issue.time_completed);
                setOpenIssuesCount(openIssues.length);
            } catch (error) {
                setOpenIssuesCount(0);
            }
        };

        const fetchComments = async () => {
            try {
                const comments = await TrailerService.fetchComments(trailer.id);
                setCommentsCount(comments.length);
            } catch (error) {
                setCommentsCount(0);
            }
        };

        if (trailer?.id) {
            fetchOpenIssues();
            fetchComments();
        }
    }, [trailer?.id]);

    const handleCardClick = () => {
        if (onSelect && typeof onSelect === 'function') {
            onSelect(trailer.id);
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
    getDaysSince(trailer.lastServiceDate);
    const accentColor = 'var(--accent)';

    let statusColor = 'var(--accent)';
    if (trailer.status === 'Active') statusColor = 'var(--status-active)';
    else if (trailer.status === 'Spare') statusColor = 'var(--status-spare)';
    else if (trailer.status === 'In Shop') statusColor = 'var(--status-inshop)';
    else if (trailer.status === 'Retired') statusColor = 'var(--status-retired)';
    else if (TrailerUtility.isServiceOverdue(trailer.lastServiceDate)) statusColor = 'var(--error)';

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
            }}/>
            {openIssuesCount > 0 && (
                <div
                    className="trailer-issues-badge"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        zIndex: 4,
                    }}
                    title={`${openIssuesCount} open issue${openIssuesCount !== 1 ? 's' : ''}`}>
                    <i className="fas fa-tools" style={{marginRight: '4px', fontSize: '0.9rem'}}></i>
                    <span>{openIssuesCount}</span>
                </div>
            )}
            {commentsCount > 0 && (
                <div
                    className="trailer-comments-badge"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: openIssuesCount > 0 ? '72px' : '20px',
                        zIndex: 4
                    }}
                    title={`${commentsCount} comment${commentsCount !== 1 ? 's' : ''}`}
                >
                    <i className="fas fa-comments trailer-comment-icon"></i>
                    <span>{commentsCount}</span>
                </div>
            )}
            <div className="card-content">
                <div className="card-header">
                    <h3 className="tractor-name" style={{color: accentColor}}>
                        Trailer #{trailer.trailerNumber || 'Not Assigned'}
                    </h3>
                </div>
                <div className="card-details">
                    <div className="detail-row">
                        <div className="detail-label">Plant</div>
                        <div className="detail-value">{plantName}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Trailer Type</div>
                        <div className="detail-value">{trailer.trailerType || 'Unknown'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Status</div>
                        <div className="detail-value">{trailer.status || 'Unknown'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Assigned Tractor</div>
                        <div className="detail-value">
                            {tractorName}
                            {showTractorWarning && (
                                <span className="warning-badge" title="Assigned to multiple trailers">
                                    <i className="fas fa-exclamation-triangle"></i>
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Last Service</div>
                        <div className={`detail-value ${trailer.lastServiceDate && isServiceOverdue ? 'overdue' : ''}`}>
                            {trailer.lastServiceDate ? (
                                <>
                                    {new Date(trailer.lastServiceDate).toLocaleDateString()}
                                </>
                            ) : (
                                'Unknown'
                            )}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Cleanliness</div>
                        <div className="detail-value">
                            {trailer.cleanlinessRating ? (
                                <div className="stars-container">
                                    {[...Array(5)].map((_, i) => (
                                        <i
                                            key={i}
                                            className={`fas fa-star ${i < trailer.cleanlinessRating ? 'filled-star' : 'empty-star'}`}
                                            style={i < trailer.cleanlinessRating ? {color: accentColor} : {}}
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

export default TrailerCard;