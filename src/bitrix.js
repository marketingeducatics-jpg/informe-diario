// Envío de la imagen del informe a un chat de Bitrix24 mediante un webhook entrante (permisos: im, disk).
import fs from 'node:fs/promises';

async function llamar(webhook, metodo, params) {
  const url = webhook.replace(/\/?$/, '/') + metodo + '.json';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json().catch(() => ({}));
  // No se imprime la URL: contiene la clave del webhook.
  if (!res.ok || json.error) {
    throw new Error(`Bitrix24 ${metodo}: ${json.error_description || json.error || `HTTP ${res.status}`}`);
  }
  return json.result;
}

export async function enviarABitrix({ webhook, chatId, mensaje, archivo, nombre }) {
  const chat = String(chatId).trim().replace(/^chat/i, '');
  const carpeta = await llamar(webhook, 'im.disk.folder.get', { CHAT_ID: chat });
  const contenido = (await fs.readFile(archivo)).toString('base64');
  const subido = await llamar(webhook, 'disk.folder.uploadfile', {
    id: carpeta.ID,
    data: { NAME: nombre },
    fileContent: [nombre, contenido],
    generateUniqueName: true,
  });
  await llamar(webhook, 'im.disk.file.commit', { CHAT_ID: chat, UPLOAD_ID: subido.ID, MESSAGE: mensaje });
}
