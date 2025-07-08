import React, { useState, useEffect } from 'react';
import { usePreferences } from '../../context/PreferencesContext';

function ManagersView({ title, showSidebar, setShowSidebar }) {
    const { preferences } = usePreferences();
    const [isLoading, setIsLoading] = useState(true);
    const [managers, setManagers] = useState([]);

    useEffect(() => {
        // This would fetch managers data in the future
        const fetchData = async () => {
            try {
                // Simulate loading
                setTimeout(() => {
                    setIsLoading(false);
                    // Sample data
                    setManagers([]);
                }, 1000);
            } catch (error) {
                console.error('Error fetching managers:', error);
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    if (isLoading) {
        return (
            <div className="managers-view loading">
                <div className="loading-spinner"></div>
                <p>Loading managers data...</p>
            </div>
        );
    }

    return (
        <div className="managers-view">
            <div className="managers-header">
                <h1>Management Team</h1>
                <p>This module will allow you to manage company leadership and assign responsibilities.</p>
            </div>

            <div className="coming-soon-container">
                <div className="coming-soon-icon">
                    <i className="fas fa-user-tie fa-5x" style={{ color: preferences.accentColor === 'red' ? '#b80017' : '#003896' }}></i>
                </div>
                <h2>Coming Soon</h2>
                <p>The Managers module is currently under development.</p>
                <p>Features will include:</p>
                <ul>
                    <li>Management team directory</li>
                    <li>Responsibility assignment</li>
                    <li>Department management</li>
                    <li>Performance tracking</li>
                    <li>Team organization</li>
                </ul>
            </div>
        </div>
    );
}

export default ManagersView;
