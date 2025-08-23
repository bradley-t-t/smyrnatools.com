// @ts-ignore
import {createClient} from "npm:@supabase/supabase-js@2.45.4";

const USERS_TABLE = "users";
const PROFILES_TABLE = "users_profiles";
const CORS_TIMEOUT = 5000;
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

const AuthUtility = {
    emailIsValid(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    passwordStrength(password) {
        if (!password || password.length < 8) return {value: "weak"};
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
        return {value: score < 3 ? "weak" : score < 5 ? "medium" : "strong"};
    },
    generateSalt() {
        const randomBytes = new Uint8Array(16);
        crypto.getRandomValues(randomBytes);
        return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    },
    hashPassword(password, salt) {
        const data = password + salt;
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        return crypto.subtle.digest("SHA-256", dataBuffer).then((hash) => Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join(""));
    }
};
const UserService = {
    async getRoleByName(name) {
        return {id: "guest-role-id", name: "Guest"};
    },
    async assignRole(userId, roleId) {
        return true;
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
        const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
            global: {
                headers: {
                    Authorization: req.headers.get("Authorization") || ""
                }
            }
        });
        switch (endpoint) {
            case "sign-in": {
                const {email, password} = await req.json();
                if (!email?.trim() || !password) {
                    return new Response(JSON.stringify({error: "Email and password are required"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const trimmedEmail = email.trim().toLowerCase();
                const {
                    data,
                    error
                } = await supabase.from(USERS_TABLE).select("id, email, password_hash, salt").eq("email", trimmedEmail).single();
                if (error || !data) {
                    return new Response(JSON.stringify({error: "Invalid credentials"}), {
                        status: 401,
                        headers: corsHeaders
                    });
                }
                const hash = await AuthUtility.hashPassword(password, data.salt);
                if (hash !== data.password_hash) {
                    return new Response(JSON.stringify({error: "Invalid credentials"}), {
                        status: 401,
                        headers: corsHeaders
                    });
                }
                await supabase.auth.signInWithPassword({email: trimmedEmail, password}).catch(() => {
                });
                const user = {userId: data.id, email: data.email};
                return new Response(JSON.stringify(user), {headers: corsHeaders});
            }
            case "sign-up": {
                const {email, password, firstName, lastName} = await req.json();
                if (!AuthUtility.emailIsValid(email)) {
                    return new Response(JSON.stringify({error: "Invalid email"}), {status: 400, headers: corsHeaders});
                }
                if (AuthUtility.passwordStrength(password).value === "weak") {
                    return new Response(JSON.stringify({error: "Weak password"}), {status: 400, headers: corsHeaders});
                }
                if (!firstName?.trim() || !lastName?.trim()) {
                    return new Response(JSON.stringify({error: "First and last name are required"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const trimmedEmail = email.trim().toLowerCase();
                const {data: existingUser} = await supabase.from(USERS_TABLE).select("id").eq("email", trimmedEmail).single();
                if (existingUser) {
                    return new Response(JSON.stringify({error: "Email already registered"}), {
                        status: 409,
                        headers: corsHeaders
                    });
                }
                const userId = crypto.randomUUID();
                const now = new Date().toISOString();
                const salt = AuthUtility.generateSalt();
                const passwordHash = await AuthUtility.hashPassword(password, salt);
                const user = {
                    id: userId,
                    email: trimmedEmail,
                    password_hash: passwordHash,
                    salt,
                    created_at: now,
                    updated_at: now
                };
                const {error: userError} = await supabase.from(USERS_TABLE).insert(user);
                if (userError) {
                    return new Response(JSON.stringify({error: userError.message}), {
                        status: 500,
                        headers: corsHeaders
                    });
                }
                const {
                    data: createdUser,
                    error: verifyError
                } = await supabase.from(USERS_TABLE).select("id").eq("id", userId).single();
                if (verifyError || !createdUser) {
                    return new Response(JSON.stringify({error: "User creation failed"}), {
                        status: 500,
                        headers: corsHeaders
                    });
                }
                const profile = {
                    id: userId,
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                    plant_code: "",
                    created_at: now,
                    updated_at: now
                };
                const {error: profileError} = await supabase.from(PROFILES_TABLE).insert(profile);
                if (profileError) {
                    await supabase.from(USERS_TABLE).delete().eq("id", userId);
                    return new Response(JSON.stringify({error: profileError.message}), {
                        status: 500,
                        headers: corsHeaders
                    });
                }
                const guestRole = await UserService.getRoleByName("Guest");
                if (!guestRole) {
                    await supabase.from(USERS_TABLE).delete().eq("id", userId);
                    return new Response(JSON.stringify({error: "Guest role not found"}), {
                        status: 500,
                        headers: corsHeaders
                    });
                }
                const roleAssigned = await UserService.assignRole(userId, guestRole.id);
                if (!roleAssigned) {
                    await supabase.from(USERS_TABLE).delete().eq("id", userId);
                    return new Response(JSON.stringify({error: "Role assignment failed"}), {
                        status: 500,
                        headers: corsHeaders
                    });
                }
                return new Response(JSON.stringify({userId, email: trimmedEmail}), {headers: corsHeaders});
            }
            case "sign-out": {
                await supabase.auth.signOut();
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "update-email": {
                const {email, userId} = await req.json();
                if (!userId) {
                    return new Response(JSON.stringify({error: "No authenticated user"}), {
                        status: 401,
                        headers: corsHeaders
                    });
                }
                if (!AuthUtility.emailIsValid(email)) {
                    return new Response(JSON.stringify({error: "Invalid email"}), {status: 400, headers: corsHeaders});
                }
                const trimmedEmail = email.trim().toLowerCase();
                const {data: existingUser} = await supabase.from(USERS_TABLE).select("id").eq("email", trimmedEmail).neq("id", userId).single();
                if (existingUser) {
                    return new Response(JSON.stringify({error: "Email already registered"}), {
                        status: 409,
                        headers: corsHeaders
                    });
                }
                const {error} = await supabase.from(USERS_TABLE).update({
                    email: trimmedEmail,
                    updated_at: new Date().toISOString()
                }).eq("id", userId);
                if (error) {
                    return new Response(JSON.stringify({error: error.message}), {status: 500, headers: corsHeaders});
                }
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "update-password": {
                const {password, userId} = await req.json();
                if (!userId) {
                    return new Response(JSON.stringify({error: "No authenticated user"}), {
                        status: 401,
                        headers: corsHeaders
                    });
                }
                if (AuthUtility.passwordStrength(password).value === "weak") {
                    return new Response(JSON.stringify({error: "Weak password"}), {status: 400, headers: corsHeaders});
                }
                const salt = AuthUtility.generateSalt();
                const passwordHash = await AuthUtility.hashPassword(password, salt);
                const {error} = await supabase.from(USERS_TABLE).update({
                    password_hash: passwordHash,
                    salt,
                    updated_at: new Date().toISOString()
                }).eq("id", userId);
                if (error) {
                    return new Response(JSON.stringify({error: error.message}), {status: 500, headers: corsHeaders});
                }
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "restore-session": {
                const {userId} = await req.json();
                if (!userId) {
                    return new Response(JSON.stringify({success: false}), {headers: corsHeaders});
                }
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Session restore timed out")), CORS_TIMEOUT));
                try {
                    const {data, error} = await Promise.race([
                        supabase.from(USERS_TABLE).select("id, email").eq("id", userId).single(),
                        timeoutPromise
                    ] as const);
                    if ((error as unknown as Error) || !data) {
                        return new Response(JSON.stringify({success: false}), {headers: corsHeaders});
                    }
                    return new Response(JSON.stringify({
                        success: true,
                        user: {userId: data.id, email: data.email}
                    }), {headers: corsHeaders});
                } catch (error) {
                    return new Response(JSON.stringify({
                        success: false,
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
