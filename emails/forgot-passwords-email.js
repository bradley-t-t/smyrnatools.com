export function buildForgotPasswordEmail({newPassword, loginUrl, theme, logoUrl}) {
    const safeTheme = theme || {};
    const t = {
        white: safeTheme.white || "",
        bgDark: safeTheme.bgDark || "",
        bgLight: safeTheme.bgLight || "",
        text: safeTheme.text || "",
        textMuted: safeTheme.textMuted || "",
        brand: safeTheme.brand || "",
        border: safeTheme.border || "",
        onBrand: safeTheme.onBrand || ""
    };
    const css = {
        bg: (c) => (c ? `background-color: ${c};` : ""),
        color: (c) => (c ? `color: ${c};` : ""),
        border: (c) => (c ? `border: 1px solid ${c};` : "")
    };
    const styles = {
        container: `max-width: 600px; ${css.bg(t.white)} font-family: Arial, Helvetica, sans-serif; margin: 0 auto;`.trim(),
        header: `${css.bg(t.bgDark)} padding: 20px; text-align: center;`.trim(),
        section: `padding: 30px 20px; ${css.bg(t.bgLight)}`.trim(),
        h1: `font-size: 24px; ${css.color(t.text)} margin: 0 0 20px;`.trim(),
        p: `font-size: 16px; ${css.color(t.text)} line-height: 1.5; margin: 0 0 20px;`.trim(),
        pwdBoxTable: `${css.bg(t.white)} ${css.border(t.border)} border-radius: 5px; padding: 15px; text-align: center;`.trim(),
        pwd: `font-size: 18px; ${css.color(t.text)} font-weight: bold;`.trim(),
        btnA: `display: inline-block; padding: 12px 24px; ${css.bg(t.brand)} ${css.color(t.onBrand)} text-decoration: none; font-size: 16px; border-radius: 5px;`.trim(),
        muted: `font-size: 14px; ${css.color(t.textMuted)} line-height: 1.5; margin: 20px 0;`.trim(),
        footer: `${css.bg(t.brand)} padding: 15px; text-align: center; ${css.color(t.onBrand)} font-size: 12px;`.trim(),
        link: `${css.color(t.onBrand)} text-decoration: none;`.trim()
    };
    const subject = "Smyrna Tools - Your New Password";
    const text = `Your new password is: ${newPassword}\nPlease log in at ${loginUrl} and change your password as soon as possible.\nFor security, do not share this password with anyone.\nIf you did not request a password reset, please contact support@smyrnatools.com.`;
    const logo = logoUrl || "https://smyrnatools.com/static/media/SmyrnaLogo.d7f873f3da1747602db3.png";
    const year = new Date().getFullYear();
    const html = `
<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="${styles.container}">
  <tr>
    <td style="${styles.header}">
      <img src="${logo}" alt="Smyrna Tools Logo" style="max-width: 150px;" />
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
      <p style="${styles.p}">Please use this password to log in to your account and change it immediately in your account settings.</p>
      <p style="${styles.muted}"><strong>Security Notice:</strong> Do not share this password with anyone.</p>
    </td>
  </tr>
  <tr>
    <td style="${styles.footer}">
      <p style="margin: 0;">&copy; ${year} Smyrna Tools.<br />
      Built for SRM Concrete | <a href="https://smyrnatools.com" style="${styles.link}">smyrnatools.com</a></p>
    </td>
  </tr>
</table>`;
    return {subject, text, html};
}

