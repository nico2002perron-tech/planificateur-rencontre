-- Migration : date limite de commande des chandails personnalisés
-- À exécuter dans le SQL Editor de Supabase.
-- Permet d'afficher un décompte « jours restants avant la commande de chandails »
-- dans le tableau de bord des événements (les équipes doivent confirmer avant cette date).
-- Note : la colonne « end_date » (plage de dates du ... au ...) existe déjà dans le schéma.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS shirt_order_deadline DATE;

COMMENT ON COLUMN events.shirt_order_deadline IS 'Date limite pour confirmer les équipes avant la commande des chandails personnalisés (alimente le décompte côté admin).';
