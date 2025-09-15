// @ts-ignore
import {createClient} from "npm:@supabase/supabase-js@2.45.4";
import EmailUtility, {isValidEmail} from "../_shared/EmailUtility.js";
import {buildReportSubmittedEmail} from "../_shared/emails/report-submitted-email.js";
import {UserService} from '../../../src/services/UserService.js'

const USERS_TABLE = 'users';
const ROLES_TABLE = 'users_roles';
const PERMISSIONS_TABLE = 'users_permissions';

const ALWAYS_SEND_EMAIL_TYPES = ['forgot_password']

const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
    "Connection": "keep-alive"
};

type ReportNotifyBody = {
    reportName?: string
    reportTitle?: string
    weekVerbose?: string
    submittedById?: string
    submittedByName?: string
    submittedByEmail?: string
}

function handleOptions() {
    return new Response(null, {status: 204, headers: corsHeaders});
}

async function getSupabase(req) {
    return createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {global: {headers: {Authorization: req.headers.get("Authorization") || ""}}}
    );
}

async function getUserHighestWeight(supabase, userId) {
    if (!userId) return 0
    const {data} = await supabase
        .from('users_permissions')
        .select('role_id, users_roles(weight)')
        .eq('user_id', userId)
    if (!Array.isArray(data) || !data.length) return 0
    const weights = data.map(item => item?.users_roles?.weight ?? 0)
    return Math.max(...weights, 0)
}

function isPlaceholderName(name) {
    if (!name) return true;
    const n = String(name).trim();
    if (!n) return true;
    if (/^User\s+[0-9a-f]{8}$/i.test(n)) return true;
    if (/^User\b/i.test(n) && n.length <= 12) return true;
    return false;
}

async function findReviewerEmailsByPermission(supabase, reviewPerm) {
    const {data: roles, error: rolesErr} = await supabase
        .from(ROLES_TABLE)
        .select('id, permissions')
        .overlaps('permissions', [reviewPerm]);
    if (rolesErr || !Array.isArray(roles) || roles.length === 0) return [];
    const roleIds = roles.map(r => r.id).filter(Boolean);
    if (!roleIds.length) return [];
    const {data: perms, error: permsErr} = await supabase
        .from(PERMISSIONS_TABLE)
        .select('user_id')
        .in('role_id', roleIds);
    if (permsErr || !Array.isArray(perms) || perms.length === 0) return [];
    const userIds = Array.from(new Set(perms.map(p => p.user_id).filter(Boolean)));
    if (!userIds.length) return [];
    const {data: users, error: usersErr} = await supabase
        .from(USERS_TABLE)
        .select('id, email')
        .in('id', userIds);
    if (usersErr || !Array.isArray(users)) return [];
    const emails = users.map(u => u?.email).filter(e => typeof e === 'string' && isValidEmail(e));
    return Array.from(new Set(emails));
}

async function filterRecipientsByWeight(userIds, emailType, supabase) {
    if (ALWAYS_SEND_EMAIL_TYPES.includes(emailType)) return userIds
    const filtered = []
    for (const userId of userIds) {
        const weight = await getUserHighestWeight(supabase, userId)
        if (weight <= 70) filtered.push(userId)
    }
    return filtered
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return handleOptions();
    try {
        const url = new URL(req.url);
        const endpoint = url.pathname.split('/').pop();
        const supabase = await getSupabase(req);
        let body: ReportNotifyBody = {};
        try {
            body = await req.json();
        } catch {}

        switch (endpoint) {
            case 'on-submitted': {
                const reportName = String(body?.reportName || '').trim();
                const reportTitle = String(body?.reportTitle || reportName || 'Report');
                const weekVerbose = String(body?.weekVerbose || '').trim();
                const submittedById = String(body?.submittedById || '').trim();
                let submittedByName = String(body?.submittedByName || '').trim();
                let submittedByEmail = String(body?.submittedByEmail || '').trim();
                if (!submittedById && !submittedByEmail && !submittedByName) {
                    return new Response(JSON.stringify({error: 'Missing submitter info'}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                const nameLooksPlaceholder = isPlaceholderName(submittedByName);
                if (!submittedById && (nameLooksPlaceholder || !submittedByEmail)) {
                    return new Response(JSON.stringify({error: 'Missing submitter id for lookup'}), {
                        status: 400,
                        headers: corsHeaders
                    });
                }
                if (submittedById && (nameLooksPlaceholder || !submittedByEmail)) {
                    const {data: profile} = await supabase.from('users_profiles').select('first_name, last_name, email').eq('id', submittedById).single();
                    if (profile) {
                        const full = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
                        if (nameLooksPlaceholder && full) submittedByName = full;
                        if (!submittedByEmail && profile.email) submittedByEmail = profile.email;
                    }
                }
                if (submittedById && (isPlaceholderName(submittedByName) || !submittedByEmail)) {
                    const {data: userRow} = await supabase.from(USERS_TABLE).select('name, email').eq('id', submittedById).single();
                    if (userRow) {
                        if (!submittedByEmail && userRow.email) submittedByEmail = userRow.email;
                        if (isPlaceholderName(submittedByName) && userRow.name) submittedByName = userRow.name;
                    }
                }
                const reviewPerm = `reports.review.${reportName}`;
                const toUserIds = await findReviewerEmailsByPermission(supabase, reviewPerm);
                const filteredUserIds = await filterRecipientsByWeight(toUserIds, 'report_submitted', supabase);
                if (!filteredUserIds.length) return new Response(JSON.stringify({ok: true, sent: 0}), {headers: corsHeaders});
                const theme = {};
                const logoUrl = Deno.env.get('EMAIL_LOGO_URL') || '';
                const fromName = Deno.env.get('EMAIL_FROM_NAME') || 'Smyrna Tools';
                const submittedAtCST = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
                const {subject, text, html} = buildReportSubmittedEmail({
                    reportTitle,
                    reportName,
                    weekVerbose,
                    submittedByName,
                    submittedByEmail,
                    submittedAt: submittedAtCST,
                    reportUrl: '',
                    theme,
                    logoUrl,
                    fromName
                });
                const prep = EmailUtility.prepareMailerSend({
                    to: filteredUserIds,
                    subject,
                    html,
                    text,
                    tags: ['report_submitted', reportName]
                });
                if (!prep.ok) return new Response(JSON.stringify({error: 'Email utility not configured'}), {
                    status: 200,
                    headers: corsHeaders
                });
                await fetch(prep.request.url, {
                    method: prep.request.method,
                    headers: prep.request.headers,
                    body: prep.request.body
                });
                return new Response(JSON.stringify({ok: true, sent: filteredUserIds.length}), {headers: corsHeaders});
            }
            default:
                return new Response(JSON.stringify({error: 'Invalid endpoint', path: url.pathname}), {
                    status: 404,
                    headers: corsHeaders
                });
        }
    } catch (e) {
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: e.message
        }), {status: 500, headers: corsHeaders});
    }
});
