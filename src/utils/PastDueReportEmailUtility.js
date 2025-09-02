import EmailUtility from './EmailUtility'
import {buildPastDueReportEmail} from '../../emails/past-due-report-email'

export async function sendPastDueReportEmail({to, reportName, dueDate, reportUrl, theme, logoUrl, tags}) {
    const {subject, text, html} = buildPastDueReportEmail({reportName, dueDate, reportUrl, theme, logoUrl})
    const emailResult = EmailUtility.prepareMailerSend({to, subject, html, text, tags})
    if (!emailResult.ok) return {ok: false, error: 'Email utility not configured'}
    await fetch(emailResult.request.url, {
        method: emailResult.request.method,
        headers: emailResult.request.headers,
        body: emailResult.request.body
    })
    return {ok: true}
}

