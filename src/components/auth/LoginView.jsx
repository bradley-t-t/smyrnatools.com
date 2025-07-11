import React, {useEffect, useRef, useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import {AuthUtils} from '../../utils/AuthUtils';
import SmyrnaLogo from '../../assets/SmyrnaLogo.png';
import PasswordRecoveryView from './PasswordRecoveryView';
import './LoginView.css';

// Force reload function to handle successful login
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

    // Timeout reference to prevent stuck loading state.
    const timeoutRef = useRef(null);

    // Clear timeout on component unmount and set up auth success listener
    // Ensure scrolling works on mobile devices
    useEffect(() => {
        const loginContainer = document.getElementById('login-scroll-container');
        if (loginContainer) {
            // Enable momentum scrolling for iOS
            loginContainer.style.WebkitOverflowScrolling = 'touch';
        }

        // Unlock scroll when login view is mounted
        document.body.style.overflow = 'auto';
        document.documentElement.style.overflow = 'auto';

        return () => {
            // Reset overflow when component unmounts
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, []);

    useEffect(() => {
        // Set up listener for auth success events
        const handleAuthSuccess = (event) => {
            console.log('Auth success event received in LoginView', event.detail);
            // Redirect on successful authentication
            setTimeout(forceReload, 500);
        };

        // Add the event listener
        window.addEventListener('authSuccess', handleAuthSuccess);

        return () => {
            // Clean up event listener and timeout
            window.removeEventListener('authSuccess', handleAuthSuccess);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Update password strength indicator
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

        // Don't proceed if already submitting
        if (isSubmitting || loading) {
            return;
        }

        setErrorMessage('');
        setIsSubmitting(true);

        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set a timeout to reset loading state if the operation takes too long
        timeoutRef.current = setTimeout(() => {
            console.warn('Login operation timed out');
            setIsSubmitting(false);
            setErrorMessage('The login operation timed out. Please try again.');
        }, 15000); // 15 second timeout

        try {
            if (isSignUp) {
                // Sign-up flow
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
                console.log('Sign up successful:', user);

                // Add a success message before redirecting
                setErrorMessage('');
                alert('Account created successfully! You will now be redirected to the dashboard.');

                // Force a page reload to trigger the app to recognize the authenticated state
                setTimeout(() => forceReload(), 1000);
            } else {
                // Sign-in flow
                if (!email || !password) {
                    setErrorMessage('Please enter both email and password');
                    setIsSubmitting(false);
                    return;
                }

                try {
                    console.log('Attempting sign in with:', email);
                    const user = await signIn(email, password);
                    console.log('Sign in successful:', user);

                    // Clear any error messages
                    setErrorMessage('');

                    // Wait briefly to show success UI state before redirecting
                    setTimeout(() => {
                        console.log('Redirecting after successful login...');
                        forceReload();
                    }, 500);

                } catch (signInError) {
                    console.error('Sign in error:', signInError);

                    // Provide more specific error messages
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
            console.error('Authentication error:', err);
            setErrorMessage(err.message || 'An error occurred during authentication');
            setIsSubmitting(false);
        } finally {
            // Clear the timeout
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