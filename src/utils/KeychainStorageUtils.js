/**
 * A secure storage utility for browser environments
 * This is a simplified version of the Swift KeychainUtils
 */
class KeychainStorageImpl {
    /**
     * Save credentials securely
     */
    saveCredentials(email, password) {
        try {
            // In a real app, use more secure storage like browser credentials API
            // For this example, we'll use localStorage with encryption
            const credentials = {
                email,
                password: this._obscurePassword(password)
            };

            localStorage.setItem('secureCredentials', JSON.stringify(credentials));
            return true;
        } catch (error) {
            console.error('Error saving credentials:', error);
            return false;
        }
    }

    /**
     * Retrieve stored credentials
     */
    retrieveCredentials() {
        try {
            const storedData = localStorage.getItem('secureCredentials');

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
            localStorage.removeItem('secureCredentials');
            return true;
        } catch (error) {
            console.error('Error clearing credentials:', error);
            return false;
        }
    }

    /**
     * Simple password obscuring (not true encryption)
     * For demonstration purposes only
     */
    _obscurePassword(password) {
        // In a real app, use a proper encryption library
        return btoa(password);
    }

    /**
     * Recover obscured password
     */
    _unobscurePassword(obscuredPassword) {
        try {
            return atob(obscuredPassword);
        } catch (error) {
            console.error('Error unobscuring password:', error);
            return '';
        }
    }
}

// Create singleton instance
const singleton = new KeychainStorageImpl();
export const KeychainStorageUtils = singleton;
