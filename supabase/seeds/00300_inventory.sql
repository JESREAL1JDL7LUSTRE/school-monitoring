insert into public.inventory_items (id,category_id,item_code,name,unit,unit_cost,condition) values
 ('22222222-2222-4222-8222-222222222222','22000000-0000-4000-8000-000000000001','DEMO-PAPER','Bond paper A4','ream',260,'Serviceable'),
 ('22222222-2222-4222-8222-222222222223','22000000-0000-4000-8000-000000000003','DEMO-LAPTOP','Laptop, 14 inch','unit',38000,'Serviceable'),
 ('22222222-2222-4222-8222-222222222224','22000000-0000-4000-8000-000000000002','DEMO-BOOK','Mathematics textbook','copy',125,'Serviceable'),
 ('22222222-2222-4222-8222-222222222225','22000000-0000-4000-8000-000000000004','DEMO-SCALE','Electronic balance','unit',3000,'Unserviceable'),
 ('22222222-2222-4222-8222-222222222226','22000000-0000-4000-8000-000000000011','DEMO-BLDG','Classroom building A','unit',2900000,'Serviceable');
update public.inventory_items set details='{"design":"Type A","year":"2018","storeys":"1","rooms":"3","area":"210","fund":"Local education fund","title":"DEMO-LOT-01"}'
  where item_code='DEMO-BLDG';

do $$
begin
perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
perform public.post_inventory_document('receipt',(now() at time zone 'Asia/Manila')::date - 1,
  '[{"item_id":"22222222-2222-4222-8222-222222222222","quantity":100},
    {"item_id":"22222222-2222-4222-8222-222222222223","quantity":8},
    {"item_id":"22222222-2222-4222-8222-222222222224","quantity":20},
    {"item_id":"22222222-2222-4222-8222-222222222225","quantity":2},
    {"item_id":"22222222-2222-4222-8222-222222222226","quantity":1}]'::jsonb,
  null,'Synthetic opening stock');
perform set_config('request.jwt.claim.sub','',true);
end;
$$;
