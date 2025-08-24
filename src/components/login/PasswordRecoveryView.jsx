import React, {useState} from 'react';
import SmyrnaLogo from '../../assets/images/SmyrnaLogo.png';
import BG from '../../assets/images/BG.png';
import './styles/LoginView.css';
import APIUtility from '../../utils/APIUtility';

function PasswordRecoveryView({onBackToLogin}) {
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        if (submitting) return;
        setMessage('');
        setError('');
        if (!email) {
            setError('Enter your email.');
            return;
        }
        setSubmitting(true);
        try {
            const envInfo = {
                edgeUrl: process.env.REACT_APP_EDGE_FUNCTIONS_URL || null,
                hasAnonKey: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
                origin: window.location.origin,
                href: window.location.href
            };
            console.debug('PasswordRecovery: submit', {email});
            console.debug('PasswordRecovery: env', envInfo);
            const {res, json} = await APIUtility.post('/auth-context/reset-password', {email});
            console.debug('PasswordRecovery: edge result', {ok: res.ok, status: res.status, json});
            if (res.ok) {
                setMessage('If an account exists for this email, a new password has been sent.');
            } else {
                setError('An error occurred. Please try again.');
            }
        } catch (err) {
            console.debug('PasswordRecovery: exception', {error: err && (err.message || String(err))});
            setError('An error occurred. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="login-container">
            <div className="login-wrapper">
                <div className="login-info">
                    <div className="login-info-media">
                        <img src={BG} alt="" aria-hidden="true" fetchPriority="high" loading="eager" decoding="async"/>
                    </div>
                    <div className="login-info-overlay">
                        <img src={SmyrnaLogo} alt="SRM Logo" className="login-info-logo"/>
                        <h2>Smyrna Tools - Password Recovery</h2>
                        <p>Enter the email associated with your account. If it exists, we will send a new password to
                            your email.</p>
                    </div>
                </div>
                <div className="login-card">
                    <div className="login-card-header">
                        <img src={SmyrnaLogo} alt="SRM Logo" className="login-card-logo"/>
                        <h1>Recover Password</h1>
                    </div>
                    {message && <div className="success-message" role="status" aria-live="polite"
                                     style={{marginBottom: '15px', textAlign: 'center'}}>{message}</div>}
                    {error && <div className="error-message" role="alert" aria-live="assertive">{error}</div>}
                    <form className="login-form" onSubmit={handleSubmit} noValidate>
                        <div className="form-group">
                            <label htmlFor="recoveryEmail"
                                   className={email ? 'floating-label active' : 'floating-label'}>
                                Email
                            </label>
                            <input
                                type="email"
                                id="recoveryEmail"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                aria-label="Email address"
                                autoFocus
                                required
                            />
                        </div>
                        <button type="submit" className="login-btn" disabled={submitting}
                                aria-label="Send new password">
                            {submitting ? 'Sending...' : 'Send New Password'}
                        </button>
                    </form>
                    <div className="login-footer">
                        <button className="text-button" onClick={onBackToLogin} aria-label="Back to Login">
                            Back to Login
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PasswordRecoveryView;