import React from 'react'
import '../mixers/styles/MixerCard.css'
import './styles/PickupTrucksCard.css'

function PickupTrucksCard({pickup, onSelect, isDuplicateVin, isDuplicateAssigned, isHighMileage}) {
    const cardProps = onSelect ? {onClick: onSelect} : {}
    const statusClass = String(pickup.status || '').toLowerCase().replace(/\s+/g, '-') || 'default'
    const assignedLabel = pickup.assigned ? `- ${pickup.assigned}` : ''
    return (
        <div className="mixer-card pickup-trucks-card" {...cardProps}>
            <div className={`status-bar ${statusClass}`}/>
            <div className="card-content">
                <div className="card-header">
                    <h3 className="mixer-name">
                        <span>Pickup {assignedLabel}</span>
                        {isDuplicateAssigned && (
                            <span className="warning-badge" title="Assigned to multiple pickups">
                                <i className="fas fa-exclamation-triangle"></i>
                            </span>
                        )}
                    </h3>
                </div>
                <div className="card-details">
                    <div className="detail-row">
                        <div className="detail-label">VIN</div>
                        <div className="detail-value">
                            <span>{pickup.vin || 'Unknown'}</span>
                            {isDuplicateVin && (
                                <span className="warning-badge" title="Duplicate VIN">
                                    <i className="fas fa-exclamation-triangle"></i>
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Make</div>
                        <div className="detail-value">{pickup.make || 'Unknown'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Model</div>
                        <div className="detail-value">{pickup.model || 'Unknown'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Year</div>
                        <div className="detail-value">{pickup.year || 'Unknown'}</div>
                    </div>
                    <div className="detail-row">
                        <div className="detail-label">Mileage</div>
                        <div className="detail-value">
                            <span>{typeof pickup.mileage === 'number' ? pickup.mileage.toLocaleString() : 'Unknown'}</span>
                            {isHighMileage && (
                                <span className="warning-badge" title="High mileage">
                                    <i className="fas fa-exclamation-triangle"></i>
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PickupTrucksCard
