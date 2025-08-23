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
            case "fetch-items": {
                const {data, error} = await supabase
                    .from("list_items")
                    .select("*")
                    .order("created_at", {ascending: false});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "fetch-plants": {
                const {data, error} = await supabase
                    .from("plants")
                    .select("*")
                    .order("plant_code");
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "fetch-creator-profiles": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const userIds: string[] = Array.isArray(body?.userIds) ? body.userIds.filter((v: any) => typeof v === "string" && v.trim()) : [];
                if (userIds.length === 0) return new Response(JSON.stringify({profiles: []}), {headers: corsHeaders});
                const {data, error} = await supabase
                    .from("users_profiles")
                    .select("id, first_name, last_name")
                    .in("id", userIds);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({profiles: data ?? []}), {headers: corsHeaders});
            }
            case "create": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                let {userId, plantCode, description, deadline, comments} = body || {};
                if (typeof userId !== "string" || !userId) return new Response(JSON.stringify({error: "User ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (typeof description !== "string" || !description.trim()) return new Response(JSON.stringify({error: "Description is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const id = crypto.randomUUID();
                const now = new Date().toISOString();
                const item = {
                    id,
                    user_id: userId,
                    plant_code: typeof plantCode === "string" ? plantCode.trim() : "",
                    description: description.trim(),
                    deadline: typeof deadline === "string" ? deadline : (deadline instanceof Date ? deadline.toISOString() : deadline ?? null),
                    comments: typeof comments === "string" ? comments.trim() : "",
                    created_at: now,
                    completed: false,
                    completed_at: null,
                    completed_by: null
                };
                const {error} = await supabase.from("list_items").insert(item);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true, id}), {headers: corsHeaders});
            }
            case "update": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const item = body?.item ?? body;
                if (!item?.id || typeof item.id !== "string") return new Response(JSON.stringify({error: "Item ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (typeof item.description !== "string" || !item.description.trim()) return new Response(JSON.stringify({error: "Description is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const update: Record<string, any> = {
                    plant_code: typeof item.plant_code === "string" ? item.plant_code.trim() : "",
                    description: item.description.trim(),
                    deadline: item.deadline ?? null,
                    comments: typeof item.comments === "string" ? item.comments.trim() : "",
                    completed: !!item.completed,
                    completed_at: item.completed_at ?? null
                };
                const {error} = await supabase
                    .from("list_items")
                    .update(update)
                    .eq("id", item.id);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "toggle-completion": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {id, currentUserId, completed} = body || {};
                if (typeof id !== "string" || !id) return new Response(JSON.stringify({error: "Item ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (typeof currentUserId !== "string" || !currentUserId) return new Response(JSON.stringify({error: "No authenticated user"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const now = new Date().toISOString();
                const newCompleted = typeof completed === "boolean" ? completed : null;
                let newStatus: boolean | null = newCompleted;
                if (newStatus === null) {
                    const {
                        data,
                        error
                    } = await supabase.from("list_items").select("completed").eq("id", id).maybeSingle();
                    if (error) return new Response(JSON.stringify({error: error.message}), {
                        status: 400,
                        headers: corsHeaders
                    });
                    newStatus = data ? !data.completed : true;
                }
                const update = {
                    completed: newStatus,
                    completed_at: newStatus ? now : null,
                    completed_by: newStatus ? currentUserId : null
                };
                const {error} = await supabase.from("list_items").update(update).eq("id", id);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "delete": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {id} = body || {};
                if (typeof id !== "string" || !id) return new Response(JSON.stringify({error: "Item ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {error} = await supabase.from("list_items").delete().eq("id", id);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
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
