-- Popote : mise à jour « import de recettes »
-- À lancer une seule fois dans Supabase > SQL Editor si ta base a été créée avant cette fonction.
-- Ajoute le lien vers la recette d'origine. Sans risque : ne touche à aucune donnée existante.
alter table public.recipes add column if not exists source text;
