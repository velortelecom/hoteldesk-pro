// Velor One - Modeles d'email centralises (branding)
// A brancher sur le futur service d'envoi d'emails. Utilise APP_NAME, LOGO_URL, APP_URL, SUPPORT_EMAIL.
import { APP_NAME, APP_URL, SUPPORT_EMAIL, LOGO_URL, PRIMARY_COLOR, SECONDARY_COLOR } from './config'

export function baseEmailTemplate(opts) {
    const title = opts.title
    const bodyHtml = opts.bodyHtml
    const ctaLabel = opts.ctaLabel || ('Ouvrir ' + APP_NAME)
    const ctaUrl = opts.ctaUrl
    const logoAbsoluteUrl = APP_URL + LOGO_URL
    const ctaBlock = ctaUrl ? ('<div style="text-align:center;margin-top:24px;"><a href="' + ctaUrl + '" style="background:' + SECONDARY_COLOR + ';color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">' + ctaLabel + '</a></div>') : ''
    const html = '<div style="font-family:Arial,sans-serif;background:#F8FAFC;padding:24px;">'
      + '<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">'
      + '<div style="background:' + PRIMARY_COLOR + ';padding:20px;text-align:center;">'
      + '<img src="' + logoAbsoluteUrl + '" width="48" height="48" style="border-radius:10px" alt="' + APP_NAME + '" />'
      + '<div style="color:#fff;font-weight:700;font-size:18px;margin-top:8px;">' + APP_NAME + '</div>'
      + '</div>'
      + '<div style="padding:24px;color:#111827;font-size:14px;line-height:1.6;">'
      + '<h2 style="margin-top:0;color:#111827;">' + title + '</h2>'
      + bodyHtml
      + ctaBlock
      + '</div>'
      + '<div style="padding:16px 24px;border-top:1px solid #F3F4F6;font-size:12px;color:#9CA3AF;text-align:center;">'
      + APP_NAME + ' - ' + APP_URL + '<br/>'
      + 'Besoin d aide ? ' + SUPPORT_EMAIL
      + '</div>'
      + '</div>'
      + '</div>'
    return html
}

export function welcomeEmail(data) {
    const bodyHtml = '<p>Bonjour ' + data.prenom + ',</p><p>Votre compte ' + APP_NAME + ' a ete cree.</p><p>Identifiant : <strong>' + data.email + '</strong></p><p>Cliquez sur le lien ci-dessous pour definir votre mot de passe et activer votre compte.</p><p><a href="' + data.resetUrl + '">Activer mon compte</a></p>'
    return baseEmailTemplate({ title: 'Bienvenue sur ' + APP_NAME, bodyHtml: bodyHtml, ctaLabel: 'Se connecter', ctaUrl: APP_URL })
}

export function passwordResetEmail(data) {
    const bodyHtml = '<p>Bonjour ' + data.prenom + ',</p><p>Un lien de reinitialisation de mot de passe vous a ete envoye.</p><p>Cliquez ci-dessous pour definir un nouveau mot de passe securise.</p>'
    return baseEmailTemplate({ title: 'Reinitialisation de votre mot de passe', bodyHtml: bodyHtml, ctaLabel: 'Reinitialiser mon mot de passe', ctaUrl: APP_URL })
}

export default { baseEmailTemplate: baseEmailTemplate, welcomeEmail: welcomeEmail, passwordResetEmail: passwordResetEmail }
