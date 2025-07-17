import React, { useState, useEffect } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import './TipBanner.css';

function TipBanner() {
    const { preferences } = usePreferences();
    const [currentTip, setCurrentTip] = useState('');
    const [isVisible, setIsVisible] = useState(true);
    const accentColor = preferences.accentColor === 'red' ? '#b80017' : '#003896';

    const tips = [
        'Only trucks that are at a shop should be marked as "In Shop"',
        'Be sure to keep your truck issues up to date',
        'Verify your assets by Friday at 10am weekly',
        'Whenever you make changes to an asset, you must re-verify it',
        'Training operators should not be assigned to an asset until they have completed their training'
    ];

    useEffect(() => {
        setCurrentTip(tips[Math.floor(Math.random() * tips.length)]);

        const tipInterval = setInterval(() => {
            const newTip = tips[Math.floor(Math.random() * tips.length)];
            setCurrentTip(newTip);
        }, 15000);

        return () => clearInterval(tipInterval);
    }, []);

    if (!isVisible || !preferences.showTips) return null;

    return (
        <div className="tip-banner" style={{ backgroundColor: preferences.themeMode === 'dark' ? '#2a2a2a' : '#ffffff' }}>
            <div className="tip-content">
                <div className="tip-icon" style={{ color: accentColor }}>
                    <i className="fas fa-lightbulb"></i>
                </div>
                <div className="tip-text">{currentTip}</div>
            </div>
            <button className="tip-close" onClick={() => setIsVisible(false)}>
                <i className="fas fa-times"></i>
            </button>
        </div>
    );
}

export default TipBanner;
