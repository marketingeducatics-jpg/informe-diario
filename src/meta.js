// Lectura de métricas de campañas desde la API de Marketing de Meta.
const BASE = 'https://graph.facebook.com';

// Códigos de error temporales de Meta (límites de uso / errores internos) que vale la pena reintentar.
const REINTENTABLES = new Set([1, 2, 4, 17, 32, 613]);

async function get(url, intentos = 3) {
  for (let i = 1; ; i++) {
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (res.ok) return json;
    const err = json.error || {};
    if (i >= intentos || !(res.status >= 500 || REINTENTABLES.has(err.code))) {
      throw new Error(`Meta API ${res.status}: ${err.message || res.statusText} (código ${err.code ?? '-'})`);
    }
    await new Promise((r) => setTimeout(r, 5000 * i));
  }
}

async function getTodo(url) {
  const datos = [];
  while (url) {
    const json = await get(url);
    datos.push(...(json.data || []));
    url = json.paging?.next;
  }
  return datos;
}

function contarResultados(actions = [], tipos) {
  for (const tipo of tipos) {
    const a = actions.find((x) => x.action_type === tipo);
    if (a) return Number(a.value);
  }
  return null;
}

/**
 * Devuelve las campañas con entrega en `fecha` (YYYY-MM-DD), con las mismas columnas
 * que el informe exportado del Administrador de anuncios:
 * [{ nombre, entrega: 'active' | 'inactive', presupuesto, resultados, gasto }]
 */
export async function obtenerCampanas({ token, cuenta, fecha, version, tiposResultado }) {
  const act = cuenta.startsWith('act_') ? cuenta : `act_${cuenta}`;
  const raiz = `${BASE}/${version}`;
  const q = (p) => new URLSearchParams({ ...p, access_token: token }).toString();

  const filas = await getTodo(`${raiz}/${act}/insights?` + q({
    level: 'campaign',
    time_range: JSON.stringify({ since: fecha, until: fecha }),
    fields: 'campaign_id,campaign_name,spend,actions',
    limit: '500',
  }));
  if (!filas.length) return [];

  const ids = filas.map((f) => f.campaign_id);
  const info = {};
  for (let i = 0; i < ids.length; i += 50) {
    Object.assign(info, await get(`${raiz}/?` + q({
      ids: ids.slice(i, i + 50).join(','),
      fields: 'name,effective_status,daily_budget,objective',
    })));
  }

  // Campañas sin presupuesto a nivel campaña (presupuesto por conjunto): se suma el diario de sus conjuntos.
  const sinPpto = ids.filter((id) => !info[id]?.daily_budget);
  const pptoConjuntos = {};
  if (sinPpto.length) {
    const conjuntos = await getTodo(`${raiz}/${act}/adsets?` + q({
      fields: 'campaign_id,daily_budget,effective_status',
      filtering: JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: sinPpto }]),
      limit: '500',
    }));
    for (const c of conjuntos) {
      if (!c.daily_budget) continue;
      pptoConjuntos[c.campaign_id] = (pptoConjuntos[c.campaign_id] || 0) + Number(c.daily_budget);
    }
  }

  return filas.map((f) => {
    const c = info[f.campaign_id] || {};
    const centavos = Number(c.daily_budget || pptoConjuntos[f.campaign_id] || 0);
    return {
      nombre: c.name || f.campaign_name,
      entrega: c.effective_status === 'ACTIVE' ? 'active' : 'inactive',
      presupuesto: centavos ? centavos / 100 : null,
      resultados: contarResultados(f.actions, tiposResultado),
      gasto: Number(f.spend || 0),
    };
  });
}
