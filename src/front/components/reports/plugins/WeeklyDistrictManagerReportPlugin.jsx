import React from 'react'

export function DistrictManagerSubmitPlugin({ maintenanceItems }) {
    if (!maintenanceItems || maintenanceItems.length === 0) return null
    function getPlantName(plantCode) {
        return plantCode || ''
    }
    function truncateText(text, maxLength) {
        if (!text) return ''
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }
    return (
        <div style={{ marginTop: 32, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
                Items Completed This Week
            </div>
            <div className="list-view-table">
                <div className="list-view-header">
                    <div className="list-column description">Description</div>
                    <div className="list-column plant">Plant</div>
                    <div className="list-column deadline">Deadline</div>
                    <div className="list-column completed-date">Completed</div>
                </div>
                <div className="list-view-rows">
                    {maintenanceItems.map(item => (
                        <div key={item.id} className={`list-view-row ${item.completed ? 'completed' : ''}`}>
                            <div className="list-column description left-align" title={item.description}>
                                <div style={{
                                    background: item.completed ? 'var(--success)' : item.isOverdue ? 'var(--error)' : 'var(--accent)',
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    display: 'inline-block',
                                    marginRight: 8,
                                    verticalAlign: 'middle'
                                }}></div>
                                {truncateText(item.description, 60)}
                            </div>
                            <div className="list-column plant" title={getPlantName(item.plant_code)}>
                                {truncateText(getPlantName(item.plant_code), 20)}
                            </div>
                            <div className="list-column deadline">
                                {item.deadline ? new Date(item.deadline).toLocaleDateString() : ''}
                            </div>
                            <div className="list-column completed-date">
                                {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : ''}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export function DistrictManagerReviewPlugin({ maintenanceItems }) {
    if (!maintenanceItems || maintenanceItems.length === 0) return null
    function getPlantName(plantCode) {
        return plantCode || ''
    }
    function truncateText(text, maxLength) {
        if (!text) return ''
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }
    return (
        <div style={{ marginTop: 32, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
                Items Completed This Week
            </div>
            <div className="list-view-table">
                <div className="list-view-header">
                    <div className="list-column description">Description</div>
                    <div className="list-column plant">Plant</div>
                    <div className="list-column deadline">Deadline</div>
                    <div className="list-column completed-date">Completed</div>
                </div>
                <div className="list-view-rows">
                    {maintenanceItems.map(item => (
                        <div key={item.id} className={`list-view-row ${item.completed ? 'completed' : ''}`}>
                            <div className="list-column description left-align" title={item.description}>
                                <div style={{
                                    background: item.completed ? 'var(--success)' : item.isOverdue ? 'var(--error)' : 'var(--accent)',
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    display: 'inline-block',
                                    marginRight: 8,
                                    verticalAlign: 'middle'
                                }}></div>
                                {truncateText(item.description, 60)}
                            </div>
                            <div className="list-column plant" title={getPlantName(item.plant_code)}>
                                {truncateText(getPlantName(item.plant_code), 20)}
                            </div>
                            <div className="list-column deadline">
                                {item.deadline ? new Date(item.deadline).toLocaleDateString() : ''}
                            </div>
                            <div className="list-column completed-date">
                                {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : ''}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

