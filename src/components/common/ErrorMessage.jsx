import React from 'react';
import './ErrorMessage.css';

function ErrorMessage({ message, onDismiss, className = '' }) {
    if (!message) return null;

    return (
        <div className={`error-message-component ${className}`}>
            <span className="error-message-text">{message}</span>
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    className="error-dismiss-button"
                    aria-label="Dismiss error"
                >
                    <i className="fas fa-times"></i>
                </button>
            )}
        </div>
    );
}

export default ErrorMessage;