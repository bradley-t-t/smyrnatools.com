import React, {useEffect, useState} from 'react';
import {usePreferences} from '../../context/PreferencesContext';
import {supabase} from '../../services/DatabaseService';
import './SettingsView.css';

function SettingsView() {
    const {preferences, toggleNavbarMinimized, toggleShowTips, toggleShowOnlineOverlay, setThemeMode, setAccentColor} = usePreferences();
    const [showFeedback, setShowFeedback] = useState(false);
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        const getCurrentUser = async () => {
            try {
                const {data} = await supabase.auth.getSession();
                if (data?.session?.user?.id) {
                    setUserId(data.session.user.id);
                    return;
                }

                const sessionUserId = sessionStorage.getItem('userId');
                if (sessionUserId) {
                    setUserId(sessionUserId);
                    return;
                }
            } catch (error) {
            }
        };

        getCurrentUser();
    }, []);

    const handleSettingChange = (changeFunction, ...args) => {
        changeFunction(...args);
        setShowFeedback(true);
        setTimeout(() => setShowFeedback(false), 2000);
    };

    return (
        <div className="settings-container">
            {showFeedback && (
                <div className="settings-feedback"
                     style={{backgroundColor: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}>
                    <i className="fas fa-check-circle"></i> Settings saved successfully
                </div>
            )}
            <div className="settings-header">
                <h1>Settings</h1>
                <p>Customize your application experience</p>
            </div>

            <div className="settings-content">
                <div className="settings-card">
                    <div className="settings-card-header">
                        <h2><i className="fas fa-palette"
                               style={{color: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}></i> Appearance
                        </h2>
                        <p>Customize how the application looks</p>
                    </div>

                    <div className="settings-section">
                        <h3>Theme Mode</h3>
                        <div className="theme-selector">
                            <div
                                className={`theme-option ${preferences.themeMode === 'light' ? 'active' : ''}`}
                                onClick={() => handleSettingChange(setThemeMode, 'light')}
                            >
                                <div className="theme-preview light-preview">
                                    <div className="preview-navbar"></div>
                                    <div className="preview-content">
                                        <div className="preview-item"></div>
                                        <div className="preview-item"></div>
                                    </div>
                                </div>
                                <span>Light</span>
                            </div>

                            <div
                                className={`theme-option ${preferences.themeMode === 'dark' ? 'active' : ''}`}
                                onClick={() => handleSettingChange(setThemeMode, 'dark')}
                            >
                                <div className="theme-preview dark-preview">
                                    <div className="preview-navbar"></div>
                                    <div className="preview-content">
                                        <div className="preview-item"></div>
                                        <div className="preview-item"></div>
                                    </div>
                                </div>
                                <span>Dark</span>
                            </div>
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3>Accent Color</h3>
                        <div className="color-selector">
                            <div
                                className={`color-option red ${preferences.accentColor === 'red' ? 'active' : ''}`}
                                onClick={() => handleSettingChange(setAccentColor, 'red')}
                            >
                                <div className="color-preview"></div>
                                <span>Red</span>
                            </div>
                            <div
                                className={`color-option blue ${preferences.accentColor === 'blue' ? 'active' : ''}`}
                                onClick={() => handleSettingChange(setAccentColor, 'blue')}
                            >
                                <div className="color-preview"></div>
                                <span>Blue</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="settings-card">
                    <div className="settings-card-header">
                        <h2><i className="fas fa-bars"
                               style={{color: preferences.accentColor === 'red' ? '#b80017' : '#003896'}}></i> Navigation
                        </h2>
                        <p>Customize the navigation experience</p>
                    </div>

                    <div className="settings-section">
                        <h3>Sidebar State</h3>
                        <div className="toggle-setting">
                            <span className="toggle-label">Minimize Navigation Bar</span>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={preferences.navbarMinimized}
                                    onChange={() => handleSettingChange(toggleNavbarMinimized)}
                                />
                                <span className="slider round"></span>
                            </label>
                            <span
                                className="toggle-state">{preferences.navbarMinimized ? 'Minimized' : 'Expanded'}</span>
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3>Interface Elements</h3>
                        <div className="toggle-setting">
                            <span className="toggle-label">Show Tips Banner</span>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={preferences.showTips}
                                    onChange={() => handleSettingChange(toggleShowTips)}
                                />
                                <span className="slider round"></span>
                            </label>
                            <span className="toggle-state">{preferences.showTips ? 'Visible' : 'Hidden'}</span>
                        </div>

                        <div className="toggle-setting">
                            <span className="toggle-label">Show Online Users Overlay</span>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={preferences.showOnlineOverlay}
                                    onChange={() => handleSettingChange(toggleShowOnlineOverlay)}
                                />
                                <span className="slider round"></span>
                            </label>
                            <span className="toggle-state">{preferences.showOnlineOverlay ? 'Visible' : 'Hidden'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SettingsView;