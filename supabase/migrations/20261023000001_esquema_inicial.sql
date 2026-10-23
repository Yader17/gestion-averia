-- Esquema inicial de Gestión de Averías.
-- Todas las tablas tienen RLS activado y SIN políticas: el acceso directo con la
-- clave pública (anon/publishable) queda denegado. Solo la Edge Function "api"
-- (clave secreta del servidor) lee y escribe, tras validar sesión y rol.

create table if not exists public.tecnicos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text,
  rol text not null check (rol in ('administrador', 'tecnico', 'consulta')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.tecnicos (id)
);
create unique index if not exists tecnicos_email_uq on public.tecnicos (lower(email)) where email is not null;

-- Solo se guarda un verificador (HMAC-SHA256 con secreto del servidor), nunca el código.
-- entrega_cifrada: código recién generado por rotación automática, cifrado con clave del
-- servidor hasta que un administrador lo recoge una vez (después se borra).
create table if not exists public.codigos_acceso (
  id uuid primary key default gen_random_uuid(),
  tecnico_id uuid not null references public.tecnicos (id) on delete cascade,
  code_hash text not null unique,
  emitido_en timestamptz not null default now(),
  expira_en timestamptz not null,
  revocado_en timestamptz,
  motivo_revocacion text,
  entrega_cifrada text,
  origen text not null check (origen in ('alta', 'renovacion_usuario', 'rotacion_automatica', 'reemision_admin', 'bootstrap'))
);
create index if not exists codigos_tecnico_idx on public.codigos_acceso (tecnico_id);

create table if not exists public.sesiones (
  id uuid primary key default gen_random_uuid(),
  tecnico_id uuid not null references public.tecnicos (id) on delete cascade,
  token_hash text not null unique,
  creada_en timestamptz not null default now(),
  expira_en timestamptz not null,
  ultima_actividad timestamptz not null default now(),
  revocada_en timestamptz,
  dispositivo text
);
create index if not exists sesiones_tecnico_idx on public.sesiones (tecnico_id);

create table if not exists public.intentos_login (
  id bigserial primary key,
  origen_hash text not null,
  exito boolean not null,
  en timestamptz not null default now()
);
create index if not exists intentos_origen_idx on public.intentos_login (origen_hash, en desc);

create table if not exists public.averias (
  id text primary key,
  fecha text not null default '',
  numero_bastidor text not null default '',
  tipo_averia text not null default '',
  intervencion text not null default '',
  lugar text not null default '',
  ubicacion text not null default '',
  observacion text not null default '',
  solucionado boolean not null default false,
  fotos jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  origen_migracion text,
  creado_en timestamptz not null default now(),
  creado_por uuid references public.tecnicos (id),
  creado_por_nombre text,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references public.tecnicos (id),
  actualizado_por_nombre text
);

-- Historial inmutable: sin FK a averias para que sobreviva a un borrado.
create table if not exists public.averias_historial (
  id bigserial primary key,
  averia_id text not null,
  version integer not null,
  accion text not null check (accion in ('crear', 'modificar', 'eliminar', 'importar')),
  cambios jsonb not null default '{}'::jsonb,
  tecnico_id uuid,
  tecnico_nombre text,
  en timestamptz not null default now()
);
create index if not exists historial_averia_idx on public.averias_historial (averia_id, en desc);

create table if not exists public.auditoria (
  id bigserial primary key,
  en timestamptz not null default now(),
  actor_id uuid,
  actor_nombre text,
  accion text not null,
  objetivo text,
  detalle jsonb not null default '{}'::jsonb
);
create index if not exists auditoria_en_idx on public.auditoria (en desc);

create table if not exists public.ia_consultas (
  id bigserial primary key,
  tecnico_id uuid not null,
  en timestamptz not null default now()
);
create index if not exists ia_consultas_idx on public.ia_consultas (tecnico_id, en desc);

create table if not exists public.configuracion (
  clave text primary key,
  valor text not null
);
insert into public.configuracion (clave, valor)
values ('contacto_codigos', 'yjiron2000@gmail.com')
on conflict (clave) do nothing;

-- Cada tabla: RLS activo, sin políticas, sin permisos para anon/authenticated.
do $$
declare t text;
begin
  foreach t in array array['tecnicos','codigos_acceso','sesiones','intentos_login','averias',
                           'averias_historial','auditoria','ia_consultas','configuracion']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Historial y auditoría son de solo inserción: se bloquean update/delete incluso al servidor.
create or replace function public.bloquear_modificacion() returns trigger
language plpgsql as $$
begin
  raise exception 'La tabla % es de solo inserción', tg_table_name;
end $$;

drop trigger if exists historial_inmutable on public.averias_historial;
create trigger historial_inmutable before update or delete on public.averias_historial
  for each row execute function public.bloquear_modificacion();
drop trigger if exists auditoria_inmutable on public.auditoria;
create trigger auditoria_inmutable before update or delete on public.auditoria
  for each row execute function public.bloquear_modificacion();
