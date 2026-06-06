// services/emailService.js
const { Resend } = require('resend');
const fs   = require('fs');
const path = require('path');

function welcomeHtml(nombre) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background-color:#f4f7f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Cabecera verde -->
          <tr>
            <td align="center" style="background-color:#2e7d32;padding:32px 24px 24px;">
              <img src="cid:logo_conectarural" alt="ConectaRural" height="72" style="display:block;"/>
            </td>
          </tr>

          <!-- Bienvenida -->
          <tr>
            <td style="padding:32px 32px 8px;">
              <h1 style="margin:0;font-size:24px;color:#1b5e20;text-align:center;">
                ¡Bienvenida, ${nombre}!
              </h1>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:16px 32px 24px;color:#333333;font-size:15px;line-height:1.6;text-align:center;">
              <p style="margin:0 0 16px;">
                Tu cuenta en <strong>ConectaRural</strong> está lista.<br/>
                Ya puedes acceder a los cursos de formación digital diseñados especialmente para ti.
              </p>
              <p style="margin:0 0 24px;">
                Explora los contenidos, descarga los materiales para verlos sin internet
                y sigue tu progreso a tu propio ritmo.
              </p>
            </td>
          </tr>

          <!-- Separador -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #e8f5e9;margin:0;"/>
            </td>
          </tr>

          <!-- Contacto -->
          <tr>
            <td style="padding:24px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#666666;">¿Necesitas ayuda? Contacta con nuestro equipo:</p>
              <a href="tel:+34642480179"
                 style="display:inline-block;background-color:#2e7d32;color:#ffffff;text-decoration:none;
                        font-size:15px;font-weight:bold;padding:10px 24px;border-radius:24px;">
                📞 642 480 179
              </a>
            </td>
          </tr>

          <!-- Pie -->
          <tr>
            <td style="background-color:#f1f8f1;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#888888;">
                Este correo ha sido enviado automáticamente por ConectaRural.<br/>
                Por favor, no respondas a este mensaje.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Envía el correo de bienvenida usando la API de Resend (HTTPS, sin SMTP).
 * Fire-and-forget: los errores se registran pero no interrumpen el registro.
 */
async function sendWelcomeEmail(nombre, email) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY no configurado — se omite el correo de bienvenida');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from   = process.env.EMAIL_FROM || 'ConectaRural <onboarding@resend.dev>';

  const logoBuffer = fs.readFileSync(path.join(__dirname, '..', 'assets', 'logo.png'));

  console.log('[email] Enviando bienvenida a', email);

  const { data, error } = await resend.emails.send({
    from,
    to:      [email],
    subject: '¡Bienvenida a ConectaRural!',
    html:    welcomeHtml(nombre),
    attachments: [
      {
        filename:   'logo.png',
        content:    logoBuffer,
        content_id: 'logo_conectarural',
      },
    ],
  });

  if (error) throw new Error(JSON.stringify(error));
  console.log('[email] Correo enviado OK, id:', data.id);
}

module.exports = { sendWelcomeEmail };
