-- La app guarda la ubicación como objeto {latitude, longitude, displayName}.
alter table public.averias alter column ubicacion drop default;
alter table public.averias alter column ubicacion drop not null;
alter table public.averias alter column ubicacion type jsonb using (
  case when ubicacion is null or ubicacion = '' then null
       when left(ubicacion, 1) = '{' then ubicacion::jsonb
       else null end
);

-- Bucket privado para fotos: sin políticas, solo accede el servidor (URLs firmadas temporales).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;
