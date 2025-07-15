const STORAGE_KEY = 'smyrna_secure_credentials';

class KeychainUtility {
    static shared = new KeychainUtility();

    constructor() {
        this.storageKey = STORAGE_KEY;
    }

    storeCredentials(email, password) {
        if (!email || !password) throw new Error('Email and password are required');

        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                email,
                password: btoa(password),
                timestamp: new Date().toISOString()
            }));
            return true;
        } catch (error) {
            console.error('Error storing credentials:', error);
            throw error;
        }
    }

    retrieveCredentials() {
        try {
            const storedData = localStorage.getItem(this.storageKey);
            if (!storedData) return null;

            const credentials = JSON.parse(storedData);
            return {
                email: credentials.email,
                password: atob(credentials.password)
            };
        } catch (error) {
            console.error('Error retrieving credentials:', error);
            return null;
        }
    }

    clearCredentials() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.error('Error clearing credentials:', error);
        }
    }
}

export default KeychainUtility;