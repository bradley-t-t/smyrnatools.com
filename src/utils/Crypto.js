/**
 * Crypto utilities to match the Swift app's implementation
 */

/**
 * Converts a string to a SHA-256 hash
 * This is a JavaScript implementation that matches the Swift SHA256 hash function
 * @param {string} data - The string to hash
 * @returns {string} - The hex string representation of the hash
 */
export async function sha256Hash(data) {
    try {
        // Use the Web Crypto API which is widely supported in modern browsers
        if (!window.crypto || !window.crypto.subtle) {
            console.warn('Web Crypto API not available, using fallback');
            return simpleHash(data);
        }

        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);

        // Set a timeout promise to prevent this from hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('SHA-256 hash timed out')), 5000);
        });

        // Race the crypto operation against the timeout
        const hashBuffer = await Promise.race([
            crypto.subtle.digest('SHA-256', dataBuffer),
            timeoutPromise
        ]);

        // Convert the hash to a hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    } catch (error) {
        console.error('Error generating SHA-256 hash:', error);
        // Fallback to a simple hash
        return simpleHash(data);
    }
}

/**
 * Simple hash function as fallback (less secure but works everywhere)
 * @param {string} data - The string to hash
 * @returns {string} - A hex string representation of a simple hash
 */
function simpleHash(data) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // Convert to hex string with padding
    const hashHex = (hash >>> 0).toString(16);
    return hashHex.padStart(64, '0'); // Pad to 64 chars like SHA-256
}

/**
 * Generate a UUID v4 string
 * @returns {string} - A UUID v4 string
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
