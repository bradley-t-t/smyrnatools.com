import {sha256Hash} from './CryptoUtility';
import {supabase} from '../services/DatabaseService';

const PWD_HASH_TIMEOUT = 5000;

export function passwordStrength(password) {
    if (!password || password.length < 8) {
        return {value: 'weak', color: '#e53e3e'};
    }

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

    if (score < 3) return {value: 'weak', color: '#e53e3e'};
    if (score < 5) return {value: 'medium', color: '#ecc94b'};
    return {value: 'strong', color: '#38a169'};
}

export class AuthUtility {
    static emailIsValid(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    static passwordStrength(password) {
        return passwordStrength(password);
    }

    static generateSalt() {
        const randomBytes = new Uint8Array(16);
        crypto.getRandomValues(randomBytes);
        return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    static async hashPassword(password, salt) {
        try {
            const data = password + salt;
            const hashPromise = sha256Hash(data);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Password hash timed out')), PWD_HASH_TIMEOUT));
            return await Promise.race([hashPromise, timeoutPromise]);
        } catch (error) {
            console.error('Error hashing password:', error);
            return this.hashPasswordSync(password, salt);
        }
    }

    static hashPasswordSync(password, salt) {
        try {
            const data = password + salt;
            let hash = 0;
            for (let i = 0; i < data.length; i++) {
                const char = data.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return (hash >>> 0).toString(16);
        } catch (error) {
            console.error('Error in sync password hashing:', error);
            throw error;
        }
    }

    static async verifyPassword(password, hash, salt) {
        const computedHash = await this.hashPassword(password, salt);
        return computedHash === hash;
    }

    static async getUserId() {
        let userId = sessionStorage.getItem('userId');
        if (userId) return userId;

        try {
            const { data } = await supabase.auth.getSession();
            if (data?.session?.user?.id) {
                sessionStorage.setItem('userId', data.session.user.id);
                return data.session.user.id;
            }
        } catch {
        }

        return null;
    }
}


export default AuthUtility;