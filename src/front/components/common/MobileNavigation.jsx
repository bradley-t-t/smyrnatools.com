import React from 'react';
import {usePreferences} from '../../../app/context/PreferencesContext';
import './styles/MobileNavgation.css';

function MobileNavigation() {
    const {preferences, toggleNavbarMinimized} = usePreferences();

    const handleToggle = () => {
        toggleNavbarMinimized();
    };

    return (
        <button
            className="mobile-nav-toggle"
            onClick={handleToggle}
            aria-label="Toggle navigation menu"
        >
            <i className={`fas ${preferences.navbarMinimized ? 'fa-bars' : 'fa-times'}`}></i>
        </button>
    );
}

export default MobileNavigation;
