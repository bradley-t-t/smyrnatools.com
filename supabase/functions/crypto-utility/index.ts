// @ts-ignore
import {createClient} from "npm:@supabase/supabase-js@2.45.4";

const HASH_TIMEOUT = 5000;
const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
    "Connection": "keep-alive"
};

function handleOptions() {
    return new Response(null, {status: 204, headers: corsHeaders});
}

const CryptoServer = {
    async crypto(data) {
        if (!(crypto && crypto.subtle)) {
            return this.fallbackHash(data);
        }
        try {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(typeof data === "string" ? data : String(data));
            const hashPromise = crypto.subtle.digest("SHA-256", dataBuffer);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("SHA-256 hash timed out")), HASH_TIMEOUT));
            const hashBuffer = await Promise.race([hashPromise, timeoutPromise]);
            return Array.from(new Uint8Array(hashBuffer as ArrayBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
        } catch (error) {
            console.error("Crypto API failed:", (error as Error).message);
            return this.fallbackHash(data);
        }
    },
    fallbackHash(data) {
        let hash = 5381;
        const str = typeof data === "string" ? data : String(data);
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
        }
        let hex = (hash >>> 0).toString(16);
        while (hex.length < 64) hex += "0";
        return hex.slice(0, 64);
    },
    generateUUID() {
        return crypto.randomUUID();
    },
    generateSalt(length = 16) {
        const randomBytes = new Uint8Array(length);
        crypto.getRandomValues(randomBytes);
        return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    },
    async hashPassword(password, salt) {
        const data = password + salt;
        return await this.crypto(data);
    }
};
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return handleOptions();
    }
    try {
        const url = new URL(req.url);
        const endpoint = url.pathname.split("/").pop();
        console.log(`Processing endpoint: ${endpoint}`);
        let body = {};
        if (req.method === "POST") {
            body = await req.json().catch(() => ({}));
        }
        switch (endpoint) {
            case "hash": {
                const data = (body as { data?: string }).data;
                if (!data) {
                    return new Response(JSON.stringify({error: "Data is required"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const hash = await CryptoServer.crypto(data);
                return new Response(JSON.stringify({hash}), {headers: corsHeaders});
            }
            case "uuid": {
                const uuid = CryptoServer.generateUUID();
                return new Response(JSON.stringify({uuid}), {headers: corsHeaders});
            }
            case "generate-salt": {
                const {length} = body as { length?: number };
                const salt = CryptoServer.generateSalt(length || 16);
                return new Response(JSON.stringify({salt}), {headers: corsHeaders});
            }
            case "hash-password": {
                const {password, salt} = body as { password?: string; salt?: string };
                if (!password || !salt) {
                    return new Response(JSON.stringify({error: "Password and salt are required"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const hash = await CryptoServer.hashPassword(password, salt);
                return new Response(JSON.stringify({hash}), {headers: corsHeaders});
            }
            case "batch-hash": {
                const items = (body as { items?: unknown[] }).items;
                if (!Array.isArray(items)) {
                    return new Response(JSON.stringify({error: "Items must be an array"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const results = await Promise.all(items.map(async (item) => {
                    const hash = await CryptoServer.crypto(item as string);
                    return {original: item, hash};
                }));
                return new Response(JSON.stringify({results}), {headers: corsHeaders});
            }
            default:
                return new Response(JSON.stringify({error: "Invalid endpoint", path: url.pathname}), {
                    status: 404,
                    headers: corsHeaders
                });
        }
    } catch (error) {
        console.error("Unhandled error:", error);
        return new Response(JSON.stringify({
            error: "Internal server error",
            message: (error as Error).message
        }), {status: 500, headers: corsHeaders});
    }
});
