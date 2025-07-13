import React, {useEffect, useRef, useState} from 'react';
import {useAuth} from '../../context/auth/AuthContext';
import {AuthUtils} from '../../utils/AuthUtils';
import SmyrnaLogo from '../../assets/images/SmyrnaLogo.png';
import PasswordRecoveryView from './PasswordRecoveryView';
import './LoginView.css';

const forceReload = () => {
    window.location.href = window.location.pathname;
};

function LoginView() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [showRecovery, setShowRecovery] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [passwordStrength, setPasswordStrength] = useState({value: '', color: ''});
    const {signIn, signUp, loading, error} = useAuth();
    const timeoutRef = useRef(null);

    useEffect(() => {
        const loginContainer = document.getElementById('login-scroll-container');
        if (loginContainer) {
            loginContainer.style.WebkitOverflowScrolling = 'touch';
        }

        document.body.style.overflow = 'auto';
        document.documentElement.style.overflow = 'auto';

        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, []);

    useEffect(() => {
        const handleAuthSuccess = (event) => {
            setTimeout(forceReload, 500);
        };

        window.addEventListener('authSuccess', handleAuthSuccess);

        return () => {
            window.removeEventListener('authSuccess', handleAuthSuccess);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (password) {
            setPasswordStrength(AuthUtils.passwordStrength(password));
        } else {
            setPasswordStrength({value: '', color: ''});
        }
    }, [password]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isSubmitting || loading) {
            return;
        }

        setErrorMessage('');
        setIsSubmitting(true);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setIsSubmitting(false);
            setErrorMessage('The login operation timed out. Please try again.');
        }, 15000);

        try {
            if (isSignUp) {
                if (!email || !password || !confirmPassword || !firstName || !lastName) {
                    setErrorMessage('Please fill in all fields');
                    setIsSubmitting(false);
                    return;
                }

                if (password !== confirmPassword) {
                    setErrorMessage('Passwords do not match');
                    setIsSubmitting(false);
                    return;
                }

                const user = await signUp(email, password, firstName, lastName);
                setErrorMessage('');
                alert('Account created successfully! You will now be redirected to the dashboard.');
                setTimeout(() => forceReload(), 1000);
            } else {
                if (!email || !password) {
                    setErrorMessage('Please enter both email and password');
                    setIsSubmitting(false);
                    return;
                }

                try {
                    const user = await signIn(email, password);
                    setErrorMessage('');
                    setTimeout(() => {
                        forceReload();
                    }, 500);
                } catch (signInError) {
                    if (signInError.message && signInError.message.includes('TypeError: Load failed')) {
                        throw new Error('Connection to the database failed. Please check your internet connection and try again.');
                    } else if (signInError.message && signInError.message.includes('timeout')) {
                        throw new Error('The login process timed out. Please try again.');
                    } else if (signInError.message && signInError.message.includes('Invalid email or password')) {
                        throw new Error('The email or password you entered is incorrect. Please try again.');
                    } else {
                        throw signInError;
                    }
                }
            }
        } catch (err) {
            setErrorMessage(err.message || 'An error occurred during authentication');
            setIsSubmitting(false);
        } finally {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        }
    };

    return (
        <>
            {showRecovery ? (
                <PasswordRecoveryView onBackToLogin={() => setShowRecovery(false)}/>
            ) : (
                <div className="login-container" id="login-scroll-container">
                    <div className="login-box">
                        <div className="login-header">
                            <img src={SmyrnaLogo} alt="Smyrna Logo" className="login-logo"/>
                            <h1>{isSignUp ? 'Create Account' : 'Sign In'}</h1>
                        </div>

                        <div className="auth-mode-selector">
                            <button
                                className={!isSignUp ? 'active' : ''}
                                onClick={() => setIsSignUp(false)}
                            >
                                Sign In
                            </button>
                            <button
                                className={isSignUp ? 'active' : ''}
                                onClick={() => setIsSignUp(true)}
                            >
                                Sign Up
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <input
                                    type="password"
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                />
                                {!isSignUp && (
                                    <div className="forgot-password">
                                        <button
                                            type="button"
                                            className="text-button"
                                            onClick={() => setShowRecovery(true)}
                                        >
                                            Forgot Password?
                                        </button>
                                    </div>
                                )}
                            </div>

                            {isSignUp && (
                                <>
                                    <div className="form-group">
                                        <label htmlFor="confirmPassword">Confirm Password</label>
                                        <input
                                            type="password"
                                            id="confirmPassword"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Confirm your password"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="firstName">First Name</label>
                                        <input
                                            type="text"
                                            id="firstName"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            placeholder="Enter your first name"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="lastName">Last Name</label>
                                        <input
                                            type="text"
                                            id="lastName"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            placeholder="Enter your last name"
                                        />
                                    </div>
                                </>
                            )}

                            {(errorMessage || error) && (
                                <div className="error-message">
                                    {errorMessage || error}
                                </div>
                            )}

                            {isSubmitting && (
                                <div className="success-message"
                                     style={{color: 'green', marginBottom: '15px', textAlign: 'center'}}>
                                    {isSignUp ? 'Creating your account...' : 'Signing you in...'}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="login-button"
                                disabled={isSubmitting || loading}
                            >
                                {isSubmitting || loading ? (
                                    <span className="login-loading">
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
                                        {isSignUp ? 'Creating Account...' : 'Signing In...'}
              </span>
                                ) : (isSignUp ? 'Create Account' : 'Sign In')}
                            </button>
                        </form>

                        <div className="login-footer">
                            <p>
                                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                                <button
                                    className="text-button"
                                    onClick={() => setIsSignUp(!isSignUp)}
                                >
                                    {isSignUp ? 'Sign In' : 'Sign Up'}
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default LoginView;