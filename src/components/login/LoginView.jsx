import React, {useEffect, useRef, useState} from 'react';
import {useAuth} from '../../app/context/AuthContext';
import {AuthUtility} from '../../utils/AuthUtility';
import SmyrnaLogo from '../../assets/images/SmyrnaLogo.png';
import BG from '../../assets/images/BG.png';
import './styles/LoginView.css';
import VersionPopup from '../common/VersionPopup';
import {useVersion} from '../../app/hooks/useVersion';
import PasswordRecoveryView from './PasswordRecoveryView';

function LoginView() {
    const version = useVersion();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [passwordStrength, setPasswordStrength] = useState({value: '', color: ''});
    const {signIn, signUp, loading, error} = useAuth();
    const timeoutRef = useRef(null);
    const forceReload = () => {
        window.location.href = window.location.pathname
    };
    const [showRecovery, setShowRecovery] = useState(false);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, []);

    useEffect(() => {
        const handleAuthSuccess = () => {
            setTimeout(forceReload, 500);
        };
        window.addEventListener('authSuccess', handleAuthSuccess);
        return () => {
            window.removeEventListener('authSuccess', handleAuthSuccess);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (password && isSignUp) setPasswordStrength(AuthUtility.passwordStrength(password));
        else setPasswordStrength({value: '', color: ''});
    }, [password, isSignUp]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (error) {
            setErrorMessage(error);
            setSuccessMessage('');
        }
    }, [error]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting || loading) return;
        setErrorMessage('');
        setSuccessMessage('');
        setIsSubmitting(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setIsSubmitting(false);
            setErrorMessage('The operation timed out. Please try again.');
        }, 10000);
        try {
            if (isSignUp) {
                if (!email || !password || !confirmPassword || !firstName || !lastName) {
                    setErrorMessage('Please complete all fields.');
                    setSuccessMessage('');
                    setIsSubmitting(false);
                    return;
                }
                if (password !== confirmPassword) {
                    setErrorMessage('Passwords do not match.');
                    setSuccessMessage('');
                    setIsSubmitting(false);
                    return;
                }
                const normFirst = await AuthUtility.normalizeName(firstName);
                const normLast = await AuthUtility.normalizeName(lastName);
                if (typeof normFirst !== 'string' || typeof normLast !== 'string') {
                    throw new Error('First and last name must be strings after normalization');
                }
                await signUp(email, password, normFirst, normLast);
                setErrorMessage('');
                setSuccessMessage('Account created successfully. Redirecting...');
                setTimeout(() => forceReload(), 1000);
            } else {
                if (!email || !password) {
                    setErrorMessage('Please enter your email and password.');
                    setSuccessMessage('');
                    setIsSubmitting(false);
                    return;
                }
                await signIn(email, password);
                setErrorMessage('');
                setSuccessMessage('Signed in successfully. Redirecting...');
                setTimeout(() => forceReload(), 500);
            }
        } catch (err) {
            setErrorMessage(err?.message || 'An authentication error occurred. Please try again.');
            setSuccessMessage('');
            setIsSubmitting(false);
        } finally {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        }
    };

    if (showRecovery) {
        return <PasswordRecoveryView onBackToLogin={() => setShowRecovery(false)}/>;
    }

    return (
        <div className="login-container">
            <VersionPopup version={version}/>
            <div className={"login-wrapper" + (isSignUp ? " sign-up-mode" : "")}>
                <div className="login-info">
                    <div className="login-info-media">
                        <img src={BG} alt="" aria-hidden="true" fetchPriority="high" loading="eager" decoding="async"/>
                    </div>
                    <div className="login-info-overlay">
                        <img src={SmyrnaLogo} alt="SRM Logo" className="login-info-logo"/>
                        <h2>Smyrna Tools - Built for SRM Concrete</h2>
                        <p>
                            Since 1999, SRM has been the leading ready-mix concrete supplier in the U.S., with 8,500
                            team members across 23 states. Join us to experience industry-leading quality and service.
                        </p>
                    </div>
                </div>
                <div className="login-card">
                    <div className="login-card-header">
                        <img src={SmyrnaLogo} alt="SRM Logo" className="login-card-logo"/>
                        <h1>{isSignUp ? 'Create Account' : 'Sign In'}</h1>
                        <div className="login-tabs">
                            <button
                                className={`login-tab ${!isSignUp ? 'active' : ''}`}
                                onClick={() => setIsSignUp(false)}
                                type="button"
                                aria-pressed={!isSignUp}
                            >
                                Sign In
                            </button>
                            <button
                                className={`login-tab ${isSignUp ? 'active' : ''}`}
                                onClick={() => setIsSignUp(true)}
                                type="button"
                                aria-pressed={isSignUp}
                            >
                                Sign Up
                            </button>
                        </div>
                    </div>
                    <form onSubmit={handleSubmit} className="login-form" noValidate>
                        <div className="form-group">
                            <label htmlFor="email" className={email ? 'floating-label active' : 'floating-label'}>
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="username"
                                aria-label="Email address"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="password" className={password ? 'floating-label active' : 'floating-label'}>
                                Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                aria-label="Password"
                                required
                            />
                            {!isSignUp && (
                                <div className="forgot-password">
                                    <button type="button" className="text-button" onClick={() => setShowRecovery(true)}>
                                        Forgot Password?
                                    </button>
                                </div>
                            )}
                            {isSignUp && password && (
                                <div className="password-strength" style={{color: passwordStrength.color}}>
                                    Password Strength: {passwordStrength.value}
                                </div>
                            )}
                        </div>
                        {isSignUp && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="confirmPassword"
                                           className={confirmPassword ? 'floating-label active' : 'floating-label'}>
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        id="confirmPassword"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        aria-label="Confirm password"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="firstName"
                                           className={firstName ? 'floating-label active' : 'floating-label'}>
                                        First Name
                                    </label>
                                    <input
                                        type="text"
                                        id="firstName"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        aria-label="First name"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="lastName"
                                           className={lastName ? 'floating-label active' : 'floating-label'}>
                                        Last Name
                                    </label>
                                    <input
                                        type="text"
                                        id="lastName"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        aria-label="Last name"
                                        required
                                    />
                                </div>
                            </>
                        )}
                        <button
                            type="submit"
                            className="login-btn"
                            disabled={isSubmitting || loading}
                            aria-label={isSignUp ? 'Create account' : 'Sign in'}
                        >
                            {isSubmitting || loading ? (
                                <span className="login-loading">
                  <span className="loading-dot"></span>
                  <span className="loading-dot"></span>
                  <span className="loading-dot"></span>
                                    {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </span>
                            ) : isSignUp ? (
                                'Create Account'
                            ) : (
                                'Sign In'
                            )}
                        </button>
                        {errorMessage && <div className="error-message">{errorMessage}</div>}
                        {successMessage && <div className="success-message">{successMessage}</div>}
                    </form>
                    <div className="login-footer">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                        <button
                            className="text-button"
                            onClick={() => setIsSignUp(!isSignUp)}
                            aria-label={isSignUp ? 'Switch to sign in' : 'Switch to sign up'}
                        >
                            {isSignUp ? 'Sign In' : 'Sign Up'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginView;

