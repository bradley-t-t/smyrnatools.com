import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './utils/ReportWebVitals';

const meta = document.createElement('meta');
meta.name = 'viewport';
meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
document.getElementsByTagName('head')[0].appendChild(meta);

// Apply theme from localStorage before React renders anything
const applyInitialTheme = () => {
  try {
    const savedPrefs = localStorage.getItem('userPreferences');
    if (savedPrefs) {
      const prefs = JSON.parse(savedPrefs);

      // Apply theme mode
      if (prefs.themeMode === 'dark') {
        document.documentElement.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
      }

      // Apply accent color
      document.documentElement.classList.remove('accent-blue', 'accent-red');
      document.documentElement.classList.add(`accent-${prefs.accentColor}`);
    }
  } catch (error) {
    console.error('Error applying initial theme:', error);
  }
};

// Import the PreferencesProvider
import { PreferencesProvider } from './context/PreferencesContext';

// Apply theme before any rendering
applyInitialTheme();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <PreferencesProvider>
            <App/>
        </PreferencesProvider>
    </React.StrictMode>
);

reportWebVitals();
