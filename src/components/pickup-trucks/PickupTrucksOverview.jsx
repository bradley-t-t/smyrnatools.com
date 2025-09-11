import React, {useMemo} from 'react'
import '../mixers/styles/MixerOverview.css'
import './styles/PickupTrucksOverview.css'

function PickupTrucksOverview({pickups = []}) {
    const stats = useMemo(() => {
        const total = Array.isArray(pickups) ? pickups.length : 0
        let mileageSum = 0
        let mileageCount = 0
        const makeCounts = {}
        const statusCounts = {Active: 0, Stationary: 0, Spare: 0, 'In Shop': 0, Retired: 0, Sold: 0}
        ;(pickups || []).forEach(p => {
            if (typeof p.mileage === 'number' && !isNaN(p.mileage)) {
                mileageSum += p.mileage;
                mileageCount++
            }
            const mk = (p.make || '').trim() || 'Unknown'
            makeCounts[mk] = (makeCounts[mk] || 0) + 1
            const s = (p.status || '').trim()
            if (Object.prototype.hasOwnProperty.call(statusCounts, s)) statusCounts[s]++
        })
        const avgMileage = mileageCount ? Math.round(mileageSum / mileageCount) : 0
        const makeRows = Object.entries(makeCounts).sort((a, b) => b[1] - a[1])
        return {total, avgMileage, makeRows, statusCounts}
    }, [pickups])

    return (
        <div className="mixer-overview pickup-trucks-overview">
            <div className="overview-grid">
                <div className="overview-card status-card">
                    <h2>Status Overview</h2>
                    <div className="status-grid">
                        <div className="status-item">
                            <div className="status-count">{stats.total}</div>
                            <div className="status-label">Total Pickups</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{stats.statusCounts.Active || 0}</div>
                            <div className="status-label">Active</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{stats.statusCounts.Stationary || 0}</div>
                            <div className="status-label">Stationary</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{stats.statusCounts['In Shop'] || 0}</div>
                            <div className="status-label">In Shop</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{stats.statusCounts.Spare || 0}</div>
                            <div className="status-label">Spare</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{stats.statusCounts.Retired || 0}</div>
                            <div className="status-label">Retired</div>
                        </div>
                        <div className="status-item">
                            <div className="status-count">{stats.statusCounts.Sold || 0}</div>
                            <div className="status-label">Sold</div>
                        </div>
                    </div>
                </div>
                <div className="overview-card maintenance-card">
                    <h2>Fleet</h2>
                    <div className="maintenance-stats">
                        <div className="maintenance-stat">
                            <div className="stat-icon"><i className="fas fa-tachometer-alt"></i></div>
                            <div className="stat-content">
                                <div className="stat-value">{stats.avgMileage.toLocaleString()}</div>
                                <div className="stat-label">Avg. Mileage</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="overview-card plant-card">
                    <h2 className="make-distribution-title">Make Distribution</h2>
                    <div className="plant-distribution-table">
                        <table className="distribution-table">
                            <thead>
                            <tr>
                                <th>Make</th>
                                <th>Count</th>
                            </tr>
                            </thead>
                            <tbody>
                            {stats.makeRows.map(([mk, count]) => (
                                <tr key={mk}>
                                    <td className="plant-name">{mk}</td>
                                    <td>{count}</td>
                                </tr>
                            ))}
                            {stats.makeRows.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="inactive-dash no-data">No data</td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PickupTrucksOverview
