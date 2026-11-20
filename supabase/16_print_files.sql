-- Optional: approved circle-50mm file bundles use the existing private request-files bucket.
-- Does not change read/write policies: only the owner and the accepted printer can read design_path.
-- Run once in Supabase SQL Editor when enabling direct in-app ZIP delivery.
update storage.buckets
set allowed_mime_types = case when allowed_mime_types is null then null else (select array_agg(distinct mime) from unnest(allowed_mime_types || array['application/zip']) as mime) end,
    file_size_limit = case when file_size_limit is null then null else greatest(file_size_limit,31457280) end
where id='request-files';
