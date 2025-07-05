import React from 'react';
import './SimpleLoading.css';

const SimpleLoading = ({ text = 'Loading...', size = 'medium' }) => {
  // Using literal string 'Loading...' to ensure consistency
  return (
    <div className={`simple-loading ${size}`}>
      Loading...
    </div>
  );
};

export default SimpleLoading;
