export function buildForgotPasswordEmail({newPassword, loginUrl, theme, logoUrl}) {
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
        headerText: `font-size: 20px; font-weight: 700; ${css.color(t.onBrand || "")}`.trim(),
        section: `padding: 28px 22px; ${css.bg(t.bgLight)}`.trim(),
        h1: `font-size: 24px; ${css.color(t.text)} margin: 0 0 16px;`.trim(),
        p: `font-size: 16px; ${css.color(t.text)} line-height: 1.6; margin: 0 0 16px;`.trim(),
        pwdBoxTable: `${css.bg(t.white)} ${css.border(t.border)} border-radius: 6px; padding: 16px; text-align: center;`.trim(),
        pwd: `font-size: 18px; ${css.color(t.text)} font-weight: bold;`.trim(),
        btnA: `display: inline-block; padding: 12px 20px; ${css.bg(t.brand)} ${css.color(t.onBrand)} text-decoration: none; font-size: 15px; border-radius: 6px;`.trim(),
        muted: `font-size: 14px; ${css.color(t.textMuted)} line-height: 1.5; margin: 20px 0;`.trim(),
        footer: `${css.bg(t.brand)} padding: 14px; text-align: center; ${css.color(t.onBrand)} font-size: 12px;`.trim(),
        link: `${css.color(t.onBrand)} text-decoration: none;`.trim()
    }
    const subject = 'Smyrna Tools - Your New Password'
    const text = `Your new password is: ${newPassword}\nPlease log in at ${loginUrl} and change your password as soon as possible.\nFor security, do not share this password with anyone.\nIf you did not request a password reset, please contact support@smyrnatools.com.`
    const year = new Date().getFullYear()
    const fallbackLogo = logoUrl || 'https://smyrnatools.com/static/media/SmyrnaLogo.d7f873f3da1747602db3.png'
    const hasLogo = typeof fallbackLogo === 'string' && fallbackLogo.startsWith('http')
    const headerInner = hasLogo
        ? `<img src="${fallbackLogo}" alt="Smyrna Tools" width="150" style="display:block;margin:0 auto;max-width:150px;height:auto;" />`
        : `<div style="${styles.headerText}">Smyrna Tools</div>`
    const html = `
<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="${styles.container}">
  <tr>
    <td style="${styles.header}">
      ${headerInner}
    </td>
  </tr>
  <tr>
    <td style="${styles.section}">
      <h1 style="${styles.h1}">Password Reset for Smyrna Tools</h1>
      <p style="${styles.p}">Hello,</p>
      <p style="${styles.p}">Your Smyrna Tools account password has been reset. Below is your new temporary password:</p>
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="${styles.pwdBoxTable}">
        <tr>
          <td style="${styles.pwd}">${newPassword}</td>
        </tr>
      </table>
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
        <tr>
          <td align="center">
            <a href="${loginUrl}" style="${styles.btnA}">Log In Now</a>
          </td>
        </tr>
      </table>
      <p style="${styles.muted}"><strong>Security Notice:</strong> Do not share this password with anyone.</p>
    </td>
  </tr>
  <tr>
    <td style="${styles.footer}">
      <p style="margin: 0;">&copy; ${year} Smyrna Tools.<br />
      Built for SRM Concrete | <a href="https://smyrnatools.com" style="${styles.link}">smyrnatools.com</a></p>
    </td>
  </tr>
</table>`
    return {subject, text, html}
}
