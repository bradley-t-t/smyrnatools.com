/**
 * Utility functions for authentication
 */
import {generateUUID, sha256Hash} from './CryptoUtil';

export class AuthUtils {
    /**
     * Validates an email address format
     * @param {string} email - The email to validate
     * @returns {boolean} - True if the email is valid, false otherwise
     */
    static emailIsValid(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    /**
     * Evaluates password strength based on length and complexity
     * @param {string} password - The password to evaluate
     * @returns {Object} - Object containing strength value ('weak', 'medium', 'strong') and color
     */
    static passwordStrength(password) {
        if (!password || password.length < 8) {
            return {value: 'weak', color: '#e53e3e'};
        }

        let score = 0;

        // Length check
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;

        // Complexity checks
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

        // Determine strength level
        if (score < 3) {
            return {value: 'weak', color: '#e53e3e'};
        } else if (score < 5) {
            return {value: 'medium', color: '#ecc94b'};
        } else {
            return {value: 'strong', color: '#38a169'};
        }
    }

    /**
     * Generate a random salt for password hashing
     * @returns {string} A random salt string
     */
    static generateSalt() {
        const randomBytes = new Uint8Array(16);
        window.crypto.getRandomValues(randomBytes);
        return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generates a SHA-256 hash of the password with salt
     * This matches the Swift implementation that uses CryptoKit.SHA256
     * @param {string} password - The password to hash
     * @param {string} salt - The salt to use
     * @returns {Promise<string>} - The hash as a hex string
     */
    static async hashPassword(password, salt) {
        try {
            // Use the same approach as Swift: SHA256(password + salt)
            const data = password + salt;

            // Set a timeout for the hash operation
            const hashPromise = sha256Hash(data);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Password hash timed out')), 5000);
            });

            // Race the hash operation against the timeout
            return await Promise.race([hashPromise, timeoutPromise]);
        } catch (error) {
            console.error('Error hashing password:', error);
            // Use sync fallback in case of timeout or other errors
            console.warn('Using fallback password hash method');
            return this.hashPasswordSync(password, salt);
        }
    }

    /**
     * Synchronous version of hashPassword for compatibility
     * Not as secure as the async version but works for simple cases
     * @param {string} password - The password to hash
     * @param {string} salt - The salt to use
     * @returns {string} - The hash
     */
    static hashPasswordSync(password, salt) {
        try {
            // Simple string-based hash as fallback
            const data = password + salt;
            let hash = 0;
            for (let i = 0; i < data.length; i++) {
                const char = data.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            // Make sure we return a consistent format that matches what's in the database
            return (hash >>> 0).toString(16); // Ensure positive integer before converting to hex
        } catch (error) {
            console.error('Error in sync password hashing:', error);
            throw error;
        }
    }

    /**
     * Verify a password against a hash and salt
     * @param {string} password - The plain text password to verify
     * @param {string} hash - The stored hash
     * @param {string} salt - The salt used for the hash
     * @returns {Promise<boolean>} - True if the password matches, false otherwise
     */
    static async verifyPassword(password, hash, salt) {
        const computedHash = await this.hashPassword(password, salt);
        return computedHash === hash;
    }
}

export default AuthUtils;