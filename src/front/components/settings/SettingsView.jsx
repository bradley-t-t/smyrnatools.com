import React, {useEffect, useState} from 'react';
import {usePreferences} from '../../../app/context/PreferencesContext';
import {supabase} from '../../../services/DatabaseService';
import './styles/SettingsView.css';

function VersionPopup({ version }) {
    if (!version) return null
    return (
        <div className="version-popup-centered">
            Version: {version} Author: Trenton Taylor
        </div>
    )
}

const ACCENT_OPTIONS = [
    { key: 'red', label: 'Red', className: 'red' },
    { key: 'blue', label: 'Blue', className: 'blue' }
];

const VIEW_MODE_OPTIONS = [
    { key: 'grid', label: 'Grid' },
    { key: 'list', label: 'List' }
];

function SettingsView() {
    const {preferences, toggleNavbarMinimized, toggleShowTips, toggleShowOnlineOverlay, toggleAutoOverview, setThemeMode, setAccentColor, updatePreferences} = usePreferences();
    const [showFeedback, setShowFeedback] = useState(false);
    const [userId, setUserId] = useState(null);
    const [version, setVersion] = useState('');

    useEffect(() => {
        fetch('/version.json', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setVersion(data.version || ''))
            .catch(() => setVersion(''))
    }, []);

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

    const handleViewModeChange = (mode) => {
        updatePreferences('defaultViewMode', mode)
        setShowFeedback(true)
        setTimeout(() => setShowFeedback(false), 2000)
    };

    return (
        <div className="settings-container">
            <VersionPopup version={version} />
            {showFeedback && (
                <div className="settings-feedback">
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
                        <h2>
                            <i className="fas fa-palette"></i> Appearance
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
                            {ACCENT_OPTIONS.map(opt => (
                                <div
                                    key={opt.key}
                                    className={`color-option ${opt.className} ${preferences.accentColor === opt.key ? 'active' : ''}`}
                                    onClick={() => handleSettingChange(setAccentColor, opt.key)}
                                >
                                    <div className={`color-preview ${opt.className}`}></div>
                                    <span>{opt.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="settings-section">
                        <h3>Default View Mode</h3>
                        <div className="view-mode-toggle">
                            {VIEW_MODE_OPTIONS.map(opt => (
                                <label key={opt.key} className={`view-mode-option${preferences.defaultViewMode === opt.key ? ' active' : ''}`}>
                                    <input
                                        type="radio"
                                        name="defaultViewMode"
                                        value={opt.key}
                                        checked={preferences.defaultViewMode === opt.key}
                                        onChange={() => handleViewModeChange(opt.key)}
                                    />
                                    <span>{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="settings-card">
                    <div className="settings-card-header">
                        <h2>
                            <i className="fas fa-bars"></i> Navigation
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
                            <span className="toggle-state">{preferences.navbarMinimized ? 'Minimized' : 'Expanded'}</span>
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
                        <div className="toggle-setting">
                            <span className="toggle-label">Pop-up Overview Automatically</span>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={preferences.autoOverview}
                                    onChange={() => handleSettingChange(toggleAutoOverview)}
                                />
                                <span className="slider round"></span>
                            </label>
                            <span className="toggle-state">{preferences.autoOverview ? 'Enabled' : 'Disabled'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SettingsView;
