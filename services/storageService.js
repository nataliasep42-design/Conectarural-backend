// services/storageService.js
// Sube y elimina vídeos/documentos de los módulos en Firebase Storage.
//
// Por qué: Render usa almacenamiento efímero — los archivos guardados con
// multer.diskStorage en uploads/ desaparecen cuando el servicio se reinicia
// o se redespliega, dejando url_archivo apuntando a un 404. Firebase Storage
// persiste los archivos fuera del contenedor y reutiliza las credenciales
// de servicio que ya existen para FCM (FCM_SERVICE_ACCOUNT_JSON).

const BUCKET_NAME = 'conectarural-26759.firebasestorage.app';
const PUBLIC_URL_PREFIX = `https://storage.googleapis.com/${BUCKET_NAME}/`;

let bucket = null;

try {
  const admin = require('firebase-admin');
  if (process.env.FCM_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON);
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    bucket = admin.storage().bucket(BUCKET_NAME);
    console.log('Storage: Firebase Storage inicializado correctamente');
  } else {
    console.warn('Storage: FCM_SERVICE_ACCOUNT_JSON no definido — subida de archivos a Firebase desactivada');
  }
} catch (err) {
  console.warn('Storage: firebase-admin no instalado o error de configuración — subida de archivos a Firebase desactivada');
}

/**
 * Sube un buffer en memoria a Firebase Storage y devuelve su URL pública estable.
 * @param {Buffer} buffer       Contenido del archivo (req.file.buffer con multer.memoryStorage)
 * @param {string} destPath     Ruta dentro del bucket, p.ej. 'videos/modulo_9_123.mp4'
 * @param {string} contentType  MIME type del archivo
 * @returns {Promise<string>}   URL pública del archivo subido
 */
async function uploadBuffer(buffer, destPath, contentType) {
  if (!bucket) {
    throw new Error('Firebase Storage no está configurado (falta FCM_SERVICE_ACCOUNT_JSON)');
  }
  const file = bucket.file(destPath);
  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
  });
  await file.makePublic();
  return `${PUBLIC_URL_PREFIX}${destPath}`;
}

/**
 * Elimina de Firebase Storage el archivo referenciado por una URL pública previamente
 * devuelta por uploadBuffer. Si la URL no pertenece al bucket (p.ej. una ruta antigua
 * /uploads/...) o el archivo ya no existe, no hace nada.
 * @param {string} url
 */
async function deleteByUrl(url) {
  if (!bucket || !url || !url.startsWith(PUBLIC_URL_PREFIX)) return;
  const destPath = url.slice(PUBLIC_URL_PREFIX.length);
  try {
    await bucket.file(destPath).delete();
  } catch (err) {
    if (err.code !== 404) {
      console.warn('Storage: error al eliminar archivo:', err.message);
    }
  }
}

module.exports = { uploadBuffer, deleteByUrl, isConfigured: () => !!bucket };
