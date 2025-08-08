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
                        <table className="teams-overview-table">
                            <thead>
                                <tr>
                                    <th>Team</th>
                                    <th>Operator Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>A Team</td>
                                    <td>{countA}</td>
                                </tr>
                                <tr>
                                    <td>B Team</td>
                                    <td>{countB}</td>
                                </tr>
                            </tbody>
                        </table>
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
