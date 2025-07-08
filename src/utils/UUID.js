/**
 * @deprecated Use the more secure implementation from UUIDHelper.js instead
 * This implementation uses Math.random() which is not cryptographically secure
 */

import { generateUUID as secureGenerateUUID } from './UUIDHelper';

/**
 * Generates a UUID v4 compatible string
 * This is kept for backward compatibility but redirects to the more secure implementation
 * @returns {string} A UUID v4 string
 */
export function generateUUID() {
    // Use the improved implementation from UUIDHelper
    return secureGenerateUUID();
}
