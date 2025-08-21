import React from 'react';
import SmyrnaLogo from '../../../assets/images/SmyrnaLogo.png';
import './styles/LoginView.css';

function PasswordRecoveryView({ onBackToLogin }) {
    return (
        <div className="login-container" id="login-scroll-container">
            <div className="login-box">
                <div className="login-header">
                    <img src={SmyrnaLogo} alt="Smyrna Logo" className="login-logo" />
                    <h1>Password Recovery</h1>
                </div>
                <div className="success-message" style={{ color: 'green', marginBottom: '15px', textAlign: 'center' }}>
                    Contact your district manager to reset your password.
                </div>
                <div className="login-footer">
                    <p>
                        Remember your password?
                        <button className="text-button" onClick={onBackToLogin}>
                            Back to Login
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default PasswordRecoveryView;