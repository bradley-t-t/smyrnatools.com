// @ts-ignore
import {createClient} from "npm:@supabase/supabase-js@2.45.4";

const USERS_TABLE = 'users';
const PROFILES_TABLE = 'users_profiles';
const ROLES_TABLE = 'users_roles';
const PERMISSIONS_TABLE = 'users_permissions';

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

// Main edge function
Deno.serve(async (req) => {
    // Handle OPTIONS requests for CORS
    if (req.method === "OPTIONS") {
        return handleOptions();
    }
    try {
        const url = new URL(req.url);
        const endpoint = url.pathname.split("/").pop();
        console.log(`Processing endpoint: ${endpoint}`);
        // Initialize Supabase client with auth context from request
        const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
            global: {
                headers: {
                    Authorization: req.headers.get("Authorization") || ""
                }
            }
        });
        const body = await req.json().catch(() => ({}));
        switch (endpoint) {
            case "current-user": {
                // Get current user from session
                const {userId} = body;
                if (userId) {
                    try {
                        const {data} = await supabase.from(USERS_TABLE).select('id').eq('id', userId).single();
                        if (data && data.id) {
                            return new Response(JSON.stringify({
                                id: userId
                            }), {
                                headers: corsHeaders
                            });
                        }
                    } catch (error) {
                        console.error("Error getting user by ID:", error);
                    }
                }
                try {
                    const {data} = await supabase.auth.getUser();
                    if (!data?.user) {
                        return new Response(JSON.stringify(null), {
                            headers: corsHeaders
                        });
                    }
                    return new Response(JSON.stringify(data.user), {
                        headers: corsHeaders
                    });
                } catch (error) {
                    console.error("Error getting auth user:", error);
                    return new Response(JSON.stringify(null), {
                        headers: corsHeaders
                    });
                }
            }
            case "user-by-id": {
                const {userId} = body;
                if (!userId) {
                    return new Response(JSON.stringify({
                        id: 'unknown',
                        name: 'Unknown User'
                    }), {
                        headers: corsHeaders
                    });
                }
                const {data} = await supabase.from(USERS_TABLE).select('id, name, email').eq('id', userId).single();
                if (!data) {
                    return new Response(JSON.stringify({
                        id: userId,
                        name: `User ${userId.slice(0, 8)}`
                    }), {
                        headers: corsHeaders
                    });
                }
                return new Response(JSON.stringify({
                    id: data.id,
                    name: data.name || data.email?.split('@')[0] || `User ${userId.slice(0, 8)}`,
                    email: data.email
                }), {
                    headers: corsHeaders
                });
            }
            case "display-name": {
                const {userId} = body;
                if (!userId) {
                    return new Response(JSON.stringify('System'), {
                        headers: corsHeaders
                    });
                }
                if (userId === 'anonymous') {
                    return new Response(JSON.stringify('Anonymous'), {
                        headers: corsHeaders
                    });
                }
                const {data: profileData} = await supabase.from(PROFILES_TABLE).select('first_name, last_name').eq('id', userId).single();
                if (profileData) {
                    const fullName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
                    if (fullName) {
                        return new Response(JSON.stringify(fullName), {
                            headers: corsHeaders
                        });
                    }
                }
                const {data: userData} = await supabase.from(USERS_TABLE).select('name, email').eq('id', userId).single();
                if (userData?.name) {
                    return new Response(JSON.stringify(userData.name.replace(/^User\s+/i, '')), {
                        headers: corsHeaders
                    });
                }
                if (userData?.email) {
                    const emailName = userData.email.split('@')[0].replace(/\./g, ' ').split(' ').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
                    return new Response(JSON.stringify(emailName), {
                        headers: corsHeaders
                    });
                }
                return new Response(JSON.stringify(userId.slice(0, 8)), {
                    headers: corsHeaders
                });
            }
            case "all-roles": {
                const {data} = await supabase.from(ROLES_TABLE).select('*').order('weight', {
                    ascending: false
                });
                return new Response(JSON.stringify(data || []), {
                    headers: corsHeaders
                });
            }
            case "role-by-id": {
                const {roleId} = body;
                if (!roleId) {
                    return new Response(JSON.stringify({
                        error: "Role ID is required"
                    }), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {data} = await supabase.from(ROLES_TABLE).select('*').eq('id', roleId).single();
                return new Response(JSON.stringify(data || null), {
                    headers: corsHeaders
                });
            }
            case "role-by-name": {
                const {roleName} = body;
                if (!roleName) {
                    return new Response(JSON.stringify({
                        error: "Role name is required"
                    }), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {data} = await supabase.from(ROLES_TABLE).select('*').eq('name', roleName).single();
                return new Response(JSON.stringify(data || null), {
                    headers: corsHeaders
                });
            }
            case "user-roles": {
                const {userId} = body;
                if (!userId) {
                    return new Response(JSON.stringify({
                        error: "User ID is required"
                    }), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const id = typeof userId === 'object' && userId.id ? userId.id : userId;
                const {data} = await supabase.from(PERMISSIONS_TABLE).select('role_id, users_roles(id, name, permissions, weight)').eq('user_id', id);
                const roles = data?.map((item) => item.users_roles) ?? [];
                return new Response(JSON.stringify(roles), {
                    headers: corsHeaders
                });
            }
            case "user-permissions": {
                const {userId} = body;
                if (!userId) {
                    return new Response(JSON.stringify({
                        error: "User ID is required"
                    }), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const id = typeof userId === 'object' && userId.id ? userId.id : userId;
                const {data} = await supabase.from(PERMISSIONS_TABLE).select('role_id, users_roles(id, name, permissions, weight)').eq('user_id', id);
                const roles = data?.map((item) => item.users_roles) ?? [];
                const permissions = new Set();
                roles.forEach((role) => role?.permissions?.forEach((perm) => permissions.add(perm)));
                return new Response(JSON.stringify(Array.from(permissions)), {
                    headers: corsHeaders
                });
            }
            case "has-permission": {
                const {userId, permission} = body;
                if (!userId || !permission) {
                    return new Response(JSON.stringify(false), {
                        headers: corsHeaders
                    });
                }
                if (permission === 'my_account.view') {
                    return new Response(JSON.stringify(true), {
                        headers: corsHeaders
                    });
                }
                const id = typeof userId === 'object' && userId.id ? userId.id : userId;
                const {data} = await supabase.from(PERMISSIONS_TABLE).select('role_id, users_roles(id, name, permissions, weight)').eq('user_id', id);
                const roles = data?.map((item) => item.users_roles) ?? [];
                const permissions = new Set();
                roles.forEach((role) => role?.permissions?.forEach((perm) => permissions.add(perm)));
                return new Response(JSON.stringify(permissions.has(permission)), {
                    headers: corsHeaders
                });
            }
            case "has-any-permission": {
                const {userId, permissions} = body;
                if (!userId || !permissions?.length) {
                    return new Response(JSON.stringify(false), {
                        headers: corsHeaders
                    });
                }
                const id = typeof userId === 'object' && userId.id ? userId.id : userId;
                const {data} = await supabase.from(PERMISSIONS_TABLE).select('role_id, users_roles(id, name, permissions, weight)').eq('user_id', id);
                const roles = data?.map((item) => item.users_roles) ?? [];
                const userPermissions = new Set();
                roles.forEach((role) => role?.permissions?.forEach((perm) => userPermissions.add(perm)));
                const hasAny = permissions.some((perm) => userPermissions.has(perm));
                return new Response(JSON.stringify(hasAny), {
                    headers: corsHeaders
                });
            }
            case "has-all-permissions": {
                const {userId, permissions} = body;
                if (!userId || !permissions?.length) {
                    return new Response(JSON.stringify(false), {
                        headers: corsHeaders
                    });
                }
                const id = typeof userId === 'object' && userId.id ? userId.id : userId;
                const {data} = await supabase.from(PERMISSIONS_TABLE).select('role_id, users_roles(id, name, permissions, weight)').eq('user_id', id);
                const roles = data?.map((item) => item.users_roles) ?? [];
                const userPermissions = new Set();
                roles.forEach((role) => role?.permissions?.forEach((perm) => userPermissions.add(perm)));
                const hasAll = permissions.every((perm) => userPermissions.has(perm));
                return new Response(JSON.stringify(hasAll), {
                    headers: corsHeaders
                });
            }
            case "menu-visibility": {
                const {userId, requiredPermissions} = body;
                if (!userId) {
                    return new Response(JSON.stringify({}), {
                        headers: corsHeaders
                    });
                }
                const id = typeof userId === 'object' && userId.id ? userId.id : userId;
                const {data} = await supabase.from(PERMISSIONS_TABLE).select('role_id, users_roles(id, name, permissions, weight)').eq('user_id', id);
                const roles = data?.map((item) => item.users_roles) ?? [];
                const userPermissions = new Set();
                roles.forEach((role) => role?.permissions?.forEach((perm) => userPermissions.add(perm)));
                const visibility = Object.fromEntries(Object.entries(requiredPermissions || {}).map(([menuItem, permission]) => [
                    menuItem,
                    !permission || userPermissions.has(permission)
                ]));
                return new Response(JSON.stringify(visibility), {
                    headers: corsHeaders
                });
            }
            case "highest-role": {
                const {userId} = body;
                if (!userId) {
                    return new Response(JSON.stringify(null), {
                        headers: corsHeaders
                    });
                }
                const id = typeof userId === 'object' && userId.id ? userId.id : userId;
                const {data} = await supabase.from(PERMISSIONS_TABLE).select('role_id, users_roles(id, name, permissions, weight)').eq('user_id', id);
                const roles = data?.map((item) => item.users_roles) ?? [];
                if (!roles.length) {
                    return new Response(JSON.stringify(null), {
                        headers: corsHeaders
                    });
                }
                const highestRole = roles.sort((a, b) => b.weight - a.weight)[0];
                return new Response(JSON.stringify(highestRole), {
                    headers: corsHeaders
                });
            }
            case "assign-role": {
                const {userId, roleId} = body;
                if (!userId || !roleId) {
                    return new Response(JSON.stringify({
                        error: "User ID and role ID are required"
                    }), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const id = typeof userId === 'object' && userId.id ? userId.id : userId;
                const {data: existing} = await supabase.from(PERMISSIONS_TABLE).select('id').eq('user_id', id).eq('role_id', roleId);
                if (existing?.length) {
                    return new Response(JSON.stringify(true), {
                        headers: corsHeaders
                    });
                }
                const {error} = await supabase.from(PERMISSIONS_TABLE).insert({
                    user_id: id,
                    role_id: roleId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
                if (error) {
                    return new Response(JSON.stringify({
                        error: error.message || "Failed to assign role"
                    }), {
                        status: 500,
                        headers: corsHeaders
                    });
                }
                return new Response(JSON.stringify(true), {
                    headers: corsHeaders
                });
            }
            case "remove-role": {
                const {userId, roleId} = body;
                if (!userId || !roleId) {
                    return new Response(JSON.stringify({
                        error: "User ID and role ID are required"
                    }), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const id = typeof userId === 'object' && userId.id ? userId.id : userId;
                const {error} = await supabase.from(PERMISSIONS_TABLE).delete().eq('user_id', id).eq('role_id', roleId);
                if (error) {
                    return new Response(JSON.stringify({
                        error: error.message || "Failed to remove role"
                    }), {
                        status: 500,
                        headers: corsHeaders
                    });
                }
                return new Response(JSON.stringify(true), {
                    headers: corsHeaders
                });
            }
            case "create-role": {
                const {name, permissions = [], weight = 0} = body;
                if (!name) {
                    return new Response(JSON.stringify({
                        error: "Role name is required"
                    }), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {data, error} = await supabase.from(ROLES_TABLE).insert({
                    name,
                    permissions,
                    weight,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }).select().single();
                if (error) {
                    return new Response(JSON.stringify({
                        error: error.message || "Failed to create role"
                    }), {
                        status: 500,
                        headers: corsHeaders
                    });
                }
                return new Response(JSON.stringify(data), {
                    headers: corsHeaders
                });
            }
            case "update-role": {
                const {roleId, updates} = body;
                if (!roleId || !updates) {
                    return new Response(JSON.stringify({
                        error: "Role ID and updates are required"
                    }), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {error} = await supabase.from(ROLES_TABLE).update({
                    ...updates,
                    updated_at: new Date().toISOString()
                }).eq('id', roleId);
                if (error) {
                    return new Response(JSON.stringify({
                        error: error.message || "Failed to update role"
                    }), {
                        status: 500,
                        headers: corsHeaders
                    });
                }
                return new Response(JSON.stringify(true), {
                    headers: corsHeaders
                });
            }
            case "delete-role": {
                const {roleId} = body;
                if (!roleId) {
                    return new Response(JSON.stringify({
                        error: "Role ID is required"
                    }), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {error} = await supabase.from(ROLES_TABLE).delete().eq('id', roleId);
                if (error) {
                    return new Response(JSON.stringify({
                        error: error.message || "Failed to delete role"
                    }), {
                        status: 500,
                        headers: corsHeaders
                    });
                }
                return new Response(JSON.stringify(true), {
                    headers: corsHeaders
                });
            }
            case "user-plant": {
                const {userId} = body;
                if (!userId) {
                    return new Response(JSON.stringify(null), {
                        headers: corsHeaders
                    });
                }
                const id = typeof userId === 'object' && userId.id ? userId.id : userId;
                const {data} = await supabase.from(PROFILES_TABLE).select('plant_code').eq('id', id).single();
                if (!data?.plant_code) {
                    return new Response(JSON.stringify(null), {
                        headers: corsHeaders
                    });
                }
                return new Response(JSON.stringify(data.plant_code), {
                    headers: corsHeaders
                });
            }
            default:
                return new Response(JSON.stringify({
                    error: "Invalid endpoint",
                    path: url.pathname
                }), {
                    status: 404,
                    headers: corsHeaders
                });
        }
    } catch (error) {
        console.error("Unhandled error:", error);
        return new Response(JSON.stringify({
            error: "Internal server error",
            message: error.message
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
});
