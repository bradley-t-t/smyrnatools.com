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
            case "fetch-regions": {
                const {data, error} = await supabase
                    .from("regions")
                    .select("*")
                    .order("region_code");
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "fetch-region-by-code": {
                let body: any;
                try { body = await req.json(); } catch { return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {status: 400, headers: corsHeaders}); }
                const {regionCode} = body || {};
                if (typeof regionCode !== "string" || !regionCode) return new Response(JSON.stringify({error: "Region code is required"}), {status: 400, headers: corsHeaders});
                const {data, error} = await supabase
                    .from("regions")
                    .select("*")
                    .eq("region_code", regionCode)
                    .maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({data: data ?? null}), {headers: corsHeaders});
            }
            case "create": {
                let body: any;
                try { body = await req.json(); } catch { return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {status: 400, headers: corsHeaders}); }
                const {regionCode, regionName} = body || {};
                if (typeof regionCode !== "string" || !regionCode.trim() || typeof regionName !== "string" || !regionName.trim()) return new Response(JSON.stringify({error: "Region code and name are required"}), {status: 400, headers: corsHeaders});
                const now = new Date().toISOString();
                const {error} = await supabase
                    .from("regions")
                    .insert({region_code: regionCode.trim(), region_name: regionName.trim(), created_at: now, updated_at: now});
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "update": {
                let body: any;
                try { body = await req.json(); } catch { return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {status: 400, headers: corsHeaders}); }
                const {regionCode, regionName, plantCodes} = body || {};
                if (typeof regionCode !== "string" || !regionCode.trim() || typeof regionName !== "string" || !regionName.trim()) return new Response(JSON.stringify({error: "Region code and name are required"}), {status: 400, headers: corsHeaders});
                const {data: regionData, error: regionError} = await supabase
                    .from("regions")
                    .select("id")
                    .eq("region_code", regionCode)
                    .maybeSingle();
                if (regionError || !regionData) return new Response(JSON.stringify({error: regionError?.message || "Region not found"}), {status: 400, headers: corsHeaders});
                const regionId = regionData.id as string;
                const {error: updateError} = await supabase
                    .from("regions")
                    .update({region_name: regionName.trim(), updated_at: new Date().toISOString()})
                    .eq("region_code", regionCode);
                if (updateError) return new Response(JSON.stringify({error: updateError.message}), {status: 400, headers: corsHeaders});
                const {error: deleteError} = await supabase
                    .from("regions_plants")
                    .delete()
                    .eq("region_id", regionId);
                if (deleteError) return new Response(JSON.stringify({error: deleteError.message}), {status: 400, headers: corsHeaders});
                if (Array.isArray(plantCodes) && plantCodes.length > 0) {
                    const now = new Date().toISOString();
                    const rows = (plantCodes as any[])
                        .filter(v => typeof v === "string" && v.trim())
                        .map(v => ({region_id: regionId, plant_code: (v as string).trim(), created_at: now}));
                    if (rows.length > 0) {
                        const {error: insertError} = await supabase
                            .from("regions_plants")
                            .insert(rows);
                        if (insertError) return new Response(JSON.stringify({error: insertError.message}), {status: 400, headers: corsHeaders});
                    }
                }
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "delete": {
                let body: any;
                try { body = await req.json(); } catch { return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {status: 400, headers: corsHeaders}); }
                const {regionCode} = body || {};
                if (typeof regionCode !== "string" || !regionCode) return new Response(JSON.stringify({error: "Region code is required"}), {status: 400, headers: corsHeaders});
                const {data: regionData, error: regionError} = await supabase
                    .from("regions")
                    .select("id")
                    .eq("region_code", regionCode)
                    .maybeSingle();
                if (regionError || !regionData) return new Response(JSON.stringify({error: regionError?.message || "Region not found"}), {status: 400, headers: corsHeaders});
                const regionId = regionData.id as string;
                const {error: deletePlantsError} = await supabase
                    .from("regions_plants")
                    .delete()
                    .eq("region_id", regionId);
                if (deletePlantsError) return new Response(JSON.stringify({error: deletePlantsError.message}), {status: 400, headers: corsHeaders});
                const {error: deleteRegionError} = await supabase
                    .from("regions")
                    .delete()
                    .eq("region_code", regionCode);
                if (deleteRegionError) return new Response(JSON.stringify({error: deleteRegionError.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "fetch-region-plants": {
                let body: any;
                try { body = await req.json(); } catch { return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {status: 400, headers: corsHeaders}); }
                const {regionCode} = body || {};
                if (typeof regionCode !== "string" || !regionCode) return new Response(JSON.stringify({error: "Region code is required"}), {status: 400, headers: corsHeaders});
                const {data: regionData, error: regionError} = await supabase
                    .from("regions")
                    .select("id")
                    .eq("region_code", regionCode)
                    .maybeSingle();
                if (regionError || !regionData) return new Response(JSON.stringify({error: regionError?.message || "Region not found"}), {status: 400, headers: corsHeaders});
                const regionId = regionData.id as string;
                const {data, error} = await supabase
                    .from("regions_plants")
                    .select("plant_code, plants!inner(plant_code, plant_name)")
                    .eq("region_id", regionId);
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                const out = (data ?? []).map((row: any) => ({plant_code: row.plants?.plant_code ?? row.plant_code, plant_name: row.plants?.plant_name ?? null}));
                return new Response(JSON.stringify({data: out}), {headers: corsHeaders});
            }
            default:
                return new Response(JSON.stringify({error: "Invalid endpoint", path: url.pathname}), {status: 404, headers: corsHeaders});
        }
    } catch (error) {
        return new Response(JSON.stringify({error: "Internal server error", message: (error as Error).message}), {status: 500, headers: corsHeaders});
    }
});

