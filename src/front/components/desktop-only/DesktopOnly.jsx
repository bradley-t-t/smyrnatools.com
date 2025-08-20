import React from 'react';
import SmyrnaLogo from '../../../assets/images/SmyrnaLogo.png';
import './styles/DesktopOnly.css';

function DesktopOnly() {
    return (
        <div className="desktop-only-container">
            <div className="desktop-only-content">
                <img src={SmyrnaLogo} alt="Smyrna Logo" className="desktop-logo"/>
                <h1>Desktop Only</h1>
                <p className="desktop-message">Smyrna Tools is currently available on desktop devices. Please access this site from a desktop or laptop for the best experience.</p>
            </div>
        </div>
    );
}

export default DesktopOnly;
