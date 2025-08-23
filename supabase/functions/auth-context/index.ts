// @ts-ignore
import {createClient} from "npm:@supabase/supabase-js@2.55.0";

const TABLES = {
    USERS: "users",
    PROFILES: "users_profiles",
    USER_ROLES: "users_permissions",
    ROLES: "users_roles"
};
const CORS_TIMEOUT = 10000;
const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Connection": "keep-alive"
};
const ValidationUtility = {
    sanitizeString(str) {
        return typeof str === "string" ? str.trim().replace(/[<>"'&]/g, "") : "";
    },
    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    validatePassword(password) {
        if (!password || password.length < 8) return {value: "weak", score: 0};
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
        return {value: score < 3 ? "weak" : score < 5 ? "medium" : "strong", score};
    },
    generateRandomPassword() {
        const length = 12;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let password = "";
        const randomBytes = new Uint8Array(length);
        crypto.getRandomValues(randomBytes);
        for (let i = 0; i < length; i++) {
            password += charset[randomBytes[i] % charset.length];
        }
        return password;
    }
};
const AuthUtility = {
    async generateSalt() {
        const randomBytes = new Uint8Array(16);
        crypto.getRandomValues(randomBytes);
        return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    },
    async hashPassword(password, salt) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(password + salt);
        const hash = await crypto.subtle.digest("SHA-256", dataBuffer);
        return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
};
const UserService = {
    async getRoleByName(name, supabase) {
        try {
            const {data, error} = await supabase.from(TABLES.ROLES).select("id, name").eq("name", name).single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error(`Error fetching role '${name}':`, error);
            return null;
        }
    },
    async assignRole(userId, roleId, supabase) {
        try {
            const now = new Date().toISOString();
            const {error} = await supabase.from(TABLES.USER_ROLES).insert({
                user_id: userId,
                role_id: roleId,
                created_at: now,
                updated_at: now
            });
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Error assigning role:", error);
            return false;
        }
    }
};
const generateUUID = () => crypto.randomUUID();
const normalizeName = (val) => {
    const str = ValidationUtility.sanitizeString(val);
    return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";
};
const createErrorResponse = (message, status = 500, details = {}) => {
    return new Response(JSON.stringify({
        error: message,
        ...details
    }), {
        status,
        headers: corsHeaders
    });
};
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, {status: 204, headers: corsHeaders});
    }
    try {
        const url = new URL(req.url);
        const endpoint = url.pathname.split("/").pop();
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
        if (!supabaseUrl || !supabaseKey) {
            return createErrorResponse("Server configuration error", 500);
        }
        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: {headers: {Authorization: req.headers.get("Authorization") || ""}}
        });
        switch (endpoint) {
            case "sign-in": {
                const {email, password} = await req.json();
                if (!email || !password) {
                    return createErrorResponse("Email and password are required", 400);
                }
                const trimmedEmail = ValidationUtility.sanitizeString(email).toLowerCase();
                if (!ValidationUtility.validateEmail(trimmedEmail)) {
                    return createErrorResponse("Invalid email format", 400);
                }
                const {
                    data,
                    error
                } = await supabase.from(TABLES.USERS).select("id, email, password_hash, salt").eq("email", trimmedEmail).single();
                if (error || !data) {
                    return createErrorResponse("Invalid credentials", 401);
                }
                const hash = await AuthUtility.hashPassword(password, data.salt);
                if (hash !== data.password_hash) {
                    return createErrorResponse("Invalid credentials", 401);
                }
                const {data: profile} = await supabase.from(TABLES.PROFILES).select("first_name, last_name, plant_code").eq("id", data.id).single();
                return new Response(JSON.stringify({
                    id: data.id,
                    email: data.email,
                    profile: profile || {}
                }), {headers: corsHeaders});
            }
            case "sign-up": {
                const {email, password, firstName, lastName} = await req.json();
                if (!email || !password || !firstName || !lastName) {
                    return createErrorResponse("All fields are required", 400);
                }
                const trimmedEmail = ValidationUtility.sanitizeString(email).toLowerCase();
                if (!ValidationUtility.validateEmail(trimmedEmail)) {
                    return createErrorResponse("Invalid email format", 400);
                }
                const passwordStrength = ValidationUtility.validatePassword(password);
                if (passwordStrength.value === "weak") {
                    return createErrorResponse("Password is too weak", 400);
                }
                const normFirst = normalizeName(firstName);
                const normLast = normalizeName(lastName);
                if (!normFirst || !normLast) {
                    return createErrorResponse("Invalid name format", 400);
                }
                const {data: existingUsers} = await supabase.from(TABLES.USERS).select("id").eq("email", trimmedEmail);
                if (existingUsers?.length) {
                    return createErrorResponse("Email already registered", 409);
                }
                const userId = generateUUID();
                const now = new Date().toISOString();
                const salt = await AuthUtility.generateSalt();
                const passwordHash = await AuthUtility.hashPassword(password, salt);
                const {error: userError} = await supabase.from(TABLES.USERS).insert({
                    id: userId,
                    email: trimmedEmail,
                    password_hash: passwordHash,
                    salt,
                    created_at: now,
                    updated_at: now
                });
                if (userError) {
                    return createErrorResponse("User creation failed", 500);
                }
                const profile = {
                    id: userId,
                    first_name: normFirst,
                    last_name: normLast,
                    plant_code: "",
                    created_at: now,
                    updated_at: now
                };
                const {error: profileError} = await supabase.from(TABLES.PROFILES).insert(profile);
                if (profileError) {
                    await supabase.from(TABLES.USERS).delete().eq("id", userId);
                    return createErrorResponse("Profile creation failed", 500);
                }
                let guestRole = await UserService.getRoleByName("Guest", supabase);
                if (!guestRole) {
                    const {data: newRole, error: createError} = await supabase.from(TABLES.ROLES).insert({
                        name: "Guest",
                        permissions: ["my_account.view"],
                        weight: 10,
                        created_at: now,
                        updated_at: now
                    }).select().single();
                    if (!createError) {
                        guestRole = newRole;
                    }
                }
                if (guestRole) {
                    const roleAssigned = await UserService.assignRole(userId, guestRole.id, supabase);
                    if (!roleAssigned) {
                        console.warn("Role assignment failed");
                    }
                }
                return new Response(JSON.stringify({id: userId, email: trimmedEmail, profile}), {headers: corsHeaders});
            }
            case "sign-out": {
                await supabase.auth.signOut();
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "restore-session": {
                const {userId} = await req.json();
                if (!userId) {
                    return createErrorResponse("User ID required", 400);
                }
                const {data: users, error} = await supabase.from(TABLES.USERS).select("*").eq("id", userId).single();
                if (error || !users) {
                    return createErrorResponse("User not found", 404);
                }
                const {data: profile} = await supabase.from(TABLES.PROFILES).select("first_name, last_name, plant_code").eq("id", userId).single();
                return new Response(JSON.stringify({
                    success: true,
                    user: {...users, profile: profile || {}}
                }), {headers: corsHeaders});
            }
            case "load-profile": {
                const {userId} = await req.json();
                if (!userId) {
                    return createErrorResponse("User ID required", 400);
                }
                const {
                    data: profileData,
                    error
                } = await supabase.from(TABLES.PROFILES).select("first_name, last_name, plant_code").eq("id", userId).single();
                if (error) {
                    return createErrorResponse("Failed to load profile", 500);
                }
                return new Response(JSON.stringify({profile: profileData || {}}), {headers: corsHeaders});
            }
            case "update-profile": {
                const {userId, firstName, lastName, plantCode} = await req.json();
                if (!userId || !firstName || !lastName) {
                    return createErrorResponse("User ID, first name, and last name required", 400);
                }
                const normFirst = normalizeName(firstName);
                const normLast = normalizeName(lastName);
                if (!normFirst || !normLast) {
                    return createErrorResponse("Invalid name format", 400);
                }
                const {error} = await supabase.from(TABLES.PROFILES).update({
                    first_name: normFirst,
                    last_name: normLast,
                    plant_code: ValidationUtility.sanitizeString(plantCode) || "",
                    updated_at: new Date().toISOString()
                }).eq("id", userId);
                if (error) {
                    return createErrorResponse("Failed to update profile", 500);
                }
                return new Response(JSON.stringify({
                    success: true,
                    profile: {first_name: normFirst, last_name: normLast, plant_code: plantCode || ""}
                }), {headers: corsHeaders});
            }
            case "reset-password": {
                const {email} = await req.json();
                const genericResponse = new Response(JSON.stringify({message: "If an account exists for this email, a new password has been sent."}), {headers: corsHeaders});
                if (!ValidationUtility.validateEmail(email)) {
                    return genericResponse;
                }
                const trimmedEmail = ValidationUtility.sanitizeString(email).toLowerCase();
                const {
                    data: user,
                    error: userErr
                } = await supabase.from(TABLES.USERS).select("id").eq("email", trimmedEmail).single();
                if (userErr || !user) {
                    return genericResponse;
                }
                const newPassword = ValidationUtility.generateRandomPassword();
                const passwordStrength = ValidationUtility.validatePassword(newPassword);
                if (passwordStrength.value === "weak") {
                    return genericResponse;
                }
                const salt = await AuthUtility.generateSalt();
                const passwordHash = await AuthUtility.hashPassword(newPassword, salt);
                const {error: updateError} = await supabase.from(TABLES.USERS).update({
                    password_hash: passwordHash,
                    salt,
                    updated_at: new Date().toISOString()
                }).eq("id", user.id);
                if (updateError) {
                    return genericResponse;
                }
                const mailerSendToken = Deno.env.get("MAILERSEND_API_TOKEN");
                const fromEmail = Deno.env.get("MAILERSEND_FROM_EMAIL");
                const fromName = Deno.env.get("MAILERSEND_FROM_NAME") || "Smyrna Tools";
                if (!mailerSendToken || !fromEmail) {
                    return genericResponse;
                }
                const loginUrl = `${Deno.env.get("FRONTEND_URL") || "https://smyrnatools.com"}/login`;
                const theme = {
                    white: Deno.env.get("THEME_COLOR_WHITE") || "",
                    bgDark: Deno.env.get("THEME_COLOR_BG_DARK") || "",
                    bgLight: Deno.env.get("THEME_COLOR_BG_LIGHT") || "",
                    text: Deno.env.get("THEME_COLOR_TEXT") || "",
                    textMuted: Deno.env.get("THEME_COLOR_TEXT_MUTED") || "",
                    brand: Deno.env.get("THEME_COLOR_PRIMARY") || "",
                    border: Deno.env.get("THEME_COLOR_BORDER") || "",
                    onBrand: Deno.env.get("THEME_COLOR_ON_PRIMARY") || ""
                } as Record<string, string>;
                const css = {
                    bg: (c: string) => (c ? `background-color: ${c};` : ""),
                    color: (c: string) => (c ? `color: ${c};` : ""),
                    border: (c: string) => (c ? `border: 1px solid ${c};` : "")
                };
                const styles = {
                    container: `max-width: 600px; ${css.bg(theme.white)} font-family: Arial, Helvetica, sans-serif; margin: 0 auto;`.trim(),
                    header: `${css.bg(theme.bgDark)} padding: 20px; text-align: center;`.trim(),
                    section: `padding: 30px 20px; ${css.bg(theme.bgLight)}`.trim(),
                    h1: `font-size: 24px; ${css.color(theme.text)} margin: 0 0 20px;`.trim(),
                    p: `font-size: 16px; ${css.color(theme.text)} line-height: 1.5; margin: 0 0 20px;`.trim(),
                    pwdBoxTable: `${css.bg(theme.white)} ${css.border(theme.border)} border-radius: 5px; padding: 15px; text-align: center;`.trim(),
                    pwd: `font-size: 18px; ${css.color(theme.text)} font-weight: bold;`.trim(),
                    btnA: `display: inline-block; padding: 12px 24px; ${css.bg(theme.brand)} ${css.color(theme.onBrand)} text-decoration: none; font-size: 16px; border-radius: 5px;`.trim(),
                    muted: `font-size: 14px; ${css.color(theme.textMuted)} line-height: 1.5; margin: 20px 0;`.trim(),
                    footer: `${css.bg(theme.brand)} padding: 15px; text-align: center; ${css.color(theme.onBrand)} font-size: 12px;`.trim(),
                    link: `${css.color(theme.onBrand)} text-decoration: none;`.trim()
                } as Record<string, string>;
                const payload = {
                    from: {email: fromEmail, name: fromName},
                    to: [{email: trimmedEmail}],
                    subject: "Smyrna Tools - Your New Password",
                    text: `Your new password is: ${newPassword}\nPlease log in at ${loginUrl} and change your password as soon as possible.\nFor security, do not share this password with anyone.\nIf you did not request a password reset, please contact support@smyrnatools.com.`,
                    html: `
<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="${styles.container}">
  <tr>
    <td style="${styles.header}">
      <img src="https://smyrnatools.com/static/media/SmyrnaLogo.d7f873f3da1747602db3.png" alt="Smyrna Tools Logo" style="max-width: 150px;" />
    </td>
  </tr>
  <tr>
    <td style="${styles.section}">
      <h1 style="${styles.h1}">Password Reset for Smyrna Tools</h1>
      <p style="${styles.p}">Hello,</p>
      <p style="${styles.p}">Your Smyrna Tools account password has been reset. Below is your new temporary password:</p>
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="${styles.pwdBoxTable}">
        <tr>
          <td style="${styles.pwd}">${newPassword}</td>
        </tr>
      </table>
      <p style="${styles.p}">Please use this password to log in to your account and change it immediately in your account settings.</p>
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
        <tr>
          <td align="center">
            <a href="${loginUrl}" style="${styles.btnA}">Log In Now</a>
          </td>
        </tr>
      </table>
      <p style="${styles.muted}"><strong>Security Notice:</strong> For your safety, do not share this password with anyone.</p>
    </td>
  </tr>
  <tr>
    <td style="${styles.footer}">
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} Smyrna Tools.<br />
      Built for SRM Concrete | <a href="https://smyrnatools.com" style="${styles.link}">smyrnatools.com</a></p>
    </td>
  </tr>
</table>`
                };
                try {
                    const response = await fetch("https://api.mailersend.com/v1/email", {
                        method: "POST",
                        headers: {Authorization: `Bearer ${mailerSendToken}`, "Content-Type": "application/json"},
                        body: JSON.stringify(payload)
                    });
                    if (!response.ok) {
                        return genericResponse;
                    }
                } catch (error) {
                    return genericResponse;
                }
                return genericResponse;
            }
            default:
                return createErrorResponse("Invalid endpoint", 404, {path: url.pathname});
        }
    } catch (error) {
        return createErrorResponse("Internal server error", 500, {message: error.message});
    }
});
