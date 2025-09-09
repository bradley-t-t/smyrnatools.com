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

function nowIso() {
    return new Date().toISOString();
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
            case "fetch-all": {
                const { data, error } = await supabase
                    .from("pickup_trucks")
                    .select("*")
                    .order("assigned_plant", {ascending: true})
                    .order("assigned", {ascending: true})
                    .order("make", {ascending: true})
                    .order("model", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "fetch-by-id": {
                let body: any;
                try { body = await req.json(); } catch { return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {status: 400, headers: corsHeaders}); }
                const id = typeof body?.id === "string" ? body.id : null;
                if (!id) return new Response(JSON.stringify({error: "Pickup Truck ID is required"}), {status: 400, headers: corsHeaders});
                const { data, error } = await supabase.from("pickup_trucks").select("*").eq("id", id).maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({data: data ?? null}), {headers: corsHeaders});
            }
            case "create": {
                let body: any;
                try { body = await req.json(); } catch { return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {status: 400, headers: corsHeaders}); }
                const pickup = body?.pickup || body;
                const userId = typeof body?.userId === "string" && body.userId ? body.userId : null;
                if (!userId) return new Response(JSON.stringify({error: "User ID is required"}), {status: 400, headers: corsHeaders});
                const now = nowIso();
                const mileageVal = typeof pickup?.mileage === "number" ? Math.max(0, Math.floor(pickup.mileage)) : (typeof pickup?.mileage === "string" && pickup.mileage.trim() !== "" ? Math.max(0, Math.floor(Number(pickup.mileage))) : null);
                const apiData: Record<string, any> = {
                    vin: typeof pickup?.vin === "string" ? pickup.vin : null,
                    make: typeof pickup?.make === "string" ? pickup.make : null,
                    model: typeof pickup?.model === "string" ? pickup.model : null,
                    year: typeof pickup?.year === "number" ? pickup.year : (typeof pickup?.year === "string" ? pickup.year : null),
                    assigned: typeof pickup?.assigned === "string" ? (pickup.assigned.trim() === "" ? null : pickup.assigned) : null,
                    assigned_plant: typeof pickup?.assignedPlant === "string" ? pickup.assignedPlant : null,
                    status: typeof pickup?.status === "string" ? pickup.status : "Active",
                    mileage: mileageVal,
                    comments: typeof pickup?.comments === "string" ? pickup.comments : null,
                    created_at: now,
                    updated_at: now,
                    updated_by: userId,
                    updated_last: null
                };
                const { data, error } = await supabase.from("pickup_trucks").insert([apiData]).select().maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({data}), {headers: corsHeaders});
            }
            case "update": {
                let body: any;
                try { body = await req.json(); } catch { return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {status: 400, headers: corsHeaders}); }
                const id = typeof body?.pickupId === "string" ? body.pickupId : (typeof body?.id === "string" ? body.id : null);
                const pickup = body?.pickup || body?.data || body;
                const userId = typeof body?.userId === "string" && body.userId ? body.userId : null;
                if (!id) return new Response(JSON.stringify({error: "Pickup Truck ID is required"}), {status: 400, headers: corsHeaders});
                if (!userId) return new Response(JSON.stringify({error: "User ID is required"}), {status: 400, headers: corsHeaders});
                const { data: current, error: curErr } = await supabase.from("pickup_trucks").select("*").eq("id", id).maybeSingle();
                if (curErr) return new Response(JSON.stringify({error: curErr.message}), {status: 400, headers: corsHeaders});
                if (!current) return new Response(JSON.stringify({error: "Pickup Truck not found"}), {status: 404, headers: corsHeaders});
                const mileageVal = typeof pickup?.mileage === "number" ? Math.max(0, Math.floor(pickup.mileage)) : (typeof pickup?.mileage === "string" && pickup.mileage.trim() !== "" ? Math.max(0, Math.floor(Number(pickup.mileage))) : current.mileage);
                const hasAssigned = Object.prototype.hasOwnProperty.call(pickup, 'assigned');
                const normalizedAssigned = hasAssigned ? (pickup.assigned == null ? null : (typeof pickup.assigned === 'string' && pickup.assigned.trim() === '' ? null : String(pickup.assigned))) : current.assigned;
                const hasAssignedPlant = Object.prototype.hasOwnProperty.call(pickup, 'assignedPlant');
                const normalizedAssignedPlant = hasAssignedPlant ? (pickup.assignedPlant == null ? null : String(pickup.assignedPlant)) : current.assigned_plant;
                const hasStatus = Object.prototype.hasOwnProperty.call(pickup, 'status');
                const normalizedStatus = hasStatus ? (pickup.status == null ? current.status : String(pickup.status)) : current.status;
                const apiData: Record<string, any> = {
                    vin: typeof pickup?.vin === "string" ? pickup.vin : current.vin,
                    make: typeof pickup?.make === "string" ? pickup.make : current.make,
                    model: typeof pickup?.model === "string" ? pickup.model : current.model,
                    year: typeof pickup?.year === "number" ? pickup.year : (typeof pickup?.year === "string" ? pickup.year : current.year),
                    assigned: normalizedAssigned,
                    assigned_plant: normalizedAssignedPlant,
                    status: normalizedStatus,
                    mileage: mileageVal,
                    comments: typeof pickup?.comments === "string" ? pickup.comments : current.comments,
                    updated_at: nowIso(),
                    updated_by: userId,
                    updated_last: current.updated_last
                };
                const { data, error } = await supabase.from("pickup_trucks").update(apiData).eq("id", id).select().maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({data}), {headers: corsHeaders});
            }
            case "delete": {
                let body: any;
                try { body = await req.json(); } catch { return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {status: 400, headers: corsHeaders}); }
                const id = typeof body?.id === "string" ? body.id : null;
                if (!id) return new Response(JSON.stringify({error: "Pickup Truck ID is required"}), {status: 400, headers: corsHeaders});
                const { error } = await supabase.from("pickup_trucks").delete().eq("id", id);
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "search-by-vin": {
                let body: any;
                try { body = await req.json(); } catch { return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {status: 400, headers: corsHeaders}); }
                const query = typeof body?.query === "string" ? body.query.trim() : "";
                if (!query) return new Response(JSON.stringify({error: "Search query is required"}), {status: 400, headers: corsHeaders});
                const { data, error } = await supabase.from("pickup_trucks").select("*").ilike("vin", `%${query}%`).order("vin", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "search-by-assigned": {
                let body: any;
                try { body = await req.json(); } catch { return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {status: 400, headers: corsHeaders}); }
                const query = typeof body?.query === "string" ? body.query.trim() : "";
                if (!query) return new Response(JSON.stringify({error: "Search query is required"}), {status: 400, headers: corsHeaders});
                const { data, error } = await supabase.from("pickup_trucks").select("*").ilike("assigned", `%${query}%`).order("assigned", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            default:
                return new Response(JSON.stringify({error: "Invalid endpoint", path: url.pathname}), {status: 404, headers: corsHeaders});
        }
    } catch (error) {
        return new Response(JSON.stringify({error: "Internal server error", message: (error as Error).message}), {status: 500, headers: corsHeaders});
    }
});
