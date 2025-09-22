import React from 'react'
import './styles/OfflineView.css'

function OfflineView({onRetry, onReload}) {
    return (
        <div className="offline-container">
            <div className="offline-content">
                <h1>Offline</h1>
                <p className="offline-message">Your connection appears to be offline or unstable. Please check your network and try again.</p>
                <div className="offline-actions">
                    <button className="btn btn-secondary" onClick={onReload}>Reload</button>
                    <button className="btn btn-primary" onClick={onRetry}>Retry Connection</button>
                </div>
            </div>
        </div>
    )
}

export default OfflineView
