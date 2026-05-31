// fcm_service.js
// Servicio de notificaciones push via Firebase Cloud Messaging.
// Requiere configurar GOOGLE_APPLICATION_CREDENTIALS o FCM_SERVER_KEY en .env
// (ver pasos manuales al final de este archivo).

let messaging = null;

try {
  const admin = require('firebase-admin');
  if (process.env.FCM_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON);
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    messaging = admin.messaging();
    console.log('FCM: Firebase Admin inicializado correctamente');
  } else {
    console.warn('FCM: FCM_SERVICE_ACCOUNT_JSON no definido — notificaciones push desactivadas');
  }
} catch (err) {
  console.warn('FCM: firebase-admin no instalado o error de configuración — notificaciones push desactivadas');
}

/**
 * Envía una notificación push a un token FCM.
 * @param {string} fcmToken   Token del dispositivo destino
 * @param {string} title      Título de la notificación
 * @param {string} body       Cuerpo del mensaje
 * @param {object} data       Datos adicionales (opcional)
 */
async function sendPush(fcmToken, title, body, data = {}) {
  if (!messaging || !fcmToken) return;
  try {
    await messaging.send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  } catch (err) {
    // Token inválido u otro error: no romper el flujo principal
    console.warn('FCM: error enviando notificación:', err.message);
  }
}

module.exports = { sendPush };

/*
 * ─── PASOS MANUALES PARA ACTIVAR FCM ────────────────────────────────────────
 *
 * 1. Crea un proyecto en https://console.firebase.google.com
 *    - Nombre sugerido: "conectarural"
 *
 * 2. En Configuración del proyecto → Cuentas de servicio
 *    → "Generar nueva clave privada" → descarga el JSON
 *
 * 3. Convierte el JSON a una sola línea (sin saltos de línea) y añade en .env:
 *    FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
 *
 * 4. Instala firebase-admin:
 *    npm install firebase-admin
 *
 * 5. Android (Flutter): descarga google-services.json desde Firebase Console
 *    → Copia en conectarural-app/android/app/google-services.json
 *
 * 6. iOS (Flutter): descarga GoogleService-Info.plist desde Firebase Console
 *    → Copia en conectarural-app/ios/Runner/GoogleService-Info.plist
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
