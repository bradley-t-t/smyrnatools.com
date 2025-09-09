import React from 'react'
import '../mixers/styles/MixerCard.css'

function PickupTrucksCard({pickup, onSelect}) {
    const cardProps = onSelect ? {onClick: onSelect} : {}
    let statusColor = 'var(--accent)'
    if (pickup.status === 'Active') statusColor = 'var(--status-active)'
    else if (pickup.status === 'Spare') statusColor = 'var(--status-spare)'
    else if (pickup.status === 'In Shop') statusColor = 'var(--status-inshop)'
    else if (pickup.status === 'Retired') statusColor = 'var(--status-retired)'
    return (
        <div className="mixer-card" {...cardProps}>
            <div style={{height: 4, width: '100%', background: statusColor, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10}}/>
            <div className="card-content">
                <div className="card-header">
                    <h3 className="mixer-name" style={{color: 'var(--accent)'}}>Pickup {pickup.assigned ? `- ${pickup.assigned}` : ''}</h3>
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
                        <div className="detail-value">{typeof pickup.mileage === 'number' ? pickup.mileage.toLocaleString() : 'Unknown'}</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PickupTrucksCard
