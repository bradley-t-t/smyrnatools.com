import { supabase } from '../../core/clients/SupabaseClient';
import emailService from '../emails/EmailService';
import EmailClient from '../../core/clients/EmailClient';

/**
 * Service for handling emails verification operations
 */
class EmailVerificationService {
  /**
   * Send a verification emails to a user
   * @param {string} email User's emails address
   * @param {string} userId User's ID
   * @returns {Promise<boolean>} Success status
   */
  async sendVerificationEmail(email, userId) {
    try {
      // Import the new SendGridServiceUtils
      const SendGridService = (await import('../../utils/./SendGridServiceUtils')).SendGridServiceUtils;

      if (!SendGridService.validateEmail(email)) {
        throw new Error('Invalid emails address');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Generate a verification token
      const token = this.generateVerificationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours

      // Store the verification token in the database
      const { error } = await supabase
        .from('email_verifications')
        .insert([
          {
            user_id: userId,
            email,
            token,
            expires_at: expiresAt.toISOString(),
            created_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;

      // Create verification link
      const verificationLink = `${window.location.origin}/verify-email?token=${token}`;

      // Send verification emails using the new SendGridServiceUtils
      await SendGridService.sendNotification({
        to: email,
        from: 'no-reply@smyrnatools.com',
        subject: 'Verify Your Email Address',
        message: 'Please verify your emails address by clicking the button below. If you did not create an account, you can ignore this emails.',
        actionUrl: verificationLink,
        actionText: 'Verify Email'
      });

      console.log('Verification emails sent successfully to:', email);
      return true;
    } catch (error) {
      console.error('Error sending verification emails:', error);
      throw error;
    }
  }

  /**
   * Verify a user's emails using a token
   * @param {string} token Verification token
   * @returns {Promise<Object>} Verification result
   */
  async verifyEmail(token) {
    try {
      if (!token) {
        throw new Error('Verification token is required');
      }

      // Get the verification record
      const { data, error } = await supabase
        .from('email_verifications')
        .select('*')
        .eq('token', token)
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Invalid verification token');
      }

      // Check if token is expired
      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        throw new Error('Verification token has expired');
      }

      // Update user's emails verification status
      const { error: updateError } = await supabase
        .from('users')
        .update({ email_verified: true })
        .eq('id', data.user_id);

      if (updateError) throw updateError;

      // Delete the verification token
      await supabase
        .from('email_verifications')
        .delete()
        .eq('token', token);

      return {
        success: true,
        message: 'Email verified successfully',
        userId: data.user_id,
        email: data.email
      };
    } catch (error) {
      console.error('Error verifying emails:', error);
      throw error;
    }
  }

  /**
   * Generate a random verification token
   * @returns {string} Random token
   */
  generateVerificationToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }
}

// Create singleton instance
const emailVerificationService = new EmailVerificationService();

export default emailVerificationService;
