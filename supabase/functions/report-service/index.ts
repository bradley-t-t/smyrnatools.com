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

function toISO(date: Date | string | null | undefined) {
    if (!date) return null;
    const d = typeof date === "string" ? new Date(date) : date;
    return isNaN(d.getTime()) ? null : d.toISOString();
}

function formatDateMMDDYY(date: Date) {
    const mm = (date.getMonth() + 1).toString();
    const dd = date.getDate().toString();
    const yy = date.getFullYear().toString().slice(-2);
    return `${mm}-${dd}-${yy}`;
}

function parseTimeToMinutes(timeStr: unknown) {
    if (!timeStr || typeof timeStr !== "string") return null;
    const [hStr, mStr] = timeStr.split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
}

function csvEscape(val: unknown) {
    const s = String(val ?? "");
    return '"' + s.replace(/"/g, '""') + '"';
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return handleOptions();
    try {
        const url = new URL(req.url);
        const endpoint = url.pathname.split("/").pop();
        switch (endpoint) {
            case "user-past-due-reports": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    body = {};
                }
                const userId: string | null = typeof body?.userId === "string" ? body.userId : null;
                const beforeDateInput: string | null = typeof body?.beforeDate === "string" ? body.beforeDate : null;
                if (!userId) return new Response(JSON.stringify({error: "userId is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const beforeIso = beforeDateInput ? new Date(beforeDateInput).toISOString() : today.toISOString();
                const {data, error} = await supabase
                    .from("reports")
                    .select("id, report_name, user_id, report_date_range_end, completed, week")
                    .eq("user_id", userId)
                    .eq("completed", false)
                    .lt("report_date_range_end", beforeIso)
                    .order("report_date_range_end", {ascending: true});
                if (error) return new Response(JSON.stringify({error: error.message}), {
                    status: 500,
                    headers: corsHeaders
                });
                return new Response(JSON.stringify({data: Array.isArray(data) ? data : []}), {headers: corsHeaders});
            }
            case "compute-yardage-metrics": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const form = body?.form || body;
                let yards = parseFloat(form?.total_yards_delivered ?? form?.Yardage ?? form?.yardage ?? "");
                let hours = parseFloat(form?.total_operator_hours ?? form?.["Total Hours"] ?? form?.total_hours ?? form?.total_operator_hours ?? "");
                let yph: number | null = (!isNaN(yards) && !isNaN(hours) && hours > 0) ? (yards / hours) : null;
                let yphGrade = "";
                if (yph !== null) {
                    if (yph >= 6) yphGrade = "excellent"; else if (yph >= 4) yphGrade = "good"; else if (yph >= 3) yphGrade = "average"; else yphGrade = "poor";
                }
                let yphLabel = "";
                if (yphGrade === "excellent") yphLabel = "Excellent"; else if (yphGrade === "good") yphLabel = "Good"; else if (yphGrade === "average") yphLabel = "Average"; else if (yphGrade === "poor") yphLabel = "Poor";
                let lost: number | null = null;
                if (form && typeof form.total_yards_lost !== "undefined" && form.total_yards_lost !== "" && !isNaN(Number(form.total_yards_lost))) lost = Number(form.total_yards_lost);
                else if (form && typeof form.yardage_lost !== "undefined" && form.yardage_lost !== "" && !isNaN(Number(form.yardage_lost))) lost = Number(form.yardage_lost);
                else if (form && typeof form.lost_yardage !== "undefined" && form.lost_yardage !== "" && !isNaN(Number(form.lost_yardage))) lost = Number(form.lost_yardage);
                else if (form && typeof form["Yardage Lost"] !== "undefined" && form["Yardage Lost"] !== "" && !isNaN(Number(form["Yardage Lost"]))) lost = Number(form["Yardage Lost"]);
                else if (form && typeof form["yardage_lost"] !== "undefined" && form["yardage_lost"] !== "" && !isNaN(Number(form["yardage_lost"]))) lost = Number(form["yardage_lost"]);
                if (lost !== null && lost < 0) lost = 0;
                let lostGrade = "";
                if (lost !== null) {
                    if (lost === 0) lostGrade = "excellent"; else if (lost < 5) lostGrade = "good"; else if (lost < 10) lostGrade = "average"; else lostGrade = "poor";
                }
                let lostLabel = "";
                if (lostGrade === "excellent") lostLabel = "Excellent"; else if (lostGrade === "good") lostLabel = "Good"; else if (lostGrade === "average") lostLabel = "Average"; else if (lostGrade === "poor") lostLabel = "Poor";
                return new Response(JSON.stringify({
                    data: {
                        yph,
                        yphGrade,
                        yphLabel,
                        lost,
                        lostGrade,
                        lostLabel
                    }
                }), {headers: corsHeaders});
            }
            case "plant-production-insights": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];

                function isExcludedRow(row: any) {
                    if (!row) return true;
                    const keys = Object.keys(row).filter(k => k !== "name" && k !== "truck_number");
                    return keys.every(k => row[k] === "" || row[k] === undefined || row[k] === null || row[k] === 0);
                }

                let totalLoads = 0;
                let totalHours = 0;
                let totalElapsedStart = 0;
                let totalElapsedEnd = 0;
                let countElapsedStart = 0;
                let countElapsedEnd = 0;
                let warnings: Array<{ row: number; message: string }> = [];
                let loadsPerHourSum = 0;
                let loadsPerHourCount = 0;
                const includedRows = rows.filter(row => !isExcludedRow(row));
                includedRows.forEach(row => {
                    const start = parseTimeToMinutes(row.start_time);
                    const firstLoad = parseTimeToMinutes(row.first_load);
                    const punchOut = parseTimeToMinutes(row.punch_out);
                    const eod = parseTimeToMinutes(row.eod_in_yard);
                    const loads = Number(row.loads);
                    let hours: number | null = null;
                    if (start !== null && punchOut !== null) {
                        hours = (punchOut - start) / 60;
                        if (hours > 0) totalHours += hours;
                    }
                    if (!isNaN(loads)) totalLoads += loads;
                    if (start !== null && firstLoad !== null) {
                        const elapsed = firstLoad - start;
                        if (!isNaN(elapsed)) {
                            totalElapsedStart += elapsed;
                            countElapsedStart++;
                            if (elapsed > 15) warnings.push({
                                row: rows.indexOf(row),
                                message: `Start to 1st Load is ${elapsed} min (> 15 min)`
                            });
                        }
                    }
                    if (eod !== null && punchOut !== null) {
                        const elapsed = punchOut - eod;
                        if (!isNaN(elapsed)) {
                            totalElapsedEnd += elapsed;
                            countElapsedEnd++;
                            if (elapsed > 15) warnings.push({
                                row: rows.indexOf(row),
                                message: `EOD to Punch Out is ${elapsed} min (> 15 min)`
                            });
                        }
                    }
                    if (!isNaN(loads) && hours && hours > 0) {
                        loadsPerHourSum += loads / hours;
                        loadsPerHourCount++;
                    }
                    if (!isNaN(loads) && loads < 3) warnings.push({
                        row: rows.indexOf(row),
                        message: `Total Loads is ${loads} (< 3)`
                    });
                    if (hours !== null && hours > 14) warnings.push({
                        row: rows.indexOf(row),
                        message: `Total Hours is ${hours.toFixed(2)} (> 14 hours)`
                    });
                });
                const avgElapsedStart = countElapsedStart ? totalElapsedStart / countElapsedStart : null;
                const avgElapsedEnd = countElapsedEnd ? totalElapsedEnd / countElapsedEnd : null;
                const avgLoads = includedRows.length ? totalLoads / includedRows.length : null;
                const avgHours = includedRows.length ? totalHours / includedRows.length : null;
                const avgLoadsPerHour = loadsPerHourCount ? loadsPerHourSum / loadsPerHourCount : null;
                let avgWarnings: string[] = [];
                if (avgElapsedStart !== null && avgElapsedStart < 0) avgWarnings.push("Reported Start and 1st Load times produce a negative elapsed duration (likely an AM/PM entry error). Please review and correct the time entries.");
                if (avgElapsedEnd !== null && avgElapsedEnd < 0) avgWarnings.push("Reported Washout -> Punch Out times produce a negative elapsed duration (likely an AM/PM entry error). Please review and correct the time entries.");
                if (avgElapsedStart !== null && avgElapsedStart > 15) avgWarnings.push(`Avg Punch In to 1st Load is ${avgElapsedStart.toFixed(1)} min (> 15 min)`);
                if (avgElapsedEnd !== null && avgElapsedEnd > 15) avgWarnings.push(`Washout to Punch Out is ${avgElapsedEnd.toFixed(1)} min (> 15 min)`);
                if (avgLoads !== null && avgLoads < 3) avgWarnings.push(`Avg Total Loads is ${avgLoads.toFixed(2)} (< 3)`);
                if (avgHours !== null && avgHours > 14) avgWarnings.push(`Avg Total Hours is ${avgHours.toFixed(2)} (> 14 hours)`);
                return new Response(JSON.stringify({
                    data: {
                        totalLoads,
                        totalHours,
                        avgElapsedStart,
                        avgElapsedEnd,
                        avgLoads,
                        avgHours,
                        avgLoadsPerHour,
                        warnings,
                        avgWarnings
                    }
                }), {headers: corsHeaders});
            }
            case "export-csv": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];
                const operatorOptions: Array<{
                    value: string;
                    label: string
                }> = Array.isArray(body?.operatorOptions) ? body.operatorOptions : [];
                const reportDate: string | null = typeof body?.reportDate === "string" ? body.reportDate : null;
                const dateStr = reportDate ? ` - ${reportDate}` : "";
                const title = `Weekly Plant Efficiency Report${dateStr}`;
                const headerRow = Array(12).fill("");
                headerRow[0] = title;
                const tableHeaders = [
                    "Operator Name",
                    "Truck Number",
                    "Start Time",
                    "1st Load",
                    "Elapsed (Start→1st)",
                    "EOD In Yard",
                    "Punch Out",
                    "Elapsed (EOD→Punch)",
                    "Total Loads",
                    "Total Hours",
                    "Loads/Hour",
                    "Comments"
                ];

                function getOperatorName(row: any) {
                    if (!row?.name) return "";
                    if (Array.isArray(operatorOptions)) {
                        const found = operatorOptions.find(opt => opt.value === row.name);
                        if (found) return found.label;
                    }
                    if (row.displayName) return row.displayName;
                    return row.name;
                }

                const csvRows: string[][] = [headerRow, tableHeaders];
                rows.forEach(row => {
                    const start = parseTimeToMinutes(row.start_time);
                    const firstLoad = parseTimeToMinutes(row.first_load);
                    const eod = parseTimeToMinutes(row.eod_in_yard);
                    const punch = parseTimeToMinutes(row.punch_out);
                    const elapsedStart = (start !== null && firstLoad !== null) ? firstLoad - start : "";
                    const elapsedEnd = (eod !== null && punch !== null) ? punch - eod : "";
                    const totalHours = (start !== null && punch !== null) ? ((punch - start) / 60) : "";
                    const loadsPerHour = (row.loads && totalHours && Number(totalHours) > 0) ? (Number(row.loads) / Number(totalHours)).toFixed(2) : "";
                    csvRows.push([
                        getOperatorName(row),
                        row.truck_number || "",
                        row.start_time || "",
                        row.first_load || "",
                        elapsedStart !== "" ? `${elapsedStart} min` : "",
                        row.eod_in_yard || "",
                        row.punch_out || "",
                        elapsedEnd !== "" ? `${elapsedEnd} min` : "",
                        row.loads?.toString?.() || "",
                        totalHours !== "" ? Number(totalHours).toFixed(2) : "",
                        loadsPerHour,
                        row.comments || ""
                    ]);
                });
                const csvContent = csvRows.map(r => r.map(csvEscape).join(',')).join('\r\n');
                const filename = `Weekly Plant Efficiency Report${reportDate ? ' - ' + reportDate.replace(/[^0-9-]/g, '') : ''}.csv`;
                return new Response(JSON.stringify({data: {filename, csv: csvContent}}), {headers: corsHeaders});
            }
            case "week-range": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    return new Response(JSON.stringify({error: "Invalid JSON in request body"}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const weekIso = typeof body?.weekIso === "string" ? body.weekIso : null;
                if (!weekIso) return new Response(JSON.stringify({error: "weekIso is required"}), {
                    status: 400,
                    headers: corsHeaders
                });
                const monday = new Date(weekIso);
                monday.setDate(monday.getDate() + 1);
                monday.setHours(0, 0, 0, 0);
                const saturday = new Date(monday);
                saturday.setDate(monday.getDate() + 5);
                const range = `${formatDateMMDDYY(monday)} through ${formatDateMMDDYY(saturday)}`;
                return new Response(JSON.stringify({data: {range}}), {headers: corsHeaders});
            }
            case "monday-saturday": {
                let body: any;
                try {
                    body = await req.json();
                } catch {
                    body = {};
                }
                const input = typeof body?.date === "string" ? body.date : null;
                const d = input ? new Date(input) : new Date();
                const day = d.getDay();
                const monday = new Date(d);
                monday.setDate(d.getDate() - ((day + 6) % 7));
                monday.setHours(0, 0, 0, 0);
                const saturday = new Date(monday);
                saturday.setDate(monday.getDate() + 5);
                saturday.setHours(0, 0, 0, 0);
                return new Response(JSON.stringify({
                    data: {
                        monday: toISO(monday),
                        saturday: toISO(saturday)
                    }
                }), {headers: corsHeaders});
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
