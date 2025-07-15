import React from 'react';
import ReactDOM from 'react-dom/client';
import './core/index.css';
import App from './core/App';
import {PreferencesProvider} from './context/PreferencesContext';
import vitalsUtility from './utils/VitalsUtility';

const applyInitialTheme = () => {
    try {
        const savedPrefs = localStorage.getItem('userPreferences');
        if (savedPrefs) {
            const { themeMode, accentColor } = JSON.parse(savedPrefs);
            document.documentElement.classList.toggle('dark-mode', themeMode === 'dark');
            document.documentElement.classList.remove('accent-blue', 'accent-red');
            if (accentColor) document.documentElement.classList.add(`accent-${accentColor}`);
        }
    } catch (error) {
        console.error('Error applying initial theme:', error);
    }
};

applyInitialTheme();

document.head.appendChild(Object.assign(document.createElement('meta'), {
    name: 'viewport',
    content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
}));

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <PreferencesProvider>
            <App />
        </PreferencesProvider>
    </React.StrictMode>
);

vitalsUtility();