// @ts-ignore
import {createClient} from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders: Record<string, string> = {
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

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return handleOptions();
    try {
        const url = new URL(req.url);
        const endpoint = url.pathname.split("/").pop();
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {global: {headers: {Authorization: req.headers.get("Authorization") || ""}}}
        );

        switch (endpoint) {
            case "set-online": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {userId} = body || {};
                if (typeof userId !== "string" || !userId) return new Response(JSON.stringify({error: "User ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const now = new Date().toISOString();
                const {error} = await supabase
                    .from("users_presence")
                    .upsert({
                        user_id: userId,
                        is_online: true,
                        last_seen: now,
                        updated_at: now
                    }, {onConflict: "user_id"});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "set-offline": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {userId} = body || {};
                if (typeof userId !== "string" || !userId) return new Response(JSON.stringify({error: "User ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const now = new Date().toISOString();
                const {error} = await supabase
                    .from("users_presence")
                    .update({is_online: false, last_seen: now, updated_at: now})
                    .eq("user_id", userId);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "heartbeat": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {userId} = body || {};
                if (typeof userId !== "string" || !userId) return new Response(JSON.stringify({error: "User ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const now = new Date().toISOString();
                const {error} = await supabase
                    .from("users_presence")
                    .update({last_seen: now, updated_at: now})
                    .eq("user_id", userId);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "cleanup": {
                const staleTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
                const {error} = await supabase
                    .from("users_presence")
                    .update({is_online: false, updated_at: new Date().toISOString()})
                    .eq("is_online", true)
                    .lt("last_seen", staleTime);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "fetch-online-users": {
                const {data, error} = await supabase
                    .from("users_presence")
                    .select("user_id, last_seen")
                    .eq("is_online", true)
                    .order("last_seen", {ascending: false});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            default:
                return new Response(JSON.stringify({error: "Invalid endpoint", path: url.pathname}), {
                    status: 404,
                    headers: corsHeaders
                });
        }
    } catch (error) {
        return new Response(JSON.stringify({
            error: "Internal server error",
            message: (error as Error).message
        }), {status: 500, headers: corsHeaders});
    }
});

