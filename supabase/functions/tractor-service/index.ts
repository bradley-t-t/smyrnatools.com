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

function toDbTimestamp(v: any) {
    if (!v) return null;
    if (typeof v === "string") return v;
    if (v instanceof Date) return v.toISOString();
    return null;
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
                const {
                    data,
                    error
                } = await supabase.from("tractors").select("*").order("truck_number", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                let latestMap: Record<string, string> = {};
                let issuesMap: Record<string, number> = {};
                let commentsMap: Record<string, number> = {};
                try {
                    const {data: hist} = await supabase
                        .from("tractors_history")
                        .select("tractor_id, changed_at")
                        .order("changed_at", {ascending: false});
                    for (const h of hist || []) if (!latestMap[(h as any).tractor_id]) latestMap[(h as any).tractor_id] = (h as any).changed_at;
                } catch {
                }
                try {
                    const {data: openIssues} = await supabase
                        .from("tractors_maintenance")
                        .select("tractor_id, time_completed").is("time_completed", null);
                    for (const row of openIssues || []) {
                        const id = (row as any).tractor_id;
                        issuesMap[id] = (issuesMap[id] || 0) + 1;
                    }
                } catch {
                }
                try {
                    const {data: comments} = await supabase
                        .from("tractors_comments")
                        .select("tractor_id");
                    for (const row of comments || []) {
                        const id = (row as any).tractor_id;
                        commentsMap[id] = (commentsMap[id] || 0) + 1;
                    }
                } catch {
                }
                const enriched = (data || []).map((m: any) => ({
                    ...m,
                    latestHistoryDate: latestMap[m.id] ?? null,
                    openIssuesCount: issuesMap[m.id] ?? 0,
                    commentsCount: commentsMap[m.id] ?? 0
                }));
                return new Response(JSON.stringify({data: enriched}), {headers: corsHeaders});
            }
            case "fetch-by-id": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const id = typeof body?.id === "string" ? body.id : null;
                if (!id) return new Response(JSON.stringify({error: "Tractor ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {data, error} = await supabase.from("tractors").select("*").eq("id", id).maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!data) return new Response(JSON.stringify({data: null}), {headers: corsHeaders});
                const {data: hist, error: histErr} = await supabase
                    .from("tractors_history")
                    .select("changed_at")
                    .eq("tractor_id", id)
                    .order("changed_at", {ascending: false})
                    .limit(1)
                    .maybeSingle();
                if (histErr) return new Response(JSON.stringify({error: histErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({
                    data: {
                        ...data,
                        latestHistoryDate: hist?.changed_at ?? null
                    }
                }), {headers: corsHeaders});
            }
            case "fetch-active": {
                const {
                    data,
                    error
                } = await supabase.from("tractors").select("*").eq("status", "Active").order("truck_number", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "fetch-history": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const tractorId = typeof body?.tractorId === "string" ? body.tractorId : null;
                const limit = Number.isInteger(body?.limit) ? body.limit : null;
                if (!tractorId) return new Response(JSON.stringify({error: "Tractor ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                let query = supabase.from("tractors_history").select("*").eq("tractor_id", tractorId).order("changed_at", {ascending: false});
                if (limit && limit > 0) query = query.limit(limit);
                const {data, error} = await query;
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
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
                const tractor = body?.tractor || body;
                const userId = typeof body?.userId === "string" && body.userId ? body.userId : null;
                if (!userId) return new Response(JSON.stringify({error: "User ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const now = nowIso();
                const apiData: Record<string, any> = {
                    truck_number: tractor?.truckNumber ?? tractor?.truck_number,
                    assigned_plant: tractor?.assignedPlant ?? tractor?.assigned_plant,
                    assigned_operator: tractor?.assignedOperator ?? tractor?.assigned_operator ?? null,
                    last_service_date: toDbTimestamp(tractor?.lastServiceDate ?? tractor?.last_service_date),
                    cleanliness_rating: typeof tractor?.cleanlinessRating === "number" ? tractor.cleanlinessRating : (typeof tractor?.cleanliness_rating === "number" ? tractor.cleanliness_rating : 0),
                    has_blower: typeof tractor?.hasBlower === "boolean" ? tractor.hasBlower : (typeof tractor?.has_blower === "boolean" ? tractor.has_blower : null),
                    vin: tractor?.vin ?? null,
                    make: tractor?.make ?? null,
                    model: tractor?.model ?? null,
                    year: tractor?.year ?? null,
                    freight: typeof tractor?.freight === "string" ? tractor.freight : null,
                    status: tractor?.status ?? "Active",
                    created_at: now,
                    updated_at: now,
                    updated_by: userId
                };
                const {data, error} = await supabase.from("tractors").insert([apiData]).select().maybeSingle();
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
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const id = typeof body?.tractorId === "string" ? body.tractorId : (typeof body?.id === "string" ? body.id : null);
                const tractor = body?.tractor || body?.data || body;
                let userId = typeof body?.userId === "string" && body.userId ? body.userId : null;
                if (!id) return new Response(JSON.stringify({error: "Tractor ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!userId) return new Response(JSON.stringify({error: "User ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data: current,
                    error: currentErr
                } = await supabase.from("tractors").select("*").eq("id", id).maybeSingle();
                if (currentErr) return new Response(JSON.stringify({error: currentErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!current) return new Response(JSON.stringify({error: "Tractor not found"}), {
                    status: 404,
                    headers: corsHeaders
                });
                let assignedOperator = tractor?.assignedOperator ?? null;
                let status = tractor?.status ?? current.status;
                if ((!assignedOperator || assignedOperator === "" || assignedOperator === "0") && status === "Active") status = "Spare";
                if (assignedOperator && status !== "Active") status = "Active";
                if (["In Shop", "Retired", "Spare"].includes(status) && assignedOperator) assignedOperator = null;
                const apiData: Record<string, any> = {
                    truck_number: tractor?.truckNumber ?? current.truck_number,
                    assigned_plant: tractor?.assignedPlant ?? current.assigned_plant,
                    assigned_operator: assignedOperator,
                    last_service_date: toDbTimestamp(tractor?.lastServiceDate) ?? current.last_service_date,
                    cleanliness_rating: typeof tractor?.cleanlinessRating === "number" ? tractor.cleanlinessRating : current.cleanliness_rating,
                    has_blower: typeof tractor?.hasBlower === "boolean" ? tractor.hasBlower : current.has_blower,
                    vin: tractor?.vin ?? current.vin,
                    make: tractor?.make ?? current.make,
                    model: tractor?.model ?? current.model,
                    year: typeof tractor?.year === "number" ? tractor.year : current.year,
                    freight: typeof tractor?.freight === "string" ? tractor.freight : current.freight,
                    status,
                    updated_at: nowIso(),
                    updated_by: userId,
                    updated_last: typeof tractor?.updatedLast === "string" ? tractor.updatedLast : current.updated_last
                };
                const {
                    data,
                    error
                } = await supabase.from("tractors").update(apiData).eq("id", id).select().maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const diffs: Array<{
                    tractor_id: string;
                    field_name: string;
                    old_value: string | null;
                    new_value: string | null;
                    changed_at: string;
                    changed_by: string;
                }> = [];
                const allowedFieldNames = new Set([
                    "truck_number",
                    "assigned_plant",
                    "assigned_operator",
                    "last_service_date",
                    "cleanliness_rating",
                    "has_blower",
                    "vin",
                    "make",
                    "model",
                    "year",
                    "freight",
                    "status"
                ]);
                const fields = [
                    {field: "truckNumber", db: "truck_number"},
                    {field: "assignedPlant", db: "assigned_plant"},
                    {field: "assignedOperator", db: "assigned_operator"},
                    {field: "lastServiceDate", db: "last_service_date", type: "date"},
                    {field: "cleanlinessRating", db: "cleanliness_rating", type: "number"},
                    {field: "hasBlower", db: "has_blower"},
                    {field: "vin", db: "vin"},
                    {field: "make", db: "make"},
                    {field: "model", db: "model"},
                    {field: "year", db: "year", type: "number"},
                    {field: "status", db: "status"},
                    {field: "freight", db: "freight"}
                ];
                for (const f of fields) {
                    if (!allowedFieldNames.has(f.db)) continue;
                    const beforeVal = (current as any)[f.db];
                    const afterVal = (apiData as any)[f.db];
                    const norm = (v: any) => v === undefined ? null : (v === null ? null : (f.type === "date" ? toDbTimestamp(v) : (f.type === "number" ? (typeof v === "number" ? String(v) : String(Number(v))) : String(v))));
                    const b = norm(beforeVal);
                    const a = norm(afterVal);
                    const changed = f.type === "number" ? (Number(b) !== Number(a)) : (String(b ?? "") !== String(a ?? ""));
                    if (changed) diffs.push({
                        tractor_id: id,
                        field_name: f.db,
                        old_value: b ?? null,
                        new_value: a ?? null,
                        changed_at: nowIso(),
                        changed_by: userId
                    });
                }
                if (diffs.length) {
                    const {error: histErr} = await supabase.from("tractors_history").insert(diffs);
                    if (histErr) {
                        let failedField = null;
                        if (diffs.length === 1) failedField = diffs[0].field_name + ':' + diffs[0].new_value;
                        return new Response(JSON.stringify({error: histErr.message, failedField}), {
                            status: 400,
                            headers: corsHeaders
                        });
                    }
                }
                return new Response(JSON.stringify({data}), {headers: corsHeaders});
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
                const id = typeof body?.id === "string" ? body.id : null;
                if (!id) return new Response(JSON.stringify({error: "Tractor ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {error: hErr} = await supabase.from("tractors_history").delete().eq("tractor_id", id);
                if (hErr) return new Response(JSON.stringify({error: hErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {error} = await supabase.from("tractors").delete().eq("id", id);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "fetch-comments": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const tractorId = typeof body?.tractorId === "string" ? body.tractorId : null;
                if (!tractorId) return new Response(JSON.stringify({error: "Tractor ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data,
                    error
                } = await supabase.from("tractors_comments").select("*").eq("tractor_id", tractorId).order("created_at", {ascending: false});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "add-comment": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const tractorId = typeof body?.tractorId === "string" ? body.tractorId : null;
                const text = typeof body?.text === "string" ? body.text.trim() : "";
                const author = typeof body?.author === "string" ? body.author.trim() : "";
                if (!tractorId) return new Response(JSON.stringify({error: "Tractor ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!text) return new Response(JSON.stringify({error: "Comment text is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!author) return new Response(JSON.stringify({error: "Author is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const comment = {tractor_id: tractorId, text, author, created_at: nowIso()};
                const {data, error} = await supabase.from("tractors_comments").insert([comment]).select().maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data}), {headers: corsHeaders});
            }
            case "delete-comment": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const commentId = typeof body?.commentId === "string" ? body.commentId : null;
                if (!commentId) return new Response(JSON.stringify({error: "Comment ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {error} = await supabase.from("tractors_comments").delete().eq("id", commentId);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "fetch-issues": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const tractorId = typeof body?.tractorId === "string" ? body.tractorId : null;
                if (!tractorId) return new Response(JSON.stringify({error: "Tractor ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data,
                    error
                } = await supabase.from("tractors_maintenance").select("*").eq("tractor_id", tractorId).order("time_created", {ascending: false});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "add-issue": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const tractorId = typeof body?.tractorId === "string" ? body.tractorId : null;
                const issue = typeof body?.issue === "string" ? body.issue.trim() : "";
                const severityIn = typeof body?.severity === "string" ? body.severity : "";
                if (!tractorId) return new Response(JSON.stringify({error: "Tractor ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!issue) return new Response(JSON.stringify({error: "Issue description is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const allowed = ["Low", "Medium", "High"];
                const severity = allowed.includes(severityIn) ? severityIn : "Medium";
                const id = crypto.randomUUID();
                const {data, error} = await supabase.from("tractors_maintenance").insert({
                    id,
                    tractor_id: tractorId,
                    issue,
                    severity,
                    time_created: nowIso()
                }).select().maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data}), {headers: corsHeaders});
            }
            case "complete-issue": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const issueId = typeof body?.issueId === "string" ? body.issueId : null;
                if (!issueId) return new Response(JSON.stringify({error: "Issue ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {error} = await supabase.from("tractors_maintenance").update({time_completed: nowIso()}).eq("id", issueId);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "delete-issue": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const issueId = typeof body?.issueId === "string" ? body.issueId : null;
                if (!issueId) return new Response(JSON.stringify({error: "Issue ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    error,
                    count
                } = await supabase.from("tractors_maintenance").delete({count: "exact"}).eq("id", issueId);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!count) return new Response(JSON.stringify({error: "Issue not found or already deleted"}), {
                    status: 404,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "fetch-by-operator": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const operatorId = typeof body?.operatorId === "string" ? body.operatorId : null;
                if (!operatorId) return new Response(JSON.stringify({error: "Operator ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data,
                    error
                } = await supabase.from("tractors").select("*").eq("assigned_operator", operatorId).order("truck_number", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "fetch-by-status": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const status = typeof body?.status === "string" ? body.status : null;
                if (!status) return new Response(JSON.stringify({error: "Status is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data,
                    error
                } = await supabase.from("tractors").select("*").eq("status", status).order("truck_number", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "search-by-truck-number": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const query = typeof body?.query === "string" ? body.query.trim() : "";
                if (!query) return new Response(JSON.stringify({error: "Search query is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data,
                    error
                } = await supabase.from("tractors").select("*").ilike("truck_number", `%${query}%`).order("truck_number", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "fetch-needing-service": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const dayThreshold = Number.isInteger(body?.dayThreshold) ? body.dayThreshold : 30;
                const {
                    data,
                    error
                } = await supabase.from("tractors").select("*").order("truck_number", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const now = new Date();
                const thresholdDate = new Date(now.getTime() - dayThreshold * 24 * 60 * 60 * 1000);
                const filtered = (data ?? []).filter((tractor: any) => {
                    if (!tractor.last_service_date) return true;
                    const lastService = new Date(tractor.last_service_date);
                    return lastService < thresholdDate;
                });
                return new Response(JSON.stringify({data: filtered}), {headers: corsHeaders});
            }
            case "fetch-cleanliness-history": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const tractorId = typeof body?.tractorId === "string" ? body.tractorId : null;
                const months = Number.isInteger(body?.months) ? body.months : 6;
                const threshold = new Date();
                threshold.setMonth(threshold.getMonth() - months);
                let query = supabase
                    .from("tractors_history")
                    .select("*")
                    .eq("field_name", "cleanliness_rating")
                    .gte("changed_at", threshold.toISOString())
                    .order("changed_at", {ascending: true})
                    .limit(200);
                if (tractorId) query = query.eq("tractor_id", tractorId);
                const {data, error} = await query;
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "add-history": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const tractorId = typeof body?.tractorId === "string" ? body.tractorId : null;
                const fieldName = typeof body?.fieldName === "string" ? body.fieldName : null;
                const oldValue = body?.oldValue == null ? null : String(body.oldValue);
                const newValue = body?.newValue == null ? null : String(body.newValue);
                const changedBy = typeof body?.changedBy === "string" && body.changedBy ? body.changedBy : null;
                if (!tractorId) return new Response(JSON.stringify({error: "Tractor ID is required"}), {status: 400, headers: corsHeaders});
                if (!fieldName) return new Response(JSON.stringify({error: "Field name required"}), {status: 400, headers: corsHeaders});
                let userId = changedBy;
                if (!userId) userId = (req.headers.get("X-User-Id") || "00000000-0000-0000-0000-000000000000");
                const record = {
                    tractor_id: tractorId,
                    field_name: fieldName,
                    old_value: oldValue,
                    new_value: newValue,
                    changed_at: nowIso(),
                    changed_by: userId
                };
                const {data, error} = await supabase.from("tractors_history").insert(record).select().maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({data}), {headers: corsHeaders});
            }
            case "verify": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const id = typeof body?.id === "string" ? body.id : (typeof body?.tractorId === "string" ? body.tractorId : null);
                let userId = typeof body?.userId === "string" && body.userId ? body.userId : (req.headers.get("X-User-Id") || null);
                if (!id) return new Response(JSON.stringify({error: "Tractor ID is required"}), {status: 400, headers: corsHeaders});
                if (!userId) return new Response(JSON.stringify({error: "User ID is required"}), {status: 400, headers: corsHeaders});
                const {data, error} = await supabase.from("tractors").update({
                    updated_last: nowIso(),
                    updated_by: userId
                }).eq("id", id).select().maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {status: 400, headers: corsHeaders});
                return new Response(JSON.stringify({data}), {headers: corsHeaders});
            }
            default:
                return new Response(JSON.stringify({error: "Unknown endpoint"}), {
                    status: 404,
                    headers: corsHeaders
                });
        }
    } catch (e) {
        return new Response(JSON.stringify({error: e.message}), {
            status: 500,
            headers: corsHeaders
        });
    }
});
