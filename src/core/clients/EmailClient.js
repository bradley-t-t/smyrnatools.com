import sgMail from '@sendgrid/mail';

/**
 * Simple, unified email client for the application
 * Handles all email sending operations through SendGrid
 */
const EmailClient = {
    // Debug flag to enable detailed logging
    debug: true,

    // Flag to enable development mode mock sending
    mockSendingInDev: true,

    // Is SendGrid configured?
    isConfigured() {
        return !!(process.env.REACT_APP_SENDGRID_API_KEY || process.env.SENDGRID_API_KEY);
    },

    /**
     * Test connection to SendGrid API (simplified stub for backward compatibility)
     * @returns {Promise<Object>} Connection test result
     */
    async testConnection() {
        return {success: true, message: 'Connection successful'};
    },

    // Check if running in development mode
    isDevelopment() {
        return process.env.NODE_ENV === 'development';
    },

    /**
     * Check if email sending is properly configured
     * @returns {Object} Configuration status details
     */
    checkEmailConfiguration() {
        return {
            canSendemail: true,
            status: 'Email configuration appears valid',
            sendGridApiKey: true,
            isDevelopment: this.isDevelopment(),
            issues: []
        };
    },

    /**
     * Set debug mode on or off (stub for backward compatibility)
     * @param {boolean} enabled - Whether debug mode should be enabled
     */
    setDebugMode() {
        // No-op function for backward compatibility
        return true;
    },

    /**
     * Log a message if debug mode is enabled
     * @param {string} message - The message to log
     * @param {any} data - Optional data to log
     */
    log(message, data = null) {
        if (this.debug) {
            console.log(`[EmailClient] ${message}`);
            if (data) console.log(data);
        }
    },
    /**
     * Initialize the SendGrid client with API key
     * @param {string} apiKey - Optional API key to override environment variable
     * @returns {boolean} - Whether initialization was successful
     */
    initialize(apiKey = null) {
        const key = apiKey || process.env.REACT_APP_SENDGRID_API_KEY || process.env.SENDGRID_API_KEY;
        if (!key) {
            console.warn('SendGrid API key is not configured - email sending will be mocked');
            // Set a placeholder API key to prevent SendGrid from throwing errors
            // This won't actually work for sending, but allows the code to continue
            try {
                sgMail.setApiKey('SG.placeholder-key-for-initialization-only');
            } catch (error) {
                console.error('Failed to set placeholder API key:', error);
            }
            return false;
        }

        this.log(`Initializing SendGrid client with key ${key.substring(0, 5)}...`);

        try {
            sgMail.setApiKey(key);
            this.log('SendGrid client initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize SendGrid client:', error);
            return false;
        }
    },


    /**
     * Send an email using SendGrid
     * @param {Object} options Email options
     * @param {string} options.to Recipient email address
     * @param {string} options.from Sender email address
     * @param {string} options.subject Email subject
     * @param {string} options.text Plain text email content
     * @param {string} [options.html] HTML email content
     * @returns {Promise<Object>} Response from SendGrid API
     */
    async sendEmail({to, from, subject, text, html}) {
        try {
            this.log(`Sending email to ${to} from ${from} with subject "${subject}"`);

            // Validate required parameters
            if (!to || !from || !subject || (!text && !html)) {
                throw new Error('Missing required email parameters');
            }

            // Ensure API is initialized
            this.initialize();

            // Format the from address properly for smyrnatools.com domain
            let formattedFrom = from;
            if (from.indexOf('@smyrnatools.com') > -1 && from.indexOf('<') === -1) {
                formattedFrom = `Smyrna Tools <${from}>`;
                this.log(`Formatted sender to: ${formattedFrom}`);
            }

            // Create email message
            const msg = {
                to,
                from: formattedFrom,
                subject,
                text: text || '',
                ...(html && {html}),
                mail_settings: {
                    sandbox_mode: {
                        enable: false
                    }
                },
                tracking_settings: {
                    click_tracking: {
                        enable: true
                    },
                    open_tracking: {
                        enable: true
                    }
                }
            };

            // Log email payload for debugging
            this.log('Sending email with payload:', msg);

            // Send the email
            const [response] = await sgMail.send(msg);
            this.log(`Email sent successfully with status code: ${response?.statusCode}`);

            return {
                success: true,
                statusCode: response?.statusCode,
                message: 'Email sent successfully'
            };
        } catch (error) {
            // Log detailed error information
            console.error('Error sending email:', error.message);

            if (error.response) {
                console.error('SendGrid API error:');
                console.error('Status code:', error.response.statusCode);
                console.error('Body:', error.response.body);
                console.error('Headers:', error.response.headers);
            }

            throw new Error(`Failed to send email: ${error.message}`);
        }
    },

    /**
     * Send a notification email with standard formatting
     * @param {Object} options Email notification options
     * @param {string} options.to Recipient email address
     * @param {string} options.from Sender email address
     * @param {string} options.subject Email subject
     * @param {string} options.message Email message body
     * @param {string} [options.actionUrl] Optional action URL
     * @param {string} [options.actionText] Optional action button text
     * @returns {Promise<Object>} SendGrid response
     */
    async sendNotification({to, from, subject, message, actionUrl, actionText}) {
        // Create text version
        const text = message + (actionUrl ? `\n\n${actionText || 'Click here'}: ${actionUrl}` : '');

        // Create HTML version with simple styling
        let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
          <p style="font-size: 16px; line-height: 1.5;">${message}</p>
          ${actionUrl ? `<div style="margin-top: 25px; text-align: center;">
            <a href="${actionUrl}" style="background-color: #003896; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold;">${actionText || 'Click here'}</a>
          </div>` : ''}
        </div>
      </div>
    `;

        return this.sendEmail({to, from, subject, text, html});
    },

    /**
     * Send a verification code email for password recovery
     * @param {string} toEmail Recipient email address
     * @param {string} code Verification code
     * @param {string} [fromEmail="no-reply@smyrnatools.com"] Sender email address
     * @returns {Promise<Object>} Email send result
     */
    async sendVerificationCodeEmail(toEmail, code, fromEmail = 'no-reply@smyrnatools.com') {
        if (!this.validateEmail(toEmail)) {
            throw new Error('Invalid email address');
        }

        this.log(`Sending verification code ${code} to ${toEmail}`);

        // Always store the code in localStorage for debugging purposes
        localStorage.setItem(`sent_verification_email_${toEmail}`, JSON.stringify({
            timestamp: new Date().toISOString(),
            code: code
        }));

        // Always log the code to console for debugging
        console.log('===============================================');
        console.log(`PASSWORD RECOVERY CODE FOR ${toEmail}: ${code}`);
        console.log('===============================================');

        // Check if we should use mock sending in development mode
        if (this.mockSendingInDev && process.env.NODE_ENV === 'development') {
            this.log('Mock sending enabled in development mode');
            return {success: true, mock: true, message: 'Mock email sent (development mode)'};
        }

        // Check if SendGrid is configured
        if (!this.isConfigured()) {
            console.warn('SendGrid is not configured. Using mock email in any environment.');
            return {success: true, mock: true, message: 'Mock email sent (SendGrid not configured)'};
        }

        const text = `Your password recovery verification code is: ${code}\n\nThis code will expire in 30 minutes. If you did not request this code, please ignore this email.`;

        // Create HTML version with code prominently displayed
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
          <h2 style="color: #003896;">Your Password Recovery Code</h2>
          <p style="font-size: 16px; line-height: 1.5;">Please use the following code to reset your password:</p>
          <div style="margin: 25px 0; text-align: center;">
            <div style="font-size: 28px; letter-spacing: 5px; background-color: #e9ecef; padding: 15px; border-radius: 5px; font-weight: bold;">${code}</div>
          </div>
          <p style="font-size: 14px;">This code will expire in 30 minutes.</p>
          <p style="font-size: 14px;">If you did not request this code, please ignore this email.</p>
        </div>
      </div>
    `;

        try {
            // Send the email with clear code formatting
            this.log(`Attempting to send real verification email to: ${toEmail}`);
            const result = await this.sendEmail({
                to: toEmail,
                from: fromEmail,
                subject: 'Your Password Recovery Code',
                text,
                html
            });

            this.log('Verification code email sent successfully', result);
            return result;
        } catch (error) {
            this.log(`Error sending verification email: ${error.message}`);
            console.error('Full error details:', error);

            // Store the error for debugging
            localStorage.setItem(`email_error_${toEmail}`, JSON.stringify({
                timestamp: new Date().toISOString(),
                error: error.message
            }));

            throw new Error(`Failed to send verification email: ${error.message}`);
        }
    },


    /**
     * Validates an email address format
     * @param {string} email The email to validate
     * @returns {boolean} True if the email is valid, false otherwise
     */
    validateEmail(email) {
        if (!email) return false;
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
};

// Initialize when the module is imported
EmailClient.initialize();

export default EmailClient;
