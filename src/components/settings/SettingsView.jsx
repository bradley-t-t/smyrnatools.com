import React, {useState} from 'react'
import {usePreferences} from '../../app/context/PreferencesContext'
import './styles/SettingsView.css'
import VersionPopup from '../common/VersionPopup'
import {useVersion} from '../../app/hooks/useVersion'

const ACCENT_OPTIONS = [
    {key: 'red', label: 'Red', className: 'red'},
    {key: 'blue', label: 'Blue', className: 'blue'}
]

function SettingsView() {
    const version = useVersion()
    const {
        preferences,
        toggleNavbarMinimized,
        toggleShowTips,
        toggleShowOnlineOverlay,
        setThemeMode,
        setAccentColor,
        toggleAcceptReportSubmittedEmails
    } = usePreferences()
    const [showFeedback, setShowFeedback] = useState(false)

    const save = (fn, ...args) => {
        fn(...args)
        setShowFeedback(true)
        setTimeout(() => setShowFeedback(false), 1200)
    }

    return (
        <div className="settings-container">
            <VersionPopup version={version}/>
            {showFeedback && (
                <div className="settings-feedback">
                    <i className="fas fa-check-circle"></i> Saved
                </div>
            )}
            <div className="settings-header">
                <h1>Settings</h1>
                <p>Adjust your setting how you would like.</p>
            </div>
            <div className="settings-content">
                <div className="settings-card">
                    <div className="settings-card-header">
                        <h2>
                            <i className="fas fa-palette"></i> Appearance
                        </h2>
                        <p>Make it feel right for you</p>
                    </div>
                    <div className="settings-section">
                        <h3>Theme</h3>
                        <div className="theme-selector">
                            <div className={`theme-option ${preferences.themeMode === 'light' ? 'active' : ''}`}
                                 onClick={() => save(setThemeMode, 'light')}>
                                <div className="theme-preview light-preview">
                                    <div className="preview-navbar"></div>
                                    <div className="preview-content">
                                        <div className="preview-item"></div>
                                        <div className="preview-item"></div>
                                    </div>
                                </div>
                                <span>Light</span>
                            </div>
                            <div className={`theme-option ${preferences.themeMode === 'dark' ? 'active' : ''}`}
                                 onClick={() => save(setThemeMode, 'dark')}>
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
                                <div key={opt.key}
                                     className={`color-option ${opt.className} ${preferences.accentColor === opt.key ? 'active' : ''}`}
                                     onClick={() => save(setAccentColor, opt.key)}>
                                    <div className={`color-preview ${opt.className}`}></div>
                                    <span>{opt.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="settings-card">
                    <div className="settings-card-header">
                        <h2>
                            <i className="fas fa-bars"></i> Navigation
                        </h2>
                        <p>Set up how you move around</p>
                    </div>
                    <div className="settings-section">
                        <h3>Sidebar</h3>
                        <div className="toggle-setting">
                            <span className="toggle-label">Minimize Navigation</span>
                            <label className="switch">
                                <input type="checkbox" checked={preferences.navbarMinimized}
                                       onChange={() => save(toggleNavbarMinimized)}/>
                                <span className="slider round"></span>
                            </label>
                            <span
                                className="toggle-state">{preferences.navbarMinimized ? 'Minimized' : 'Expanded'}</span>
                        </div>
                    </div>
                    <div className="settings-section">
                        <h3>Interface</h3>
                        <div className="toggle-setting">
                            <span className="toggle-label">Tips</span>
                            <label className="switch">
                                <input type="checkbox" checked={preferences.showTips}
                                       onChange={() => save(toggleShowTips)}/>
                                <span className="slider round"></span>
                            </label>
                            <span className="toggle-state">{preferences.showTips ? 'Visible' : 'Hidden'}</span>
                        </div>
                        <div className="toggle-setting">
                            <span className="toggle-label">Online Users List</span>
                            <label className="switch">
                                <input type="checkbox" checked={preferences.showOnlineOverlay}
                                       onChange={() => save(toggleShowOnlineOverlay)}/>
                                <span className="slider round"></span>
                            </label>
                            <span className="toggle-state">{preferences.showOnlineOverlay ? 'Visible' : 'Hidden'}</span>
                        </div>
                    </div>
                </div>
                <div className="settings-card">
                    <div className="settings-card-header">
                        <h2>
                            <i className="fas fa-bell"></i> Notifications
                        </h2>
                        <p>Control what you get notified about</p>
                    </div>
                    <div className="settings-section">
                        <h3>Emails</h3>
                        <div className="toggle-setting">
                            <span className="toggle-label">Report Submitted Emails</span>
                            <label className="switch">
                                <input type="checkbox" checked={preferences.acceptReportSubmittedEmails}
                                       onChange={() => save(toggleAcceptReportSubmittedEmails)}/>
                                <span className="slider round"></span>
                            </label>
                            <span className="toggle-state">{preferences.acceptReportSubmittedEmails ? 'Enabled' : 'Disabled'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SettingsView
