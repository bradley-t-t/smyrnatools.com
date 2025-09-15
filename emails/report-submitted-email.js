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
        container: `max-width: 600px; ${css.bg(t.white)} font-family: Arial, Helvetica, sans-serif; margin: 0 auto;`.trim(),
        header: `${css.bg(t.bgDark)} padding: 20px; text-align: center;`.trim(),
        headerText: `font-size: 20px; font-weight: 700; ${css.color(t.onBrand || "")} `.trim(),
        section: `padding: 30px 20px; ${css.bg(t.bgLight)}`.trim(),
        h1: `font-size: 22px; ${css.color(t.text)} margin: 0 0 16px;`.trim(),
        p: `font-size: 16px; ${css.color(t.text)} line-height: 1.5; margin: 0 0 16px;`.trim(),
        meta: `font-size: 14px; ${css.color(t.textMuted)} line-height: 1.4; margin: 0 0 16px;`.trim(),
        card: `${css.bg(t.white)} ${css.border(t.border)} border-radius: 6px; padding: 16px;`.trim(),
        btnWrap: `margin: 20px 0; text-align: center;`.trim(),
        btnA: `display: inline-block; padding: 12px 24px; ${css.bg(t.brand)} ${css.color(t.onBrand)} text-decoration: none; font-size: 16px; border-radius: 5px;`.trim(),
        footer: `${css.bg(t.brand)} padding: 15px; text-align: center; ${css.color(t.onBrand)} font-size: 12px;`.trim(),
        link: `${css.color(t.onBrand)} text-decoration: none;`.trim()
    }
    const safeTitle = reportTitle || reportName || "Report"
    const safeName = submittedByName || submittedByEmail || "User"
    const safeAt = submittedAt ? new Date(submittedAt) : new Date()
    const atText = safeAt.toLocaleString()
    const subject = `${safeTitle} submitted by ${safeName}`
    const plainWeek = weekVerbose ? ` for ${weekVerbose}` : ""
    const text = `${safeName} submitted ${safeTitle}${plainWeek}.
${reportUrl ? `Review: ${reportUrl}` : ""}`.trim()
    const year = new Date().getFullYear()
    const hasLogo = typeof logoUrl === "string" && logoUrl.startsWith("http")
    const headerInner = hasLogo
        ? `<img src="${logoUrl}" alt="${fromName || "Smyrna Tools"}" width="150" style="display:block;margin:0 auto;max-width:150px;height:auto;" />`
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
      <h1 style="${styles.h1}">${safeTitle} submitted</h1>
      <p style="${styles.p}"><strong>${safeName}</strong> submitted <strong>${safeTitle}</strong>${weekVerbose ? ` for <strong>${weekVerbose}</strong>` : ""}.</p>
      <div style="${styles.card}">
        <div style="${styles.meta}">Submitted at: ${atText}</div>
        ${submittedByEmail ? `<div style="${styles.meta}">Submitted by: ${submittedByEmail}</div>` : ""}
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

