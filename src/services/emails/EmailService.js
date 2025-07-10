import EmailUtil from '../utils/EmailUtil';

import { sendNotification, validateEmail } from '../utils/SendGridClient';

import SendGridServiceUtils from '../../utils/SendGridServiceUtils';

/**
 * Service for handling emails functionality throughout the application
 */
class EmailService {
  constructor() {
    // Default sender emails for smyrnatools.com with proper formatting
    this.defaultSender = 'Smyrna Tools <no-reply@smyrnatools.com>';

    // Initialize SendGrid service
    SendGridServiceUtils.initialize();
  }

  /**
   * Send a welcome emails to a new user
   * @param {string} toEmail Recipient emails address
   * @param {string} userName User's name
   * @returns {Promise<Object>} Email send result
   */
  async sendWelcomeEmail(toEmail, userName) {
    if (!SendGridServiceUtils.validateEmail(toEmail)) {
      throw new Error('Invalid emails address');
    }

    return SendGridServiceUtils.sendNotification({
      to: toEmail,
      from: this.defaultSender,
      subject: 'Welcome to Our Application',
      message: `Hello ${userName},\n\nWelcome to our application. We're excited to have you on board!`,
      actionUrl: 'https://yourdomain.com/getting-started',
      actionText: 'Get Started'
    });
  }

  /**
   * Send a password reset emails
   * @param {string} toEmail Recipient emails address
   * @param {string} resetLink Password reset link
   * @returns {Promise<Object>} Email send result
   */
  async sendPasswordResetEmail(toEmail, resetLink) {
    if (!SendGridServiceUtils.validateEmail(toEmail)) {
      throw new Error('Invalid emails address');
    }

    console.log('Sending password reset emails to:', toEmail);
    return SendGridServiceUtils.sendNotification({
      to: toEmail,
      from: this.defaultSender,
      subject: 'Password Reset Request',
      message: 'You requested a password reset. Click the button below to reset your password. If you did not request this change, you can ignore this emails.',
      actionUrl: resetLink,
      actionText: 'Reset Password'
    });
  }

  /**
   * Send a verification code emails for password recovery
   * @param {string} toEmail Recipient emails address
   * @param {string} code Verification code
   * @returns {Promise<Object>} Email send result
   */
  async sendVerificationCodeEmail(toEmail, code) {
    if (!SendGridServiceUtils.validateEmail(toEmail)) {
      throw new Error('Invalid emails address');
    }

    // Use the specialized verification code emails method
    console.log('Sending verification code emails to:', toEmail, 'with code:', code);
    return SendGridServiceUtils.sendVerificationCodeEmail(toEmail, code, this.defaultSender);
  }

  /**
   * Send a notification about an operator status change
   * @param {string} toEmail Recipient emails address
   * @param {Object} operator Operator data
   * @param {string} oldStatus Previous status
   * @param {string} newStatus New status
   * @returns {Promise<Object>} Email send result
   */
  async sendOperatorStatusChangeNotification(toEmail, operator, oldStatus, newStatus) {
      if (!EmailClient.validateEmail(toEmail)) {
        throw new Error('Invalid emails address');
      }

      return EmailClient.sendNotification({
      to: toEmail,
      from: this.defaultSender,
      subject: `Operator Status Update: ${operator.name}`,
      message: `Operator ${operator.name} (ID: ${operator.employeeId}) status has changed from ${oldStatus} to ${newStatus}.`,
      actionUrl: `https://yourdomain.com/operators/${operator.employeeId}`,
      actionText: 'View Operator'
    });
  }

  /**
   * Send a mixer maintenance notification
   * @param {string} toEmail Recipient emails address
   * @param {Object} mixer Mixer data
   * @param {string} maintenanceType Type of maintenance needed
   * @returns {Promise<Object>} Email send result
   */
  async sendMixerMaintenanceNotification(toEmail, mixer, maintenanceType) {
      if (!EmailClient.validateEmail(toEmail)) {
        throw new Error('Invalid emails address');
      }

      return EmailClient.sendNotification({
      to: toEmail,
      from: this.defaultSender,
      subject: `Mixer Maintenance Required: Truck #${mixer.truckNumber}`,
      message: `Truck #${mixer.truckNumber} requires ${maintenanceType} maintenance. Please schedule service as soon as possible.`,
      actionUrl: `https://yourdomain.com/mixers/${mixer.id}`,
      actionText: 'View Mixer Details'
    });
  }

  /**
   * Send a custom notification emails
   * @param {string} toEmail Recipient emails address
   * @param {string} subject Email subject
   * @param {string} message Email message
   * @param {string} [actionUrl] Optional action URL
   * @param {string} [actionText] Optional action button text
   * @returns {Promise<Object>} Email send result
   */
  async sendCustomNotification(toEmail, subject, message, actionUrl = null, actionText = null) {
    if (!SendGridServiceUtils.validateEmail(toEmail)) {
      throw new Error('Invalid emails address');
    }

    console.log('Sending custom notification emails to:', toEmail, 'with subject:', subject);
    return SendGridServiceUtils.sendNotification({
      to: toEmail,
      from: this.defaultSender,
      subject,
      message,
      ...(actionUrl && { actionUrl }),
      ...(actionText && { actionText })
    });
  }

  /**
   * Update the default sender emails
   * @param {string} senderEmail New sender emails address
   */
  setDefaultSender(senderEmail) {
    if (!SendGridServiceUtils.validateEmail(senderEmail)) {
      throw new Error('Invalid sender emails address');
    }

    // Format the sender emails if needed
    if (senderEmail.indexOf('@smyrnatools.com') > -1 && senderEmail.indexOf('<') === -1) {
      this.defaultSender = `Smyrna Tools <${senderEmail}>`;
    } else {
      this.defaultSender = senderEmail;
    }

    console.log('Default sender emails updated to:', this.defaultSender);
  }
}

// Create and export a singleton instance
const emailService = new EmailService();
export default emailService;

// Create singleton instance
const emailService = new EmailService();

export default emailService;
