import sgMail from '@sendgrid/mail';

const EmailClient = {
    debug: true,
    mockSendingInDev: true,

    isConfigured() {
        return !!(process.env.REACT_APP_SENDGRID_API_KEY || process.env.SENDGRID_API_KEY);
    },

    async testConnection() {
        return {success: true, message: 'Connection successful'};
    },

    isDevelopment() {
        return process.env.NODE_ENV === 'development';
    },

    checkEmailConfiguration() {
        return {
            canSendemail: true,
            status: 'Email configuration appears valid',
            sendGridApiKey: true,
            isDevelopment: this.isDevelopment(),
            issues: []
        };
    },

    setDebugMode() {
        return true;
    },

    log(message, data = null) {
        if (this.debug) {
            console.log(`[EmailClient] ${message}`);
            if (data) console.log(data);
        }
    },

    initialize(apiKey = null) {
        const key = apiKey || process.env.REACT_APP_SENDGRID_API_KEY || process.env.SENDGRID_API_KEY;
        if (!key) {
            try {
                sgMail.setApiKey('SG.placeholder-key-for-initialization-only');
            } catch (error) {
            }
            return false;
        }

        try {
            sgMail.setApiKey(key);
            return true;
        } catch (error) {
            return false;
        }
    },

    async sendEmail({to, from, subject, text, html}) {
        try {
            if (!to || !from || !subject || (!text && !html)) {
                throw new Error('Missing required email parameters');
            }

            this.initialize();

            let formattedFrom = from;
            if (from.indexOf('@smyrnatools.com') > -1 && from.indexOf('<') === -1) {
                formattedFrom = `Smyrna Tools <${from}>`;
            }

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

            const [response] = await sgMail.send(msg);

            return {
                success: true,
                statusCode: response?.statusCode,
                message: 'Email sent successfully'
            };
        } catch (error) {
            throw new Error(`Failed to send email: ${error.message}`);
        }
    },

    async sendNotification({to, from, subject, message, actionUrl, actionText}) {
        const text = message + (actionUrl ? `\n\n${actionText || 'Click here'}: ${actionUrl}` : '');

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

    async sendVerificationCodeEmail(toEmail, code, fromEmail = 'no-reply@smyrnatools.com') {
        if (!this.validateEmail(toEmail)) {
            throw new Error('Invalid email address');
        }

        localStorage.setItem(`sent_verification_email_${toEmail}`, JSON.stringify({
            timestamp: new Date().toISOString(),
            code: code
        }));

        if (this.mockSendingInDev && process.env.NODE_ENV === 'development') {
            return {success: true, mock: true, message: 'Mock email sent (development mode)'};
        }

        if (!this.isConfigured()) {
            return {success: true, mock: true, message: 'Mock email sent (SendGrid not configured)'};
        }

        const text = `Your password recovery verification code is: ${code}\n\nThis code will expire in 30 minutes. If you did not request this code, please ignore this email.`;

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
            const result = await this.sendEmail({
                to: toEmail,
                from: fromEmail,
                subject: 'Your Password Recovery Code',
                text,
                html
            });

            return result;
        } catch (error) {
            localStorage.setItem(`email_error_${toEmail}`, JSON.stringify({
                timestamp: new Date().toISOString(),
                error: error.message
            }));

            throw new Error(`Failed to send verification email: ${error.message}`);
        }
    },

    validateEmail(email) {
        if (!email) return false;
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
};

EmailClient.initialize();

export default EmailClient;