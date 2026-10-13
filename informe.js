// Informe diario de Meta Ads → imagen PNG → chat de Bitrix24.
//
//   node informe.js                 datos reales de ayer, genera la imagen y la envía a Bitrix24
//   node informe.js --no-enviar     igual, pero sin enviar (solo deja la imagen en salida/)
//   node informe.js --demo          usa ejemplo.json en lugar de la API de Meta (no envía salvo --enviar)
//   node informe.js --solo-html     no genera PNG; deja salida/informe.html para revisarlo en el navegador
//
// Variables de entorno: META_TOKEN, BITRIX_WEBHOOK_URL, BITRIX_CHAT_ID,
// META_AD_ACCOUNT_ID (opcional; por defecto la cuenta de config.json),
// FECHA (opcional, YYYY-MM-DD; por defecto ayer en la zona horaria de config.json).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { obtenerCampanas } from './src/meta.js';
import { enviarABitrix } from './src/bitrix.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(DIR, 'salida');
const args = new Set(process.argv.slice(2));
const demo = args.has('--demo');
const soloHtml = args.has('--solo-html');
const enviar = !soloHtml && !args.has('--no-enviar') && (!demo || args.has('--enviar'));

const leerJson = async (f) => JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8'));
const config = await leerJson('config.json');

function hoyEn(tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()); // YYYY-MM-DD
}
function diaAnterior(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function requerido(nombre) {
  const v = process.env[nombre]?.trim();
  if (!v) throw new Error(`Falta la variable de entorno ${nombre}`);
  return v;
}

const hoy = hoyEn(config.zonaHoraria);
if (process.env.GITHUB_EVENT_NAME === 'schedule' && config.feriados.includes(hoy)) {
  console.log(`Hoy (${hoy}) es feriado según config.json; no se envía informe.`);
  process.exit(0);
}

let periodo, campanas;
if (demo) {
  ({ periodo, campanas } = await leerJson('ejemplo.json'));
} else {
  periodo = process.env.FECHA?.trim() || diaAnterior(hoy);
  campanas = await obtenerCampanas({
    token: requerido('META_TOKEN'),
    cuenta: process.env.META_AD_ACCOUNT_ID?.trim() || config.cuentaPublicitaria,
    fecha: periodo,
    version: config.metaApiVersion,
    tiposResultado: config.tiposResultado,
  });
}
console.log(`Período ${periodo}: ${campanas.length} campañas con entrega.`);

await fs.mkdir(SALIDA, { recursive: true });
await fs.writeFile(path.join(SALIDA, 'datos.json'), JSON.stringify({ periodo, campanas }, null, 2));

const datos = JSON.stringify({ periodo, generado: hoy, campanas }).replace(/</g, '\\u003c');
const plantilla = await fs.readFile(path.join(DIR, 'plantilla.html'), 'utf8');
const html = plantilla.replace('<!--DATOS-->', `<script>window.INFORME = ${datos};</script>`);
const archivoHtml = path.join(SALIDA, 'informe.html');
await fs.writeFile(archivoHtml, html);

if (soloHtml) {
  console.log(`HTML generado: ${archivoHtml}`);
  process.exit(0);
}

// Nombre igual al que usa el applet: informe_diario_meta_educatics_12_oct_2026.png
const [a, mes, d] = periodo.split('-');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombrePng = `informe_diario_meta_educatics_${d}_${MESES[Number(mes) - 1]}_${a}.png`;
const archivoPng = path.join(SALIDA, nombrePng);

const { chromium } = await import('playwright');
const navegador = await chromium.launch();
try {
  const pagina = await navegador.newPage({ viewport: { width: 1180, height: 800 }, deviceScaleFactor: 2 });
  await pagina.goto(pathToFileURL(archivoHtml).href, { waitUntil: 'networkidle' });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForSelector('body[data-listo="1"]');
  await pagina.locator('#shot').screenshot({ path: archivoPng });
} finally {
  await navegador.close();
}
console.log(`Imagen generada: ${archivoPng}`);

if (enviar) {
  await enviarABitrix({
    webhook: requerido('BITRIX_WEBHOOK_URL'),
    chatId: requerido('BITRIX_CHAT_ID'),
    mensaje: config.mensaje,
    archivo: archivoPng,
    nombre: nombrePng,
  });
  console.log('Informe enviado al chat de Bitrix24.');
} else {
  console.log('Envío a Bitrix24 omitido.');
}
