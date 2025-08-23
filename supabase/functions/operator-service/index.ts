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
            case "list": {
                const {data, error} = await supabase.from("operators").select("*").order("name");
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "list-active": {
                const {data, error} = await supabase.from("operators").select("*").eq("status", "Active").order("name");
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "list-by-plant": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    body = {};
                }
                const plantCode = typeof body?.plantCode === "string" ? body.plantCode : null;
                if (!plantCode) return new Response(JSON.stringify({error: "Plant code is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {data, error} = await supabase
                    .from("operators")
                    .select("*")
                    .eq("plant_code", plantCode)
                    .eq("position", "Mixer Operator")
                    .order("name");
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "list-tractor": {
                const {data, error} = await supabase
                    .from("operators")
                    .select("*")
                    .eq("position", "Tractor Operator")
                    .order("name");
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "list-trainers": {
                const {data, error} = await supabase.from("operators").select("*").eq("is_trainer", true).order("name");
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "fetch-operators": {
                const [{data: activeData, error: activeError}, {
                    data: otherData,
                    error: otherError
                }] = await Promise.all([
                    supabase.from("operators").select("*").eq("status", "Active").order("name"),
                    supabase.from("operators").select("*").not("status", "eq", "Active").order("name")
                ]);
                if (activeError || otherError) {
                    const err = activeError ?? otherError;
                    return new Response(JSON.stringify({error: err?.message || "Failed to fetch operators"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const combined = [...(activeData ?? []), ...(otherData ?? [])];
                return new Response(JSON.stringify({data: combined}), {headers: corsHeaders});
            }
            case "get-by-employee-id": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    body = {};
                }
                const employeeId = typeof body?.employeeId === "string" ? body.employeeId : null;
                if (!employeeId) return new Response(JSON.stringify({error: "Invalid Employee ID"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data,
                    error
                } = await supabase.from("operators").select("*").eq("employee_id", employeeId).single();
                if (error || !data) return new Response(JSON.stringify({data: null}), {headers: corsHeaders});
                return new Response(JSON.stringify({data}), {headers: corsHeaders});
            }
            case "create": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    body = {};
                }
                const input = body?.operator ?? body;
                const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
                let employee_id = typeof input?.employee_id === "string" && input.employee_id ? input.employee_id : crypto.randomUUID();
                const row = {
                    employee_id,
                    smyrna_id: input?.smyrna_id ?? null,
                    name: typeof input?.name === "string" ? input.name.trim() : "",
                    plant_code: input?.plant_code ?? null,
                    status: input?.status ?? "Active",
                    is_trainer: input?.is_trainer === true || String(input?.is_trainer).toLowerCase() === "true",
                    assigned_trainer: input?.assigned_trainer ?? null,
                    position: input?.position ?? null,
                    created_at: input?.created_at ?? now,
                    updated_at: now,
                    pending_start_date: input?.pending_start_date ?? null
                };
                const {data, error} = await supabase.from("operators").insert(row).select("*").single();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data}), {headers: corsHeaders});
            }
            case "update": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    body = {};
                }
                const input = body?.operator ?? body;
                const employeeId = typeof input?.employee_id === "string" ? input.employee_id : null;
                if (!employeeId) return new Response(JSON.stringify({error: "Invalid Employee ID"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
                const updateObj: Record<string, any> = {
                    smyrna_id: input?.smyrna_id ?? null,
                    name: typeof input?.name === "string" ? input.name.trim() : "",
                    plant_code: input?.plant_code ?? null,
                    status: input?.status ?? "Active",
                    is_trainer: input?.is_trainer === true || String(input?.is_trainer).toLowerCase() === "true",
                    assigned_trainer: input?.assigned_trainer ?? null,
                    position: input?.position ?? null,
                    created_at: input?.created_at ?? undefined,
                    updated_at: now,
                    pending_start_date: input?.pending_start_date ?? null
                };
                Object.keys(updateObj).forEach((k) => updateObj[k] === undefined && delete updateObj[k]);
                const {data, error} = await supabase
                    .from("operators")
                    .update(updateObj)
                    .eq("employee_id", employeeId)
                    .select("*")
                    .maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!data) return new Response(JSON.stringify({error: "Operator not found"}), {
                    status: 404,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data}), {headers: corsHeaders});
            }
            case "delete": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    body = {};
                }
                const employeeId = typeof body?.employeeId === "string" ? body.employeeId : null;
                if (!employeeId) return new Response(JSON.stringify({error: "Invalid Employee ID"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data,
                    error
                } = await supabase.from("operators").delete().eq("employee_id", employeeId).select("*");
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!data || data.length === 0) return new Response(JSON.stringify({error: "Operator was not deleted"}), {
                    status: 404,
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
