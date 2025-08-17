import React from 'react'

export function DistrictManagerSubmitPlugin({maintenanceItems}) {
    if (!maintenanceItems || maintenanceItems.length === 0) return null

    function getPlantName(plantCode) {
        return plantCode || ''
    }

    function truncateText(text, maxLength) {
        if (!text) return ''
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }

    return (
        <div style={{marginTop: 32, marginBottom: 16}}>
            <div style={{fontWeight: 700, fontSize: 17, marginBottom: 8}}>
                Items Completed This Week
            </div>
            <div className="mixers-list-table-container" style={{marginTop: 8}}>
                <table className="mixers-list-table">
                    <thead>
                    <tr>
                        <th>Description</th>
                        <th>Plant</th>
                        <th>Deadline</th>
                        <th>Completed</th>
                    </tr>
                    </thead>
                    <tbody>
                    {maintenanceItems.map(item => (
                        <tr key={item.id} className={item.completed ? 'completed' : ''}>
                            <td title={item.description}>
                                    <span
                                        style={{
                                            background: item.completed ? 'var(--success)' : item.isOverdue ? 'var(--error)' : 'var(--accent)',
                                            width: 10,
                                            height: 10,
                                            borderRadius: '50%',
                                            display: 'inline-block',
                                            marginRight: 8,
                                            verticalAlign: 'middle'
                                        }}
                                    ></span>
                                {truncateText(item.description, 60)}
                            </td>
                            <td title={getPlantName(item.plant_code)}>
                                {truncateText(getPlantName(item.plant_code), 20)}
                            </td>
                            <td>
                                {item.deadline ? new Date(item.deadline).toLocaleDateString() : ''}
                            </td>
                            <td>
                                {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : ''}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export function DistrictManagerReviewPlugin({maintenanceItems}) {
    if (!maintenanceItems || maintenanceItems.length === 0) return null

    function getPlantName(plantCode) {
        return plantCode || ''
    }

    function truncateText(text, maxLength) {
        if (!text) return ''
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }

    return (
        <div style={{marginTop: 32, marginBottom: 16}}>
            <div style={{fontWeight: 700, fontSize: 17, marginBottom: 8}}>
                Items Completed This Week
            </div>
            <div className="mixers-list-table-container" style={{marginTop: 8}}>
                <table className="mixers-list-table">
                    <thead>
                    <tr>
                        <th>Description</th>
                        <th>Plant</th>
                        <th>Deadline</th>
                        <th>Completed</th>
                    </tr>
                    </thead>
                    <tbody>
                    {maintenanceItems.map(item => (
                        <tr key={item.id} className={item.completed ? 'completed' : ''}>
                            <td title={item.description}>
                                    <span
                                        style={{
                                            background: item.completed ? 'var(--success)' : item.isOverdue ? 'var(--error)' : 'var(--accent)',
                                            width: 10,
                                            height: 10,
                                            borderRadius: '50%',
                                            display: 'inline-block',
                                            marginRight: 8,
                                            verticalAlign: 'middle'
                                        }}
                                    ></span>
                                {truncateText(item.description, 60)}
                            </td>
                            <td title={getPlantName(item.plant_code)}>
                                {truncateText(getPlantName(item.plant_code), 20)}
                            </td>
                            <td>
                                {item.deadline ? new Date(item.deadline).toLocaleDateString() : ''}
                            </td>
                            <td>
                                {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : ''}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
