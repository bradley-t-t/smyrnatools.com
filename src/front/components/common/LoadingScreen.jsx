import React from 'react';
import './styles/LoadingScreen.css';
import SmyrnaLogo from '../../../assets/images/SmyrnaLogo.png';
import { usePreferences } from '../../../app/context/PreferencesContext';
import ThemeUtility from '../../../utils/ThemeUtility';

function LoadingScreen({message = 'Loading...', fullPage = false, inline = false}) {
    const { preferences } = usePreferences();
    const isDarkMode = preferences?.themeMode === 'dark';
    const themeClass = isDarkMode ? 'dark-mode' : '';

    return (
        <div className={`loading-screen ${themeClass} ${fullPage ? 'full-page' : inline ? 'inline' : 'popup'}`}>
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
