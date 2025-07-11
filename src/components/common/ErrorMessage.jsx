import React from 'react';
import './ErrorMessage.css';

/**
 * A reusable error message component that works in both light and dark modes
 * 
 * @param {Object} props Component properties
 * @param {string} props.message Error message to display
 * @param {Function} props.onDismiss Optional callback when dismiss button is clicked
 * @param {string} props.className Optional additional CSS classes
 */
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
