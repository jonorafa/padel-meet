-- Migration 006: Insert 18 demo bot players
-- Uses session_replication_role = 'replica' to bypass FK constraint on profiles.id → auth.users(id)

SET session_replication_role = 'replica';

INSERT INTO public.profiles (id, name, level, city, bio_fr, bio_en, play_style, is_demo, created_at, updated_at)
VALUES
  ('b0000001-0000-0000-0000-000000000000', 'Adam Cohen',       3.5, 'Tel Aviv',    'Padel passionné, toujours fair-play.',        'Passionate padel player, always fair.',         'Défensif',   true, NOW(), NOW()),
  ('b0000002-0000-0000-0000-000000000000', 'Daniel Katz',      4.0, 'Jérusalem',   'Aime les matchs tactiques.',                  'Loves tactical matches.',                       'Stratégique', true, NOW(), NOW()),
  ('b0000003-0000-0000-0000-000000000000', 'David Peretz',     2.5, 'Tel Aviv',    'Débutant enthousiaste.',                      'Enthusiastic beginner.',                        'Agressif',   true, NOW(), NOW()),
  ('b0000004-0000-0000-0000-000000000000', 'Eitan Shapiro',    5.0, 'Haïfa',       'Compétiteur dans l''âme.',                    'Competitor at heart.',                          'Offensif',   true, NOW(), NOW()),
  ('b0000005-0000-0000-0000-000000000000', 'Gabriel Amar',     3.0, 'Tel Aviv',    'Régulier et fiable sur le court.',            'Consistent and reliable on court.',             'Défensif',   true, NOW(), NOW()),
  ('b0000006-0000-0000-0000-000000000000', 'Idan Goldman',     4.5, 'Raanana',     'Joueur complet, aime le jeu en équipe.',      'Complete player, loves teamwork.',              'Stratégique', true, NOW(), NOW()),
  ('b0000007-0000-0000-0000-000000000000', 'Jonathan Mizrahi', 3.5, 'Netanya',     'Toujours motivé pour jouer.',                 'Always motivated to play.',                     'Agressif',   true, NOW(), NOW()),
  ('b0000008-0000-0000-0000-000000000000', 'Leo Weiss',        2.0, 'Tel Aviv',    'Nouveau sur les courts, apprend vite.',       'New to the courts, learning fast.',             'Défensif',   true, NOW(), NOW()),
  ('b0000009-0000-0000-0000-000000000000', 'Liam Dadon',       4.0, 'Herzliya',    'Jeu dynamique et rapide.',                    'Dynamic and fast-paced game.',                  'Offensif',   true, NOW(), NOW()),
  ('b000000a-0000-0000-0000-000000000000', 'Michael Berger',   5.5, 'Tel Aviv',    'Niveau avancé, cherche de bons partenaires.', 'Advanced level, looking for strong partners.',  'Stratégique', true, NOW(), NOW()),
  ('b000000b-0000-0000-0000-000000000000', 'Nathan Biton',     3.0, 'Ashdod',      'Joueur polyvalent.',                          'Versatile player.',                             'Offensif',   true, NOW(), NOW()),
  ('b000000c-0000-0000-0000-000000000000', 'Noah Klein',       2.5, 'Tel Aviv',    'Débutant mais très appliqué.',                'Beginner but very dedicated.',                  'Défensif',   true, NOW(), NOW()),
  ('b000000d-0000-0000-0000-000000000000', 'Oliver Haddad',    4.5, 'Ramat Gan',   'Finesse et précision.',                       'Finesse and precision.',                        'Stratégique', true, NOW(), NOW()),
  ('b000000e-0000-0000-0000-000000000000', 'Oscar Rosen',      3.5, 'Tel Aviv',    'Régulier et constant.',                       'Regular and consistent.',                       'Défensif',   true, NOW(), NOW()),
  ('b000000f-0000-0000-0000-000000000000', 'Paul Azoulay',     6.0, 'Jérusalem',   'Élite du padel local.',                       'Local padel elite.',                            'Offensif',   true, NOW(), NOW()),
  ('b0000010-0000-0000-0000-000000000000', 'Rafael Meyer',     4.0, 'Haïfa',       'Joueur solide au fond du court.',             'Solid player at the back of the court.',        'Défensif',   true, NOW(), NOW()),
  ('b0000011-0000-0000-0000-000000000000', 'Sam Abutbul',      3.0, 'Petah Tikva', 'Sociable et bon état d''esprit.',             'Sociable with a great attitude.',               'Agressif',   true, NOW(), NOW()),
  ('b0000012-0000-0000-0000-000000000000', 'Tom Feldman',      4.5, 'Tel Aviv',    'Technique soignée, jeu puissant.',            'Polished technique, powerful game.',            'Offensif',   true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

SET session_replication_role = DEFAULT;
