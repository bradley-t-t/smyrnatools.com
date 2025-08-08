import React from 'react';
import './styles/TeamsOverview.css';

function TeamsOverview({ onClose, teams }) {
    let countA = 0
    let countB = 0
    if (teams && typeof teams === 'object') {
        if (Array.isArray(teams.A)) countA = teams.A.length
        if (Array.isArray(teams.B)) countB = teams.B.length
    }
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content overview-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Teams Overview</h2>
                    <button className="close-button" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <div className="overview-metrics">
                        <div className="metrics-row">
                            <div className="metric-card">
                                <div className="metric-title">Operators (A Team)</div>
                                <div className="metric-value">{countA}</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-title">Operators (B Team)</div>
                                <div className="metric-value">{countB}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="primary-button" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

export default TeamsOverview
