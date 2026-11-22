-- Synthetic walkthrough inventory. The first five inventory fixtures are managed by 00300.
do $$
declare
  fixture record;
  actor constant uuid := '10000000-0000-4000-8000-000000000004';
  maya constant uuid := '11111111-1111-4111-8111-111111111111';
  tomas constant uuid := '11111111-1111-4111-8111-111111111112';
  demo_date constant date := (now() at time zone 'Asia/Manila')::date;
  previous_actor text := current_setting('request.jwt.claim.sub', true);
  item_id_value uuid;
  item_code_value text;
  issue_quantity numeric;
  receipt_request uuid;
  issue_request uuid;
  return_request uuid;
  final_request uuid;
  issued_line bigint;
  recorded_balance numeric;
  counted_balance numeric;
  count_note text;
begin
  if not exists (select 1 from auth.users where id = actor and email = 'property@school.example') then
    raise exception 'Load the local school demo accounts before the inventory walkthrough';
  end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);

  for fixture in
    select * from (values
      (1, 'SUP-MARKER', 'Whiteboard markers', 'box', 345.00, 24, 6, 'loan', 'Supply room',
       '{"old":"SUP-017","remarks":"Assorted colors, twelve markers per box"}'),
      (1, 'SUP-FOLDER', 'Document folders', 'pack', 180.00, 12, 5, 'closed', 'Records office', '{}'),
      (1, 'SUP-TRAY', 'Damaged document trays', 'unit', 290.00, 3, 0, 'disposal', 'Holding area', '{}'),
      (2, 'BOOK-SCI', 'Grade 6 science reader', 'copy', 315.00, 32, 8, 'loan', 'Library',
       '{"grade_level":"Grade 6","author_subject":"Science","supplier":"Demo Learning Press"}'),
      (2, 'BOOK-MATH', 'Grade 4 mathematics workbook', 'copy', 225.00, 25, 5, 'closed', 'Library',
       '{"grade_level":"Grade 4","author_subject":"Mathematics"}'),
      (2, 'BOOK-ATLAS', 'Damaged classroom atlases', 'copy', 450.00, 3, 0, 'disposal', 'Library holding shelf',
       '{"grade_level":"Grade 5","author_subject":"Social studies"}'),
      (3, 'ICT-TABLET', 'Classroom tablet', 'unit', 14200.00, 12, 3, 'loan', 'ICT lab',
       '{"old":"ICT-024","serial":"DEMO-TABLET-S10","useful_life":"5 years"}'),
      (3, 'ICT-SPEAKER', 'USB desktop speaker set', 'set', 980.00, 7, 2, 'closed', 'ICT lab', '{}'),
      (3, 'ICT-MONITOR', 'Faulty LCD monitor', 'unit', 6800.00, 3, 0, 'disposal', 'ICT repair bay',
       '{"serial":"DEMO-MONITOR-L24"}'),
      (4, 'SCI-MICRO', 'Student microscope kit', 'set', 8650.00, 8, 2, 'loan', 'Science room',
       '{"serial":"DEMO-MICRO-M40","supplier":"Demo Laboratory Supply"}'),
      (4, 'SCI-GEOM', 'Class geometry demonstration set', 'set', 2350.00, 6, 2, 'closed', 'Science room',
       '{"supplier":"Demo Laboratory Supply"}'),
      (4, 'SCI-SCALE', 'Corroded laboratory balance', 'unit', 3600.00, 3, 0, 'disposal', 'Science holding room', '{}'),
      (5, 'SPORT-VBALL', 'Volleyball training kit', 'set', 2750.00, 9, 2, 'loan', 'PE storeroom', '{}'),
      (5, 'SPORT-BADM', 'Badminton net and posts', 'set', 4200.00, 5, 1, 'closed', 'PE storeroom', '{}'),
      (5, 'SPORT-MAT', 'Torn exercise mats', 'unit', 1800.00, 3, 0, 'disposal', 'PE storeroom', '{}'),
      (6, 'TLE-TOOLS', 'Carpentry hand tool kit', 'set', 7450.00, 7, 2, 'loan', 'TLE workshop',
       '{"serial":"DEMO-TLE-CARP","useful_life":"7 years"}'),
      (6, 'TLE-SCALES', 'Kitchen measuring set', 'set', 1460.00, 6, 1, 'closed', 'TLE workshop', '{}'),
      (6, 'TLE-DRILL', 'Burned-out bench drill', 'unit', 7650.00, 3, 0, 'disposal', 'Workshop holding bay', '{}'),
      (7, 'SHS-KIT', 'Basic electronics trainer', 'set', 12500.00, 6, 2, 'loan', 'SHS laboratory',
       '{"serial":"DEMO-SHS-ELT"}'),
      (7, 'SHS-METER', 'Digital multimeter', 'unit', 3100.00, 7, 2, 'closed', 'SHS laboratory', '{}'),
      (7, 'SHS-SUPPLY', 'Failed bench power supply', 'unit', 9600.00, 3, 0, 'disposal', 'SHS repair bay', '{}'),
      (8, 'OFF-SCANNER', 'Document scanner', 'unit', 16800.00, 5, 2, 'loan', 'Administration office',
       '{"serial":"DEMO-SCAN-A50"}'),
      (8, 'OFF-BIND', 'Manual binding machine', 'unit', 4800.00, 4, 1, 'closed', 'Records office', '{}'),
      (8, 'OFF-PRINT', 'Decommissioned laser printer', 'unit', 12200.00, 3, 0, 'disposal', 'Administration holding bay', '{}'),
      (8, 'OFF-COPIER', 'Photocopier awaiting service', 'unit', 43500.00, 1, 0, 'repair', 'Administration office',
       '{"remarks":"Paper feed rollers scheduled for replacement"}'),
      (9, 'CLINIC-BP', 'Digital blood-pressure monitor', 'unit', 2650.00, 5, 2, 'loan', 'School clinic', '{}'),
      (9, 'CLINIC-THERMO', 'Infrared thermometer', 'unit', 1850.00, 6, 2, 'closed', 'School clinic', '{}'),
      (9, 'CLINIC-SCALE', 'Broken platform scale', 'unit', 4100.00, 3, 0, 'disposal', 'Clinic holding area', '{}'),
      (10, 'DRRM-RADIO', 'Rechargeable two-way radio', 'unit', 4200.00, 9, 2, 'loan', 'DRRM cabinet',
       '{"serial":"DEMO-DRRM-R40"}'),
      (10, 'DRRM-LAMP', 'Portable emergency lamp', 'unit', 1460.00, 6, 2, 'closed', 'DRRM cabinet', '{}'),
      (10, 'DRRM-SIREN', 'Damaged portable siren', 'unit', 3200.00, 3, 0, 'disposal', 'DRRM holding shelf', '{}'),
      (11, 'BLDG-ANNEX', 'Learning annex', 'building', 3150000.00, 1, 0, 'loan', 'East campus',
       '{"design":"One-storey reinforced concrete building","year":2021,"storeys":1,"rooms":4,"area":282,"fund":"Demo local education fund","title":"DEMO-LOT-02"}'),
      (11, 'BLDG-MULTI', 'Multipurpose pavilion', 'building', 1890000.00, 1, 0, 'closed', 'West campus',
       '{"design":"Covered school pavilion","year":2020,"storeys":1,"rooms":0,"area":190,"fund":"Demo facilities grant","title":"DEMO-LOT-03"}'),
      (11, 'BLDG-SHED', 'Retired storage shed', 'building', 275000.00, 1, 0, 'disposal', 'Service area',
       '{"design":"Detached timber shed","year":2002,"storeys":1,"rooms":0,"area":42,"fund":"Demo facilities grant","title":"DEMO-LOT-04"}'),
      (12, 'FURN-DESK', 'Adjustable classroom desk', 'unit', 3750.00, 20, 5, 'loan', 'Room 6', '{}'),
      (12, 'FURN-CABINET', 'Steel storage cabinet', 'unit', 9400.00, 5, 1, 'closed', 'Records office', '{}'),
      (12, 'FURN-CHAIR', 'Broken classroom chairs', 'unit', 1150.00, 5, 0, 'disposal', 'Maintenance holding area', '{}'),
      (13, 'DON-WHEEL', 'Donated folding wheelchair', 'unit', 9500.00, 5, 1, 'loan', 'School clinic',
       '{"donor":"Demo Community Partners","donation_certificate":"DEMO-DON-020"}'),
      (13, 'DON-SHELF', 'Donated bookcase', 'unit', 6500.00, 5, 1, 'closed', 'Library',
       '{"donor":"Demo Readers Association","donation_certificate":"DEMO-DON-021"}'),
      (13, 'DON-PC', 'Retired donated desktop unit', 'unit', 24000.00, 3, 0, 'disposal', 'ICT holding area',
       '{"donor":"Demo Community Partners","donation_certificate":"DEMO-DON-022"}'),
      (14, 'CANT-WARMER', 'Stainless food warmer', 'unit', 13600.00, 5, 1, 'loan', 'Canteen kitchen', '{}'),
      (14, 'CANT-SCALE', 'Commercial kitchen scale', 'unit', 2950.00, 5, 1, 'closed', 'Canteen kitchen', '{}'),
      (14, 'CANT-OVEN', 'Unserviceable countertop oven', 'unit', 11200.00, 3, 0, 'disposal', 'Canteen holding area', '{}'),
      (15, 'PPE-PROJ', 'Large-venue projector', 'unit', 129500.00, 5, 1, 'loan', 'Multipurpose hall',
       '{"serial":"DEMO-PROJ-X100","fund":"Demo facilities grant","useful_life":"7 years"}'),
      (15, 'PPE-GEN', 'Portable generator', 'unit', 79500.00, 3, 1, 'closed', 'Maintenance room',
       '{"serial":"DEMO-GEN-G80","useful_life":"10 years"}'),
      (15, 'PPE-COPY', 'Decommissioned photocopier', 'unit', 87500.00, 3, 0, 'disposal', 'Maintenance holding area', '{}'),
      (3, 'ICT-DISPLAY', 'Interactive classroom display', 'unit', 123500.00, 2, 0, 'record', 'ICT lab', '{}'),
      (4, 'SCI-IMAGING', 'Digital microscope imaging station', 'set', 86400.00, 1, 0, 'record', 'Science room',
       '{"supplier":"Demo Laboratory Supply"}'),
      (5, 'SPORT-SCORE', 'Electronic scoreboard', 'unit', 69400.00, 1, 0, 'record', 'Covered court', '{}'),
      (6, 'TLE-OVEN', 'Commercial teaching oven', 'unit', 62750.00, 1, 0, 'record', 'TLE workshop', '{}'),
      (7, 'SHS-WORK', 'Laboratory workstation', 'set', 75600.00, 2, 0, 'record', 'SHS laboratory', '{}'),
      (8, 'OFF-COPIER2', 'Network multifunction photocopier', 'unit', 118000.00, 1, 0, 'record', 'Administration office', '{}'),
      (9, 'CLINIC-CAB', 'Temperature-controlled clinic cabinet', 'unit', 68100.00, 1, 0, 'record', 'School clinic', '{}'),
      (10, 'DRRM-POWER', 'Backup power station', 'set', 77000.00, 1, 0, 'record', 'Emergency supply room', '{}'),
      (12, 'FURN-LAB', 'Fixed science lab workbench', 'set', 58500.00, 2, 0, 'record', 'Science room', '{}'),
      (13, 'DON-DISPLAY', 'Donated training display', 'unit', 73400.00, 1, 0, 'record', 'Training room',
       '{"donor":"Demo Community Partners","donation_certificate":"DEMO-DON-023"}'),
      (14, 'CANT-CHILL', 'Commercial reach-in refrigerator', 'unit', 73500.00, 1, 0, 'record', 'Canteen kitchen', '{}')
    ) as inventory(category, code, name, unit, cost, opening, reorder_point, scenario, location, attributes)
  loop
    item_code_value := 'DEMO-INV-' || fixture.code;
    item_id_value := ('70000007-0000-4000-8000-' || substr(md5(fixture.code), 1, 12))::uuid;
    receipt_request := md5('school-admin-desk/demo/inventory/receipt/' || fixture.code)::uuid;
    issue_request := md5('school-admin-desk/demo/inventory/issue/' || fixture.code)::uuid;
    return_request := md5('school-admin-desk/demo/inventory/return/' || fixture.code)::uuid;
    final_request := md5('school-admin-desk/demo/inventory/final/' || fixture.code)::uuid;
    count_note := 'Synthetic demo count for ' || item_code_value;

    insert into public.inventory_items (id, category_id, item_code, name, unit, unit_cost, reorder_point, condition, description, details)
    values (
      item_id_value, ('22000000-0000-4000-8000-' || lpad(fixture.category::text, 12, '0'))::uuid,
      item_code_value, fixture.name, fixture.unit, fixture.cost, fixture.reorder_point,
      case fixture.scenario when 'disposal' then 'Unserviceable' when 'repair' then 'For repair' else 'Serviceable' end,
      'Synthetic school inventory sample used in local demonstrations.',
      jsonb_build_object('location', fixture.location, 'acquired_on', demo_date - 14,
        'received_on', demo_date - 14, 'delivery_receipt', 'DEMO-DR-' || fixture.code) || fixture.attributes::jsonb
    ) on conflict do nothing;
    if not exists (select 1 from public.inventory_items where id = item_id_value) then continue; end if;

    if not exists (select 1 from public.inventory_documents where request_id = receipt_request) then
      perform public.post_inventory_document('receipt', demo_date - 14,
        jsonb_build_array(jsonb_build_object('item_id', item_id_value, 'quantity', fixture.opening)),
        null, 'DEMO-DR-' || fixture.code, receipt_request);
    end if;

    if fixture.scenario in ('loan', 'closed') then
      issue_quantity := case when fixture.scenario = 'loan' then least(2, fixture.opening) else 1 end;
      if not exists (select 1 from public.inventory_documents where request_id = issue_request) then
        perform public.post_inventory_document('issue', demo_date - 10,
          jsonb_build_array(jsonb_build_object('item_id', item_id_value, 'quantity', issue_quantity)),
          case when fixture.scenario = 'loan' then maya else tomas end,
          'Synthetic classroom issue ' || fixture.code, issue_request);
      end if;
      if (fixture.scenario = 'closed' or issue_quantity > 1)
        and not exists (select 1 from public.inventory_documents where request_id = return_request) then
        select ledger.id into strict issued_line
        from public.inventory_transactions ledger
        join public.inventory_documents document on document.id = ledger.document_id
        where document.request_id = issue_request and ledger.item_id = item_id_value;
        perform public.post_inventory_document('return', demo_date - 7,
          jsonb_build_array(jsonb_build_object('item_id', item_id_value, 'quantity', 1, 'issue_line_id', issued_line)),
          null, 'Synthetic classroom return ' || fixture.code, return_request);
      end if;
    end if;

    if not exists (select 1 from public.inventory_documents where request_id = final_request) then
      if fixture.scenario = 'disposal' then
        if fixture.category = 11 then
          perform public.post_inventory_document('disposal', demo_date - 3,
            jsonb_build_array(jsonb_build_object('item_id', item_id_value, 'quantity', 1)),
            null, 'DEMO-DISP-' || fixture.code, final_request, '{"method":"Destroy"}');
        else
          perform public.post_inventory_document('disposal', demo_date - 3,
            jsonb_build_array(jsonb_build_object('item_id', item_id_value, 'quantity', 1)),
            null, 'DEMO-DISP-' || fixture.code, final_request,
            jsonb_build_object('method', 'Sale', 'receipt_number', 'DEMO-OR-' || fixture.code, 'proceeds', 125));
        end if;
      elsif fixture.scenario = 'loan' and fixture.category in (1, 2, 3) then
        perform public.post_inventory_document('adjustment', demo_date - 3,
          jsonb_build_array(jsonb_build_object('item_id', item_id_value, 'quantity', 1)),
          null, 'Synthetic recount adjustment ' || fixture.code, final_request);
      end if;
    end if;

    if not exists (select 1 from public.physical_counts where item_id = item_id_value and remarks = count_note) then
      select balance into strict recorded_balance from public.inventory_balances where item_id = item_id_value;
      counted_balance := case when fixture.scenario = 'loan' and recorded_balance > 0
        then recorded_balance - 1 else recorded_balance end;
      perform public.record_inventory_count(item_id_value, counted_balance, demo_date, fixture.location, count_note);
    end if;
  end loop;

  perform set_config('request.jwt.claim.sub', coalesce(previous_actor, ''), true);
end;
$$;
