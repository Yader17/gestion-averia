create table if not exists public.manuales_tecnicos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  equipo text not null default '',
  nombre_archivo text not null,
  ruta_storage text not null unique,
  tamano_bytes bigint not null check (tamano_bytes > 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'listo', 'error')),
  paginas integer not null default 0 check (paginas >= 0),
  error_indexacion text,
  subido_por uuid references public.tecnicos (id),
  subido_por_nombre text,
  creado_en timestamptz not null default now(),
  indexado_en timestamptz
);
create index if not exists manuales_tecnicos_estado_idx on public.manuales_tecnicos (estado, creado_en desc);

create table if not exists public.manuales_tecnicos_paginas (
  manual_id uuid not null references public.manuales_tecnicos (id) on delete cascade,
  pagina integer not null check (pagina > 0),
  contenido text not null,
  contenido_busqueda tsvector generated always as (to_tsvector('simple', contenido)) stored,
  primary key (manual_id, pagina)
);
create index if not exists manuales_paginas_busqueda_idx
  on public.manuales_tecnicos_paginas using gin (contenido_busqueda);

alter table public.manuales_tecnicos enable row level security;
alter table public.manuales_tecnicos_paginas enable row level security;
revoke all on public.manuales_tecnicos from anon, authenticated;
revoke all on public.manuales_tecnicos_paginas from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manuales', 'manuales', false, 20971520, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf'];

create or replace function public.buscar_paginas_manuales(p_consulta text, p_limite integer default 8)
returns table (
  manual_id uuid,
  titulo text,
  equipo text,
  pagina integer,
  contenido text,
  rango real
)
language sql
stable
security definer
set search_path = public
as $$
  with consulta as (
    select plainto_tsquery('simple', left(coalesce(p_consulta, ''), 1000)) as q
  )
  select m.id, m.titulo, m.equipo, p.pagina, p.contenido,
         ts_rank(p.contenido_busqueda, consulta.q) as rango
  from public.manuales_tecnicos_paginas p
  join public.manuales_tecnicos m on m.id = p.manual_id
  cross join consulta
  where m.estado = 'listo'
    and numnode(consulta.q) > 0
    and p.contenido_busqueda @@ consulta.q
  order by rango desc, m.creado_en desc, p.pagina
  limit least(greatest(coalesce(p_limite, 8), 1), 12);
$$;
revoke all on function public.buscar_paginas_manuales(text, integer) from public, anon, authenticated;
grant execute on function public.buscar_paginas_manuales(text, integer) to service_role;
