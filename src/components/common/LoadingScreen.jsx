import React from 'react';
import './LoadingScreen.css';
import SmyrnaLogo from '../../assets/SmyrnaLogo.png';

function LoadingScreen({message = 'Loading...'}) {
    return (
        <div className="loading-screen">
            <div className="loading-content">
                <img src={SmyrnaLogo} alt="Logo" className="loading-logo"/>
                <div className="loading-spinner"></div>
                <p className="loading-message">{message}</p>
            </div>
        </div>
    );
}

export default LoadingScreen;
