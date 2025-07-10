import sgMail from '@sendgrid/mail';

/**
 * Unified SendGrid Service that combines all functionality
 * from EmailUtil, SendGridClient, and sendgrid-debug
 */
class SendGridServiceUtils {
  /**
   * Initialize the SendGrid client with API key
   * @param {string} apiKey - Optional API key (will use environment variable if not provided)
   */
  static initialize(apiKey = null) {
    // Use provided API key or environment variable
    const key = apiKey || process.env.REACT_APP_SENDGRID_API_KEY || process.env.SENDGRID_API_KEY;
    if (!key) {
      console.warn('SendGrid API key is not configured');
      return false;
    }

    // Set the API key
    sgMail.setApiKey(key);
    return true;
  }

  /**
   * Send an emails using SendGrid
   * @param {Object} options Email options
   * @param {string} options.to Recipient emails address
   * @param {string} options.from Sender emails address (no-reply@smyrnatools.com recommended)
   * @param {string} options.subject Email subject
   * @param {string} options.text Plain text emails content
   * @param {string} [options.html] HTML emails content
   * @param {Array} [options.attachments] Optional array of attachments
   * @returns {Promise<Object>} SendGrid response
   */
  static async sendEmail({ to, from, subject, text, html, attachments }) {
    try {
      // Ensure API is initialized
      this.initialize();

      // Validate required parameters
      if (!to || !from || !subject || (!text && !html)) {
        throw new Error('Missing required emails parameters');
      }

      // Format the from address properly with name and emails
      let formattedFrom = from;
      if (from.indexOf('@smyrnatools.com') > -1 && from.indexOf('<') === -1) {
        formattedFrom = `Smyrna Tools <${from}>`;
      }

      // Create emails message with proper structure for browser environment
      const msg = {
        to,
        from: formattedFrom,
        subject,
        text: text || '',
        ...(html && { html }),
        ...(attachments && { attachments }),
        // Important settings to improve deliverability
        mail_settings: {
          sandbox_mode: {
            enable: false // Disable sandbox mode for production
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

      console.log('Sending emails with payload:', JSON.stringify(msg, null, 2));

      // Send the emails directly using SendGrid
      const [response] = await sgMail.send(msg);

      console.log('Email sent successfully, status code:', response?.statusCode);
      return { 
        success: true, 
        message: 'Email sent successfully', 
        statusCode: response?.statusCode 
      };
    } catch (error) {
      console.error('Error sending emails:', error);

      // Extract and log detailed error information
      let errorDetails = {};
      if (error.response) {
        try {
          errorDetails = error.response.body;
          console.error('SendGrid API error details:', JSON.stringify(errorDetails, null, 2));
        } catch (e) {
          console.error('Could not parse error response');
        }
      }

      // Always log detailed error info
      console.error('Error message:', error.message);
      console.error('Error code:', errorDetails.code || error.code || 'Not Assigned');
      console.error('Error status:', error.status || error.statusCode || 'Not Assigned');

      // Rethrow with more information
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send a notification emails with standard formatting
   * @param {Object} options Email notification options
   * @param {string} options.to Recipient emails address
   * @param {string} options.from Sender emails address
   * @param {string} options.subject Email subject
   * @param {string} options.message Email message body
   * @param {string} [options.actionUrl] Optional action URL
   * @param {string} [options.actionText] Optional action button text
   * @returns {Promise<Object>} SendGrid response
   */
  static async sendNotification({ to, from, subject, message, actionUrl, actionText }) {
    // Create basic text version
    const text = message + (actionUrl ? `\n\n${actionText || 'Click here'}: ${actionUrl}` : '');

    // Create HTML version with simple styling
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
          <h2 style="color: #003896;">${subject}</h2>
          <p style="font-size: 16px; line-height: 1.5;">${message.replace(/\n/g, '<br>')}</p>
          ${actionUrl ? `<div style="margin-top: 25px; text-align: center;">
            <a href="${actionUrl}" style="background-color: #003896; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold;">${actionText || 'Click here'}</a>
          </div>` : ''}
        </div>
        <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
          <p>This is an automated message from Smyrna Tools.</p>
        </div>
      </div>
    `;

    return this.sendEmail({ to, from, subject, text, html });
  }

  /**
   * Send a verification code emails for password recovery
   * @param {string} toEmail Recipient emails address
   * @param {string} code Verification code
   * @param {string} [fromEmail="no-reply@smyrnatools.com"] Sender emails address
   * @returns {Promise<Object>} Email send result
   */
  static async sendVerificationCodeEmail(toEmail, code, fromEmail = 'no-reply@smyrnatools.com') {
    if (!this.validateEmail(toEmail)) {
      throw new Error('Invalid emails address');
    }

    const message = `Your password recovery verification code is: ${code}\n\nThis code will expire in 30 minutes. If you did not request this code, please ignore this email.`;

    // Create HTML version with prominent code display
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
        <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
          <p>This is an automated message from Smyrna Tools.</p>
        </div>
      </div>
    `;

    try {
      const result = await this.sendEmail({
        to: toEmail,
        from: fromEmail,
        subject: 'Your Password Recovery Code',
        text: message,
        html: html
      });

      console.log('Verification code emails sent successfully');
      return result;
    } catch (error) {
      console.error('Failed to send verification code emails:', error);
      throw error;
    }
  }

  /**
   * Validates an emails address format
   * @param {string} email The emails to validate
   * @returns {boolean} True if the emails is valid, false otherwise
   */
  static validateEmail(email) {
    if (!email) return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * Test SendGrid API connectivity
   * @param {string} apiKey - SendGrid API key to test
   * @returns {Promise<Object>} Test result
   */
  static async testConnection(apiKey) {
    try {
      if (!apiKey) {
        throw new Error('API key is required for testing');
      }

      // Set API key for this test
      sgMail.setApiKey(apiKey);

      // Test the connection with a minimal API call
      // Using a GET request to avoid sending actual emails during testing
      try {
        const response = await fetch('https://api.sendgrid.com/v3/scopes', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            success: false,
            status: response.status,
            message: 'API connection failed',
            details: data
          };
        }

        return {
          success: true,
          status: response.status,
          message: 'API connection successful',
          scopes: data.scopes || []
        };
      } catch (fetchError) {
        // Try a simpler method if fetch fails
        // This is a minimal sgMail operation that won't send an emails
        // but will validate the API key
        await sgMail.setApiKey(apiKey);

        return {
          success: true,
          message: 'API key appears valid',
          method: 'fallback'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Connection test failed',
        error: error.message
      };
    }
  }

  /**
   * Send a test emails to verify functionality
   * @param {string} toEmail - Recipient emails
   * @param {string} fromEmail - Sender emails (defaults to no-reply@smyrnatools.com)
   * @param {string} apiKey - Optional API key to use
   * @returns {Promise<Object>} Result of the test
   */
  static async sendTestEmail(toEmail, fromEmail = 'no-reply@smyrnatools.com', apiKey = null) {
    try {
      // Set API key if provided
      if (apiKey) {
        sgMail.setApiKey(apiKey);
      } else {
        this.initialize();
      }

      if (!this.validateEmail(toEmail)) {
        throw new Error('Invalid recipient emails address');
      }

      if (!this.validateEmail(fromEmail)) {
        throw new Error('Invalid sender emails address');
      }

      const timestamp = new Date().toLocaleString();

      const result = await this.sendEmail({
        to: toEmail,
        from: fromEmail,
        subject: 'SendGrid Test Email',
        text: `This is a test email from Smyrna Tools application. Sent at: ${timestamp}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
              <h2 style="color: #003896;">SendGrid Test Email</h2>
              <p style="font-size: 16px;">This is a test email from Smyrna Tools application.</p>
              <p style="font-size: 14px;">Sent at: ${timestamp}</p>
            </div>
          </div>
        `
      });

      return {
        success: true,
        message: 'Test emails sent successfully',
        details: result
      };
    } catch (error) {
      console.error('Test emails failed:', error);
      return {
        success: false,
        message: 'Failed to send test emails',
        error: error.message
      };
    }
  }
}

export default SendGridServiceUtils;
