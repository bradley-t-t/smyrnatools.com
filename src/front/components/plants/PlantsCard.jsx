import React from 'react'
import './styles/PlantsCard.css'

function PlantsCard({plant, onSelect}) {
    const handleCardClick = () => {
        if (onSelect) onSelect(plant.plantCode)
    }

    let statusColor = 'var(--accent)'
    if (plant.status === 'Active') statusColor = 'var(--status-active)'
    else if (plant.status === 'Spare') statusColor = 'var(--status-spare)'
    else if (plant.status === 'In Shop') statusColor = 'var(--status-inshop)'
    else if (plant.status === 'Retired') statusColor = 'var(--status-retired)'

    return (
        <div className="mixer-card plant-card" onClick={handleCardClick}>
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
            <div className="card-content">
                <div className="card-header">
                    <h3 className="mixer-name">
                        ({plant.plantCode}) {plant.plantName}
                    </h3>
                </div>
                <div className="card-details">
                    <div className="detail-row">
                        <div className="detail-label">Status</div>
                        <div className="detail-value">{plant.status || 'Active'}</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PlantsCard
