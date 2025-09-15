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

function normalize(field: string, value: any): any {
    if (value === undefined || value === null) return null;
    const f = String(field || "").toLowerCase();
    let v: any = value;
    if (typeof v === "string") v = v.trim();
    if (v === "") return null;
    if (f.includes("date")) {
        const d = new Date(v);
        return isNaN(d.getTime()) ? String(v) : d.toISOString().split("T")[0];
    }
    if (f.includes("rating") || f.includes("hours") || f.includes("mileage") || f.includes("year")) {
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
    }
    if (f.startsWith("has_") || f.startsWith("is_")) {
        if (v === true || v === "true" || v === 1 || v === "1") return true;
        if (v === false || v === "false" || v === 0 || v === "0") return false;
    }
    if (f.startsWith("assigned_") || f.endsWith("_id") || f.includes("operator") || f.includes("tractor")) {
        if (v === "0" || v === 0) return null;
    }
    return v;
}

function decodeBase64ToUint8Array(base64: string): Uint8Array {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary_string.charCodeAt(i);
    return bytes;
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
                } = await supabase.from("mixers").select("*").order("truck_number", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data: hist,
                    error: histErr
                } = await supabase.from("mixers_history").select("mixer_id, changed_at").order("changed_at", {ascending: false});
                if (histErr) return new Response(JSON.stringify({error: histErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const latestMap: Record<string, string> = {};
                for (const h of hist || []) if (!latestMap[h.mixer_id] || new Date(h.changed_at) > new Date(latestMap[h.mixer_id])) latestMap[h.mixer_id] = h.changed_at;
                const enriched = (data || []).map((m: any) => ({...m, latestHistoryDate: latestMap[m.id] ?? null}));
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
                if (!id) return new Response(JSON.stringify({error: "Mixer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {data, error} = await supabase.from("mixers").select("*").eq("id", id).maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!data) return new Response(JSON.stringify({data: null}), {headers: corsHeaders});
                const {
                    data: hist,
                    error: histErr
                } = await supabase.from("mixers_history").select("changed_at").eq("mixer_id", id).order("changed_at", {ascending: false}).limit(1).maybeSingle();
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
                } = await supabase.from("mixers").select("*").eq("status", "Active").order("truck_number", {ascending: true});
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
                const mixerId = typeof body?.mixerId === "string" ? body.mixerId : null;
                const limit = Number.isInteger(body?.limit) ? body.limit : null;
                if (!mixerId) return new Response(JSON.stringify({error: "Mixer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                let query = supabase.from("mixers_history").select("*").eq("mixer_id", mixerId).order("changed_at", {ascending: false});
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
                const mixer = body?.mixer || body;
                const userId = typeof body?.userId === "string" && body.userId ? body.userId : null;
                if (!userId) return new Response(JSON.stringify({error: "User ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const now = nowIso();
                const apiData: Record<string, any> = {
                    truck_number: mixer?.truckNumber ?? mixer?.truck_number,
                    assigned_plant: mixer?.assignedPlant ?? mixer?.assigned_plant,
                    assigned_operator: mixer?.assignedOperator ?? mixer?.assigned_operator ?? null,
                    last_service_date: toDbTimestamp(mixer?.lastServiceDate ?? mixer?.last_service_date),
                    last_chip_date: toDbTimestamp(mixer?.lastChipDate ?? mixer?.last_chip_date),
                    cleanliness_rating: typeof mixer?.cleanlinessRating === "number" ? mixer.cleanlinessRating : (typeof mixer?.cleanliness_rating === "number" ? mixer.cleanliness_rating : 0),
                    vin: mixer?.vin ?? null,
                    make: mixer?.make ?? null,
                    model: mixer?.model ?? null,
                    year: mixer?.year ?? null,
                    status: mixer?.status ?? "Active",
                    created_at: now,
                    updated_at: now,
                    updated_by: userId
                };
                const {data, error} = await supabase.from("mixers").insert([apiData]).select().maybeSingle();
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
                const id = typeof body?.mixerId === "string" ? body.mixerId : (typeof body?.id === "string" ? body.id : null);
                const mixer = body?.mixer || body?.data || body;
                let userId = typeof body?.userId === "string" && body.userId ? body.userId : null;
                if (!id) return new Response(JSON.stringify({error: "Mixer ID is required"}), {
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
                } = await supabase.from("mixers").select("*").eq("id", id).maybeSingle();
                if (currentErr) return new Response(JSON.stringify({error: currentErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!current) return new Response(JSON.stringify({error: "Mixer not found"}), {
                    status: 404,
                    headers: corsHeaders
                });
                let assignedOperator = mixer?.assignedOperator ?? null;
                let status = mixer?.status ?? current.status;
                if ((!assignedOperator || assignedOperator === "" || assignedOperator === "0") && status === "Active") status = "Spare";
                if (assignedOperator && status !== "Active") status = "Active";
                if (["In Shop", "Retired", "Spare"].includes(status) && assignedOperator) assignedOperator = null;
                const apiData: Record<string, any> = {
                    truck_number: mixer?.truckNumber ?? current.truck_number,
                    assigned_plant: mixer?.assignedPlant ?? current.assigned_plant,
                    assigned_operator: assignedOperator,
                    last_service_date: toDbTimestamp(mixer?.lastServiceDate) ?? current.last_service_date,
                    last_chip_date: toDbTimestamp(mixer?.lastChipDate) ?? current.last_chip_date,
                    cleanliness_rating: typeof mixer?.cleanlinessRating === "number" ? mixer.cleanlinessRating : current.cleanliness_rating,
                    vin: mixer?.vin ?? current.vin,
                    make: mixer?.make ?? current.make,
                    model: mixer?.model ?? current.model,
                    year: typeof mixer?.year === "number" ? mixer.year : current.year,
                    status,
                    updated_at: nowIso(),
                    updated_by: userId,
                    updated_last: typeof mixer?.updatedLast === "string" ? mixer.updatedLast : current.updated_last
                };
                const {data, error} = await supabase.from("mixers").update(apiData).eq("id", id).select().maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const diffs: Array<{
                    mixer_id: string;
                    field_name: string;
                    old_value: string | null;
                    new_value: string | null;
                    changed_at: string;
                    changed_by: string;
                }> = [];
                const fields = [
                    {field: "truck_number"},
                    {field: "assigned_plant"},
                    {field: "assigned_operator"},
                    {field: "last_service_date"},
                    {field: "last_chip_date"},
                    {field: "cleanliness_rating"},
                    {field: "vin"},
                    {field: "make"},
                    {field: "model"},
                    {field: "year"},
                    {field: "status"}
                ];
                for (const f of fields) {
                    const beforeVal = (current as any)[f.field];
                    const afterVal = (apiData as any)[f.field];
                    const b = normalize(f.field, beforeVal);
                    const a = normalize(f.field, afterVal);
                    if (b !== a) diffs.push({
                        mixer_id: id,
                        field_name: f.field,
                        old_value: b != null ? String(b) : null,
                        new_value: a != null ? String(a) : null,
                        changed_at: nowIso(),
                        changed_by: userId
                    });
                }
                if (diffs.length) {
                    const {error: histErr} = await supabase.from("mixers_history").insert(diffs);
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
                if (!id) return new Response(JSON.stringify({error: "Mixer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {error: hErr} = await supabase.from("mixers_history").delete().eq("mixer_id", id);
                if (hErr) return new Response(JSON.stringify({error: hErr.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {error} = await supabase.from("mixers").delete().eq("id", id);
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
                const mixerId = typeof body?.mixerId === "string" ? body.mixerId : null;
                if (!mixerId) return new Response(JSON.stringify({error: "Mixer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data,
                    error
                } = await supabase.from("mixers_comments").select("*").eq("mixer_id", mixerId).order("created_at", {ascending: false});
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
                const mixerId = typeof body?.mixerId === "string" ? body.mixerId : null;
                const text = typeof body?.text === "string" ? body.text.trim() : "";
                const author = typeof body?.author === "string" ? body.author.trim() : "";
                if (!mixerId) return new Response(JSON.stringify({error: "Mixer ID is required"}), {
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
                const comment = {mixer_id: mixerId, text, author, created_at: nowIso()};
                const {data, error} = await supabase.from("mixers_comments").insert([comment]).select().maybeSingle();
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
                const {error} = await supabase.from("mixers_comments").delete().eq("id", commentId);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({success: true}), {headers: corsHeaders});
            }
            case "fetch-images": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const mixerId = typeof body?.mixerId === "string" ? body.mixerId : null;
                if (!mixerId) return new Response(JSON.stringify({error: "Mixer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {data, error} = await supabase.from("mixers_images").select("*").eq("mixer_id", mixerId);
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
            }
            case "upload-image": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const mixerId = typeof body?.mixerId === "string" ? body.mixerId : null;
                const fileName = typeof body?.fileName === "string" ? body.fileName : null;
                const fileBase64 = typeof body?.fileBase64 === "string" ? body.fileBase64 : null;
                const contentType = typeof body?.contentType === "string" ? body.contentType : "application/octet-stream";
                if (!mixerId) return new Response(JSON.stringify({error: "Mixer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!fileName || !fileBase64) return new Response(JSON.stringify({error: "File name and base64 content are required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const pathInBucket = `mixer_images/${fileName}`;
                const bytes = decodeBase64ToUint8Array(fileBase64);
                const {error: uploadError} = await supabase.storage.from("smyrna").upload(pathInBucket, bytes, {contentType});
                if (uploadError) return new Response(JSON.stringify({error: uploadError.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                const filePath = `smyrna/${pathInBucket}`;
                const {data, error} = await supabase.from("mixers_images").insert({
                    mixer_id: mixerId,
                    image_url: filePath,
                    created_at: nowIso()
                }).select().maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data}), {headers: corsHeaders});
            }
            case "delete-image": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const imageId = typeof body?.imageId === "string" ? body.imageId : null;
                if (!imageId) return new Response(JSON.stringify({error: "Image ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data: imageData,
                    error: fetchError
                } = await supabase.from("mixers_images").select("image_url").eq("id", imageId).maybeSingle();
                if (fetchError) return new Response(JSON.stringify({error: fetchError.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (imageData?.image_url) {
                    const relPath = imageData.image_url.startsWith("smyrna/") ? imageData.image_url.substring("smyrna/".length) : imageData.image_url;
                    const {error: deleteFileError} = await supabase.storage.from("smyrna").remove([relPath]);
                    if (deleteFileError) return new Response(JSON.stringify({error: deleteFileError.message}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const {error} = await supabase.from("mixers_images").delete().eq("id", imageId);
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
                const mixerId = typeof body?.mixerId === "string" ? body.mixerId : null;
                if (!mixerId) return new Response(JSON.stringify({error: "Mixer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {
                    data,
                    error
                } = await supabase.from("mixers_maintenance").select("*").eq("mixer_id", mixerId).order("time_created", {ascending: false});
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
                const mixerId = typeof body?.mixerId === "string" ? body.mixerId : null;
                const issue = typeof body?.issue === "string" ? body.issue.trim() : "";
                const severity = typeof body?.severity === "string" ? body.severity : "";
                if (!mixerId) return new Response(JSON.stringify({error: "Mixer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!issue) return new Response(JSON.stringify({error: "Issue description is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!["Low", "Medium", "High"].includes(severity)) return new Response(JSON.stringify({error: "Severity must be Low, Medium, or High"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const id = crypto.randomUUID();
                const {data, error} = await supabase.from("mixers_maintenance").insert({
                    id,
                    mixer_id: mixerId,
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
                const {error} = await supabase.from("mixers_maintenance").update({time_completed: nowIso()}).eq("id", issueId);
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
                } = await supabase.from("mixers_maintenance").delete({count: "exact"}).eq("id", issueId);
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
                } = await supabase.from("mixers").select("*").eq("assigned_operator", operatorId).order("truck_number", {ascending: true});
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
                } = await supabase.from("mixers").select("*").eq("status", status).order("truck_number", {ascending: true});
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
                } = await supabase.from("mixers").select("*").ilike("truck_number", `%${query}%`).order("truck_number", {ascending: true});
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
                } = await supabase.from("mixers").select("*").order("truck_number", {ascending: true});
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
                const mixerId = typeof body?.mixerId === "string" ? body.mixerId : null;
                const months = Number.isInteger(body?.months) ? body.months : 6;
                const threshold = new Date();
                threshold.setMonth(threshold.getMonth() - months);
                let query = supabase.from("mixers_history").select("*").eq("field_name", "cleanliness_rating").gte("changed_at", threshold.toISOString()).order("changed_at", {ascending: true}).limit(200);
                if (mixerId) query = query.eq("mixer_id", mixerId);
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
                const mixerId = typeof body?.mixerId === "string" ? body.mixerId : null;
                const fieldName = typeof body?.fieldName === "string" ? body.fieldName : null;
                const oldValue = body?.oldValue == null ? null : String(body.oldValue);
                const newValue = body?.newValue == null ? null : String(body.newValue);
                const changedBy = typeof body?.changedBy === "string" && body.changedBy ? body.changedBy : null;
                if (!mixerId) return new Response(JSON.stringify({error: "Mixer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!fieldName) return new Response(JSON.stringify({error: "Field name required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const b = normalize(fieldName, oldValue);
                const a = normalize(fieldName, newValue);
                if (b === a) return new Response(JSON.stringify({data: null, skipped: true}), {headers: corsHeaders});
                let userId = changedBy;
                if (!userId) userId = (req.headers.get("X-User-Id") || "00000000-0000-0000-0000-000000000000");
                const record = {
                    mixer_id: mixerId,
                    field_name: fieldName,
                    old_value: b != null ? String(b) : null,
                    new_value: a != null ? String(a) : null,
                    changed_at: nowIso(),
                    changed_by: userId
                };
                const {data, error} = await supabase.from("mixers_history").insert(record).select().maybeSingle();
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data}), {headers: corsHeaders});
            }
            case "search-by-vin": {
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
                } = await supabase.from("mixers").select("*").ilike("vin", `%${query}%`).order("truck_number", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 400,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: data ?? []}), {headers: corsHeaders});
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
                const id = typeof body?.id === "string" ? body.id : (typeof body?.mixerId === "string" ? body.mixerId : null);
                let userId = typeof body?.userId === "string" && body.userId ? body.userId : (req.headers.get("X-User-Id") || null);
                if (!id) return new Response(JSON.stringify({error: "Mixer ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                if (!userId) return new Response(JSON.stringify({error: "User ID is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const {data, error} = await supabase.from("mixers").update({
                    updated_last: nowIso(),
                    updated_by: userId
                }).eq("id", id).select().maybeSingle();
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
