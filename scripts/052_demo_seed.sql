-- =============================================================================
-- Migration 052: DEMO SEED — Workspace completo para presentaciones
-- =============================================================================
-- Popula una organización ficticia "Estudio Demo Lexia" con data creíble en
-- TODOS los módulos (casos, clientes, personas, tareas, vencimientos, docs,
-- notificaciones, Lexia Workspace, chat, billing).
--
-- Uso:
--   1. Crear en Supabase Auth un usuario de demo (ej. demo@lexia.app) con
--      password a elección (NO necesita metadata especial).
--   2. Ajustar más abajo v_demo_email y v_demo_pretty_name si querés
--      personalizar.
--   3. Ejecutar este script en el SQL Editor de Supabase *como service_role*
--      (o con psql usando el rol postgres). Bypasea RLS por ser superuser.
--   4. Reejecutable: usa UUIDs estables + ON CONFLICT; no duplica filas.
--
-- Esta migración NO toca data real: todo vive bajo la organización demo.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 0. Variables y pre-condiciones
-- =============================================================================
DO $demo$
DECLARE
  -- >>>>> Editar si querés usar otro email o branding <<<<<
  v_demo_email         TEXT := 'demo@lexia.app';
  v_demo_first         TEXT := 'Dra. Lucía';
  v_demo_last          TEXT := 'Martín';
  v_demo_firm          TEXT := 'Estudio Demo Lexia';
  v_demo_slug          TEXT := 'estudio-demo-lexia';

  v_demo_user          UUID;

  -- UUIDs estables (patrón d3100000-<tag>-4000-a000-<seq>)
  v_org                UUID := 'd3100000-0000-4000-a000-000000000001';

  -- Compañías
  v_co_distrib         UUID := 'd3100000-c1c1-4000-a000-000000000001';
  v_co_construc        UUID := 'd3100000-c1c1-4000-a000-000000000002';
  v_co_agro            UUID := 'd3100000-c1c1-4000-a000-000000000003';
  v_co_textil          UUID := 'd3100000-c1c1-4000-a000-000000000004';
  v_co_hotel           UUID := 'd3100000-c1c1-4000-a000-000000000005';

  -- Personas
  v_p_distrib_rep      UUID := 'd3100000-9e9e-4000-a000-000000000001';  -- rep. distribuidora
  v_p_construc_rep     UUID := 'd3100000-9e9e-4000-a000-000000000002';  -- rep. constructora
  v_p_agro_rep         UUID := 'd3100000-9e9e-4000-a000-000000000003';  -- rep. agro
  v_p_textil_rep       UUID := 'd3100000-9e9e-4000-a000-000000000004';  -- rep. textil
  v_p_hotel_rep        UUID := 'd3100000-9e9e-4000-a000-000000000005';  -- rep. hotel
  v_p_ind_benitez      UUID := 'd3100000-9e9e-4000-a000-000000000006';  -- cliente individual
  v_p_ind_fernandez    UUID := 'd3100000-9e9e-4000-a000-000000000007';  -- cliente individual
  v_p_judge_rocha      UUID := 'd3100000-9e9e-4000-a000-000000000010';  -- jueza
  v_p_judge_videla     UUID := 'd3100000-9e9e-4000-a000-000000000011';  -- juez
  v_p_opp_carrizo      UUID := 'd3100000-9e9e-4000-a000-000000000020';  -- abogado contraparte
  v_p_opp_luna         UUID := 'd3100000-9e9e-4000-a000-000000000021';  -- abogado contraparte
  v_p_exp_cabrera      UUID := 'd3100000-9e9e-4000-a000-000000000030';  -- perito contable
  v_p_exp_sosa         UUID := 'd3100000-9e9e-4000-a000-000000000031';  -- perito ingeniero
  v_p_wit_molina       UUID := 'd3100000-9e9e-4000-a000-000000000040';  -- testigo
  v_p_wit_pereyra      UUID := 'd3100000-9e9e-4000-a000-000000000041';  -- testigo

  -- Casos
  v_case_despido       UUID := 'd3100000-ca5e-4000-a000-000000000001';
  v_case_cobro         UUID := 'd3100000-ca5e-4000-a000-000000000002';
  v_case_danos         UUID := 'd3100000-ca5e-4000-a000-000000000003';
  v_case_desalojo      UUID := 'd3100000-ca5e-4000-a000-000000000004';
  v_case_rescision     UUID := 'd3100000-ca5e-4000-a000-000000000005';
  v_case_sucesion      UUID := 'd3100000-ca5e-4000-a000-000000000006';
  v_case_concurso      UUID := 'd3100000-ca5e-4000-a000-000000000007';
  v_case_accidente     UUID := 'd3100000-ca5e-4000-a000-000000000008';

  -- Tiempo
  v_now                TIMESTAMPTZ := NOW();
