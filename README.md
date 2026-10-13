# Informe diario Meta Ads → Bitrix24

Cada día laborable (lunes a viernes, 07:45 hora de Ecuador) GitHub Actions:

1. Consulta en la **API de Marketing de Meta** las campañas con entrega del día anterior.
2. Arma el informe con el mismo diseño y las mismas reglas del applet `dashboard informe diario - actualizado.html`: semáforo, alertas y totales. Columnas: campaña, entrega, presupuesto diario, leads (resultados), costo por lead y gasto.
3. Genera la imagen `informe_diario_meta_educatics_DD_mes_AAAA.png`.
4. La publica en el chat **"Marketing - Diseño gráfico (P)"** de Bitrix24 con el mensaje
   *"Buenos días, adjunto detalle de campañas. Saludos cordiales."*

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `informe.js` | Script principal |
| `src/meta.js` | Lectura de campañas desde Meta |
| `src/bitrix.js` | Envío de la imagen al chat de Bitrix24 |
| `plantilla.html` | Diseño del informe (copiado del applet) |
| `config.json` | Cuenta publicitaria (`act_208537584721591`), mensaje, zona horaria, feriados y tipos de resultado |
| `ejemplo.json` | Datos reales del 12 oct 2026, para pruebas |
| `.github/workflows/informe-diario.yml` | Programación lunes a viernes |

---

## Configuración (una sola vez)

### 1. Token de Meta (usuario del sistema, no caduca)

1. Ve a [developers.facebook.com/apps](https://developers.facebook.com/apps) y crea una app de tipo **Empresa** asociada al Business Manager de EDUCATICS. Agrégale el producto **API de Marketing**.
2. En **Configuración del negocio → Usuarios → Usuarios del sistema**, crea un usuario del sistema con rol *Empleado*.
3. Con **Asignar activos**, dale acceso a la cuenta publicitaria EDUCATICS (ID `208537584721591`) con el permiso *Ver rendimiento*. Asígnale también la app.
4. Pulsa **Generar token**, elige la app, marca el permiso `ads_read` y en caducidad elige **Nunca**. Copia el token.

### 2. Webhook de Bitrix24

1. En Bitrix24 entra a **Recursos para desarrolladores → Otro → Webhook entrante**.
2. Marca los permisos **im** (mensajería) y **disk** (Drive) y guarda. Copia la URL, que tiene esta forma: `https://TU-EMPRESA.bitrix24.xx/rest/1/xxxxxxxx/`.
   El mensaje se publicará a nombre del usuario que crea el webhook.
3. Abre el chat **"Marketing - Diseño gráfico (P)"** en el navegador. La URL contiene `IM_DIALOG=chatNNNN`, y ese `chatNNNN` es el ID del chat.

### 3. GitHub

1. Crea un repositorio **privado** en GitHub, por ejemplo `informe-diario`.
2. Sube todos los archivos de esta carpeta, incluida la carpeta `.github`. No subas el Excel ni las imágenes: ya están excluidos en `.gitignore`.
3. Ve a **Settings → Secrets and variables → Actions → New repository secret** y crea estos 3 secretos:

| Secreto | Valor |
|---|---|
| `META_TOKEN` | Token del paso 1 |
| `BITRIX_WEBHOOK_URL` | URL del webhook del paso 2 |
| `BITRIX_CHAT_ID` | `chatNNNN` |

### 4. Prueba

En **Actions → Informe diario Meta Ads → Run workflow**:

- Sin marcar nada: lee los datos de Meta de ayer y genera la imagen **sin enviarla**. Descárgala desde *Artifacts* para revisarla.
- Marcando **Enviar al chat de Bitrix24**: la publica de verdad. Para la primera prueba conviene poner temporalmente un chat de prueba en `BITRIX_CHAT_ID`.

Desde ese momento el informe sale solo de lunes a viernes. Si una ejecución falla, GitHub te avisa por correo y puedes relanzarla a mano. También puedes indicar una fecha distinta en el campo *fecha*.

## Ajustes

- **Feriados:** agrega fechas a `config.json → "feriados"`, por ejemplo `["2026-11-02", "2026-11-03", "2026-12-25"]`. Esos días no se envía el informe.
- **Lunes:** el informe del lunes muestra el domingo, igual que el resto de días muestra el día anterior.
- **Leads:** se cuentan como "Clientes potenciales (formulario)" (`onsite_conversion.lead_grouped`), igual que la columna *Resultados* del Administrador de anuncios.
- **Hora de envío:** modifica la línea `cron` del workflow (está en hora UTC; Ecuador = UTC − 5).
- **Versión de la API de Meta:** `config.json → metaApiVersion`. Meta retira cada versión unos 2 años después de publicarla.
