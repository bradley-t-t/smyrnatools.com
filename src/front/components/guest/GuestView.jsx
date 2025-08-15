import React from 'react';
import {useAuth} from '../../../app/context/AuthContext';
import SmyrnaLogo from '../../../assets/images/SmyrnaLogo.png';
import './styles/GuestView.css';

function GuestView() {
    const {signOut} = useAuth();

    const handleSignOut = async () => {
        try {
            await signOut();
            window.location.href = '/';
        } catch (error) {
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