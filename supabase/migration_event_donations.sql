-- Migration : dons amassés par événement (cause soutenue)
-- À exécuter dans le SQL Editor de Supabase AVANT de déployer le code.
-- donation_org    : organisme / cause bénéficiaire (affiché avant l'événement « Au profit de ... »
--                   et après, dans le souvenir « X $ remis à ... »).
-- donation_amount : montant amassé, saisi après l'événement dans le planificateur ;
--                   mis en vedette sur la page publique Événements (cartes souvenir,
--                   page souvenir, et bandeau total de l'onglet « Passés »).

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS donation_org TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS donation_amount NUMERIC(12,2);

COMMENT ON COLUMN events.donation_org IS 'Organisme ou cause bénéficiaire des profits de l''événement (affiché sur le site public).';
COMMENT ON COLUMN events.donation_amount IS 'Montant des dons amassés, saisi après l''événement (mis en vedette dans la section Événements passés du site public).';
