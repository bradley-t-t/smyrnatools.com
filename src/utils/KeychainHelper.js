/**
 * KeychainHelper - a browser localStorage based implementation
 * Simulates iOS KeychainHelper for credential storage
 */
class KeychainHelper {
    // Singleton instance
    static shared = new KeychainHelper();

    constructor() {
        this.storageKey = 'smyrna_secure_credentials';
    }

    /**
     * Store user credentials to localStorage (obscured for demo)
     * @param {string} email - User email
     * @param {string} password - User password (obscured in this demo)
     * @returns {boolean} - True if saved successfully, false otherwise
     */
    storeCredentials(email, password) {
        try {
            const credentials = {
                email,
                password: this._obscurePassword(password),
                timestamp: new Date().toISOString()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(credentials));
            return true;
        } catch (error) {
            console.error('Error storing credentials:', error);
            return false;
        }
    }

    /**
     * Retrieve user credentials from localStorage
     * @returns {Object|null} - The credentials object or null if not found
     */
    retrieveCredentials() {
        try {
            const storedData = localStorage.getItem(this.storageKey);
            if (!storedData) return null;

            const credentials = JSON.parse(storedData);
            return {
                email: credentials.email,
                password: this._unobscurePassword(credentials.password)
            };
        } catch (error) {
            console.error('Error retrieving credentials:', error);
            return null;
        }
    }

    /**
     * Clear stored credentials
     */
    clearCredentials() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.error('Error clearing credentials:', error);
        }
    }

    /**
     * Simple password obscuring (not true encryption)
     * For demonstration purposes only
     * @param {string} password - The password to obscure
     * @returns {string} - The obscured password
     */
    _obscurePassword(password) {
        return btoa(password);
    }

    /**
     * Unobscure the password
     * @param {string} obscuredPassword - The obscured password
     * @returns {string} - The original password
     */
    _unobscurePassword(obscuredPassword) {
        return atob(obscuredPassword);
    }
}

export default KeychainHelper;