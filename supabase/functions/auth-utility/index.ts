// @ts-ignore
import {createClient} from "npm:@supabase/supabase-js@2.45.4";

const PWD_HASH_TIMEOUT = 5000;
const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
    "Connection": "keep-alive"
};

function handleOptions() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
}

console.log("Auth utility function started");
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return handleOptions();
    }
    try {
        const url = new URL(req.url);
        const endpoint = url.pathname.split("/").pop();
        console.log(`Processing endpoint: ${endpoint}`);
        const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
            global: {
                headers: {
                    Authorization: req.headers.get("Authorization") || ""
                }
            }
        });
        switch (endpoint) {
            case "password-strength": {
                const {password} = await req.json();
                if (!password || password.length < 8) {
                    return new Response(JSON.stringify({value: "weak"}), {headers: corsHeaders});
                }
                let score = 0;
                if (password.length >= 8) score++;
                if (password.length >= 12) score++;
                if (/[A-Z]/.test(password)) score++;
                if (/[a-z]/.test(password)) score++;
                if (/[0-9]/.test(password)) score++;
                if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
                let result;
                if (score < 3) {
                    result = "weak";
                } else if (score < 5) {
                    result = "medium";
                } else {
                    result = "strong";
                }
                return new Response(JSON.stringify({value: result}), {headers: corsHeaders});
            }
            case "email-is-valid": {
                const {email} = await req.json();
                if (!email) {
                    return new Response(JSON.stringify({error: "Email is required"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                return new Response(JSON.stringify({isValid}), {headers: corsHeaders});
            }
            case "normalize-name": {
                const {name} = await req.json();
                if (!name) {
                    return new Response(JSON.stringify({error: "Name is required"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const n = name.replace(/\s+/g, "");
                const normalizedName = n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : "";
                return new Response(JSON.stringify({normalizedName}), {headers: corsHeaders});
            }
            case "generate-salt": {
                const randomBytes = new Uint8Array(16);
                crypto.getRandomValues(randomBytes);
                const salt = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
                return new Response(JSON.stringify({salt}), {headers: corsHeaders});
            }
            case "hash-password": {
                console.log("Processing hash-password request");
                let requestBody;
                try {
                    requestBody = await req.json();
                } catch (err) {
                    console.error("Error parsing request body:", err);
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {password, salt} = requestBody;
                if (!password || !salt) {
                    return new Response(JSON.stringify({error: "Password and salt are required"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                try {
                    const data = password + salt;
                    const encoder = new TextEncoder();
                    const dataBuffer = encoder.encode(data);
                    const hashPromise = crypto.subtle.digest("SHA-256", dataBuffer).then((hash) => {
                        return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
                    });
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Password hash timed out")), PWD_HASH_TIMEOUT));
                    const hash = await Promise.race([hashPromise, timeoutPromise]);
                    console.log("Hash generated successfully");
                    return new Response(JSON.stringify({hash}), {headers: corsHeaders});
                } catch (error) {
                    console.error("Error in crypto API, using fallback:", error);
                    const data = password + salt;
                    let hash = 0;
                    for (let i = 0; i < data.length; i++) {
                        const char = data.charCodeAt(i);
                        hash = (hash << 5) - hash + char;
                        hash = hash & hash;
                    }
                    const syncHash = (hash >>> 0).toString(16);
                    return new Response(JSON.stringify({hash: syncHash, fallback: true}), {headers: corsHeaders});
                }
            }
            case "get-user-id": {
                try {
                    const {data} = await supabase.auth.getSession();
                    const userId = data?.session?.user?.id || null;
                    return new Response(JSON.stringify({userId}), {headers: corsHeaders});
                } catch (error) {
                    console.error("Error getting user session:", error);
                    return new Response(JSON.stringify({
                        userId: null,
                        error: (error as Error).message
                    }), {headers: corsHeaders});
                }
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
