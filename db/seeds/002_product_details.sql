-- Seeds · 002 · Dades de la fitxa (US-03) per als 15 productes d'exemple i imatges per a 4.
-- Les imatges són fitxers SVG de bloop4-frontend/public/images/products/.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM product_images) THEN
    RAISE EXCEPTION 'Los seeds ya están cargados. Usa ./db/reset.sh para empezar de cero.';
  END IF;
END $$;

UPDATE products p SET
  description    = d.description,
  deposit_amount = d.deposit_amount,
  insurance      = d.insurance,
  specs          = d.specs::jsonb
FROM (VALUES
  ('d0000000-0000-4000-8000-000000000001',
   'Altavoz autoamplificado de dos vías, ideal para bodas, fiestas y presentaciones de hasta 150 personas.',
   150.00, 'Cubre daños accidentales durante el evento. Franquicia de 50 €.',
   '{"Potencia": "1300 W", "Peso": "18 kg", "Medidas": "62 x 38 x 35 cm", "Alimentación": "230 V · 1 enchufe Schuko"}'),
  ('d0000000-0000-4000-8000-000000000002',
   'Subgrave activo para reforzar los graves en fiestas y conciertos al aire libre.',
   200.00, 'Cubre daños accidentales durante el evento. Franquicia de 80 €.',
   '{"Potencia": "1600 W", "Peso": "42 kg", "Medidas": "70 x 52 x 60 cm", "Alimentación": "230 V · 1 enchufe Schuko"}'),
  ('d0000000-0000-4000-8000-000000000003',
   'Mesa digital con 16 entradas, efectos integrados y control desde tableta.',
   250.00, 'Cubre daños accidentales y fallos eléctricos. Franquicia de 100 €.',
   '{"Canales": "16", "Peso": "6 kg", "Medidas": "48 x 38 x 15 cm", "Alimentación": "230 V"}'),
  ('d0000000-0000-4000-8000-000000000004',
   'Micrófono de mano inalámbrico con receptor, para discursos y karaoke.',
   50.00, NULL,
   '{"Alcance": "80 m", "Autonomía": "8 h", "Pilas": "2 x AA (incluidas)"}'),
  ('d0000000-0000-4000-8000-000000000005',
   'Micrófono de diadema inalámbrico para presentadores que necesitan las manos libres.',
   50.00, NULL,
   '{"Alcance": "80 m", "Autonomía": "8 h", "Pilas": "2 x AA (incluidas)"}'),
  ('d0000000-0000-4000-8000-000000000006',
   'Foco PAR LED de colores para iluminar paredes, escenarios y pistas de baile.',
   30.00, NULL,
   '{"Potencia": "180 W", "Peso": "3 kg", "Control": "DMX y modo automático", "Alimentación": "230 V"}'),
  ('d0000000-0000-4000-8000-000000000007',
   'Cabeza móvil con haz concentrado para efectos aéreos en conciertos y discotecas.',
   300.00, 'Cubre daños accidentales durante el evento. Franquicia de 120 €.',
   '{"Lámpara": "230 W", "Peso": "16 kg", "Control": "DMX", "Alimentación": "230 V"}'),
  ('d0000000-0000-4000-8000-000000000008',
   'Máquina de humo con mando a distancia. Incluye un litro de líquido.',
   60.00, NULL,
   '{"Potencia": "1500 W", "Peso": "9 kg", "Depósito": "2,5 l", "Alimentación": "230 V"}'),
  ('d0000000-0000-4000-8000-000000000009',
   'Silla Tiffany de resina blanca, la más pedida para bodas y banquetes.',
   0.00, NULL,
   '{"Material": "Resina", "Peso": "4 kg", "Medidas": "40 x 42 x 92 cm"}'),
  ('d0000000-0000-4000-8000-000000000010',
   'Silla plegable con asiento acolchado, cómoda para conferencias y ceremonias.',
   0.00, NULL,
   '{"Material": "Acero y polipiel", "Peso": "4,5 kg", "Medidas": "45 x 47 x 80 cm"}'),
  ('d0000000-0000-4000-8000-000000000011',
   'Mesa redonda para banquetes de hasta 10 comensales. Mantel no incluido.',
   20.00, NULL,
   '{"Diámetro": "180 cm", "Altura": "74 cm", "Peso": "28 kg"}'),
  ('d0000000-0000-4000-8000-000000000012',
   'Mesa rectangular imperial para presidencias y comidas largas.',
   20.00, NULL,
   '{"Medidas": "240 x 100 cm", "Altura": "74 cm", "Peso": "35 kg"}'),
  ('d0000000-0000-4000-8000-000000000013',
   'Carpa plegable de montaje rápido para mercados, catering y zonas de sombra.',
   100.00, 'Cubre daños por viento y lluvia. Franquicia de 60 €.',
   '{"Medidas": "3 x 3 m", "Altura": "2,5 m", "Peso": "35 kg", "Lonas laterales": "Incluidas"}'),
  ('d0000000-0000-4000-8000-000000000014',
   'Carpa jaima de lona blanca, con mástil central, para bodas y eventos al aire libre.',
   400.00, 'Cubre daños por viento y lluvia. Franquicia de 150 €.',
   '{"Medidas": "5 x 5 m", "Altura": "5 m", "Peso": "120 kg", "Montaje": "Incluido (2 personas)"}'),
  ('d0000000-0000-4000-8000-000000000015',
   'Módulo de tarima para montar escenarios a medida. Altura regulable.',
   80.00, 'Cubre daños accidentales durante el evento. Franquicia de 40 €.',
   '{"Medidas": "2 x 1 m", "Altura": "40-60 cm", "Carga máxima": "750 kg/m²", "Peso": "48 kg"}')
) AS d (id, description, deposit_amount, insurance, specs)
WHERE p.id = d.id::uuid;

INSERT INTO product_images (product_id, path, alt_text, sort_order) VALUES
  ('d0000000-0000-4000-8000-000000000001', '/images/products/altavoz-activo-12.svg',   'Altavoz activo de 12 pulgadas visto de frente', 0),
  ('d0000000-0000-4000-8000-000000000006', '/images/products/foco-par-led.svg',        'Foco PAR LED con luz de colores', 0),
  ('d0000000-0000-4000-8000-000000000009', '/images/products/silla-tiffany.svg',       'Silla Tiffany blanca', 0),
  ('d0000000-0000-4000-8000-000000000014', '/images/products/carpa-jaima.svg',         'Carpa jaima blanca montada en un jardín', 0),
  ('d0000000-0000-4000-8000-000000000014', '/images/products/carpa-jaima-interior.svg','Interior de la carpa jaima con mesas', 1);
