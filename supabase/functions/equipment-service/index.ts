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
                } = await supabase.from("heavy_equipment").select("*").order("identifying_number", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const latestMap: Record<string, string> = {};
                const {data: hist} = await supabase.from("heavy_equipment_history").select("equipment_id, changed_at").order("changed_at", {ascending: false});
                for (const h of hist || []) {
                    const id = (h as any).equipment_id;
                    const at = (h as any).changed_at;
                    if (!latestMap[id]) latestMap[id] = at;
                }
                const issuesMap: Record<string, number> = {};
                const {data: openIssues} = await supabase.from("heavy_equipment_maintenance").select("equipment_id, time_completed").is("time_completed", null);
                for (const row of openIssues || []) {
                    const id = (row as any).equipment_id;
                    issuesMap[id] = (issuesMap[id] || 0) + 1;
                }
                const commentsMap: Record<string, number> = {};
                const {data: comments} = await supabase.from("heavy_equipment_comments").select("equipment_id");
                for (const row of comments || []) {
                    const id = (row as any).equipment_id;
                    commentsMap[id] = (commentsMap[id] || 0) + 1;
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
                if (!id) return new Response(JSON.stringify({error: "Equipment ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {data, error} = await supabase.from("heavy_equipment").select("*").eq("id", id).maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!data) return new Response(JSON.stringify({data: null}), {headers: corsHeaders});
                const {
                    data: hist,
                    error: histErr
                } = await supabase.from("heavy_equipment_history").select("changed_at").eq("equipment_id", id).order("changed_at", {ascending: false}).limit(1).maybeSingle();
                if (histErr) return new Response(JSON.stringify({error: histErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({
                    data: {
                        ...data,
                        latestHistoryDate: (hist as any)?.changed_at ?? null
                    }
                }), {headers: corsHeaders});
            }
            case "fetch-active": {
                const {
                    data,
                    error
                } = await supabase.from("heavy_equipment").select("*").eq("status", "Active").order("identifying_number", {ascending: true});
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
                const equipmentId = typeof body?.equipmentId === "string" ? body.equipmentId : null;
                const limit = Number.isInteger(body?.limit) ? body.limit : null;
                if (!equipmentId) return new Response(JSON.stringify({error: "Equipment ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                let query = supabase.from("heavy_equipment_history").select("*").eq("equipment_id", equipmentId).order("changed_at", {ascending: false});
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
                const equipment = body?.equipment || body;
                const userId = typeof body?.userId === "string" && body.userId ? body.userId : null;
                if (!userId) return new Response(JSON.stringify({error: "User ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const now = nowIso();
                const apiData: Record<string, any> = {
                    identifying_number: equipment?.identifyingNumber ?? equipment?.identifying_number,
                    assigned_plant: equipment?.assignedPlant ?? equipment?.assigned_plant,
                    equipment_type: equipment?.equipmentType ?? equipment?.equipment_type,
                    status: equipment?.status ?? "Active",
                    last_service_date: toDbTimestamp(equipment?.lastServiceDate ?? equipment?.last_service_date),
                    hours_mileage: equipment?.hoursMileage != null ? Number(equipment.hoursMileage) : (equipment?.hours_mileage != null ? Number(equipment.hours_mileage) : null),
                    cleanliness_rating: equipment?.cleanlinessRating != null ? Number(equipment.cleanlinessRating) : (equipment?.cleanliness_rating != null ? Number(equipment.cleanliness_rating) : null),
                    condition_rating: equipment?.conditionRating != null ? Number(equipment.conditionRating) : (equipment?.condition_rating != null ? Number(equipment.condition_rating) : null),
                    equipment_make: equipment?.equipmentMake ?? equipment?.equipment_make ?? null,
                    equipment_model: equipment?.equipmentModel ?? equipment?.equipment_model ?? null,
                    year_made: equipment?.yearMade != null ? Number(equipment.yearMade) : (equipment?.year_made != null ? Number(equipment.year_made) : null),
                    created_at: now,
                    updated_at: now,
                    updated_by: userId
                };
                const {data, error} = await supabase.from("heavy_equipment").insert([apiData]).select().maybeSingle();
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
                const id = typeof body?.equipmentId === "string" ? body.equipmentId : (typeof body?.id === "string" ? body.id : null);
                const equipment = body?.equipment || body?.data || body;
                let userId = typeof body?.userId === "string" && body.userId ? body.userId : null;
                if (!id) return new Response(JSON.stringify({error: "Equipment ID is required"}), {
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
                } = await supabase.from("heavy_equipment").select("*").eq("id", id).maybeSingle();
                if (currentErr) return new Response(JSON.stringify({error: currentErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!current) return new Response(JSON.stringify({error: "Equipment not found"}), {
                    status: 404,
                    headers: corsHeaders
                });
                const apiData: Record<string, any> = {
                    identifying_number: equipment?.identifyingNumber ?? current.identifying_number,
                    assigned_plant: equipment?.assignedPlant ?? current.assigned_plant,
                    equipment_type: equipment?.equipmentType ?? current.equipment_type,
                    status: equipment?.status ?? current.status,
                    last_service_date: toDbTimestamp(equipment?.lastServiceDate) ?? current.last_service_date,
                    hours_mileage: equipment?.hoursMileage != null ? Number(equipment.hoursMileage) : current.hours_mileage,
                    cleanliness_rating: equipment?.cleanlinessRating != null ? Number(equipment.cleanlinessRating) : current.cleanliness_rating,
                    condition_rating: equipment?.conditionRating != null ? Number(equipment.conditionRating) : current.condition_rating,
                    equipment_make: equipment?.equipmentMake ?? current.equipment_make,
                    equipment_model: equipment?.equipmentModel ?? current.equipment_model,
                    year_made: equipment?.yearMade != null ? Number(equipment.yearMade) : current.year_made,
                    updated_at: nowIso(),
                    updated_by: userId
                };
                const {
                    data,
                    error
                } = await supabase.from("heavy_equipment").update(apiData).eq("id", id).select().maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const diffs: Array<{
                    equipment_id: string;
                    field_name: string;
                    old_value: string | null;
                    new_value: string | null;
                    changed_at: string;
                    changed_by: string;
                }> = [];
                const fields = [
                    {db: "identifying_number"},
                    {db: "assigned_plant"},
                    {db: "equipment_type"},
                    {db: "status"},
                    {db: "last_service_date", type: "date"},
                    {db: "hours_mileage", type: "number"},
                    {db: "cleanliness_rating", type: "number"},
                    {db: "condition_rating", type: "number"},
                    {db: "equipment_make"},
                    {db: "equipment_model"},
                    {db: "year_made", type: "number"}
                ];
                for (const f of fields) {
                    const beforeVal = (current as any)[f.db];
                    const afterVal = (apiData as any)[f.db];
                    const norm = (v: any) => v === undefined ? null : (v === null ? null : (f.type === "date" ? toDbTimestamp(v) : (f.type === "number" ? (typeof v === "number" ? v : Number(v)) : v)));
                    const b = norm(beforeVal);
                    const a = norm(afterVal);
                    const changed = f.type === "number" ? (Number(b) !== Number(a)) : (String(b ?? "") !== String(a ?? ""));
                    if (changed) diffs.push({
                        equipment_id: id,
                        field_name: f.db,
                        old_value: b?.toString?.() ?? null,
                        new_value: a?.toString?.() ?? null,
                        changed_at: nowIso(),
                        changed_by: userId
                    });
                }
                if (diffs.length) {
                    const {error: histErr} = await supabase.from("heavy_equipment_history").insert(diffs);
                    if (histErr) return new Response(JSON.stringify({error: histErr.message}), {
                        status: 400,
                        headers: corsHeaders
                    });
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
                if (!id) return new Response(JSON.stringify({error: "Equipment ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {error: hErr} = await supabase.from("heavy_equipment_history").delete().eq("equipment_id", id);
                if (hErr) return new Response(JSON.stringify({error: hErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {error} = await supabase.from("heavy_equipment").delete().eq("id", id);
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
                const equipmentId = typeof body?.equipmentId === "string" ? body.equipmentId : null;
                if (!equipmentId) return new Response(JSON.stringify({error: "Equipment ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data,
                    error
                } = await supabase.from("heavy_equipment_comments").select("*").eq("equipment_id", equipmentId).order("created_at", {ascending: false});
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
                const equipmentId = typeof body?.equipmentId === "string" ? body.equipmentId : null;
                const text = typeof body?.text === "string" ? body.text.trim() : "";
                const author = typeof body?.author === "string" ? body.author.trim() : "";
                if (!equipmentId) return new Response(JSON.stringify({error: "Equipment ID is required"}), {
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
                const comment = {equipment_id: equipmentId, text, author, created_at: nowIso()};
                const {
                    data,
                    error
                } = await supabase.from("heavy_equipment_comments").insert([comment]).select().maybeSingle();
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
                const {error} = await supabase.from("heavy_equipment_comments").delete().eq("id", commentId);
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
                const equipmentId = typeof body?.equipmentId === "string" ? body.equipmentId : null;
                if (!equipmentId) return new Response(JSON.stringify({error: "Equipment ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data,
                    error
                } = await supabase.from("heavy_equipment_maintenance").select("*").eq("equipment_id", equipmentId).order("time_created", {ascending: false});
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
                const equipmentId = typeof body?.equipmentId === "string" ? body.equipmentId : null;
                const issue = typeof body?.issue === "string" ? body.issue.trim() : "";
                const severityIn = typeof body?.severity === "string" ? body.severity : "";
                if (!equipmentId) return new Response(JSON.stringify({error: "Equipment ID is required"}), {
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
                const {data, error} = await supabase.from("heavy_equipment_maintenance").insert({
                    id,
                    equipment_id: equipmentId,
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
                const {error} = await supabase.from("heavy_equipment_maintenance").update({time_completed: nowIso()}).eq("id", issueId);
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
                } = await supabase.from("heavy_equipment_maintenance").delete({count: "exact"}).eq("id", issueId);
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
                } = await supabase.from("heavy_equipment").select("*").eq("status", status).order("identifying_number", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "search-by-identifying-number": {
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
                } = await supabase.from("heavy_equipment").select("*").ilike("identifying_number", `%${query}%`).order("identifying_number", {ascending: true});
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
                } = await supabase.from("heavy_equipment").select("*").order("identifying_number", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const thresholdDate = new Date();
                thresholdDate.setDate(thresholdDate.getDate() - dayThreshold);
                const filtered = (data || []).filter((m: any) => !m.last_service_date || new Date(m.last_service_date) < thresholdDate);
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
                const equipmentId = typeof body?.equipmentId === "string" ? body.equipmentId : null;
                const months = Number.isInteger(body?.months) ? body.months : 6;
                const threshold = new Date();
                threshold.setMonth(threshold.getMonth() - months);
                let query = supabase.from("heavy_equipment_history").select("*").eq("field_name", "cleanliness_rating").gte("changed_at", threshold.toISOString()).order("changed_at", {ascending: true}).limit(200);
                if (equipmentId) query = query.eq("equipment_id", equipmentId);
                const {data, error} = await query;
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "fetch-condition-history": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const equipmentId = typeof body?.equipmentId === "string" ? body.equipmentId : null;
                const months = Number.isInteger(body?.months) ? body.months : 6;
                const threshold = new Date();
                threshold.setMonth(threshold.getMonth() - months);
                let query = supabase.from("heavy_equipment_history").select("*").eq("field_name", "condition_rating").gte("changed_at", threshold.toISOString()).order("changed_at", {ascending: true}).limit(200);
                if (equipmentId) query = query.eq("equipment_id", equipmentId);
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
                const equipmentId = typeof body?.equipmentId === "string" ? body.equipmentId : null;
                const fieldName = typeof body?.fieldName === "string" ? body.fieldName : null;
                const oldValue = body?.oldValue == null ? null : String(body.oldValue);
                const newValue = body?.newValue == null ? null : String(body.newValue);
                const changedBy = typeof body?.changedBy === "string" && body.changedBy ? body.changedBy : null;
                if (!equipmentId) return new Response(JSON.stringify({error: "Equipment ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!fieldName) return new Response(JSON.stringify({error: "Field name required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                let userId = changedBy;
                if (!userId) userId = (req.headers.get("X-User-Id") || "00000000-0000-0000-0000-000000000000");
                const record = {
                    equipment_id: equipmentId,
                    field_name: fieldName,
                    old_value: oldValue,
                    new_value: newValue,
                    changed_at: nowIso(),
                    changed_by: userId
                };
                const {
                    data,
                    error
                } = await supabase.from("heavy_equipment_history").insert(record).select().maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data}), {headers: corsHeaders});
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