BEGIN
  -- ---------------------------------------------------------------------------
  -- Validar que exista el usuario demo en auth.users
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_demo_user
  FROM auth.users
  WHERE lower(email) = lower(v_demo_email)
  LIMIT 1;

  IF v_demo_user IS NULL THEN
    RAISE EXCEPTION
      E'No encontré un usuario con email "%" en auth.users.\n'
      'Creá la cuenta demo en el Supabase Auth Dashboard primero '
      '(sin metadata extra) y volvé a correr este script.',
      v_demo_email;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Marcar al usuario demo como admin_general en su JWT metadata
  -- ---------------------------------------------------------------------------
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object('system_role', 'admin_general'),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                           || jsonb_build_object(
                                'first_name', v_demo_first,
                                'last_name',  v_demo_last,
                                'firm_name',  v_demo_firm
                              )
  WHERE id = v_demo_user;

  -- =============================================================================
  -- 1. Organización demo
  -- =============================================================================
  INSERT INTO public.organizations (
    id, name, slug, legal_name, tax_id, email, phone, website,
    address, city, province, country,
    subscription_tier, subscription_status, subscription_expires_at,
    settings, is_active, created_by, created_at, updated_at
  )
  VALUES (
    v_org, v_demo_firm, v_demo_slug, 'Estudio Demo Lexia S.R.L.', '30-71234567-8',
    'contacto@lexia-demo.com.ar', '+54 351 555-1010', 'https://lexia-demo.com.ar',
    'Av. Colón 456, Piso 6', 'Córdoba', 'Córdoba', 'Argentina',
    'professional', 'active', v_now + INTERVAL '365 days',
    jsonb_build_object('demo', true, 'seed_version', 1),
    true, v_demo_user, v_now - INTERVAL '120 days', v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, slug = EXCLUDED.slug, legal_name = EXCLUDED.legal_name,
    email = EXCLUDED.email, phone = EXCLUDED.phone, website = EXCLUDED.website,
    address = EXCLUDED.address, city = EXCLUDED.city, province = EXCLUDED.province,
    subscription_tier = EXCLUDED.subscription_tier, subscription_status = EXCLUDED.subscription_status,
    subscription_expires_at = EXCLUDED.subscription_expires_at,
    settings = EXCLUDED.settings, updated_at = v_now;

  -- =============================================================================
  -- 2. Profile del usuario demo (asegurar creación + vínculo a org)
  -- =============================================================================
  INSERT INTO public.profiles (
    id, first_name, last_name, email, phone, title, bar_number,
    is_active, avatar_url, organization_id, created_at, updated_at
  )
  VALUES (
    v_demo_user, v_demo_first, v_demo_last, v_demo_email,
    '+54 351 555-2020', 'Socia titular', 'MP 1-12345',
    true, NULL, v_org,
    v_now - INTERVAL '120 days', v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    title = EXCLUDED.title,
    bar_number = EXCLUDED.bar_number,
    phone = EXCLUDED.phone,
    organization_id = v_org,
    is_active = true,
    updated_at = v_now;

  -- =============================================================================
  -- 3. Companies (empresas-cliente del estudio)
  -- =============================================================================
  INSERT INTO public.companies (
    id, company_name, legal_name, cuit, tax_id,
    email, phone, website, address, city, province, postal_code, country,
    industry, legal_form, notes, is_active,
    organization_id, created_by, created_at, updated_at
  )
  VALUES
    (v_co_distrib, 'Distribuidora San Martín', 'Distribuidora San Martín S.A.',
     '30-70123456-1', NULL, 'info@distsanmartin.com.ar', '+54 351 555-3030',
     'https://distsanmartin.com.ar', 'Ruta 9 km 702', 'Córdoba', 'Córdoba', 'X5000',
     'Argentina', 'Distribución mayorista', 'S.A.',
     'Cliente estratégico desde 2021. Litigios laborales recurrentes.', true,
     v_org, v_demo_user, v_now - INTERVAL '300 days', v_now),
    (v_co_construc, 'Constructora Arroyito', 'Constructora Arroyito S.R.L.',
     '30-70234567-2', NULL, 'obras@arroyito.ar', '+54 3541 555-4040',
     'https://arroyito.ar', 'Av. Fuerza Aérea 2100', 'Arroyito', 'Córdoba', 'X2434',
     'Argentina', 'Construcción civil', 'S.R.L.',
     'Obras públicas y privadas. Suelen tener reclamos de proveedores.', true,
     v_org, v_demo_user, v_now - INTERVAL '240 days', v_now),
    (v_co_agro, 'Agropecuaria La Esmeralda', 'Agropecuaria La Esmeralda S.A.',
     '30-70345678-3', NULL, 'admin@laesmeralda.com.ar', '+54 353 555-5050',
     NULL, 'Zona Rural RP 8', 'Villa María', 'Córdoba', 'X5900',
     'Argentina', 'Agropecuaria', 'S.A.',
     'Litigio actual por incumplimiento de contrato de acopio.', true,
     v_org, v_demo_user, v_now - INTERVAL '180 days', v_now),
    (v_co_textil, 'Tecnotextil', 'Tecnotextil S.R.L.',
     '30-70456789-4', NULL, 'gerencia@tecnotextil.ar', '+54 351 555-6060',
     NULL, 'Parque Industrial Ferreyra Lote 12', 'Córdoba', 'Córdoba', 'X5024',
     'Argentina', 'Manufactura textil', 'S.R.L.',
     'Pyme familiar. Asesoramiento continuo en contratos laborales.', true,
     v_org, v_demo_user, v_now - INTERVAL '150 days', v_now),
    (v_co_hotel, 'Hotel Sierras Chicas', 'Sierras Chicas Hospitality S.A.',
     '30-70567890-5', NULL, 'contacto@sierraschicas.com.ar', '+54 3543 555-7070',
     'https://sierraschicas.com.ar', 'Av. San Martín 850', 'Unquillo', 'Córdoba', 'X5105',
     'Argentina', 'Hotelería y turismo', 'S.A.',
     'Caso de concurso preventivo en curso.', true,
     v_org, v_demo_user, v_now - INTERVAL '90 days', v_now)
  ON CONFLICT (id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    legal_name = EXCLUDED.legal_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    industry = EXCLUDED.industry,
    address = EXCLUDED.address,
    updated_at = v_now;

  -- =============================================================================
  -- 4. People (personas: clientes ind., contrapartes, jueces, peritos, testigos)
  -- =============================================================================
  INSERT INTO public.people (
    id, client_type, first_name, last_name, dni, company_name, cuit,
    legal_representative, email, phone, secondary_phone,
    address, city, province, postal_code, portal_user_id,
    notes, is_active, person_type, company_id, company_role,
    organization_id, created_at, updated_at
  )
  VALUES
    -- Representantes de compañías cliente
    (v_p_distrib_rep, 'individual', 'Ricardo', 'Paz', '22345678', NULL, NULL,
     NULL, 'ricardo.paz@distsanmartin.com.ar', '+54 351 555-3031', NULL,
     'Av. Colón 1234', 'Córdoba', 'Córdoba', 'X5000', NULL,
     'Presidente y representante legal.', true,
     'client'::person_type, v_co_distrib, 'legal_representative'::company_role,
     v_org, v_now - INTERVAL '300 days', v_now),

    (v_p_construc_rep, 'individual', 'Marcela', 'Ortega', '25123456', NULL, NULL,
     NULL, 'marcela.ortega@arroyito.ar', '+54 3541 555-4041', NULL,
     'Av. Fuerza Aérea 2100', 'Arroyito', 'Córdoba', 'X2434', NULL,
     'Socia gerente. Firma todos los contratos.', true,
     'client'::person_type, v_co_construc, 'legal_representative'::company_role,
     v_org, v_now - INTERVAL '240 days', v_now),

    (v_p_agro_rep, 'individual', 'Esteban', 'Villagra', '18987654', NULL, NULL,
     NULL, 'esteban.villagra@laesmeralda.com.ar', '+54 353 555-5051', NULL,
     'Zona Rural RP 8', 'Villa María', 'Córdoba', 'X5900', NULL,
     'Titular. Muy involucrado en la defensa.', true,
     'client'::person_type, v_co_agro, 'legal_representative'::company_role,
     v_org, v_now - INTERVAL '180 days', v_now),

    (v_p_textil_rep, 'individual', 'Silvia', 'Gómez', '24567890', NULL, NULL,
     NULL, 'silvia.gomez@tecnotextil.ar', '+54 351 555-6061', NULL,
     'Parque Industrial Ferreyra', 'Córdoba', 'Córdoba', 'X5024', NULL,
     'Gerente de RRHH. Contacto operativo.', true,
     'client'::person_type, v_co_textil, 'contact'::company_role,
     v_org, v_now - INTERVAL '150 days', v_now),

    (v_p_hotel_rep, 'individual', 'Gustavo', 'Aranda', '20765432', NULL, NULL,
     NULL, 'gustavo.aranda@sierraschicas.com.ar', '+54 3543 555-7071', NULL,
     'Av. San Martín 850', 'Unquillo', 'Córdoba', 'X5105', NULL,
     'Director. Clave para el concurso preventivo.', true,
     'client'::person_type, v_co_hotel, 'director'::company_role,
     v_org, v_now - INTERVAL '90 days', v_now),

    -- Clientes individuales
    (v_p_ind_benitez, 'individual', 'Juan Carlos', 'Benítez', '30112233', NULL, NULL,
     NULL, 'jcbenitez@gmail.com', '+54 351 555-8080', NULL,
     'Bv. Chacabuco 650', 'Córdoba', 'Córdoba', 'X5000', NULL,
     'Actor en juicio de daños por accidente de tránsito.', true,
     'client'::person_type, NULL, NULL,
     v_org, v_now - INTERVAL '120 days', v_now),

    (v_p_ind_fernandez, 'individual', 'María Elena', 'Fernández', '28334455', NULL, NULL,
     NULL, 'mefernandez@hotmail.com', '+54 351 555-9090', NULL,
     'Rivadavia 1440', 'Córdoba', 'Córdoba', 'X5000', NULL,
     'Heredera en sucesión. Cliente desde 2020.', true,
     'client'::person_type, NULL, NULL,
     v_org, v_now - INTERVAL '200 days', v_now),

    -- Jueces
    (v_p_judge_rocha, 'individual', 'Graciela', 'Rocha', NULL, NULL, NULL,
     NULL, 'mesadeentrada.32@justiciacordoba.gob.ar', NULL, NULL,
     'Caseros 551', 'Córdoba', 'Córdoba', 'X5000', NULL,
     'Titular del Juzgado Civil y Comercial Nº 32.', true,
     'judge'::person_type, NULL, NULL,
     v_org, v_now - INTERVAL '200 days', v_now),

    (v_p_judge_videla, 'individual', 'Alberto', 'Videla', NULL, NULL, NULL,
     NULL, 'camaratrabajo.sala3@justiciacordoba.gob.ar', NULL, NULL,
     'Duarte Quirós 650', 'Córdoba', 'Córdoba', 'X5000', NULL,
     'Vocal Cámara del Trabajo Sala III.', true,
     'judge'::person_type, NULL, NULL,
     v_org, v_now - INTERVAL '200 days', v_now),

    -- Abogados contraparte
    (v_p_opp_carrizo, 'individual', 'Federico', 'Carrizo', NULL, NULL, NULL,
     NULL, 'fcarrizo@estudiocarrizo.com.ar', '+54 351 555-1111', NULL,
     'Independencia 120', 'Córdoba', 'Córdoba', 'X5000', NULL,
     'Abogado laboralista. Contraparte habitual en casos de despido.', true,
     'opposing_lawyer'::person_type, NULL, NULL,
     v_org, v_now - INTERVAL '200 days', v_now),

    (v_p_opp_luna, 'individual', 'Sandra', 'Luna', NULL, NULL, NULL,
     NULL, 'sluna@lunaabogados.com.ar', '+54 351 555-2222', NULL,
     '27 de Abril 480', 'Córdoba', 'Córdoba', 'X5000', NULL,
     'Abogada comercialista. Representa a Frigorífico del Centro S.A.', true,
     'opposing_lawyer'::person_type, NULL, NULL,
     v_org, v_now - INTERVAL '200 days', v_now),

    -- Peritos
    (v_p_exp_cabrera, 'individual', 'Mariano', 'Cabrera', '22009988', NULL, NULL,
     NULL, 'mcabrera.perito@gmail.com', '+54 351 555-3333', NULL,
     'Deán Funes 910', 'Córdoba', 'Córdoba', 'X5000', NULL,
     'Perito contador. CPCE Córdoba.', true,
     'expert'::person_type, NULL, NULL,
     v_org, v_now - INTERVAL '150 days', v_now),

    (v_p_exp_sosa, 'individual', 'Raúl', 'Sosa', '18776655', NULL, NULL,
     NULL, 'ing.rsosa@perito.com.ar', '+54 351 555-4444', NULL,
     'Belgrano 1200', 'Córdoba', 'Córdoba', 'X5000', NULL,
     'Perito ingeniero mecánico. Accidentología vial.', true,
     'expert'::person_type, NULL, NULL,
     v_org, v_now - INTERVAL '150 days', v_now),

    -- Testigos
    (v_p_wit_molina, 'individual', 'Claudia', 'Molina', '29334422', NULL, NULL,
     NULL, 'cmolina.test@gmail.com', '+54 351 555-5555', NULL,
     'Colón 2300', 'Córdoba', 'Córdoba', 'X5000', NULL,
     'Ex-empleada de Distribuidora San Martín.', true,
     'witness'::person_type, NULL, NULL,
     v_org, v_now - INTERVAL '60 days', v_now),

    (v_p_wit_pereyra, 'individual', 'Diego', 'Pereyra', '31556677', NULL, NULL,
     NULL, 'dpereyra@gmail.com', '+54 351 555-6666', NULL,
     'Maipú 340', 'Córdoba', 'Córdoba', 'X5000', NULL,
     'Testigo presencial del accidente de tránsito.', true,
     'witness'::person_type, NULL, NULL,
     v_org, v_now - INTERVAL '90 days', v_now)
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    notes = EXCLUDED.notes,
    person_type = EXCLUDED.person_type,
    company_id = EXCLUDED.company_id,
    company_role = EXCLUDED.company_role,
    updated_at = v_now;

  -- =============================================================================
  -- 5. Cases (casos variados + mix de estados)
  -- =============================================================================
  INSERT INTO public.cases (
    id, case_number, court_number, title, description, case_type,
    jurisdiction, court_name, company_id, opposing_party, opposing_counsel,
    status, filing_date, next_hearing_date, statute_of_limitations,
    estimated_value, fee_arrangement, is_visible_to_client, notes,
    organization_id, created_at, updated_at
  )
  VALUES
    -- 1. Despido injustificado (activo, contestación por venir)
    (v_case_despido, 'EXP-2025-0123', '12345/2025',
     'Molina, Claudia c/ Distribuidora San Martín S.A. s/ Despido',
     'Actora alega despido sin causa tras 8 años de antigüedad. Reclama indemnizaciones agravadas art. 182 LCT.',
     'Laboral', 'Justicia Ordinaria de Córdoba', 'Cámara del Trabajo Sala III Córdoba',
     v_co_distrib, 'Claudia Molina', 'Dr. Federico Carrizo',
     'active'::case_status, CURRENT_DATE - INTERVAL '45 days',
     (CURRENT_DATE + INTERVAL '12 days')::timestamptz, CURRENT_DATE + INTERVAL '300 days',
     8500000.00, 'Honorarios por escala + pacto cuota litis 20%', true,
     'Defender: hubo injuria grave probada. Abundante prueba testimonial.',
     v_org, v_now - INTERVAL '45 days', v_now),

    -- 2. Cobro de pesos (activo)
    (v_case_cobro, 'EXP-2025-0124', '23456/2025',
     'Constructora Arroyito S.R.L. c/ Frigorífico del Centro S.A. s/ Cobro de pesos',
     'Reclamo por facturas impagas correspondientes a obra de ampliación de planta.',
     'Comercial', 'Justicia Ordinaria de Córdoba', 'Juzgado Civil y Comercial Nº 32',
     v_co_construc, 'Frigorífico del Centro S.A.', 'Dra. Sandra Luna',
     'active'::case_status, CURRENT_DATE - INTERVAL '30 days',
     (CURRENT_DATE + INTERVAL '22 days')::timestamptz, CURRENT_DATE + INTERVAL '500 days',
     14200000.00, 'Honorarios regulados por ley', true,
     'Mediación previa fallida. Se presentó demanda ejecutiva.',
     v_org, v_now - INTERVAL '30 days', v_now),

    -- 3. Daños y perjuicios por accidente (activo)
    (v_case_danos, 'EXP-2025-0110', '34567/2025',
     'Benítez, Juan Carlos c/ Flota Norte S.R.L. s/ Daños y perjuicios',
     'Accidente de tránsito 12/08/2024. Ruta 9, km 702. Actor sufrió lesiones graves y pérdida parcial de capacidad laboral.',
     'Daños y Perjuicios', 'Justicia Ordinaria de Córdoba', 'Juzgado Civil y Comercial Nº 12',
     NULL, 'Flota Norte S.R.L.', 'Dr. Pedro Olmos',
     'active'::case_status, CURRENT_DATE - INTERVAL '120 days',
     (CURRENT_DATE + INTERVAL '60 days')::timestamptz, CURRENT_DATE + INTERVAL '700 days',
     22000000.00, 'Pacto cuota litis 25%', true,
     'Pendiente pericial mecánica. Testigo Pereyra clave.',
     v_org, v_now - INTERVAL '120 days', v_now),

    -- 4. Desalojo (pendiente)
    (v_case_desalojo, 'EXP-2025-0089', '45678/2025',
     'Agropecuaria La Esmeralda S.A. c/ Sucesores de Ramírez s/ Desalojo',
     'Ocupación sin título de campo en zona rural RP 8, Villa María.',
     'Civil y Comercial', 'Justicia Ordinaria de Córdoba', 'Juzgado Civil y Comercial Nº 8',
     v_co_agro, 'Sucesión Ramírez', 'Defensor oficial',
     'pending'::case_status, CURRENT_DATE - INTERVAL '180 days',
     (CURRENT_DATE + INTERVAL '90 days')::timestamptz, CURRENT_DATE + INTERVAL '365 days',
     9500000.00, 'Honorarios regulados', true,
     'Esperando informe de dominio. Citación compleja por sucesión abierta.',
     v_org, v_now - INTERVAL '180 days', v_now),

    -- 5. Rescisión contractual (activo)
    (v_case_rescision, 'EXP-2025-0097', '56789/2025',
     'Agropecuaria La Esmeralda S.A. c/ Acopio Sur S.A. s/ Rescisión contractual',
     'Incumplimiento de contrato de acopio de soja campaña 2024/25.',
     'Comercial', 'Justicia Ordinaria de Córdoba', 'Juzgado Civil y Comercial Nº 14',
     v_co_agro, 'Acopio Sur S.A.', 'Dr. Martín Suárez',
     'active'::case_status, CURRENT_DATE - INTERVAL '75 days',
     NULL, CURRENT_DATE + INTERVAL '420 days',
     31000000.00, 'Honorarios por escala', true,
     'Demanda presentada. A la espera de contestación.',
     v_org, v_now - INTERVAL '75 days', v_now),

    -- 6. Sucesión (activa)
    (v_case_sucesion, 'EXP-2024-0456', '11223/2024',
     'Sucesión ab-intestato Fernández, Roberto',
     'Declaratoria de herederos. Actora: cónyuge supérstite.',
     'Sucesorio', 'Justicia Ordinaria de Córdoba', 'Juzgado Civil y Comercial Nº 45',
     NULL, NULL, NULL,
     'active'::case_status, CURRENT_DATE - INTERVAL '200 days',
     NULL, NULL,
     4500000.00, 'Honorarios porcentaje acervo 5%', true,
     'Dictada declaratoria. Iniciar inscripción de bienes.',
     v_org, v_now - INTERVAL '200 days', v_now),

    -- 7. Concurso preventivo (activo, estratégico)
    (v_case_concurso, 'EXP-2025-0005', '77889/2025',
     'Sierras Chicas Hospitality S.A. s/ Concurso preventivo',
     'Apertura de concurso preventivo. Pasivo denunciado: $185M.',
     'Concursal', 'Justicia Ordinaria de Córdoba', 'Juzgado Concursos y Sociedades Nº 3',
     v_co_hotel, NULL, NULL,
     'active'::case_status, CURRENT_DATE - INTERVAL '60 days',
     (CURRENT_DATE + INTERVAL '8 days')::timestamptz, NULL,
     185000000.00, 'Honorarios por etapa', true,
     'Verificación de créditos en curso. Síndico: Cra. López.',
     v_org, v_now - INTERVAL '60 days', v_now),

    -- 8. Accidente laboral (cerrado)
    (v_case_accidente, 'EXP-2024-0312', '99001/2024',
     'Sosa, Ramiro c/ Tecnotextil S.R.L. s/ Accidente laboral',
     'Accidente in itinere. Se acordó transacción extrajudicial.',
     'Laboral', 'Justicia Ordinaria de Córdoba', 'Juzgado de Conciliación Nº 4',
     v_co_textil, 'Ramiro Sosa', 'Dra. Lorena Medina',
     'closed'::case_status, CURRENT_DATE - INTERVAL '320 days',
     NULL, NULL,
     3200000.00, 'Honorarios regulados', true,
     'Cerrado con acuerdo homologado. Cliente satisfecho.',
     v_org, v_now - INTERVAL '320 days', v_now - INTERVAL '30 days')
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    case_type = EXCLUDED.case_type,
    court_name = EXCLUDED.court_name,
    status = EXCLUDED.status,
    next_hearing_date = EXCLUDED.next_hearing_date,
    estimated_value = EXCLUDED.estimated_value,
    notes = EXCLUDED.notes,
    updated_at = v_now;

  -- =============================================================================
  -- 6. Case assignments (demo user como leader en todos)
  -- =============================================================================
  INSERT INTO public.case_assignments (
    id, case_id, user_id, assignment_role, assigned_by, notes, organization_id, assigned_at
  )
  SELECT
    ('d3100000-a551-4000-a000-' || lpad((row_number() OVER ())::text, 12, '0'))::uuid,
    case_id, v_demo_user, 'leader', v_demo_user,
    'Responsable del expediente', v_org, v_now - INTERVAL '30 days'
  FROM (VALUES
    (v_case_despido), (v_case_cobro), (v_case_danos), (v_case_desalojo),
    (v_case_rescision), (v_case_sucesion), (v_case_concurso), (v_case_accidente)
  ) AS t(case_id)
  ON CONFLICT (case_id, user_id) DO NOTHING;

  -- =============================================================================
  -- 7. Case participants (personas vinculadas a cada caso)
  -- =============================================================================
  INSERT INTO public.case_participants (
    id, case_id, person_id, role, notes, is_active, organization_id, created_at, updated_at
  )
  VALUES
    -- Caso despido
    ('d3100000-7a71-4000-a000-000000000001', v_case_despido, v_p_distrib_rep,
     'client_representative'::participant_role, 'Representa a la empresa demandada.', true,
     v_org, v_now - INTERVAL '40 days', v_now),
    ('d3100000-7a71-4000-a000-000000000002', v_case_despido, v_p_opp_carrizo,
     'opposing_lawyer'::participant_role, 'Letrado de la actora.', true,
     v_org, v_now - INTERVAL '40 days', v_now),
    ('d3100000-7a71-4000-a000-000000000003', v_case_despido, v_p_judge_videla,
     'judge'::participant_role, 'Vocal interviniente.', true,
     v_org, v_now - INTERVAL '40 days', v_now),
    ('d3100000-7a71-4000-a000-000000000004', v_case_despido, v_p_wit_molina,
     'opposing_party'::participant_role, 'Actora.', true,
     v_org, v_now - INTERVAL '40 days', v_now),

    -- Caso cobro
    ('d3100000-7a71-4000-a000-000000000005', v_case_cobro, v_p_construc_rep,
     'client_representative'::participant_role, 'Socia gerente.', true,
     v_org, v_now - INTERVAL '30 days', v_now),
    ('d3100000-7a71-4000-a000-000000000006', v_case_cobro, v_p_opp_luna,
     'opposing_lawyer'::participant_role, 'Letrada de la contraria.', true,
     v_org, v_now - INTERVAL '30 days', v_now),
    ('d3100000-7a71-4000-a000-000000000007', v_case_cobro, v_p_judge_rocha,
     'judge'::participant_role, NULL, true,
     v_org, v_now - INTERVAL '30 days', v_now),

    -- Caso daños
    ('d3100000-7a71-4000-a000-000000000008', v_case_danos, v_p_ind_benitez,
     'client_representative'::participant_role, 'Actor damnificado.', true,
     v_org, v_now - INTERVAL '120 days', v_now),
    ('d3100000-7a71-4000-a000-000000000009', v_case_danos, v_p_wit_pereyra,
     'witness'::participant_role, 'Testigo presencial.', true,
     v_org, v_now - INTERVAL '120 days', v_now),
    ('d3100000-7a71-4000-a000-000000000010', v_case_danos, v_p_exp_sosa,
     'expert_witness'::participant_role, 'Perito mecánico designado.', true,
     v_org, v_now - INTERVAL '120 days', v_now),

    -- Caso desalojo
    ('d3100000-7a71-4000-a000-000000000011', v_case_desalojo, v_p_agro_rep,
     'client_representative'::participant_role, 'Titular de la sociedad.', true,
     v_org, v_now - INTERVAL '180 days', v_now),

    -- Caso rescisión
    ('d3100000-7a71-4000-a000-000000000012', v_case_rescision, v_p_agro_rep,
     'client_representative'::participant_role, 'Mismo representante que desalojo.', true,
     v_org, v_now - INTERVAL '75 days', v_now),
    ('d3100000-7a71-4000-a000-000000000013', v_case_rescision, v_p_exp_cabrera,
     'expert_witness'::participant_role, 'Perito contador.', true,
     v_org, v_now - INTERVAL '75 days', v_now),

    -- Caso sucesión
    ('d3100000-7a71-4000-a000-000000000014', v_case_sucesion, v_p_ind_fernandez,
     'client_representative'::participant_role, 'Heredera peticionante.', true,
     v_org, v_now - INTERVAL '200 days', v_now),

    -- Caso concurso
    ('d3100000-7a71-4000-a000-000000000015', v_case_concurso, v_p_hotel_rep,
     'client_representative'::participant_role, 'Director de la concursada.', true,
     v_org, v_now - INTERVAL '60 days', v_now),
    ('d3100000-7a71-4000-a000-000000000016', v_case_concurso, v_p_exp_cabrera,
     'expert_witness'::participant_role, 'Síndico alternativo propuesto.', true,
     v_org, v_now - INTERVAL '60 days', v_now),

    -- Caso accidente (cerrado)
    ('d3100000-7a71-4000-a000-000000000017', v_case_accidente, v_p_textil_rep,
     'client_representative'::participant_role, 'Gerente de RRHH.', true,
     v_org, v_now - INTERVAL '320 days', v_now - INTERVAL '30 days')
  ON CONFLICT (case_id, person_id, role) DO NOTHING;

  -- =============================================================================
  -- 8. Case notes (notas internas pineadas + regulares)
  -- =============================================================================
  INSERT INTO public.case_notes (
    id, case_id, content, created_by, is_visible_to_client, is_pinned,
    organization_id, created_at, updated_at
  )
  VALUES
    ('d3100000-7071-4000-a000-000000000001', v_case_despido,
     E'**Estrategia de defensa**\n\n1. Demostrar injuria grave: actora abandonó puesto 3 días sin causa.\n2. Testigos: Pereyra y supervisora Godoy.\n3. Anticipar pedido agravado por maternidad — tener constancia de que no comunicó embarazo.',
     v_demo_user, false, true, v_org, v_now - INTERVAL '40 days', v_now),
    ('d3100000-7071-4000-a000-000000000002', v_case_despido,
     'Reunión con cliente — muestran legajo completo. Falta parte médica del 18/03.',
     v_demo_user, false, false, v_org, v_now - INTERVAL '20 days', v_now),
    ('d3100000-7071-4000-a000-000000000003', v_case_cobro,
     E'**Mediación previa**: frustrada por incomparecencia de la contraria. Se presentó acta. Avanzamos con ejecutiva.',
     v_demo_user, false, true, v_org, v_now - INTERVAL '25 days', v_now),
    ('d3100000-7071-4000-a000-000000000004', v_case_danos,
     E'**Puntos periciales críticos**:\n- Velocidad del camión al impacto\n- Estado de neumáticos y frenos\n- Visibilidad nocturna del sector',
     v_demo_user, false, true, v_org, v_now - INTERVAL '80 days', v_now),
    ('d3100000-7071-4000-a000-000000000005', v_case_concurso,
     'Sind. López pide ampliación de plazo verificación. Evaluar oposición.',
     v_demo_user, false, false, v_org, v_now - INTERVAL '10 days', v_now),
    ('d3100000-7071-4000-a000-000000000006', v_case_accidente,
     'Acuerdo homologado. Cliente abonó en 2 cuotas. Carpeta archivada.',
     v_demo_user, false, false, v_org, v_now - INTERVAL '30 days', v_now - INTERVAL '30 days')
  ON CONFLICT (id) DO NOTHING;
END
$demo$;

COMMIT;

-- =============================================================================
-- Segundo bloque: operaciones diarias (tareas, vencimientos, docs, etc.)
-- Separado para mantener manejable el tamaño de cada bloque DO.
-- =============================================================================

BEGIN;

DO $demo_ops$
DECLARE
  v_demo_email    TEXT := 'demo@lexia.app';
  v_demo_user     UUID;
  v_org           UUID := 'd3100000-0000-4000-a000-000000000001';
  v_now           TIMESTAMPTZ := NOW();

  v_case_despido  UUID := 'd3100000-ca5e-4000-a000-000000000001';
  v_case_cobro    UUID := 'd3100000-ca5e-4000-a000-000000000002';
  v_case_danos    UUID := 'd3100000-ca5e-4000-a000-000000000003';
  v_case_desalojo UUID := 'd3100000-ca5e-4000-a000-000000000004';
  v_case_rescision UUID := 'd3100000-ca5e-4000-a000-000000000005';
  v_case_sucesion UUID := 'd3100000-ca5e-4000-a000-000000000006';
  v_case_concurso UUID := 'd3100000-ca5e-4000-a000-000000000007';
  v_case_accidente UUID := 'd3100000-ca5e-4000-a000-000000000008';

  -- Vencimientos (por si necesitamos referenciar)
  v_dl_contest    UUID := 'd3100000-dead-4000-a000-000000000001';
  v_dl_mediacion  UUID := 'd3100000-dead-4000-a000-000000000002';
  v_dl_vto_arg    UUID := 'd3100000-dead-4000-a000-000000000003';
  v_dl_pericia    UUID := 'd3100000-dead-4000-a000-000000000004';
  v_dl_audiencia  UUID := 'd3100000-dead-4000-a000-000000000005';
  v_dl_verificacion UUID := 'd3100000-dead-4000-a000-000000000006';
  v_dl_inscripcion UUID := 'd3100000-dead-4000-a000-000000000007';
  v_dl_vencido    UUID := 'd3100000-dead-4000-a000-000000000008';
  v_dl_prescrip   UUID := 'd3100000-dead-4000-a000-000000000009';
BEGIN
  SELECT id INTO v_demo_user FROM auth.users WHERE lower(email) = lower(v_demo_email) LIMIT 1;
  IF v_demo_user IS NULL THEN
    RAISE EXCEPTION 'Falta demo user %', v_demo_email;
  END IF;

  -- =============================================================================
  -- 9. Deadlines (vencimientos y eventos)
  -- =============================================================================
  INSERT INTO public.deadlines (
    id, title, description, deadline_type, due_date,
    reminder_days, case_id, created_by, is_completed, completed_at, completed_by,
    organization_id, created_at, updated_at
  )
  VALUES
    (v_dl_contest,
     'Contestar demanda — Molina c/ Distribuidora San Martín',
     'Traslado de demanda. Plazo legal 10 días hábiles.',
     'Contestación de demanda',
     (CURRENT_DATE + INTERVAL '6 days')::timestamptz,
     ARRAY[7,3,1], v_case_despido, v_demo_user, false, NULL, NULL,
     v_org, v_now - INTERVAL '4 days', v_now),

    (v_dl_mediacion,
     'Audiencia de conciliación — Constructora Arroyito c/ Frigorífico',
     NULL, 'Audiencia',
     (CURRENT_DATE + INTERVAL '22 days')::timestamptz,
     ARRAY[7,3,1], v_case_cobro, v_demo_user, false, NULL, NULL,
     v_org, v_now - INTERVAL '10 days', v_now),

    (v_dl_vto_arg,
     'Vencimiento ofrecimiento prueba — Benítez c/ Flota Norte',
     'Fecha límite para ofrecer prueba pericial y testimonial.',
     'Ofrecimiento de prueba',
     (CURRENT_DATE + INTERVAL '14 days')::timestamptz,
     ARRAY[15,7,3,1], v_case_danos, v_demo_user, false, NULL, NULL,
     v_org, v_now - INTERVAL '30 days', v_now),

    (v_dl_pericia,
     'Presentación dictamen pericial mecánico',
     'Ing. Sosa entregó borrador. Observaciones.',
     'Pericial',
     (CURRENT_DATE + INTERVAL '45 days')::timestamptz,
     ARRAY[7,3], v_case_danos, v_demo_user, false, NULL, NULL,
     v_org, v_now - INTERVAL '20 days', v_now),

    (v_dl_audiencia,
     'Audiencia preliminar — Desalojo La Esmeralda',
     NULL, 'Audiencia',
     (CURRENT_DATE + INTERVAL '90 days')::timestamptz,
     ARRAY[15,7,3], v_case_desalojo, v_demo_user, false, NULL, NULL,
     v_org, v_now - INTERVAL '60 days', v_now),

    (v_dl_verificacion,
     'Verificación de créditos — Concurso Sierras Chicas',
     'Fecha límite para presentación de acreedores.',
     'Concursal',
     (CURRENT_DATE + INTERVAL '8 days')::timestamptz,
     ARRAY[7,3,1], v_case_concurso, v_demo_user, false, NULL, NULL,
     v_org, v_now - INTERVAL '30 days', v_now),

    (v_dl_inscripcion,
     'Inscripción en el Registro — Sucesión Fernández',
     NULL, 'Registración',
     (CURRENT_DATE + INTERVAL '30 days')::timestamptz,
     ARRAY[7,3], v_case_sucesion, v_demo_user, false, NULL, NULL,
     v_org, v_now - INTERVAL '15 days', v_now),

    -- Vencido / completado
    (v_dl_vencido,
     'Presentar demanda ejecutiva — Cobro Arroyito',
     'Hecho: presentada 15/09.',
     'Presentación judicial',
     (CURRENT_DATE - INTERVAL '20 days')::timestamptz,
     ARRAY[7,3,1], v_case_cobro, v_demo_user, true,
     v_now - INTERVAL '22 days', v_demo_user,
     v_org, v_now - INTERVAL '35 days', v_now - INTERVAL '22 days'),

    -- Vencido atrasado (sin marcar) — demo para highlight
    (v_dl_prescrip,
     'Revisar prescripción sucesión Fernández',
     'Alerta: chequear plazo bienal.',
     'Seguimiento',
     (CURRENT_DATE - INTERVAL '5 days')::timestamptz,
     ARRAY[3,1], v_case_sucesion, v_demo_user, false, NULL, NULL,
     v_org, v_now - INTERVAL '20 days', v_now)
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    due_date = EXCLUDED.due_date,
    is_completed = EXCLUDED.is_completed,
    updated_at = v_now;

  -- =============================================================================
  -- 10. Tasks (mix de estados, prioridades)
  -- =============================================================================
  INSERT INTO public.tasks (
    id, title, description, case_id, deadline_id, assigned_to, created_by,
    status, priority, due_date, reminder_date, completed_at,
    estimated_hours, actual_hours, organization_id, created_at, updated_at
  )
  VALUES
    -- Tareas del caso despido
    ('d3100000-7a5c-4000-a000-000000000001',
     'Redactar contestación de demanda',
     'Usar Lexia Workspace. Atacar fundamentos: injuria grave probada.',
     v_case_despido, v_dl_contest, v_demo_user, v_demo_user,
     'in_progress'::task_status, 'urgent'::task_priority,
     (CURRENT_DATE + INTERVAL '5 days')::timestamptz,
     (CURRENT_DATE + INTERVAL '3 days')::timestamptz, NULL,
     6.0, 2.5, v_org, v_now - INTERVAL '4 days', v_now),
    ('d3100000-7a5c-4000-a000-000000000002',
     'Revisar legajo laboral y pieza médica',
     NULL, v_case_despido, NULL, v_demo_user, v_demo_user,
     'pending'::task_status, 'high'::task_priority,
     (CURRENT_DATE + INTERVAL '2 days')::timestamptz, NULL, NULL,
     1.5, NULL, v_org, v_now - INTERVAL '3 days', v_now),
    ('d3100000-7a5c-4000-a000-000000000003',
     'Entrevistar testigo Godoy',
     NULL, v_case_despido, NULL, v_demo_user, v_demo_user,
     'pending'::task_status, 'medium'::task_priority,
     (CURRENT_DATE + INTERVAL '8 days')::timestamptz, NULL, NULL,
     1.0, NULL, v_org, v_now - INTERVAL '3 days', v_now),

    -- Cobro
    ('d3100000-7a5c-4000-a000-000000000004',
     'Asistir a audiencia de conciliación',
     NULL, v_case_cobro, v_dl_mediacion, v_demo_user, v_demo_user,
     'pending'::task_status, 'high'::task_priority,
     (CURRENT_DATE + INTERVAL '22 days')::timestamptz, NULL, NULL,
     2.0, NULL, v_org, v_now - INTERVAL '10 days', v_now),
    ('d3100000-7a5c-4000-a000-000000000005',
     'Preparar liquidación actualizada de intereses',
     NULL, v_case_cobro, NULL, v_demo_user, v_demo_user,
     'pending'::task_status, 'medium'::task_priority,
     (CURRENT_DATE + INTERVAL '18 days')::timestamptz, NULL, NULL,
     1.0, NULL, v_org, v_now - INTERVAL '5 days', v_now),

    -- Daños
    ('d3100000-7a5c-4000-a000-000000000006',
     'Ofrecer prueba pericial y testimonial',
     'Usar Lexia para chequear citas art. 378 CPCCN.',
     v_case_danos, v_dl_vto_arg, v_demo_user, v_demo_user,
     'in_progress'::task_status, 'high'::task_priority,
     (CURRENT_DATE + INTERVAL '13 days')::timestamptz, NULL, NULL,
     3.0, 1.0, v_org, v_now - INTERVAL '20 days', v_now),
    ('d3100000-7a5c-4000-a000-000000000007',
     'Coordinar reunión con perito Sosa',
     NULL, v_case_danos, v_dl_pericia, v_demo_user, v_demo_user,
     'pending'::task_status, 'medium'::task_priority,
     (CURRENT_DATE + INTERVAL '20 days')::timestamptz, NULL, NULL,
     1.0, NULL, v_org, v_now - INTERVAL '12 days', v_now),

    -- Desalojo
    ('d3100000-7a5c-4000-a000-000000000008',
     'Solicitar informe de dominio actualizado',
     NULL, v_case_desalojo, NULL, v_demo_user, v_demo_user,
     'in_progress'::task_status, 'low'::task_priority,
     (CURRENT_DATE + INTERVAL '10 days')::timestamptz, NULL, NULL,
     0.5, 0.2, v_org, v_now - INTERVAL '40 days', v_now),

    -- Rescisión
    ('d3100000-7a5c-4000-a000-000000000009',
     'Ampliar demanda incluyendo intereses punitorios',
     NULL, v_case_rescision, NULL, v_demo_user, v_demo_user,
     'pending'::task_status, 'medium'::task_priority,
     (CURRENT_DATE + INTERVAL '25 days')::timestamptz, NULL, NULL,
     2.5, NULL, v_org, v_now - INTERVAL '7 days', v_now),

    -- Concurso
    ('d3100000-7a5c-4000-a000-000000000010',
     'Verificar créditos laborales pendientes',
     NULL, v_case_concurso, v_dl_verificacion, v_demo_user, v_demo_user,
     'in_progress'::task_status, 'urgent'::task_priority,
     (CURRENT_DATE + INTERVAL '7 days')::timestamptz, NULL, NULL,
     8.0, 3.0, v_org, v_now - INTERVAL '15 days', v_now),
    ('d3100000-7a5c-4000-a000-000000000011',
     'Impugnar crédito de Proveedor Central S.A.',
     NULL, v_case_concurso, NULL, v_demo_user, v_demo_user,
     'pending'::task_status, 'high'::task_priority,
     (CURRENT_DATE + INTERVAL '15 days')::timestamptz, NULL, NULL,
     4.0, NULL, v_org, v_now - INTERVAL '5 days', v_now),

    -- Sucesión
    ('d3100000-7a5c-4000-a000-000000000012',
     'Inscribir declaratoria en Reg. de la Propiedad',
     NULL, v_case_sucesion, v_dl_inscripcion, v_demo_user, v_demo_user,
     'pending'::task_status, 'medium'::task_priority,
     (CURRENT_DATE + INTERVAL '30 days')::timestamptz, NULL, NULL,
     2.0, NULL, v_org, v_now - INTERVAL '15 days', v_now),

    -- Tareas completadas (histórico)
    ('d3100000-7a5c-4000-a000-000000000013',
     'Presentar demanda ejecutiva',
     NULL, v_case_cobro, v_dl_vencido, v_demo_user, v_demo_user,
     'completed'::task_status, 'urgent'::task_priority,
     (CURRENT_DATE - INTERVAL '22 days')::timestamptz, NULL,
     v_now - INTERVAL '22 days',
     4.0, 3.5, v_org, v_now - INTERVAL '35 days', v_now - INTERVAL '22 days'),
    ('d3100000-7a5c-4000-a000-000000000014',
     'Cerrar acuerdo con Tecnotextil',
     NULL, v_case_accidente, NULL, v_demo_user, v_demo_user,
     'completed'::task_status, 'high'::task_priority,
     (CURRENT_DATE - INTERVAL '35 days')::timestamptz, NULL,
     v_now - INTERVAL '35 days',
     3.0, 4.0, v_org, v_now - INTERVAL '60 days', v_now - INTERVAL '35 days'),

    -- Tarea standalone (sin caso)
    ('d3100000-7a5c-4000-a000-000000000015',
     'Reunión interna — revisar agenda semanal',
     'Repaso de expedientes con vencimiento próximo.',
     NULL, NULL, v_demo_user, v_demo_user,
     'pending'::task_status, 'low'::task_priority,
     (CURRENT_DATE + INTERVAL '1 days')::timestamptz, NULL, NULL,
     0.5, NULL, v_org, v_now - INTERVAL '1 day', v_now)
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    priority = EXCLUDED.priority,
    due_date = EXCLUDED.due_date,
    completed_at = EXCLUDED.completed_at,
    actual_hours = EXCLUDED.actual_hours,
    updated_at = v_now;

  -- Comentarios de tareas (threads de colaboración)
  INSERT INTO public.task_comments (id, task_id, created_by, content, created_at, updated_at)
  VALUES
    ('d3100000-71c1-4000-a000-000000000001',
     'd3100000-7a5c-4000-a000-000000000001', v_demo_user,
     'Arranqué con el modo agente sobre el template contestación. Estoy revisando las citas con el verificador.',
     v_now - INTERVAL '2 days', v_now - INTERVAL '2 days'),
    ('d3100000-71c1-4000-a000-000000000002',
     'd3100000-7a5c-4000-a000-000000000001', v_demo_user,
     'Falta atacar el punto de agravio por maternidad. Confirmar con cliente fecha exacta de notificación.',
     v_now - INTERVAL '1 day', v_now - INTERVAL '1 day'),
    ('d3100000-71c1-4000-a000-000000000003',
     'd3100000-7a5c-4000-a000-000000000010', v_demo_user,
     'Sind. López mandó listado parcial de acreedores. Lo cruzo con contabilidad del cliente.',
     v_now - INTERVAL '3 days', v_now - INTERVAL '3 days')
  ON CONFLICT (id) DO NOTHING;

  -- =============================================================================
  -- 11. Documents (metadata de archivos por caso)
  -- =============================================================================
  INSERT INTO public.documents (
    id, name, description, category, file_path, file_size, mime_type,
    case_id, uploaded_by, is_visible_to_client, version, organization_id,
    created_at, updated_at
  )
  VALUES
    -- Caso despido
    ('d3100000-d0cc-4000-a000-000000000001', 'Demanda Molina c/ Distribuidora.pdf',
     'Traslado de demanda recibido por cédula.', 'court_filing'::document_category,
     'demo/cases/despido/demanda.pdf', 482300, 'application/pdf',
     v_case_despido, v_demo_user, false, 1, v_org, v_now - INTERVAL '44 days', v_now),
    ('d3100000-d0cc-4000-a000-000000000002', 'Legajo personal Molina.pdf',
     'Legajo completo aportado por cliente.', 'client_document'::document_category,
     'demo/cases/despido/legajo-molina.pdf', 1523000, 'application/pdf',
     v_case_despido, v_demo_user, false, 1, v_org, v_now - INTERVAL '40 days', v_now),
    ('d3100000-d0cc-4000-a000-000000000003', 'Telegrama de despido.pdf',
     NULL, 'correspondence'::document_category,
     'demo/cases/despido/telegrama.pdf', 120400, 'application/pdf',
     v_case_despido, v_demo_user, false, 1, v_org, v_now - INTERVAL '40 days', v_now),
    ('d3100000-d0cc-4000-a000-000000000004', 'Convenio colectivo aplicable.pdf',
     'Convenio 130/75 empleados de comercio.', 'evidence'::document_category,
     'demo/cases/despido/cct-130.pdf', 890100, 'application/pdf',
     v_case_despido, v_demo_user, false, 1, v_org, v_now - INTERVAL '35 days', v_now),

    -- Cobro
    ('d3100000-d0cc-4000-a000-000000000010', 'Contrato obra Frigorífico.pdf',
     'Contrato original firmado.', 'contract'::document_category,
     'demo/cases/cobro/contrato-obra.pdf', 1204000, 'application/pdf',
     v_case_cobro, v_demo_user, true, 1, v_org, v_now - INTERVAL '30 days', v_now),
    ('d3100000-d0cc-4000-a000-000000000011', 'Facturas impagas (3).pdf',
     'Facturas A 0001-00000423, 0001-00000451 y 0001-00000478.', 'evidence'::document_category,
     'demo/cases/cobro/facturas.pdf', 542000, 'application/pdf',
     v_case_cobro, v_demo_user, true, 1, v_org, v_now - INTERVAL '30 days', v_now),
    ('d3100000-d0cc-4000-a000-000000000012', 'Acta mediación fallida.pdf',
     NULL, 'court_filing'::document_category,
     'demo/cases/cobro/acta-mediacion.pdf', 210000, 'application/pdf',
     v_case_cobro, v_demo_user, false, 1, v_org, v_now - INTERVAL '25 days', v_now),

    -- Daños
    ('d3100000-d0cc-4000-a000-000000000020', 'Denuncia policial accidente.pdf',
     NULL, 'evidence'::document_category,
     'demo/cases/danos/denuncia-policial.pdf', 330000, 'application/pdf',
     v_case_danos, v_demo_user, true, 1, v_org, v_now - INTERVAL '120 days', v_now),
    ('d3100000-d0cc-4000-a000-000000000021', 'Historia clínica Benítez.pdf',
     'Estudios de hospital privado.', 'evidence'::document_category,
     'demo/cases/danos/historia-clinica.pdf', 2104000, 'application/pdf',
     v_case_danos, v_demo_user, false, 1, v_org, v_now - INTERVAL '115 days', v_now),
    ('d3100000-d0cc-4000-a000-000000000022', 'Dictamen pericial (borrador).pdf',
     'Ing. Sosa — borrador V1.', 'internal_memo'::document_category,
     'demo/cases/danos/pericial-v1.pdf', 890000, 'application/pdf',
     v_case_danos, v_demo_user, false, 1, v_org, v_now - INTERVAL '10 days', v_now),

    -- Desalojo
    ('d3100000-d0cc-4000-a000-000000000030', 'Escritura título campo La Esmeralda.pdf',
     NULL, 'evidence'::document_category,
     'demo/cases/desalojo/escritura.pdf', 1650000, 'application/pdf',
     v_case_desalojo, v_demo_user, false, 1, v_org, v_now - INTERVAL '175 days', v_now),
    ('d3100000-d0cc-4000-a000-000000000031', 'Informe dominio (vencido).pdf',
     'Requiere renovación.', 'evidence'::document_category,
     'demo/cases/desalojo/informe-dominio.pdf', 450000, 'application/pdf',
     v_case_desalojo, v_demo_user, false, 1, v_org, v_now - INTERVAL '90 days', v_now),

    -- Rescisión
    ('d3100000-d0cc-4000-a000-000000000040', 'Contrato de acopio soja 2024.pdf',
     NULL, 'contract'::document_category,
     'demo/cases/rescision/contrato-acopio.pdf', 980000, 'application/pdf',
     v_case_rescision, v_demo_user, true, 1, v_org, v_now - INTERVAL '75 days', v_now),
    ('d3100000-d0cc-4000-a000-000000000041', 'Intimación CD 234567.pdf',
     NULL, 'correspondence'::document_category,
     'demo/cases/rescision/cd-intimacion.pdf', 145000, 'application/pdf',
     v_case_rescision, v_demo_user, false, 1, v_org, v_now - INTERVAL '70 days', v_now),

    -- Sucesión
    ('d3100000-d0cc-4000-a000-000000000050', 'Partida defunción Fernández.pdf',
     NULL, 'evidence'::document_category,
     'demo/cases/sucesion/partida.pdf', 98000, 'application/pdf',
     v_case_sucesion, v_demo_user, true, 1, v_org, v_now - INTERVAL '200 days', v_now),
    ('d3100000-d0cc-4000-a000-000000000051', 'Declaratoria de herederos.pdf',
     NULL, 'court_filing'::document_category,
     'demo/cases/sucesion/declaratoria.pdf', 220000, 'application/pdf',
     v_case_sucesion, v_demo_user, true, 1, v_org, v_now - INTERVAL '40 days', v_now),

    -- Concurso
    ('d3100000-d0cc-4000-a000-000000000060', 'Nómina de acreedores denunciados.xlsx',
     NULL, 'court_filing'::document_category,
     'demo/cases/concurso/nomina-acreedores.xlsx', 56000,
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     v_case_concurso, v_demo_user, false, 1, v_org, v_now - INTERVAL '55 days', v_now),
    ('d3100000-d0cc-4000-a000-000000000061', 'Estados contables 2024.pdf',
     'Balance cerrado 31/12/2024.', 'evidence'::document_category,
     'demo/cases/concurso/balance-2024.pdf', 3400000, 'application/pdf',
     v_case_concurso, v_demo_user, false, 1, v_org, v_now - INTERVAL '55 days', v_now),
    ('d3100000-d0cc-4000-a000-000000000062', 'Resolución apertura concurso.pdf',
     NULL, 'court_filing'::document_category,
     'demo/cases/concurso/resolucion-apertura.pdf', 310000, 'application/pdf',
     v_case_concurso, v_demo_user, true, 1, v_org, v_now - INTERVAL '50 days', v_now),

    -- Accidente laboral cerrado
    ('d3100000-d0cc-4000-a000-000000000070', 'Acuerdo transaccional homologado.pdf',
     NULL, 'contract'::document_category,
     'demo/cases/accidente/acuerdo.pdf', 340000, 'application/pdf',
     v_case_accidente, v_demo_user, true, 1, v_org, v_now - INTERVAL '30 days', v_now - INTERVAL '30 days')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    file_size = EXCLUDED.file_size,
    updated_at = v_now;

  -- =============================================================================
  -- 12. Activity log (eventos recientes visibles en timeline)
  -- =============================================================================
  INSERT INTO public.activity_log (
    id, user_id, action_type, entity_type, entity_id, case_id,
    old_values, new_values, description, organization_id, created_at
  )
  VALUES
    ('d3100000-ac11-4000-a000-000000000001', v_demo_user, 'created', 'case', v_case_despido, v_case_despido,
     NULL, jsonb_build_object('title', 'Molina c/ Distribuidora San Martín'),
     'Caso creado', v_org, v_now - INTERVAL '45 days'),
    ('d3100000-ac11-4000-a000-000000000002', v_demo_user, 'uploaded', 'document',
     'd3100000-d0cc-4000-a000-000000000001'::uuid, v_case_despido, NULL,
     jsonb_build_object('name','Demanda Molina c/ Distribuidora.pdf'),
     'Documento subido', v_org, v_now - INTERVAL '44 days'),
    ('d3100000-ac11-4000-a000-000000000003', v_demo_user, 'completed', 'task',
     'd3100000-7a5c-4000-a000-000000000013'::uuid, v_case_cobro, NULL, NULL,
     'Tarea completada: Presentar demanda ejecutiva', v_org, v_now - INTERVAL '22 days'),
    ('d3100000-ac11-4000-a000-000000000004', v_demo_user, 'created', 'deadline',
     v_dl_contest, v_case_despido, NULL,
     jsonb_build_object('title','Contestar demanda — Molina'),
     'Vencimiento agendado', v_org, v_now - INTERVAL '4 days'),
    ('d3100000-ac11-4000-a000-000000000005', v_demo_user, 'ai_edit', 'lexia_document',
     gen_random_uuid(), v_case_despido, NULL, NULL,
     'Modo agente aplicó 3 pasos en contestación', v_org, v_now - INTERVAL '2 days'),
    ('d3100000-ac11-4000-a000-000000000006', v_demo_user, 'status_changed', 'case',
     v_case_accidente, v_case_accidente,
     jsonb_build_object('status','active'),
     jsonb_build_object('status','closed'),
     'Caso cerrado con acuerdo', v_org, v_now - INTERVAL '30 days')
  ON CONFLICT (id) DO NOTHING;

  -- =============================================================================
  -- 13. Notifications (mezcla leída + no leída)
  -- =============================================================================
  INSERT INTO public.notifications (
    id, user_id, category, type, title, message,
    case_id, task_id, deadline_id, document_id, triggered_by,
    is_read, read_at, organization_id, created_at, metadata
  )
  VALUES
    -- No leídas
    ('d3100000-1010-4000-a000-000000000001', v_demo_user, 'work'::notification_category,
     'deadline_approaching'::notification_type,
     'Vencimiento en 6 días',
     'Contestar demanda — Molina c/ Distribuidora San Martín',
     v_case_despido, NULL, v_dl_contest, NULL, v_demo_user,
     false, NULL, v_org, v_now - INTERVAL '6 hours', '{}'::jsonb),

    ('d3100000-1010-4000-a000-000000000002', v_demo_user, 'work'::notification_category,
     'deadline_approaching'::notification_type,
     'Verificación de créditos en 8 días',
     'Concurso Sierras Chicas — prioridad alta',
     v_case_concurso, NULL, v_dl_verificacion, NULL, v_demo_user,
     false, NULL, v_org, v_now - INTERVAL '5 hours', '{}'::jsonb),

    ('d3100000-1010-4000-a000-000000000003', v_demo_user, 'work'::notification_category,
     'deadline_overdue'::notification_type,
     'Vencimiento atrasado',
     'Revisar prescripción sucesión Fernández — vencido hace 5 días',
     v_case_sucesion, NULL, v_dl_prescrip, NULL, v_demo_user,
     false, NULL, v_org, v_now - INTERVAL '3 hours', '{}'::jsonb),

    ('d3100000-1010-4000-a000-000000000004', v_demo_user, 'activity'::notification_category,
     'document_uploaded'::notification_type,
     'Nuevo documento en Daños Benítez',
     'Dictamen pericial (borrador) subido por perito Sosa',
     v_case_danos, NULL, NULL, 'd3100000-d0cc-4000-a000-000000000022'::uuid, v_demo_user,
     false, NULL, v_org, v_now - INTERVAL '10 hours', '{}'::jsonb),

    -- Leídas
    ('d3100000-1010-4000-a000-000000000005', v_demo_user, 'work'::notification_category,
     'task_assigned'::notification_type,
     'Nueva tarea asignada',
     'Ofrecer prueba pericial y testimonial — Daños Benítez',
     v_case_danos, 'd3100000-7a5c-4000-a000-000000000006'::uuid, NULL, NULL, v_demo_user,
     true, v_now - INTERVAL '18 days', v_org, v_now - INTERVAL '20 days', '{}'::jsonb),

    ('d3100000-1010-4000-a000-000000000006', v_demo_user, 'activity'::notification_category,
     'case_status_changed'::notification_type,
     'Caso cerrado',
     'Sosa c/ Tecnotextil marcado como cerrado',
     v_case_accidente, NULL, NULL, NULL, v_demo_user,
     true, v_now - INTERVAL '30 days', v_org, v_now - INTERVAL '30 days', '{}'::jsonb),

    ('d3100000-1010-4000-a000-000000000007', v_demo_user, 'work'::notification_category,
     'task_completed'::notification_type,
     'Tarea completada',
     'Presentar demanda ejecutiva — Cobro Arroyito',
     v_case_cobro, 'd3100000-7a5c-4000-a000-000000000013'::uuid, NULL, NULL, v_demo_user,
     true, v_now - INTERVAL '22 days', v_org, v_now - INTERVAL '22 days', '{}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET
    is_read = EXCLUDED.is_read,
    read_at = EXCLUDED.read_at;
END
$demo_ops$;

COMMIT;

-- =============================================================================
-- Tercer bloque: Lexia Workspace (documentos, versiones, edits, chat)
-- =============================================================================

BEGIN;

DO $demo_lexia$
DECLARE
  v_demo_email    TEXT := 'demo@lexia.app';
  v_demo_user     UUID;
  v_org           UUID := 'd3100000-0000-4000-a000-000000000001';
  v_now           TIMESTAMPTZ := NOW();

  v_case_despido  UUID := 'd3100000-ca5e-4000-a000-000000000001';
  v_case_cobro    UUID := 'd3100000-ca5e-4000-a000-000000000002';
  v_case_danos    UUID := 'd3100000-ca5e-4000-a000-000000000003';
  v_case_concurso UUID := 'd3100000-ca5e-4000-a000-000000000007';

  v_ldoc_contest  UUID := 'd3100000-1ed1-4000-a000-000000000001';
  v_ldoc_demanda  UUID := 'd3100000-1ed1-4000-a000-000000000002';
  v_ldoc_escrito  UUID := 'd3100000-1ed1-4000-a000-000000000003';
  v_ldoc_dictamen UUID := 'd3100000-1ed1-4000-a000-000000000004';

  v_conv_general  UUID := 'd3100000-c04f-4000-a000-000000000001';
  v_conv_concurso UUID := 'd3100000-c04f-4000-a000-000000000002';
  v_conv_investig UUID := 'd3100000-c04f-4000-a000-000000000003';

  v_content_contest JSONB;
  v_content_demanda JSONB;
  v_content_escrito JSONB;
  v_content_dictamen JSONB;
BEGIN
  SELECT id INTO v_demo_user FROM auth.users WHERE lower(email) = lower(v_demo_email) LIMIT 1;
  IF v_demo_user IS NULL THEN RAISE EXCEPTION 'Falta demo user'; END IF;

  -- =============================================================================
  -- 14. Lexia documents (Tiptap JSON content)
  -- =============================================================================

  -- Contestación — documento rico con secciones, headings, citations
  v_content_contest := '{
    "type": "doc",
    "content": [
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Contestación de demanda"}]},
      {"type":"paragraph","content":[
        {"type":"text","marks":[{"type":"bold"}],"text":"Señor Juez:"}
      ]},
      {"type":"paragraph","content":[
        {"type":"text","text":"DISTRIBUIDORA SAN MARTÍN S.A., CUIT 30-70123456-1, con domicilio real en Ruta 9 km 702 de la ciudad de Córdoba, representada por su presidente Ricardo Paz (DNI 22.345.678), con el patrocinio letrado de la Dra. Lucía Martín (MP 1-12345), constituyendo domicilio electrónico en "},
        {"type":"text","marks":[{"type":"italic"}],"text":"demo@lexia.app"},
        {"type":"text","text":", viene en legal tiempo y forma a contestar la demanda incoada por la Sra. Claudia Molina, solicitando desde ya su rechazo con expresa imposición de costas."}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"I. Objeto"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"Que por las consideraciones de hecho y de derecho que se expresarán, mi representada solicita el rechazo íntegro de la demanda, en virtud de que el distracto encontró justa causa en la grave injuria laboral protagonizada por la actora."}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"II. Negativa puntual de los hechos"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"Se niegan todos y cada uno de los hechos invocados por la actora que no sean expresamente reconocidos, en particular: (i) que el despido carezca de causa; (ii) que la relación laboral haya tenido 8 años de antigüedad ininterrumpida; (iii) que la actora haya comunicado estado de embarazo antes del despido; (iv) cualquier acto discriminatorio."}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"III. Hechos — versión de mi representada"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"La actora ingresó a trabajar en mi representada el 14 de marzo de 2017. El día 12 de marzo de 2025, sin causa ni comunicación, abandonó su puesto de trabajo, situación que se reiteró los días 13 y 14, configurándose una inasistencia injustificada de tres jornadas consecutivas."}
      ]},
      {"type":"paragraph","content":[
        {"type":"text","text":"Ante ello, mi representada intimó por telegrama de fecha 17/03/2025 a retomar tareas, bajo apercibimiento de considerarse configurado el abandono de trabajo en los términos del "},
        {"type":"text","marks":[{"type":"highlight"}],"text":"art. 244 LCT"},
        {"type":"text","text":". La actora no dio respuesta. El distracto con justa causa se comunicó el 25/03/2025."}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"IV. Derecho"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"Resultan aplicables al caso los arts. 242, 244 y 245 LCT, así como los precedentes de la CSJN en «Vizzoti c/ AMSA» (Fallos 327:3677) en cuanto a la base de cálculo indemnizatoria (para el hipotético caso de prosperar la demanda)."}
      ]},
      {"type":"paragraph","content":[
        {"type":"text","text":"Respecto del agravio invocado por maternidad (art. 182 LCT), no resulta aplicable en tanto la actora nunca notificó fehacientemente dicha circunstancia a su empleadora, requisito exigido por la jurisprudencia laboral ("},
        {"type":"text","marks":[{"type":"highlight"}],"text":"CNAT, Sala VII, «Pérez c/ Falabella», 12/05/2021"},
        {"type":"text","text":")."}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"V. Prueba"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"Se ofrece: (a) documental — legajo personal, telegramas intercambiados, convenio colectivo 130/75; (b) testimonial — Claudia Godoy (supervisora directa), Diego Pereyra (delegado); (c) informativa — al Correo Argentino sobre autenticidad y recepción del CD de intimación."}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"VI. Petitorio"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"Por todo lo expuesto, solicito: (i) se tenga por contestada la demanda en tiempo y forma; (ii) se proveea la prueba ofrecida; (iii) oportunamente se dicte sentencia rechazando la demanda con costas a la actora."}
      ]}
    ]
  }'::jsonb;

  v_content_demanda := '{
    "type":"doc",
    "content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Demanda por cobro de pesos"}]},
      {"type":"paragraph","content":[
        {"type":"text","marks":[{"type":"bold"}],"text":"Señor Juez:"}
      ]},
      {"type":"paragraph","content":[
        {"type":"text","text":"CONSTRUCTORA ARROYITO S.R.L., CUIT 30-70234567-2, con patrocinio letrado de la Dra. Lucía Martín (MP 1-12345), se presenta y promueve formal demanda ejecutiva contra FRIGORÍFICO DEL CENTRO S.A. por la suma de $14.200.000, con más intereses y costas."}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"I. Hechos"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"Entre las partes se celebró contrato de obra de fecha 03/02/2024, por el cual mi mandante se obligó a ampliar la planta de faena de la demandada ubicada en la localidad de Arroyito..."}
      ]}
    ]
  }'::jsonb;

  v_content_escrito := '{
    "type":"doc",
    "content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Ofrecimiento de prueba"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"En el juicio Benítez, Juan Carlos c/ Flota Norte S.R.L. s/ Daños y perjuicios..."}
      ]}
    ]
  }'::jsonb;

  v_content_dictamen := '{
    "type":"doc",
    "content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Impugnación de crédito"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"(Documento vacío — recién creado)"}
      ]}
    ]
  }'::jsonb;

  INSERT INTO public.lexia_documents (
    id, organization_id, user_id, case_id, document_type, title,
    content, content_text, client_role, metadata, active_context,
    version, created_at, updated_at
  )
  VALUES
    (v_ldoc_contest, v_org, v_demo_user, v_case_despido, 'contestacion',
     'Contestación — Molina c/ Distribuidora San Martín',
     v_content_contest,
     'Contestación de demanda... DISTRIBUIDORA SAN MARTÍN S.A. viene a contestar la demanda...',
     'demandado',
     jsonb_build_object(
       'template_id','contestacion-laboral-v1',
       'agent_runs', 2,
       'stress_test_score', 'medium',
       'last_action','agent_completed'
     ),
     jsonb_build_object(
       'documentIds', jsonb_build_array(
         'd3100000-d0cc-4000-a000-000000000001',
         'd3100000-d0cc-4000-a000-000000000002',
         'd3100000-d0cc-4000-a000-000000000003'),
       'personIds', jsonb_build_array(
         'd3100000-9e9e-4000-a000-000000000040',
         'd3100000-9e9e-4000-a000-000000000020')
     ),
     4, v_now - INTERVAL '4 days', v_now - INTERVAL '2 hours'),

    (v_ldoc_demanda, v_org, v_demo_user, v_case_cobro, 'demanda',
     'Demanda ejecutiva — Arroyito c/ Frigorífico',
     v_content_demanda,
     'Demanda por cobro de pesos... CONSTRUCTORA ARROYITO S.R.L....',
     'actora',
     jsonb_build_object('template_id','demanda-ejecutiva-v1','last_action','manual_edit'),
     jsonb_build_object(
       'documentIds', jsonb_build_array(
         'd3100000-d0cc-4000-a000-000000000010',
         'd3100000-d0cc-4000-a000-000000000011'),
       'personIds', jsonb_build_array(
         'd3100000-9e9e-4000-a000-000000000002')),
     2, v_now - INTERVAL '25 days', v_now - INTERVAL '3 days'),

    (v_ldoc_escrito, v_org, v_demo_user, v_case_danos, 'escrito',
     'Ofrecimiento de prueba — Benítez c/ Flota Norte',
     v_content_escrito,
     'Ofrecimiento de prueba... Benítez c/ Flota Norte...',
     'actora',
     jsonb_build_object('last_action','draft'),
     jsonb_build_object(
       'documentIds', jsonb_build_array(
         'd3100000-d0cc-4000-a000-000000000020',
         'd3100000-d0cc-4000-a000-000000000021'),
       'personIds', jsonb_build_array()),
     1, v_now - INTERVAL '3 days', v_now - INTERVAL '1 day'),

    (v_ldoc_dictamen, v_org, v_demo_user, v_case_concurso, 'escrito',
     'Impugnación crédito Proveedor Central (borrador)',
     v_content_dictamen,
     'Impugnación de crédito (documento vacío — recién creado)',
     'demandada',
     jsonb_build_object('last_action','created'),
     jsonb_build_object(
       'documentIds', jsonb_build_array(
         'd3100000-d0cc-4000-a000-000000000060',
         'd3100000-d0cc-4000-a000-000000000061'),
       'personIds', jsonb_build_array()),
     1, v_now - INTERVAL '1 day', v_now - INTERVAL '1 day')
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    content_text = EXCLUDED.content_text,
    metadata = EXCLUDED.metadata,
    active_context = EXCLUDED.active_context,
    version = EXCLUDED.version,
    updated_at = v_now;

  -- Versions (snapshots)
  INSERT INTO public.lexia_document_versions (
    id, document_id, organization_id, user_id, version,
    content, content_text, source, edit_id, summary, created_at
  )
  VALUES
    ('d3100000-11e5-4000-a000-000000000001', v_ldoc_contest, v_org, v_demo_user, 1,
     '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"(Plantilla inicial aplicada)"}]}]}'::jsonb,
     '(Plantilla inicial aplicada)', 'template', NULL,
     'Plantilla contestación laboral aplicada', v_now - INTERVAL '4 days'),
    ('d3100000-11e5-4000-a000-000000000002', v_ldoc_contest, v_org, v_demo_user, 2,
     '{"type":"doc","content":[]}'::jsonb, '(snapshot parcial)', 'manual', NULL,
     'Edición manual — completé datos de partes', v_now - INTERVAL '3 days'),
    ('d3100000-11e5-4000-a000-000000000003', v_ldoc_contest, v_org, v_demo_user, 3,
     '{"type":"doc","content":[]}'::jsonb, '(snapshot parcial)', 'ai_agent', NULL,
     'Modo agente — 3 pasos (hechos, derecho, prueba)', v_now - INTERVAL '2 days'),
    ('d3100000-11e5-4000-a000-000000000004', v_ldoc_contest, v_org, v_demo_user, 4,
     v_content_contest, 'Contestación completa', 'ai_edit', NULL,
     'Aplicada sugerencia ⌘K — negativa puntual', v_now - INTERVAL '2 hours'),
    ('d3100000-11e5-4000-a000-000000000005', v_ldoc_demanda, v_org, v_demo_user, 1,
     '{"type":"doc","content":[]}'::jsonb, '(plantilla)', 'template', NULL,
     'Plantilla demanda ejecutiva aplicada', v_now - INTERVAL '25 days'),
    ('d3100000-11e5-4000-a000-000000000006', v_ldoc_demanda, v_org, v_demo_user, 2,
     v_content_demanda, 'Demanda parcial', 'manual', NULL,
     'Redacción de hechos', v_now - INTERVAL '3 days')
  ON CONFLICT (id) DO NOTHING;

  -- Edits (auditoría de ediciones AI)
  INSERT INTO public.lexia_document_edits (
    id, document_id, organization_id, user_id, instruction, mode,
    selection_from, selection_to, selection_text, context,
    reasoning, replacement, alternatives, citations,
    status, accepted_text, model_used, tokens_used, created_at, resolved_at
  )
  VALUES
    ('d3100000-ed17-4000-a000-000000000001', v_ldoc_contest, v_org, v_demo_user,
     'Reforzar la negativa puntual del art. 182 LCT', 'selection',
     1200, 1450, 'Se niegan todos y cada uno de los hechos...',
     jsonb_build_object(
       'documentIds', jsonb_build_array(
         'd3100000-d0cc-4000-a000-000000000001',
         'd3100000-d0cc-4000-a000-000000000002'),
       'personIds', jsonb_build_array()),
     'La actora no acreditó notificación fehaciente del embarazo; reforzar con jurisprudencia de CNAT Sala VII.',
     'Se niegan todos y cada uno de los hechos invocados por la actora que no sean expresamente reconocidos, en particular: (i) que el despido carezca de causa; (ii) que la relación laboral haya tenido 8 años de antigüedad ininterrumpida; (iii) que la actora haya comunicado estado de embarazo antes del despido; (iv) cualquier acto discriminatorio.',
     '[]'::jsonb,
     jsonb_build_array(
       jsonb_build_object('source','art. 182 LCT','status','verified'),
       jsonb_build_object('source','CNAT Sala VII, «Pérez c/ Falabella», 12/05/2021','status','warning',
                          'note','No pudo verificarse en repositorio curado')),
     'accepted',
     'Se niegan todos y cada uno de los hechos invocados...',
     'gpt-5.4', 2340, v_now - INTERVAL '2 hours', v_now - INTERVAL '2 hours'),

    ('d3100000-ed17-4000-a000-000000000002', v_ldoc_contest, v_org, v_demo_user,
     'Modo agente: completar secciones III, IV y V', 'agent',
     NULL, NULL, NULL,
     jsonb_build_object(
       'agent', jsonb_build_object(
         'plan_run_id', 'd3100000-ed17-plan-000000000002',
         'plan_summary', 'Contestación laboral — 3 secciones')),
     'Plan propuesto: hechos, derecho, prueba. Ejecutar paso a paso.',
     NULL, '[]'::jsonb, '[]'::jsonb,
     'accepted', NULL, 'gpt-5.4', 8120,
     v_now - INTERVAL '2 days', v_now - INTERVAL '2 days'),

    ('d3100000-ed17-4000-a000-000000000003', v_ldoc_demanda, v_org, v_demo_user,
     'Mejorar párrafo de fundamentos jurídicos', 'selection',
     850, 1020, 'Los arts. 520 y ss CPCCN autorizan...',
     '{"documentIds":[],"personIds":[]}'::jsonb,
     'Agregar cita de Palacio y precedente CSJN reciente.',
     'Los arts. 520 y ss CPCCN autorizan la vía ejecutiva en tanto el título traído reúne los requisitos de liquidez, exigibilidad y autosuficiencia (cfr. Palacio, «Derecho Procesal Civil», T. VII, 2019, p. 312; CSJN «Banco Patagonia c/ Terra», 18/06/2023).',
     '[]'::jsonb,
     jsonb_build_array(
       jsonb_build_object('source','arts. 520 y ss CPCCN','status','verified'),
       jsonb_build_object('source','CSJN «Banco Patagonia c/ Terra», 18/06/2023','status','unknown')),
     'pending', NULL, 'gpt-5.4', 1870,
     v_now - INTERVAL '2 days', NULL)
  ON CONFLICT (id) DO NOTHING;

  -- =============================================================================
  -- 15. Lexia conversations (chat legal)
  -- =============================================================================
  INSERT INTO public.lexia_conversations (
    id, user_id, case_id, organization_id,
    title, summary, intent, model_used,
    message_count, is_archived, is_pinned, last_message_at,
    created_at, updated_at
  )
  VALUES
    (v_conv_general, v_demo_user, NULL, v_org,
     'Tips generales — prescripción laboral',
     'Consultas breves sobre plazos prescriptivos en causas laborales.',
     'general_qa', 'gpt-5.4',
     4, false, true, v_now - INTERVAL '3 days',
     v_now - INTERVAL '5 days', v_now - INTERVAL '3 days'),

    (v_conv_concurso, v_demo_user, v_case_concurso, v_org,
     'Estrategia concurso Sierras Chicas',
     'Análisis de créditos privilegiados, impugnaciones y cronograma.',
     'case_strategy', 'gpt-5.4',
     6, false, true, v_now - INTERVAL '1 day',
     v_now - INTERVAL '10 days', v_now - INTERVAL '1 day'),

    (v_conv_investig, v_demo_user, v_case_despido, v_org,
     'Investigar: art. 182 LCT y notificación de embarazo',
     'Búsqueda en documentos del caso + jurisprudencia.',
     'investigate', 'gpt-5.4',
     3, false, false, v_now - INTERVAL '2 days',
     v_now - INTERVAL '3 days', v_now - INTERVAL '2 days')
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    last_message_at = EXCLUDED.last_message_at,
    message_count = EXCLUDED.message_count,
    updated_at = v_now;

  -- Mensajes de cada conversación (UIMessage-like structure)
  INSERT INTO public.lexia_messages (
    id, conversation_id, role, content, metadata, tokens_used, organization_id, created_at
  )
  VALUES
    -- conversación general
    ('msg-gen-1', v_conv_general, 'user',
     jsonb_build_object('id','msg-gen-1','role','user','parts',
       jsonb_build_array(jsonb_build_object('type','text','text',
         '¿Cuál es el plazo de prescripción de acciones emergentes de un despido?'))),
     '{}'::jsonb, 0, v_org, v_now - INTERVAL '5 days'),
    ('msg-gen-2', v_conv_general, 'assistant',
     jsonb_build_object('id','msg-gen-2','role','assistant','parts',
       jsonb_build_array(jsonb_build_object('type','text','text',
         'En Argentina, el art. 256 LCT establece un plazo de prescripción bienal para las acciones emergentes de la relación laboral, incluyendo las indemnizaciones por despido. El plazo corre desde que la obligación se hace exigible.'))),
     '{}'::jsonb, 180, v_org, v_now - INTERVAL '5 days' + INTERVAL '1 min'),
    ('msg-gen-3', v_conv_general, 'user',
     jsonb_build_object('id','msg-gen-3','role','user','parts',
       jsonb_build_array(jsonb_build_object('type','text','text',
         '¿Hay algún supuesto que suspenda o interrumpa el plazo?'))),
     '{}'::jsonb, 0, v_org, v_now - INTERVAL '3 days' - INTERVAL '5 min'),
    ('msg-gen-4', v_conv_general, 'assistant',
     jsonb_build_object('id','msg-gen-4','role','assistant','parts',
       jsonb_build_array(jsonb_build_object('type','text','text',
         'Sí: el reclamo administrativo ante el SECLO/MTESS suspende el plazo hasta el acta de cierre; también la interposición de demanda, las gestiones extrajudiciales fehacientes y los reconocimientos del empleador (arts. 2541 y 2545 CCyC en lo aplicable). La intimación por CD, por sí sola, no suspende pero puede constituir mora.'))),
     '{}'::jsonb, 240, v_org, v_now - INTERVAL '3 days'),

    -- conversación concurso
    ('msg-conc-1', v_conv_concurso, 'user',
     jsonb_build_object('id','msg-conc-1','role','user','parts',
       jsonb_build_array(jsonb_build_object('type','text','text',
         'Proveedor Central S.A. insinuó un crédito de $42M alegando facturas impagas pero sin acompañar acuerdos de pago. ¿Elementos para impugnar?'))),
     '{}'::jsonb, 0, v_org, v_now - INTERVAL '3 days'),
    ('msg-conc-2', v_conv_concurso, 'assistant',
     jsonb_build_object('id','msg-conc-2','role','assistant','parts',
       jsonb_build_array(jsonb_build_object('type','text','text',
         'Sobre la impugnación del crédito, te sugiero atacar: (1) autosuficiencia de la causa — la mera factura no prueba la prestación; necesita remito, acuerdo marco o correspondencia; (2) compensaciones pendientes del período — cruzar contra tu libro IVA y cuentas corrientes; (3) prescripción parcial si hay facturas de más de 3 años (art. 2560 CCyC para mercantiles).'))),
     '{}'::jsonb, 420, v_org, v_now - INTERVAL '3 days' + INTERVAL '2 min'),

    -- investigar
    ('msg-inv-1', v_conv_investig, 'user',
     jsonb_build_object('id','msg-inv-1','role','user','parts',
       jsonb_build_array(jsonb_build_object('type','text','text',
         '¿La actora notificó el embarazo a la empresa antes del despido? Revisar el legajo y el telegrama.'))),
     '{}'::jsonb, 0, v_org, v_now - INTERVAL '2 days'),
    ('msg-inv-2', v_conv_investig, 'assistant',
     jsonb_build_object('id','msg-inv-2','role','assistant','parts',
       jsonb_build_array(jsonb_build_object('type','text','text',
         'Del legajo personal Molina.pdf (p. 14) surge un certificado médico del 18/03/2025 que menciona "controles ginecológicos"; del telegrama de despido no surge notificación previa de embarazo ni agravio invocado por la empresa. Recomiendo atacar el art. 182 LCT por falta de notificación fehaciente ANTES del distracto (requisito: CNAT Sala VII «Pérez c/ Falabella»).'))),
     '{}'::jsonb, 380, v_org, v_now - INTERVAL '2 days' + INTERVAL '1 min')
  ON CONFLICT (conversation_id, id) DO NOTHING;
