import React from 'react';
import './styles/SimpleLoading.css';

const SimpleLoading = ({text = 'Loading...', size = 'medium'}) => {
    return (
        <div className={`simple-loading ${size}`}>
            {text}
        </div>
    );
};

export default SimpleLoading;
