import React from 'react';
import './LoadingScreen.css';
import SmyrnaLogo from '../../assets/images/SmyrnaLogo.png';

function LoadingScreen({message = 'Loading...', fullPage = false, inline = false}) {
    return (
        <div className={`loading-screen ${fullPage ? 'full-page' : inline ? 'inline' : 'popup'}`}>
            <div className="loading-content">
                <div className="loading-animation">
                    <img src={SmyrnaLogo} alt="Loading" className="bouncing-logo"/>
                </div>
                <p className="loading-message">{message}</p>
            </div>
        </div>
    );
}

export default LoadingScreen;