END
$demo_lexia$;

COMMIT;

-- =============================================================================
-- Cuarto bloque: Billing (acuerdos, items, facturas, movimientos, pagos)
-- =============================================================================

BEGIN;

DO $demo_billing$
DECLARE
  v_demo_email   TEXT := 'demo@lexia.app';
  v_demo_user    UUID;
  v_org          UUID := 'd3100000-0000-4000-a000-000000000001';
  v_now          TIMESTAMPTZ := NOW();

  v_co_distrib   UUID := 'd3100000-c1c1-4000-a000-000000000001';
  v_co_construc  UUID := 'd3100000-c1c1-4000-a000-000000000002';
  v_co_agro      UUID := 'd3100000-c1c1-4000-a000-000000000003';
  v_co_textil    UUID := 'd3100000-c1c1-4000-a000-000000000004';
  v_co_hotel     UUID := 'd3100000-c1c1-4000-a000-000000000005';
  v_p_benitez    UUID := 'd3100000-9e9e-4000-a000-000000000006';

  v_case_despido  UUID := 'd3100000-ca5e-4000-a000-000000000001';
  v_case_cobro    UUID := 'd3100000-ca5e-4000-a000-000000000002';
  v_case_danos    UUID := 'd3100000-ca5e-4000-a000-000000000003';
  v_case_concurso UUID := 'd3100000-ca5e-4000-a000-000000000007';
  v_case_accidente UUID := 'd3100000-ca5e-4000-a000-000000000008';

  v_fa_distrib   UUID := 'd3100000-fa11-4000-a000-000000000001';
  v_fa_construc  UUID := 'd3100000-fa11-4000-a000-000000000002';
  v_fa_hotel     UUID := 'd3100000-fa11-4000-a000-000000000003';
  v_fa_benitez   UUID := 'd3100000-fa11-4000-a000-000000000004';

  v_inv_distrib_09 UUID := 'd3100000-11c0-4000-a000-000000000001';
  v_inv_distrib_10 UUID := 'd3100000-11c0-4000-a000-000000000002';
  v_inv_construc   UUID := 'd3100000-11c0-4000-a000-000000000003';
  v_inv_hotel      UUID := 'd3100000-11c0-4000-a000-000000000004';
  v_inv_benitez    UUID := 'd3100000-11c0-4000-a000-000000000005';
