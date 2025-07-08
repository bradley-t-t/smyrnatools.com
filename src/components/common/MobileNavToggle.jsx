import React from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import './MobileNavToggle.css';

function MobileNavToggle() {
  const { preferences, toggleNavbarMinimized } = usePreferences();

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

export default MobileNavToggle;
