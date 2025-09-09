import React from 'react'
import '../mixers/styles/MixerCard.css'
import './styles/PickupTrucksCard.css'

function PickupTrucksCard({pickup, onSelect}) {
    const cardProps = onSelect ? {onClick: onSelect} : {}
    const statusClass = String(pickup.status || '').toLowerCase().replace(/\s+/g, '-') || 'default'
    return (
        <div className="mixer-card pickup-trucks-card" {...cardProps}>
            <div className={`status-bar ${statusClass}`}/>
            <div className="card-content">
                <div className="card-header">
                    <h3 className="mixer-name">Pickup {pickup.assigned ? `- ${pickup.assigned}` : ''}</h3>
                </div>
                <div className="card-details">
                    <div className="detail-row">
                        <div className="detail-label">VIN</div>
                        <div className="detail-value">{pickup.vin || 'Unknown'}</div>
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
                        <div
                            className="detail-value">{typeof pickup.mileage === 'number' ? pickup.mileage.toLocaleString() : 'Unknown'}</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PickupTrucksCard