BEGIN
  SELECT id INTO v_demo_user FROM auth.users WHERE lower(email) = lower(v_demo_email) LIMIT 1;
  IF v_demo_user IS NULL THEN RAISE EXCEPTION 'Falta demo user'; END IF;

  -- =============================================================================
  -- 16. Organization billing settings
  -- =============================================================================
  INSERT INTO public.organization_billing_settings (
    id, organization_id, default_currency, invoice_prefix, default_tax_rate,
    default_payment_terms_days, default_participation_studio_assigned,
    default_participation_lawyer_recruited, current_jus_value, jus_currency,
    settings, created_at, updated_at
  )
  VALUES (
    'd3100000-b111-4000-a000-000000000001', v_org, 'ARS', 'DEMO',
    21.00, 30, 30.00, 20.00, 15200.00, 'ARS',
    jsonb_build_object('demo', true), v_now - INTERVAL '120 days', v_now
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    current_jus_value = EXCLUDED.current_jus_value,
    updated_at = v_now;

  -- =============================================================================
  -- 17. Fee agreements
  -- =============================================================================
  INSERT INTO public.fee_agreements (
    id, client_id, company_id, case_id, type, status, currency,
    valid_from, valid_until, terms, notes, created_by, organization_id,
    created_at, updated_at
  )
  VALUES
    (v_fa_distrib, NULL, v_co_distrib, NULL,
     'retainer_plus_task'::fee_agreement_type, 'active'::fee_agreement_status, 'ARS',
     CURRENT_DATE - INTERVAL '300 days', NULL,
     jsonb_build_object(
       'monthly_retainer', 450000,
       'task_rates', jsonb_build_object('per_scrito', 120000, 'audiencia', 180000),
       'scope', 'Asesoramiento general y litigios laborales'
     ),
     'Contrato marco vigente. Revisar ajuste IPC enero.',
     v_demo_user, v_org, v_now - INTERVAL '300 days', v_now),

    (v_fa_construc, NULL, v_co_construc, v_case_cobro,
     'hybrid'::fee_agreement_type, 'active'::fee_agreement_status, 'ARS',
     CURRENT_DATE - INTERVAL '60 days', NULL,
     jsonb_build_object(
       'fixed_fee', 800000, 'success_fee_pct', 10,
       'scope', 'Ejecución contra Frigorífico del Centro'
     ),
     'Fijo + % sobre recupero efectivo.',
     v_demo_user, v_org, v_now - INTERVAL '60 days', v_now),

    (v_fa_hotel, NULL, v_co_hotel, v_case_concurso,
     'custom_quote'::fee_agreement_type, 'active'::fee_agreement_status, 'ARS',
     CURRENT_DATE - INTERVAL '90 days', NULL,
     jsonb_build_object(
       'stages', jsonb_build_array(
         jsonb_build_object('name','Apertura y presentación','amount',1500000),
         jsonb_build_object('name','Verificación de créditos','amount',2200000),
         jsonb_build_object('name','Propuesta de acuerdo','amount',2800000)),
       'scope', 'Concurso preventivo completo'
     ),
     'Presupuesto por etapas.',
     v_demo_user, v_org, v_now - INTERVAL '90 days', v_now),

    (v_fa_benitez, v_p_benitez, NULL, v_case_danos,
     'custom_quote'::fee_agreement_type, 'active'::fee_agreement_status, 'ARS',
     CURRENT_DATE - INTERVAL '120 days', NULL,
     jsonb_build_object('pacto_cuota_litis', 25, 'anticipo', 350000),
     'Pacto cuota litis 25% del recupero.',
     v_demo_user, v_org, v_now - INTERVAL '120 days', v_now)
  ON CONFLICT (id) DO UPDATE SET
    terms = EXCLUDED.terms,
    notes = EXCLUDED.notes,
    updated_at = v_now;

  -- =============================================================================
  -- 18. Client accounts
  -- =============================================================================
  INSERT INTO public.client_accounts (
    id, client_id, company_id, credit_limit, grace_days, currency,
    notes, organization_id, created_at, updated_at
  )
  VALUES
    ('d3100000-acc0-4000-a000-000000000001', NULL, v_co_distrib, 5000000.00, 30, 'ARS',
     NULL, v_org, v_now - INTERVAL '300 days', v_now),
    ('d3100000-acc0-4000-a000-000000000002', NULL, v_co_construc, 3000000.00, 30, 'ARS',
     NULL, v_org, v_now - INTERVAL '240 days', v_now),
    ('d3100000-acc0-4000-a000-000000000003', NULL, v_co_agro, 4000000.00, 30, 'ARS',
     NULL, v_org, v_now - INTERVAL '180 days', v_now),
    ('d3100000-acc0-4000-a000-000000000004', NULL, v_co_textil, 2000000.00, 30, 'ARS',
     NULL, v_org, v_now - INTERVAL '150 days', v_now),
    ('d3100000-acc0-4000-a000-000000000005', NULL, v_co_hotel, 8000000.00, 45, 'ARS',
     'Cliente en concurso — ampliar plazo.', v_org, v_now - INTERVAL '90 days', v_now),
    ('d3100000-acc0-4000-a000-000000000006', v_p_benitez, NULL, 500000.00, 30, 'ARS',
     NULL, v_org, v_now - INTERVAL '120 days', v_now)
  ON CONFLICT DO NOTHING;
  -- Note: partial unique indexes (org, client_id) / (org, company_id) se
  -- respetan; con ON CONFLICT DO NOTHING ignoramos duplicados en re-ejecuciones.

  -- =============================================================================
  -- 19. Invoices
  -- =============================================================================
  INSERT INTO public.invoices (
    id, client_id, company_id, invoice_number, status,
    issue_date, due_date, subtotal, tax_rate, tax_amount, total,
    currency, period, notes, created_by, organization_id, created_at, updated_at
  )
  VALUES
    (v_inv_distrib_09, NULL, v_co_distrib, 'DEMO-0001-0023',
     'paid'::invoice_status,
     (CURRENT_DATE - INTERVAL '55 days')::date,
     (CURRENT_DATE - INTERVAL '25 days')::date,
     450000, 21.00, 94500, 544500, 'ARS', '2025-09',
     'Honorarios septiembre 2025 — retainer + 2 escritos',
     v_demo_user, v_org, v_now - INTERVAL '55 days', v_now - INTERVAL '25 days'),

    (v_inv_distrib_10, NULL, v_co_distrib, 'DEMO-0001-0041',
     'issued'::invoice_status,
     (CURRENT_DATE - INTERVAL '10 days')::date,
     (CURRENT_DATE + INTERVAL '20 days')::date,
     690000, 21.00, 144900, 834900, 'ARS', '2025-10',
     'Honorarios octubre 2025 — retainer + audiencia + contestación',
     v_demo_user, v_org, v_now - INTERVAL '10 days', v_now),

    (v_inv_construc, NULL, v_co_construc, 'DEMO-0001-0035',
     'overdue'::invoice_status,
     (CURRENT_DATE - INTERVAL '55 days')::date,
     (CURRENT_DATE - INTERVAL '25 days')::date,
     800000, 21.00, 168000, 968000, 'ARS', NULL,
     'Honorarios fijos — ejecución Frigorífico',
     v_demo_user, v_org, v_now - INTERVAL '55 days', v_now),

    (v_inv_hotel, NULL, v_co_hotel, 'DEMO-0001-0039',
     'partially_paid'::invoice_status,
     (CURRENT_DATE - INTERVAL '30 days')::date,
     (CURRENT_DATE + INTERVAL '15 days')::date,
     1500000, 21.00, 315000, 1815000, 'ARS', NULL,
     'Etapa 1 — Apertura concurso',
     v_demo_user, v_org, v_now - INTERVAL '30 days', v_now),

    (v_inv_benitez, v_p_benitez, NULL, 'DEMO-0001-0018',
     'paid'::invoice_status,
     (CURRENT_DATE - INTERVAL '110 days')::date,
     (CURRENT_DATE - INTERVAL '80 days')::date,
     350000, 21.00, 73500, 423500, 'ARS', NULL,
     'Anticipo pacto cuota litis',
     v_demo_user, v_org, v_now - INTERVAL '110 days', v_now - INTERVAL '100 days')
  ON CONFLICT (organization_id, invoice_number) DO UPDATE SET
    status = EXCLUDED.status,
    total = EXCLUDED.total,
    updated_at = v_now;

  -- =============================================================================
  -- 20. Billing items
  -- =============================================================================
  INSERT INTO public.billing_items (
    id, client_id, company_id, case_id, fee_agreement_id, invoice_id,
    type, description, amount, quantity, currency, period, status,
    created_by, approved_by, approved_at, organization_id, created_at, updated_at
  )
  VALUES
    -- Distribuidora septiembre (facturado)
    ('d3100000-b17e-4000-a000-000000000001', NULL, v_co_distrib, v_case_despido,
     v_fa_distrib, v_inv_distrib_09, 'monthly_fee'::billing_item_type,
     'Retainer mensual — septiembre', 450000, 1, 'ARS', '2025-09',
     'invoiced'::billing_item_status, v_demo_user, v_demo_user,
     v_now - INTERVAL '56 days', v_org, v_now - INTERVAL '60 days', v_now),

    -- Distribuidora octubre
    ('d3100000-b17e-4000-a000-000000000002', NULL, v_co_distrib, NULL,
     v_fa_distrib, v_inv_distrib_10, 'monthly_fee'::billing_item_type,
     'Retainer mensual — octubre', 450000, 1, 'ARS', '2025-10',
     'invoiced'::billing_item_status, v_demo_user, v_demo_user,
     v_now - INTERVAL '11 days', v_org, v_now - INTERVAL '15 days', v_now),
    ('d3100000-b17e-4000-a000-000000000003', NULL, v_co_distrib, v_case_despido,
     v_fa_distrib, v_inv_distrib_10, 'task_fee'::billing_item_type,
     'Preparación contestación demanda Molina', 120000, 2, 'ARS', '2025-10',
     'invoiced'::billing_item_status, v_demo_user, v_demo_user,
     v_now - INTERVAL '11 days', v_org, v_now - INTERVAL '15 days', v_now),

    -- Distribuidora draft (sin facturar)
    ('d3100000-b17e-4000-a000-000000000004', NULL, v_co_distrib, v_case_despido,
     v_fa_distrib, NULL, 'task_fee'::billing_item_type,
     'Audiencia testimonial — preparar', 180000, 1, 'ARS', '2025-11',
     'draft'::billing_item_status, v_demo_user, NULL, NULL,
     v_org, v_now - INTERVAL '2 days', v_now),

    -- Constructora
    ('d3100000-b17e-4000-a000-000000000005', NULL, v_co_construc, v_case_cobro,
     v_fa_construc, v_inv_construc, 'other'::billing_item_type,
     'Honorarios fijos ejecución Frigorífico', 800000, 1, 'ARS', NULL,
     'invoiced'::billing_item_status, v_demo_user, v_demo_user,
     v_now - INTERVAL '56 days', v_org, v_now - INTERVAL '60 days', v_now),

    -- Hotel
    ('d3100000-b17e-4000-a000-000000000006', NULL, v_co_hotel, v_case_concurso,
     v_fa_hotel, v_inv_hotel, 'other'::billing_item_type,
     'Etapa 1: apertura concurso preventivo', 1500000, 1, 'ARS', NULL,
     'invoiced'::billing_item_status, v_demo_user, v_demo_user,
     v_now - INTERVAL '31 days', v_org, v_now - INTERVAL '35 days', v_now),

    -- Benítez
    ('d3100000-b17e-4000-a000-000000000007', v_p_benitez, NULL, v_case_danos,
     v_fa_benitez, v_inv_benitez, 'other'::billing_item_type,
     'Anticipo honorarios', 350000, 1, 'ARS', NULL,
     'invoiced'::billing_item_status, v_demo_user, v_demo_user,
     v_now - INTERVAL '111 days', v_org, v_now - INTERVAL '115 days', v_now)
  ON CONFLICT (id) DO UPDATE SET
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    status = EXCLUDED.status,
    updated_at = v_now;

  -- =============================================================================
  -- 21. Payments
  -- =============================================================================
  INSERT INTO public.payments (
    id, client_id, company_id, amount, currency, payment_date,
    payment_method, reference_number, invoice_id, notes,
    created_by, organization_id, created_at, updated_at
  )
  VALUES
    ('d3100000-9a41-4000-a000-000000000001', NULL, v_co_distrib,
     544500, 'ARS', (CURRENT_DATE - INTERVAL '22 days')::date, 'transferencia',
     'BANCO-MACRO-TRANSF-0123', v_inv_distrib_09, 'Pago total factura septiembre',
     v_demo_user, v_org, v_now - INTERVAL '22 days', v_now),
    ('d3100000-9a41-4000-a000-000000000002', NULL, v_co_hotel,
     900000, 'ARS', (CURRENT_DATE - INTERVAL '15 days')::date, 'transferencia',
     'BANCO-GALICIA-0987', v_inv_hotel, 'Pago parcial etapa 1 concurso',
     v_demo_user, v_org, v_now - INTERVAL '15 days', v_now),
    ('d3100000-9a41-4000-a000-000000000003', v_p_benitez, NULL,
     423500, 'ARS', (CURRENT_DATE - INTERVAL '105 days')::date, 'efectivo',
     NULL, v_inv_benitez, 'Anticipo en efectivo',
     v_demo_user, v_org, v_now - INTERVAL '105 days', v_now - INTERVAL '105 days')
  ON CONFLICT (id) DO NOTHING;

  -- =============================================================================
  -- 22. Account movements (ledger)
  -- =============================================================================
  INSERT INTO public.account_movements (
    id, client_id, company_id, type, amount, currency,
    movement_date, reference_id, reference_type, invoice_id, notes,
    created_by, organization_id, created_at
  )
  VALUES
    -- Distribuidora
    ('d3100000-1ed6-4000-a000-000000000001', NULL, v_co_distrib,
     'invoice'::account_movement_type, 544500, 'ARS',
     (CURRENT_DATE - INTERVAL '55 days')::date, v_inv_distrib_09, 'invoice',
     v_inv_distrib_09, 'Fc. DEMO-0001-0023',
     v_demo_user, v_org, v_now - INTERVAL '55 days'),
    ('d3100000-1ed6-4000-a000-000000000002', NULL, v_co_distrib,
     'payment'::account_movement_type, -544500, 'ARS',
     (CURRENT_DATE - INTERVAL '22 days')::date, NULL, 'payment',
     v_inv_distrib_09, 'Pago Fc. 0023',
     v_demo_user, v_org, v_now - INTERVAL '22 days'),
    ('d3100000-1ed6-4000-a000-000000000003', NULL, v_co_distrib,
     'invoice'::account_movement_type, 834900, 'ARS',
     (CURRENT_DATE - INTERVAL '10 days')::date, v_inv_distrib_10, 'invoice',
     v_inv_distrib_10, 'Fc. DEMO-0001-0041 (pendiente)',
     v_demo_user, v_org, v_now - INTERVAL '10 days'),

    -- Constructora (vencida)
    ('d3100000-1ed6-4000-a000-000000000004', NULL, v_co_construc,
     'invoice'::account_movement_type, 968000, 'ARS',
     (CURRENT_DATE - INTERVAL '55 days')::date, v_inv_construc, 'invoice',
     v_inv_construc, 'Fc. DEMO-0001-0035 (vencida)',
     v_demo_user, v_org, v_now - INTERVAL '55 days'),

    -- Hotel
    ('d3100000-1ed6-4000-a000-000000000005', NULL, v_co_hotel,
     'invoice'::account_movement_type, 1815000, 'ARS',
     (CURRENT_DATE - INTERVAL '30 days')::date, v_inv_hotel, 'invoice',
     v_inv_hotel, 'Fc. DEMO-0001-0039',
     v_demo_user, v_org, v_now - INTERVAL '30 days'),
    ('d3100000-1ed6-4000-a000-000000000006', NULL, v_co_hotel,
     'payment'::account_movement_type, -900000, 'ARS',
     (CURRENT_DATE - INTERVAL '15 days')::date, NULL, 'payment',
     v_inv_hotel, 'Pago parcial Fc. 0039',
     v_demo_user, v_org, v_now - INTERVAL '15 days'),

    -- Benítez
    ('d3100000-1ed6-4000-a000-000000000007', v_p_benitez, NULL,
     'invoice'::account_movement_type, 423500, 'ARS',
     (CURRENT_DATE - INTERVAL '110 days')::date, v_inv_benitez, 'invoice',
     v_inv_benitez, 'Fc. DEMO-0001-0018',
     v_demo_user, v_org, v_now - INTERVAL '110 days'),
    ('d3100000-1ed6-4000-a000-000000000008', v_p_benitez, NULL,
     'payment'::account_movement_type, -423500, 'ARS',
     (CURRENT_DATE - INTERVAL '105 days')::date, NULL, 'payment',
     v_inv_benitez, 'Pago anticipo',
     v_demo_user, v_org, v_now - INTERVAL '105 days')
  ON CONFLICT (id) DO NOTHING;

  -- =============================================================================
  -- 23. Case participations (participación del abogado demo en casos)
  -- =============================================================================
  INSERT INTO public.case_participations (
    id, case_id, lawyer_id, participation_type, percentage,
    base_amount, calculated_amount, status, notes,
    organization_id, created_at, updated_at
  )
  VALUES
    ('d3100000-cab1-4000-a000-000000000001', v_case_despido, v_demo_user,
     'studio_assigned'::participation_type, 30.00, 240000, 72000,
     'pending', NULL, v_org, v_now - INTERVAL '45 days', v_now),
    ('d3100000-cab1-4000-a000-000000000002', v_case_cobro, v_demo_user,
     'lawyer_recruited'::participation_type, 20.00, 800000, 160000,
     'approved', 'Caso originado por referido del abogado.',
     v_org, v_now - INTERVAL '30 days', v_now),
    ('d3100000-cab1-4000-a000-000000000003', v_case_concurso, v_demo_user,
     'studio_assigned'::participation_type, 30.00, 1500000, 450000,
     'paid', NULL, v_org, v_now - INTERVAL '30 days', v_now - INTERVAL '10 days'),
    ('d3100000-cab1-4000-a000-000000000004', v_case_accidente, v_demo_user,
     'studio_assigned'::participation_type, 30.00, 320000, 96000,
     'paid', 'Pagado con acuerdo transaccional.',
     v_org, v_now - INTERVAL '60 days', v_now - INTERVAL '30 days')
  ON CONFLICT (case_id, lawyer_id) DO UPDATE SET
    status = EXCLUDED.status,
    calculated_amount = EXCLUDED.calculated_amount,
    updated_at = v_now;

  -- =============================================================================
  -- 24. Lawyer compensations (mensual, JUS)
  -- =============================================================================
  INSERT INTO public.lawyer_compensations (
    id, lawyer_id, period, base_salary_jus, jus_value_at_period, base_amount_ars,
    participations_total, deductions, total_gross, status, payment_date,
    notes, organization_id, created_at, updated_at
  )
  VALUES
    ('d3100000-c017-4000-a000-000000000001', v_demo_user, '2025-09',
     80.00, 14800.00, 1184000.00,
     96000.00, 0.00, 1280000.00,
     'paid'::compensation_status, (CURRENT_DATE - INTERVAL '25 days')::date,
     NULL, v_org, v_now - INTERVAL '30 days', v_now - INTERVAL '25 days'),
    ('d3100000-c017-4000-a000-000000000002', v_demo_user, '2025-10',
     80.00, 15200.00, 1216000.00,
     450000.00, 0.00, 1666000.00,
     'approved'::compensation_status, NULL,
     'Incluye pago etapa 1 concurso.', v_org, v_now - INTERVAL '3 days', v_now)
  ON CONFLICT (lawyer_id, period, organization_id) DO UPDATE SET
    total_gross = EXCLUDED.total_gross,
    status = EXCLUDED.status,
    updated_at = v_now;

  RAISE NOTICE '✓ Demo seed completo. Usuario: %', v_demo_email;
  RAISE NOTICE '  Organización: Estudio Demo Lexia (id: %)', v_org;
END
$demo_billing$;

COMMIT;

-- =============================================================================
-- Fin de migración 052_demo_seed.sql
-- =============================================================================
-- Cómo resetear la data demo (cuidado: borra TODA la org demo):
--
--   DELETE FROM public.organizations WHERE id = 'd3100000-0000-4000-a000-000000000001';
--   -- ON DELETE CASCADE / RESTRICT puede requerir limpiar tablas dependientes primero.
--
-- Opción segura de "refrescar": volver a ejecutar este script. Los ON CONFLICT
-- actualizan filas existentes sin duplicar.
-- =============================================================================
