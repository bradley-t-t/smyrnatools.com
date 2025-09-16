import React from 'react'
import '../styles/ReportTypes.css'
import {ReportUtility} from '../../../utils/ReportUtility'

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
        <div className="rpt-section">
            <div className="rpt-section-title">
                Items Completed This Week
            </div>
            <div className="mixers-list-table-container rpt-table-container">
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
                                    className={`rpt-status-dot ${item.completed ? 'success' : item.isOverdue ? 'error' : 'accent'}`}
                                />
                                {truncateText(item.description, 60)}
                            </td>
                            <td title={getPlantName(item.plant_code)}>
                                {truncateText(getPlantName(item.plant_code), 20)}
                            </td>
                            <td>
                                {item.deadline ? ReportUtility.formatDate(item.deadline) : ''}
                            </td>
                            <td>
                                {item.completed_at ? ReportUtility.formatDate(item.completed_at) : ''}
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
        <div className="rpt-section">
            <div className="rpt-section-title">
                Items Completed This Week
            </div>
            <div className="mixers-list-table-container rpt-table-container">
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
                                    className={`rpt-status-dot ${item.completed ? 'success' : item.isOverdue ? 'error' : 'accent'}`}
                                />
                                {truncateText(item.description, 60)}
                            </td>
                            <td title={getPlantName(item.plant_code)}>
                                {truncateText(getPlantName(item.plant_code), 20)}
                            </td>
                            <td>
                                {item.deadline ? ReportUtility.formatDate(item.deadline) : ''}
                            </td>
                            <td>
                                {item.completed_at ? ReportUtility.formatDate(item.completed_at) : ''}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
