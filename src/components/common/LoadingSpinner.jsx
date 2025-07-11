import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({size = 'medium', text}) => {
    let sizeClass = '';

    if (size === 'small') {
        sizeClass = 'small';
    } else if (size === 'large') {
        sizeClass = 'large';
    }

    return (
        <div className="loading-spinner-container">
            <div className={`loading-spinner ${sizeClass}`}></div>
            {text && <div className="loading-text">{text}</div>}
        </div>
    );
};

export default LoadingSpinner;
