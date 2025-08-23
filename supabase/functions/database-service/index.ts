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
            case "execute-sql": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    body = {};
                }
                const query = typeof body?.query === "string" ? body.query : null;
                const params = Array.isArray(body?.params) ? body.params : [];
                if (!query) return new Response(JSON.stringify({error: "Query is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {data, error} = await supabase.rpc("execute_sql", {query, params});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "table-exists": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    body = {};
                }
                const tableName = typeof body?.tableName === "string" ? body.tableName : null;
                if (!tableName) return new Response(JSON.stringify({error: "Table name is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const query = `SELECT EXISTS (SELECT
                                              FROM information_schema.tables
                                              WHERE table_schema = 'public' AND table_name = $1) as exists`;
                const {data, error} = await supabase.rpc("execute_sql", {query, params: [tableName]});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const exists = Array.isArray(data) && data[0]?.exists === true;
                return new Response(JSON.stringify({exists}), {headers: corsHeaders});
            }
            case "get-all-records": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    body = {};
                }
                const tableName = typeof body?.tableName === "string" ? body.tableName : null;
                if (!tableName) return new Response(JSON.stringify({error: "Table name is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const query = `SELECT *
                               FROM ${tableName}`;
                const {data, error} = await supabase.rpc("execute_sql", {query, params: []});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "fetch-all": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    body = {};
                }
                const table = typeof body?.table === "string" ? body.table : null;
                const columns = typeof body?.columns === "string" ? body.columns : "*";
                const orderBy = typeof body?.orderBy === "string" ? body.orderBy : "id";
                if (!table) return new Response(JSON.stringify({error: "Table is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {data, error} = await supabase.from(table).select(columns).order(orderBy as any);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "fetch": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    body = {};
                }
                const table = typeof body?.table === "string" ? body.table : null;
                const columns = typeof body?.columns === "string" ? body.columns : "*";
                const filterColumn = typeof body?.filterColumn === "string" ? body.filterColumn : null;
                const value = body?.value;
                if (!table || !filterColumn) return new Response(JSON.stringify({error: "Table and filterColumn are required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {data, error} = await supabase.from(table).select(columns).eq(filterColumn, value as any);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "insert": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    body = {};
                }
                const table = typeof body?.table === "string" ? body.table : null;
                const item = body?.item ?? null;
                if (!table || !item) return new Response(JSON.stringify({error: "Table and item are required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {data, error} = await supabase.from(table).insert(item).select("*");
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "update": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    body = {};
                }
                const table = typeof body?.table === "string" ? body.table : null;
                const filterColumn = typeof body?.filterColumn === "string" ? body.filterColumn : null;
                const value = body?.value;
                const dataUpdate = body?.data ?? null;
                if (!table || !filterColumn || dataUpdate === null) return new Response(JSON.stringify({error: "Missing fields"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {error} = await supabase.from(table).update(dataUpdate).eq(filterColumn, value as any);
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
                    body = {};
                }
                const table = typeof body?.table === "string" ? body.table : null;
                const filterColumn = typeof body?.filterColumn === "string" ? body.filterColumn : null;
                const value = body?.value;
                if (!table || !filterColumn) return new Response(JSON.stringify({error: "Missing fields"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {error} = await supabase.from(table).delete().eq(filterColumn, value as any);
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
