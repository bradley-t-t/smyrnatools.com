import React from 'react';
import './LoadingText.css';

const LoadingText = ({ text = 'Loading', size = 'medium' }) => {
  return (
    <div className={`loading-text-container ${size}`}>
      <div className="loading-text">
        Loading...
      </div>
    </div>
  );
};

export default LoadingText;
