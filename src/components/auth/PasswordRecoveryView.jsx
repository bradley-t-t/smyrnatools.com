import React, {useEffect, useState} from 'react';
import {supabase} from '../../core/clients/SupabaseClient';
import EmailClient from '../../core/clients/EmailClient';
import {sendEmailMock} from '../../services/EmailService';
import './LoginView.css';
import SmyrnaLogo from '../../assets/images/SmyrnaLogo.png';

function PasswordRecoveryView({onBackToLogin}) {
    const [stage, setStage] = useState('email');
    const [email, setEmail] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setMessage('');
        setError('');
    }, [stage]);

    useEffect(() => {
        const configStatus = EmailClient.checkEmailConfiguration();
        if (process.env.NODE_ENV === 'development') {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('recovery_code_')) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                    } catch (err) {
                    }
                }
            }
        }
    }, []);

    const handleSubmitEmail = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setIsSubmitting(true);

        if (!email) {
            setError('Please enter your email address');
            setIsSubmitting(false);
            return;
        }

        if (!EmailClient.validateEmail(email)) {
            setError('Please enter a valid email address');
            setIsSubmitting(false);
            return;
        }

        const normalizedEmail = email.trim().toLowerCase();
        setEmail(normalizedEmail);

        try {
            const {data: userData, error: userError} = await supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .single();

            if (userError) {
                throw new Error('No account found with this email address');
            }

            if (!userData) {
                throw new Error('No account found with this email address');
            }

            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 30);

            const {error: checkTableError} = await supabase
                .from('recovery_codes')
                .select('id')
                .limit(1);

            const {error: insertError} = await supabase
                .from('recovery_codes')
                .upsert([
                    {
                        email: normalizedEmail,
                        code: verificationCode,
                        expires_at: expiresAt.toISOString()
                    }
                ]);

            if (insertError) {
                if (insertError.message && insertError.message.includes('does not exist')) {
                    localStorage.setItem('recovery_code_' + normalizedEmail, JSON.stringify({
                        code: verificationCode,
                        expires_at: expiresAt.toISOString()
                    }));
                } else {
                    throw new Error('Error generating recovery code');
                }
            }

            try {
                await sendEmailMock({
                    to: email,
                    from: 'noreply@yourdomain.com',
                    subject: 'Password Recovery Code',
                    message: `Your password recovery code is: ${verificationCode}\n\nThis code will expire in 30 minutes.`,
                });
            } catch (emailError) {
            }

            if (process.env.NODE_ENV === 'development') {
                setMessage(`Recovery code sent! For testing, use code: ${verificationCode}`);
            } else {
                setMessage('Recovery code sent! Please check your email.');
            }
            setStage('verification');
        } catch (err) {
            setError(err.message || 'An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setIsSubmitting(true);

        if (!verificationCode) {
            setError('Please enter the verification code');
            setIsSubmitting(false);
            return;
        }

        try {
            let data;
            let verifyError;

            try {
                const result = await supabase
                    .from('recovery_codes')
                    .select('*')
                    .eq('email', email)
                    .eq('code', verificationCode)
                    .single();

                data = result.data;
                verifyError = result.error;
            } catch (dbError) {
                verifyError = dbError;
            }

            if (verifyError || !data) {
                const storedData = localStorage.getItem('recovery_code_' + email);

                if (storedData) {
                    const parsedData = JSON.parse(storedData);
                    if (parsedData.code === verificationCode) {
                        data = {
                            email: email,
                            code: verificationCode,
                            expires_at: parsedData.expires_at
                        };
                        verifyError = null;
                    }
                }
            }

            if (verifyError || !data) {
                throw new Error('Invalid or expired verification code');
            }

            const expiresAt = new Date(data.expires_at);
            const now = new Date();
            if (now > expiresAt) {
                throw new Error('Verification code has expired');
            }

            setMessage('Code verified! Please set your new password.');
            setStage('reset');
        } catch (err) {
            setError(err.message || 'Verification failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setIsSubmitting(true);

        if (!newPassword || !confirmPassword) {
            setError('Please fill in all fields');
            setIsSubmitting(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            setIsSubmitting(false);
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long');
            setIsSubmitting(false);
            return;
        }

        try {
            const {error: resetError} = await supabase.auth.updateUser({
                email: email,
                password: newPassword
            });

            if (resetError) {
                throw new Error(resetError.message);
            }

            try {
                await supabase
                    .from('recovery_codes')
                    .delete()
                    .eq('email', email);
            } catch (cleanupError) {
            }

            localStorage.removeItem('recovery_code_' + email);

            setMessage('Password reset successful! You can now log in with your new password.');
            setTimeout(() => {
                onBackToLogin();
            }, 3000);
        } catch (err) {
            setError(err.message || 'Password reset failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderEmailForm = () => (
        <form onSubmit={handleSubmitEmail}>
            <div className="form-group">
                <label htmlFor="recovery-email">Email Address</label>
                <input
                    type="email"
                    id="recovery-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    disabled={isSubmitting}
                />
            </div>

            <button
                type="submit"
                className="login-button"
                disabled={isSubmitting}
            >
                {isSubmitting ? (
                    <span className="login-loading">
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
            Sending Code...
          </span>
                ) : 'Send Recovery Code'}
            </button>
        </form>
    );

    const renderVerificationForm = () => (
        <form onSubmit={handleVerifyCode}>
            <div className="form-group">
                <label htmlFor="verification-code">Verification Code</label>
                <input
                    type="text"
                    id="verification-code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter the 6-digit code"
                    disabled={isSubmitting}
                />
            </div>

            <button
                type="submit"
                className="login-button"
                disabled={isSubmitting}
            >
                {isSubmitting ? (
                    <span className="login-loading">
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
            Verifying...
          </span>
                ) : 'Verify Code'}
            </button>

            <div className="login-footer">
                <p>
                    <button
                        className="text-button"
                        onClick={() => setStage('email')}
                        disabled={isSubmitting}
                    >
                        Back to Email Entry
                    </button>
                </p>
            </div>
        </form>
    );

    const renderResetForm = () => (
        <form onSubmit={handleResetPassword}>
            <div className="form-group">
                <label htmlFor="new-password">New Password</label>
                <input
                    type="password"
                    id="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    disabled={isSubmitting}
                />
            </div>

            <div className="form-group">
                <label htmlFor="confirm-password">Confirm Password</label>
                <input
                    type="password"
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    disabled={isSubmitting}
                />
            </div>

            <button
                type="submit"
                className="login-button"
                disabled={isSubmitting}
            >
                {isSubmitting ? (
                    <span className="login-loading">
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
            Resetting Password...
          </span>
                ) : 'Reset Password'}
            </button>
        </form>
    );

    return (
        <div className="login-container" id="login-scroll-container">
            <div className="login-box">
                <div className="login-header">
                    <img src={SmyrnaLogo} alt="Smyrna Logo" className="login-logo"/>
                    <h1>Password Recovery</h1>
                </div>

                {message && (
                    <div className="success-message"
                         style={{color: 'green', marginBottom: '15px', textAlign: 'center'}}>
                        {message}
                    </div>
                )}

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                {stage === 'email' && renderEmailForm()}
                {stage === 'verification' && renderVerificationForm()}
                {stage === 'reset' && renderResetForm()}

                <div className="login-footer">
                    <p>
                        Remember your password?
                        <button
                            className="text-button"
                            onClick={onBackToLogin}
                            disabled={isSubmitting}
                        >
                            Back to Login
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default PasswordRecoveryView;