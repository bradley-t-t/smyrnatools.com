import React from 'react';
import {MixerUtils} from '../../models/Mixer';
import Theme from '../../utils/Theme';
import './MixerCard.css';

function MixerCard({mixer, operatorName, plantName, showOperatorWarning, onSelect, onDelete}) {
    const isServiceOverdue = MixerUtils.isServiceOverdue(mixer.lastServiceDate);
    const isChipOverdue = MixerUtils.isChipOverdue(mixer.lastChipDate);
    const statusColor = Theme.statusColors[mixer.status] || Theme.statusColors.default;

    const handleCardClick = () => {
        if (onSelect && typeof onSelect === 'function') {
            onSelect(mixer.id);
        }
    };

    const cardProps = onSelect ? { onClick: handleCardClick } : {};

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
            <div className="card-content">
                <div className="status-dot" style={{backgroundColor: statusColor, width: '20px', height: '20px', top: '16px', right: '16px', position: 'absolute', borderRadius: '50%', border: '2px solid white', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)', zIndex: 2}} title={mixer.status || 'Unknown'}></div>
                <div className="card-header">
                    <h3 className="mixer-name">Truck #{mixer.truckNumber || 'N/A'}</h3>
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
                        <div className="detail-label">Last Service</div>
                        <div className={`detail-value ${isServiceOverdue ? 'overdue' : ''}`}>
                            {mixer.lastServiceDate ? (
                                <>
                                    {new Date(mixer.lastServiceDate).toLocaleDateString()}
                                    {daysSinceService &&
                                        <span className="days-ago"> ({daysSinceService} days ago)</span>}
                                </>
                            ) : (
                                'Unknown'
                            )}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Last Chip</div>
                        <div className={`detail-value ${isChipOverdue ? 'overdue' : ''}`}>
                            {mixer.lastChipDate ? (
                                <>
                                    {new Date(mixer.lastChipDate).toLocaleDateString()}
                                    {daysSinceChip && <span className="days-ago"> ({daysSinceChip} days ago)</span>}
                                </>
                            ) : (
                                'Unknown'
                            )}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Cleanliness</div>
                        <div className="detail-value">
                            {mixer.cleanlinessRating ? `${mixer.cleanlinessRating}/5` : 'Not Rated'}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Status</div>
                        <div className="detail-value">{mixer.status || 'Unknown'}</div>
                    </div>
                </div>
                {onDelete && (
                    <div className="card-footer">
                        <button
                            className="delete-button"
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering onSelect
                                onDelete(mixer.id);
                            }}
                            title="Delete Mixer"
                        >
                            <i className="fas fa-trash"></i> Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default MixerCard;