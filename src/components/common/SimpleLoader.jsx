import React from 'react';
import './SimpleLoader.css';

const SimpleLoader = ({text = 'Loading...', size = 'medium'}) => {
    return (
        <div className={`simple-loader ${size}`}>
            <div className="loader-spinner"></div>
            {text && <div className="loader-text">{text}</div>}
        </div>
    );
};

export default SimpleLoader;
