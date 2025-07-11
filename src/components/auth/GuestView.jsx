import React from 'react';
import {useAuth} from '../../context/AuthContext';
import SmyrnaLogo from '../../assets/SmyrnaLogo.png';
import './GuestView.css';

function GuestView() {
    const {signOut} = useAuth();

    const handleSignOut = async () => {
        try {
            await signOut();
            // Force reload the page to ensure complete reset of app state
            window.location.href = '/';
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <div className="guest-view-container">
            <div className="guest-view-content">
                <img src={SmyrnaLogo} alt="Smyrna Logo" className="guest-logo"/>
                <h1>Access Pending</h1>
                <p className="guest-message">
                    You must contact your district manager for them to approve your sign-up.
                </p>
                <button className="sign-out-button" onClick={handleSignOut}>
                    Sign Out
                </button>
            </div>
        </div>
    );
}

export default GuestView;
