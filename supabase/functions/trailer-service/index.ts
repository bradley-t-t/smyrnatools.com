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
                const {
                    data,
                    error
                } = await supabase.from("trailers").select("*").order("trailer_number", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {data: hist, error: histErr} = await supabase
                    .from("trailers_history")
                    .select("trailer_id, changed_at")
                    .order("changed_at", {ascending: false});
                if (histErr) return new Response(JSON.stringify({error: histErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const latestMap: Record<string, string> = {};
                for (const h of hist || []) if (!latestMap[(h as any).trailer_id]) latestMap[(h as any).trailer_id] = (h as any).changed_at;
                const {data: openIssues, error: issuesErr} = await supabase
                    .from("trailers_maintenance")
                    .select("trailer_id, time_completed").is("time_completed", null);
                if (issuesErr) return new Response(JSON.stringify({error: issuesErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const issuesMap: Record<string, number> = {};
                for (const row of openIssues || []) {
                    const id = (row as any).trailer_id;
                    issuesMap[id] = (issuesMap[id] || 0) + 1;
                }
                const {data: comments, error: commentsErr} = await supabase
                    .from("trailers_comments")
                    .select("trailer_id");
                if (commentsErr) return new Response(JSON.stringify({error: commentsErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const commentsMap: Record<string, number> = {};
                for (const row of comments || []) {
                    const id = (row as any).trailer_id;
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
                if (!id) return new Response(JSON.stringify({error: "Trailer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {data, error} = await supabase.from("trailers").select("*").eq("id", id).maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!data) return new Response(JSON.stringify({data: null}), {headers: corsHeaders});
                const {
                    data: histTop,
                    error: histErr
                } = await supabase.from("trailers_history").select("changed_at").eq("trailer_id", id).order("changed_at", {ascending: false}).limit(1).maybeSingle();
                if (histErr) return new Response(JSON.stringify({error: histErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({
                    data: {
                        ...data,
                        latestHistoryDate: (histTop as any)?.changed_at ?? null
                    }
                }), {headers: corsHeaders});
            }
            case "fetch-active": {
                const {
                    data,
                    error
                } = await supabase.from("trailers").select("*").eq("status", "Active").order("trailer_number", {ascending: true});
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
                const trailerId = typeof body?.trailerId === "string" ? body.trailerId : null;
                const limit = Number.isInteger(body?.limit) ? body.limit : null;
                if (!trailerId) return new Response(JSON.stringify({error: "Trailer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                let query = supabase.from("trailers_history").select("*").eq("trailer_id", trailerId).order("changed_at", {ascending: false});
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
                const trailer = body?.trailer || body;
                const userId = typeof body?.userId === "string" && body.userId ? body.userId : null;
                if (!userId) return new Response(JSON.stringify({error: "User ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const now = nowIso();
                const apiData: Record<string, any> = {
                    trailer_number: trailer?.trailerNumber ?? trailer?.trailer_number,
                    assigned_plant: trailer?.assignedPlant ?? trailer?.assigned_plant,
                    trailer_type: trailer?.trailerType ?? trailer?.trailer_type ?? "Cement",
                    assigned_tractor: trailer?.assignedTractor ?? trailer?.assigned_tractor ?? null,
                    cleanliness_rating: typeof trailer?.cleanlinessRating === "number" ? trailer.cleanlinessRating : (typeof trailer?.cleanliness_rating === "number" ? trailer.cleanliness_rating : 1),
                    status: trailer?.status ?? "Active",
                    created_at: now,
                    updated_at: now,
                    updated_last: trailer?.updatedLast ?? null,
                    updated_by: userId
                };
                const {data, error} = await supabase.from("trailers").insert([apiData]).select().maybeSingle();
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
                const id = typeof body?.trailerId === "string" ? body.trailerId : (typeof body?.id === "string" ? body.id : null);
                const trailer = body?.trailer || body?.data || body;
                let userId = typeof body?.userId === "string" && body.userId ? body.userId : null;
                if (!id) return new Response(JSON.stringify({error: "Trailer ID is required"}), {
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
                } = await supabase.from("trailers").select("*").eq("id", id).maybeSingle();
                if (currentErr) return new Response(JSON.stringify({error: currentErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!current) return new Response(JSON.stringify({error: "Trailer not found"}), {
                    status: 404,
                    headers: corsHeaders
                });
                const apiData: Record<string, any> = {
                    trailer_number: trailer?.trailerNumber ?? current.trailer_number,
                    assigned_plant: trailer?.assignedPlant ?? current.assigned_plant,
                    trailer_type: trailer?.trailerType ?? current.trailer_type,
                    assigned_tractor: trailer?.assignedTractor ?? current.assigned_tractor,
                    cleanliness_rating: typeof trailer?.cleanlinessRating === "number" ? trailer.cleanlinessRating : current.cleanliness_rating,
                    status: trailer?.status ?? current.status,
                    updated_at: nowIso(),
                    updated_by: userId,
                    updated_last: typeof trailer?.updatedLast === "string" ? trailer.updatedLast : current.updated_last
                };
                const {
                    data,
                    error
                } = await supabase.from("trailers").update(apiData).eq("id", id).select().maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const diffs: Array<{
                    trailer_id: string;
                    field_name: string;
                    old_value: string | null;
                    new_value: string | null;
                    changed_at: string;
                    changed_by: string;
                }> = [];
                const fields = [
                    {db: "trailer_number"},
                    {db: "assigned_plant"},
                    {db: "trailer_type"},
                    {db: "assigned_tractor"},
                    {db: "cleanliness_rating", type: "number"},
                    {db: "status"}
                ];
                for (const f of fields) {
                    const beforeVal = (current as any)[f.db];
                    const afterVal = (apiData as any)[f.db];
                    const norm = (v: any) => v === undefined ? null : (v === null ? null : (f.type === "number" ? (typeof v === "number" ? v : Number(v)) : v));
                    const b = norm(beforeVal);
                    const a = norm(afterVal);
                    const changed = f.type === "number" ? (Number(b) !== Number(a)) : (String(b ?? "") !== String(a ?? ""));
                    if (changed) diffs.push({
                        trailer_id: id,
                        field_name: f.db,
                        old_value: b?.toString?.() ?? null,
                        new_value: a?.toString?.() ?? null,
                        changed_at: nowIso(),
                        changed_by: userId
                    });
                }
                if (diffs.length) {
                    const {error: histErr} = await supabase.from("trailers_history").insert(diffs);
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
                if (!id) return new Response(JSON.stringify({error: "Trailer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {error: hErr} = await supabase.from("trailers_history").delete().eq("trailer_id", id);
                if (hErr) return new Response(JSON.stringify({error: hErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {error} = await supabase.from("trailers").delete().eq("id", id);
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
                const trailerId = typeof body?.trailerId === "string" ? body.trailerId : null;
                if (!trailerId) return new Response(JSON.stringify({error: "Trailer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data,
                    error
                } = await supabase.from("trailers_comments").select("*").eq("trailer_id", trailerId).order("created_at", {ascending: false});
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
                const trailerId = typeof body?.trailerId === "string" ? body.trailerId : null;
                const text = typeof body?.text === "string" ? body.text.trim() : "";
                const author = typeof body?.author === "string" ? body.author.trim() : "";
                if (!trailerId) return new Response(JSON.stringify({error: "Trailer ID is required"}), {
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
                const comment = {trailer_id: trailerId, text, author, created_at: nowIso()};
                const {data, error} = await supabase.from("trailers_comments").insert([comment]).select().maybeSingle();
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
                const {error} = await supabase.from("trailers_comments").delete().eq("id", commentId);
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
                const trailerId = typeof body?.trailerId === "string" ? body.trailerId : null;
                if (!trailerId) return new Response(JSON.stringify({error: "Trailer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data,
                    error
                } = await supabase.from("trailers_maintenance").select("*").eq("trailer_id", trailerId).order("time_created", {ascending: false});
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
                const trailerId = typeof body?.trailerId === "string" ? body.trailerId : null;
                const issue = typeof body?.issue === "string" ? body.issue.trim() : "";
                const severityIn = typeof body?.severity === "string" ? body.severity : "";
                if (!trailerId) return new Response(JSON.stringify({error: "Trailer ID is required"}), {
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
                const {data, error} = await supabase.from("trailers_maintenance").insert({
                    id,
                    trailer_id: trailerId,
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
                const {error} = await supabase.from("trailers_maintenance").update({time_completed: nowIso()}).eq("id", issueId);
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
                } = await supabase.from("trailers_maintenance").delete({count: "exact"}).eq("id", issueId);
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
                } = await supabase.from("trailers").select("*").eq("status", status).order("trailer_number", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "search-by-trailer-number": {
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
                } = await supabase.from("trailers").select("*").ilike("trailer_number", `%${query}%`).order("trailer_number", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
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
                const trailerId = typeof body?.trailerId === "string" ? body.trailerId : null;
                const months = Number.isInteger(body?.months) ? body.months : 6;
                const threshold = new Date();
                threshold.setMonth(threshold.getMonth() - months);
                let query = supabase.from("trailers_history").select("*").eq("field_name", "cleanliness_rating").gte("changed_at", threshold.toISOString()).order("changed_at", {ascending: true}).limit(200);
                if (trailerId) query = query.eq("trailer_id", trailerId);
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
                const trailerId = typeof body?.trailerId === "string" ? body.trailerId : null;
                const fieldName = typeof body?.fieldName === "string" ? body.fieldName : null;
                const oldValue = body?.oldValue == null ? null : String(body.oldValue);
                const newValue = body?.newValue == null ? null : String(body.newValue);
                const changedBy = typeof body?.changedBy === "string" && body.changedBy ? body.changedBy : null;
                if (!trailerId) return new Response(JSON.stringify({error: "Trailer ID is required"}), {
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
                    trailer_id: trailerId,
                    field_name: fieldName,
                    old_value: oldValue,
                    new_value: newValue,
                    changed_at: nowIso(),
                    changed_by: userId
                };
                const {data, error} = await supabase.from("trailers_history").insert(record).select().maybeSingle();
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
