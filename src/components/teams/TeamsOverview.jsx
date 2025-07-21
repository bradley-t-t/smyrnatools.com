import React from 'react';
import './TeamsOverview.css';

function TeamsOverview({ onClose, teams }) {
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
                                <div className="metric-title">Active Operators (A Team)</div>
                                <div className="metric-value">{teams.A.filter(op => op.status === 'Active').length}</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-title">Active Operators (B Team)</div>
                                <div className="metric-value">{teams.B.filter(op => op.status === 'Active').length}</div>
                            </div>
                        </div>
                        <div className="overview-notation">
                            <em>
                                Information does not account for operators who have requested off or have time off.
                            </em>
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
    );
}

export default TeamsOverview;

