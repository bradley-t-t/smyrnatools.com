export function buildReportSubmittedEmail({
                                              reportTitle,
                                              reportName,
                                              weekVerbose,
                                              submittedByName,
                                              submittedByEmail,
                                              submittedAt,
                                              reportUrl,
                                              theme,
                                              logoUrl,
                                              fromName
                                          }) {
    const safeTheme = theme || {}
    const t = {
        white: safeTheme.white || "",
        bgDark: safeTheme.bgDark || "",
        bgLight: safeTheme.bgLight || "",
        text: safeTheme.text || "",
        textMuted: safeTheme.textMuted || "",
        brand: safeTheme.brand || "",
        border: safeTheme.border || "",
        onBrand: safeTheme.onBrand || ""
    }
    const css = {
        bg: c => (c ? `background-color: ${c};` : ""),
        color: c => (c ? `color: ${c};` : ""),
        border: c => (c ? `border: 1px solid ${c};` : "")
    }
    const styles = {
        container: `max-width: 640px; ${css.bg(t.white)} font-family: Arial, Helvetica, sans-serif; margin: 0 auto;`.trim(),
        header: `${css.bg(t.bgDark)} padding: 20px; text-align: center;`.trim(),
        headerText: `font-size: 20px; font-weight: 700; ${css.color(t.onBrand || "")} `.trim(),
        section: `padding: 28px 22px; ${css.bg(t.bgLight)}`.trim(),
        h1: `font-size: 22px; ${css.color(t.text)} margin: 0 0 12px;`.trim(),
        p: `font-size: 16px; ${css.color(t.text)} line-height: 1.6; margin: 0 0 16px;`.trim(),
        metaRow: `margin: 0 0 6px; font-size: 14px; ${css.color(t.text)}`.trim(),
        metaLabel: `font-weight: 600; ${css.color(t.textMuted)}`.trim(),
        card: `${css.bg(t.white)} ${css.border(t.border)} border-radius: 8px; padding: 16px 18px;`.trim(),
        btnWrap: `margin: 20px 0; text-align: center;`.trim(),
        btnA: `display: inline-block; padding: 12px 20px; ${css.bg(t.brand)} ${css.color(t.onBrand)} text-decoration: none; font-size: 15px; border-radius: 6px;`.trim(),
        footer: `${css.bg(t.brand)} padding: 14px; text-align: center; ${css.color(t.onBrand)} font-size: 12px;`.trim(),
        link: `${css.color(t.onBrand)} text-decoration: none;`.trim()
    }
    const isPlaceholder = (n) => {
        const s = String(n || '').trim()
        if (!s) return true
        if (/^User\s+[0-9a-f]{8}$/i.test(s)) return true
        if (/^User\b/i.test(s) && s.length <= 12) return true
        return false
    }
    const safeTitle = reportTitle || reportName || "Report"
    const candidateName = submittedByName && !isPlaceholder(submittedByName) ? submittedByName : ''
    const safeName = candidateName || submittedByEmail || "User"
    const safeAt = submittedAt ? new Date(submittedAt) : new Date()
    const atText = safeAt.toLocaleString()
    const subject = `${safeTitle} Submitted by ${safeName}`
    const plainWeek = weekVerbose ? ` for ${weekVerbose}` : ""
    const text = `${safeName} Submitted ${safeTitle}${plainWeek}.
${reportUrl ? `Review: ${reportUrl}` : ""}`.trim()
    const year = new Date().getFullYear()
    const fallbackLogo = logoUrl || Deno.env.get('EMAIL_LOGO_URL') || 'https://smyrnatools.com/static/media/SmyrnaLogo.d7f873f3da1747602db3.png'
    const hasLogo = typeof fallbackLogo === "string" && fallbackLogo.startsWith("http")
    const headerInner = hasLogo
        ? `<img src="${fallbackLogo}" alt="${fromName || "Smyrna Tools"}" width="150" style="display:block;margin:0 auto;max-width:150px;height:auto;" />`
        : `<div style="${styles.headerText}">${fromName || "Smyrna Tools"}</div>`
    const html = `
<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="${styles.container}">
  <tr>
    <td style="${styles.header}">
      ${headerInner}
    </td>
  </tr>
  <tr>
    <td style="${styles.section}">
      <h1 style="${styles.h1}">${safeTitle} Submitted</h1>
      <p style="${styles.p}"><strong>${safeName}</strong> Submitted <strong>${safeTitle}</strong>${weekVerbose ? ` for <strong>${weekVerbose}</strong>` : ""}.</p>
      <div style="${styles.card}">
        <div style="${styles.metaRow}"><span style="${styles.metaLabel}">Submitted at:</span> ${atText}</div>
        ${submittedByEmail ? `<div style="${styles.metaRow}"><span style="${styles.metaLabel}">Submitter email:</span> ${submittedByEmail}</div>` : ""}
      </div>
      ${reportUrl ? `<div style="${styles.btnWrap}"><a href="${reportUrl}" style="${styles.btnA}">Review Report</a></div>` : ""}
    </td>
  </tr>
  <tr>
    <td style="${styles.footer}">
      <p style="margin: 0;">&copy; ${year} Smyrna Tools | <a href="https://smyrnatools.com" style="${styles.link}">smyrnatools.com</a></p>
    </td>
  </tr>
</table>`
    return {subject, text, html}
}
