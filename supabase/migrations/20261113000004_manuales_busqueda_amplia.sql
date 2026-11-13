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
  with terminos as (
    select distinct termino
    from regexp_split_to_table(lower(left(coalesce(p_consulta, ''), 1000)), '[^[:alnum:]]+') as partes(termino)
    where length(termino) >= 3
      and termino not in (
        'a','al','de','del','el','la','las','los','un','una','unos','unas','y','o','en','por','para','con','como',
        'que','qué','cual','cuál','donde','dónde','cuando','cuándo','the','what','does','how','why','is','are',
        'and','or','of','to','in','on','for','with','from','about','manual','manuales','manuals','page','pagina'
      )
  ),
  consulta as (
    select case
      when count(*) = 0 then null
      else to_tsquery('simple', string_agg(termino || ':*', ' | ' order by termino))
    end as q
    from terminos
  )
  select m.id, m.titulo, m.equipo, p.pagina, p.contenido,
         ts_rank(p.contenido_busqueda, consulta.q) as rango
  from public.manuales_tecnicos_paginas p
  join public.manuales_tecnicos m on m.id = p.manual_id
  cross join consulta
  where m.estado = 'listo'
    and consulta.q is not null
    and p.contenido_busqueda @@ consulta.q
  order by rango desc, m.creado_en desc, p.pagina
  limit least(greatest(coalesce(p_limite, 8), 1), 12);
$$;
revoke all on function public.buscar_paginas_manuales(text, integer) from public, anon, authenticated;
grant execute on function public.buscar_paginas_manuales(text, integer) to service_role;
