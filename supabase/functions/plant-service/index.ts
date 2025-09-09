// @ts-ignore
import {createClient} from "npm:@supabase/supabase-js@2.45.4";

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

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return handleOptions();
    }
    try {
        const url = new URL(req.url);
        const endpoint = url.pathname.split("/").pop();
        const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
            global: {
                headers: {
                    Authorization: req.headers.get("Authorization") || ""
                }
            }
        });
        switch (endpoint) {
            case "fetch-all": {
                const {data, error} = await supabase.from("plants").select("*").order("plant_code");
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "fetch-by-code": {
                let body;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {plantCode} = body || {};
                if (!plantCode) return new Response(JSON.stringify({error: "Plant code is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data,
                    error
                } = await supabase.from("plants").select("*").eq("plant_code", plantCode).maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? null}), {headers: corsHeaders});
            }
            case "create": {
                let body;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                let {plantCode, plantName} = body || {};
                plantCode = typeof plantCode === "string" ? plantCode.trim() : "";
                plantName = typeof plantName === "string" ? plantName.trim() : "";
                if (!plantCode || !plantName) return new Response(JSON.stringify({error: "Plant code and name are required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const now = new Date().toISOString();
                const plant = {plant_code: plantCode, plant_name: plantName, created_at: now, updated_at: now};
                const {error} = await supabase.from("plants").insert(plant);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "update": {
                let body;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                let {plantCode, plantName} = body || {};
                plantCode = typeof plantCode === "string" ? plantCode.trim() : "";
                plantName = typeof plantName === "string" ? plantName.trim() : "";
                if (!plantCode || !plantName) return new Response(JSON.stringify({error: "Plant code and name are required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {error} = await supabase.from("plants").update({
                    plant_name: plantName,
                    updated_at: new Date().toISOString()
                }).eq("plant_code", plantCode);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "delete": {
                let body;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {plantCode} = body || {};
                if (!plantCode) return new Response(JSON.stringify({error: "Plant code is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const [{error: profilesError}, {error}] = await Promise.all([
                    supabase.from("users_profiles").update({
                        plant_code: "",
                        updated_at: new Date().toISOString()
                    }).eq("plant_code", plantCode),
                    supabase.from("plants").delete().eq("plant_code", plantCode)
                ]);
                if (profilesError || error) return new Response(JSON.stringify({error: (profilesError || error)?.message || "Unknown error"}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "get-with-regions": {
                let body;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {plantCode} = body || {};
                if (!plantCode) return new Response(JSON.stringify({error: "Plant code is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data: plant,
                    error: plantError
                } = await supabase.from("plants").select("*").eq("plant_code", plantCode).maybeSingle();
                if (plantError) return new Response(JSON.stringify({error: plantError.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!plant) return new Response(JSON.stringify({plant: null, regions: []}), {headers: corsHeaders});
                let regionIds: number[] = [];
                const {
                    data: regionPlants,
                    error: regionPlantsError
                } = await supabase.from("region_plants").select("region_id").eq("plant_code", plantCode);
                if (regionPlantsError) return new Response(JSON.stringify({error: regionPlantsError.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                regionIds = (regionPlants ?? []).map((rp: { region_id: number }) => rp.region_id);
                if (!regionIds.length) {
                    const {
                        data: regionPlants2,
                        error: regionPlantsError2
                    } = await supabase.from("regions_plants").select("region_id").eq("plant_code", plantCode);
                    if (regionPlantsError2) return new Response(JSON.stringify({error: regionPlantsError2.message}), {
                        status: 400,
                        headers: corsHeaders
                    });
                    regionIds = (regionPlants2 ?? []).map((rp: { region_id: number }) => rp.region_id);
                }
                if (!regionIds.length) return new Response(JSON.stringify({
                    plant,
                    regions: []
                }), {headers: corsHeaders});
                const {
                    data: regions,
                    error: regionsError
                } = await supabase.from("regions").select("*").in("id", regionIds);
                if (regionsError) return new Response(JSON.stringify({error: regionsError.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({plant, regions: regions ?? []}), {headers: corsHeaders});
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
