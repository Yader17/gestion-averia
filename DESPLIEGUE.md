# Gestión de Averías: despliegue, seguridad y operación

## Arquitectura

- **Cliente**: Expo / React Native (+ react-native-web, Electron). Solo habla con la Edge Function `api`.
- **Servidor**: Supabase (Postgres + Storage + Edge Function `supabase/functions/api`). Es el almacén central; las tablas tienen RLS activada sin políticas, así que el cliente no accede a ellas directamente.
- **Autenticación**: código personal por técnico (20 caracteres, 100 bits, generado en servidor). Solo se guarda un HMAC-SHA256 con *pepper*. Vigencia de 120 días, rotación automática y avisos a 14, 7 y 1 días.
- **IA**: acción `ia.consultar` en el servidor. Recuperación (RAG) sobre las averías reales y llamada a Gemini desde el servidor. Proveedor intercambiable (`AiProvider` en `supabase/functions/_shared/ai.ts`).
- **Documentación técnica**: biblioteca privada de PDF en Supabase Storage. Solo administradores cargan o eliminan; los tres roles autenticados pueden leer y consultar los manuales en la IA. La búsqueda es textual por página y las respuestas validan sus referencias contra las páginas recuperadas.
- **Actualizaciones**: EAS Update (JavaScript por OTA). Los cambios nativos requieren un APK nuevo.

## Variables de entorno

### Cliente (públicas, pueden ir en `.env` o `app.json`)

| Variable | Descripción |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto (`https://<ref>.supabase.co`). Alternativa: `extra.backend.url` en `app.json`. |

### Servidor (secretos de la Edge Function; nunca en Git)

| Secreto | Obligatorio | Descripción |
|---|---|---|
| `CODE_PEPPER` | sí | Clave para el HMAC de códigos y tokens de sesión. Si se cambia, todos los códigos dejan de valer. |
| `DELIVERY_KEY` | sí | Clave AES-GCM para la entrega puntual de códigos recién emitidos. |
| `BOOTSTRAP_TOKEN` | sí | Autoriza la creación del primer administrador (solo funciona si no hay ninguno). |
| `CRON_TOKEN` | sí | Autoriza la rotación automática (`system.rotate`). |
| `GEMINI_API_KEY` | para IA | Clave de Gemini. Sin ella el asistente usa búsqueda tradicional. |
| `GEMINI_MODEL` | no | Modelo preferido (por defecto `gemini-3.6-flash`). Hay respaldo automático a otros modelos si responde 404, 429 o 503. |
| `AI_USER_PER_HOUR` | no | Consultas de IA por usuario y hora (20 por defecto). |
| `AI_GLOBAL_PER_DAY` | no | Consultas de IA globales por día (500 por defecto). |

Se cargan con `npx supabase secrets set --env-file supabase/.env` (archivo local ignorado por Git).

## Despliegue

1. `npx supabase login` y `npx supabase link --project-ref <ref>`.
2. `npx supabase db push --linked`: aplica `supabase/migrations`.
3. `npx supabase secrets set ...`: ver tabla anterior.
4. `npx supabase functions deploy api --no-verify-jwt`. La autenticación es propia (sesiones por código), por eso se desactiva la verificación JWT de Supabase.
5. Primer administrador: acción `system.bootstrap` con `{token: BOOTSTRAP_TOKEN, nombre, email}`. Devuelve el código una sola vez. Sin contraseñas por defecto.
6. Rotación diaria (una sola vez, en el SQL editor o con `supabase db query --linked`). Sustituye `<CRON_TOKEN>` y `<ref>`:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('rotar-codigos-acceso', '15 3 * * *', $job$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/api',
    headers := jsonb_build_object('content-type','application/json','x-cron-token','<CRON_TOKEN>'),
    body := '{"action":"system.rotate","params":{}}'::jsonb) $job$);
```

7. Compilar el APK: `npx eas-cli build -p android --profile preview`.
8. Publicar cambios de JavaScript: `npx eas-cli update --channel preview --message "..."`.

## Biblioteca de documentación técnica

- La migración aditiva `20261113000003_manuales_tecnicos.sql` crea las tablas de documentos y páginas, el índice textual y el bucket privado `manuales`. No modifica averías ni archivos existentes.
- Solo se aceptan PDF de hasta 20 MB y 500 páginas. Se indexa texto seleccionable por página; los PDF escaneados requieren OCR y quedan marcados como no indexados.
- Los documentos solo se operan mediante la Edge Function autenticada: todos los roles pueden listar/abrir manuales indexados; solo el administrador puede cargar, reintentar indexación o eliminar. Las URL de lectura son firmadas y caducan en 10 minutos.
- La IA busca páginas con búsqueda de texto PostgreSQL y envía a Gemini solo las páginas recuperadas. Considera la confidencialidad de los manuales y las condiciones de uso del proveedor antes de subirlos.

## Migración de datos antiguos

Los datos de la versión anterior estaban en el dispositivo (AsyncStorage). No se migran solos:

1. Antes de nada, exportar a Excel desde la app antigua (copia de seguridad).
2. Con la app nueva, iniciar sesión como administrador: **Más → Configuración → Administración → Migración**. Hace una copia de seguridad local (`@gestion_averias/backup_premigracion`) y sube los registros por lotes. La importación es solo de inserción: nunca sobrescribe registros existentes.
3. Las fotos que existan únicamente en el dispositivo no se migran.

## Seguridad: qué se garantiza y qué no

- Los códigos nunca se guardan en claro. Los tokens de sesión tampoco (solo su hash).
- Límite de intentos fallidos de acceso: 5 por origen y 100 globales cada 15 minutos.
- Conflictos: las actualizaciones llevan versión; si otro usuario modificó el registro, el servidor responde 409 y no sobrescribe en silencio.
- Historial de cambios (`averias_historial`) y auditoría (`auditoria`) inmutables por trigger.
- La IA es de solo lectura, no puede crear, modificar ni eliminar averías. Las averías se envían al modelo como datos delimitados. Los IDs y soluciones de la respuesta se validan contra los registros reales antes de mostrarse. No se envía el campo "lugar" ni datos de autores a Gemini.
- Limitaciones conocidas:
  - En la versión web el token de sesión se guarda en `localStorage`; en Android usa SecureStore.
  - El nivel gratuito de Gemini puede usar los datos enviados para mejorar los modelos de Google. No lo uses con información confidencial sin revisar sus condiciones.
  - El código, la dependencia y la configuración de Firebase ya se han retirado del repositorio. Las reglas de Firestore viven en la consola de Firebase: ciérralas o elimina la base de datos allí.

## Versión de escritorio (Windows)

1. `npm install`
2. `npm run electron:build-installer` genera el instalador NSIS en `electron-dist\`.
3. El instalador no está firmado: Windows SmartScreen puede mostrar un aviso ("Más información" > "Ejecutar de todas formas").
  - Pendiente de comprobar en dispositivo real: subida de fotos desde Android y accesibilidad con lector de pantalla.

## Pruebas

```
npx tsc --noEmit
npx vitest run
npx expo export --platform web
```
