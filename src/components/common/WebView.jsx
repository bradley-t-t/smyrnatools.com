import React from 'react';
import './WebView.css';

function WebView({url, onClose}) {
    return (
        <div className="web-view-container">
            <div className="web-view-header">
                <button className="close-button" onClick={onClose}>
                    <i className="fas fa-times"></i>
                </button>
                <div className="url-display">{url}</div>
            </div>
            <iframe
                src={url}
                title="External Content"
                className="web-view-frame"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
        </div>
    );
}

export default WebView;
