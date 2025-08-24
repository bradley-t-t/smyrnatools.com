import {createClient} from "@supabase/supabase-js";

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
            case "fetch-messages": {
                let body: any;
                try { body = await req.json(); } catch { return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {status: 400, headers: corsHeaders}); }
                const listItemId: string = typeof body?.listItemId === "string" ? body.listItemId.trim() : "";
                if (!listItemId) return new Response(JSON.stringify({error: "Missing list item"}), {status: 400, headers: corsHeaders});
                const {data, error} = await supabase
                    .from("list_item_messages")
                    .select("id,list_item_id,sender_id,message,created_at,edited_at,deleted_at,reply_to_message_id")
                    .eq("list_item_id", listItemId)
                    .is("deleted_at", null)
                    .order("created_at", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "send-message": {
                let body: any;
                try { body = await req.json(); } catch { return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {status: 400, headers: corsHeaders}); }
                const listItemId: string = typeof body?.listItemId === "string" ? body.listItemId.trim() : "";
                const message: string = typeof body?.message === "string" ? body.message.trim() : "";
                const rawUserId = body?.userId ?? body?.id ?? body?.user_id ?? body?.userid
                const userId: string = typeof rawUserId === "string" ? rawUserId.trim() : "";
                if (!listItemId) return new Response(JSON.stringify({error: "Missing list item"}), {status: 400, headers: corsHeaders});
                if (!message) return new Response(JSON.stringify({error: "Empty message"}), {status: 400, headers: corsHeaders});
                if (!userId) return new Response(JSON.stringify({error: "Missing userId"}), {status: 401, headers: corsHeaders});
                const now = new Date().toISOString();
                const row = {id: crypto.randomUUID(), list_item_id: listItemId, sender_id: userId, message, created_at: now};
                const {error} = await supabase.from("list_item_messages").insert(row);
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({success: true, id: row.id}), {headers: corsHeaders});
            }
            case "delete-message": {
                let body: any;
                try { body = await req.json(); } catch { return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {status: 400, headers: corsHeaders}); }
                const rawUserId = body?.userId ?? body?.id ?? body?.user_id ?? body?.userid
                const userId: string = typeof rawUserId === "string" ? rawUserId.trim() : "";
                const messageId: string = typeof body?.messageId === "string" ? body.messageId.trim() : "";
                if (!messageId) return new Response(JSON.stringify({error: "Missing messageId"}), {status: 400, headers: corsHeaders});
                if (!userId) return new Response(JSON.stringify({error: "Missing userId"}), {status: 401, headers: corsHeaders});
                const now = new Date().toISOString();
                const {error} = await supabase.from("list_item_messages").update({deleted_at: now}).eq("id", messageId).eq("sender_id", userId);
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            default:
                return new Response(JSON.stringify({error: "Invalid endpoint", path: url.pathname}), {status: 404, headers: corsHeaders});
        }
    } catch (error) {
        return new Response(JSON.stringify({error: "Internal server error", message: (error as Error).message}), {status: 500, headers: corsHeaders});
    }
});
