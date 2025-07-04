import React from 'react';
import './HtmlViewer.css';

function HtmlViewer({htmlContent, onClose}) {
    return (
        <div className="html-viewer-overlay">
            <div className="html-viewer-container">
                <div className="html-viewer-header">
                    <h2>HTML Content</h2>
                    <button className="close-button" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="html-viewer-content">
                    <pre>{htmlContent}</pre>
                </div>
            </div>
        </div>
    );
}

export default HtmlViewer;
