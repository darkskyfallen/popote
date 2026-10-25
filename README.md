# Popote

Application de recettes, de planning des repas et de liste de courses, partagée entre les membres d'un foyer.
C'est une PWA : elle s'installe sur Android, iPhone et PC depuis le navigateur, fonctionne hors ligne et se synchronise en temps réel via Supabase.

**Fonctions** : recettes avec portions ajustables, planning midi/soir par semaine, liste de courses générée et fusionnée par rayon, articles ajoutés à la main, rééquilibrage alimentaire (objectif calorique, profils d'équilibre, macros, astuces), détection des apports de chaque ingrédient, foyer partagé avec code d'invitation.

---

## 1. Tester sur ton PC (5 minutes)

Il te faut [Node.js](https://nodejs.org) version 20.19 ou plus récente.

```bash
npm install
npm run dev
```

Ouvre l'adresse affichée (http://localhost:5173). Sans configuration Supabase, Popote démarre en **mode local** : tout fonctionne, mais les données restent dans ce navigateur. Pratique pour essayer.

---

## 2. Créer la base de données Supabase (10 minutes)

1. Crée un compte gratuit sur [supabase.com](https://supabase.com) et un **nouveau projet** (région Europe, par exemple Paris ou Francfort). Note le mot de passe de base de données quelque part, tu n'en auras pas besoin ensuite.
2. Dans le menu de gauche, ouvre **SQL Editor** → **New query**, colle tout le contenu du fichier `supabase/schema.sql`, puis clique **Run**. Tu dois voir « Success ».
3. Ouvre **Authentication** → **Sign In / Providers** → **Email** :
   - **Confirm email** : désactive-le si tu veux pouvoir te connecter tout de suite après la création du compte (le plus simple pour un usage à deux). Si tu le laisses activé, fais bien l'étape 4.3 plus bas.
4. Ouvre **Project Settings** → **API Keys** (ou **Data API**) et récupère :
   - l'**URL du projet** (`https://xxxx.supabase.co`)
   - la **clé publishable** (`sb_publishable_…`), ou à défaut la clé **anon**.

   Ces deux valeurs peuvent être publiques : la sécurité est assurée par les règles de la base (chacun ne voit que son foyer). Ne partage jamais la clé **secret** ni la clé **service_role**.

Pour tester avec Supabase sur ton PC : copie `.env.example` en `.env.local`, remplis les deux valeurs, puis relance `npm run dev`.

---

## 3. Mettre en ligne sur GitHub Pages (10 minutes)

1. Sur GitHub, crée un **nouveau dépôt** (par exemple `popote`). Il peut être public ou privé selon ton offre GitHub (Pages sur un dépôt privé demande GitHub Pro).
2. Envoie le projet :
   ```bash
   git init
   git add .
   git commit -m "Popote"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/popote.git
   git push -u origin main
   ```
3. Dans le dépôt : **Settings** → **Pages** → **Source** : choisis **GitHub Actions**.
4. **Settings** → **Secrets and variables** → **Actions** → onglet **Variables** → **New repository variable**, ajoute :
   - `VITE_SUPABASE_URL` = l'URL du projet
   - `VITE_SUPABASE_KEY` = la clé publishable
5. Onglet **Actions** → **Déployer sur GitHub Pages** → **Run workflow** (ou pousse un nouveau commit). Après une minute environ, l'appli est en ligne sur :
   `https://TON-PSEUDO.github.io/popote/`

Ensuite, chaque `git push` sur `main` remet l'appli à jour automatiquement, et les téléphones reçoivent la nouvelle version à la prochaine ouverture.

### Dernier réglage dans Supabase

**Authentication** → **URL Configuration** :
- **Site URL** : `https://TON-PSEUDO.github.io/popote/`
- **Redirect URLs** : ajoute la même adresse, plus `http://localhost:5173` pour tes tests.

Sans ça, le lien de confirmation par email (si tu l'as gardé activé) renverrait vers une mauvaise adresse.

---

## 4. Installer et partager

**Sur Android (Chrome)** : ouvre l'adresse du site → menu ⋮ → **Installer l'application**. Le bouton « Installer » apparaît aussi dans Popote, sous l'icône de compte.

**Sur iPhone (Safari obligatoirement)** : ouvre l'adresse → bouton **Partager** → **Sur l'écran d'accueil**.

**Partager avec ton proche** :
1. Crée ton compte dans Popote, puis **Créer un foyer** (coche « Ajouter les recettes d'exemple » si tu veux partir avec les 8 recettes).
2. Touche l'icône de compte en haut à droite : ton **code d'invitation** (6 caractères) s'affiche.
3. Ton proche installe l'appli, crée son compte, choisit **Rejoindre un foyer** et saisit le code.

Recettes, planning, liste de courses et cases cochées sont partagés en temps réel. Les réglages de rééquilibrage restent personnels à chacun.

---

## 5. Plus tard : la version APK

La PWA est prête à être emballée en APK Android avec [PWABuilder](https://www.pwabuilder.com) (gratuit) : tu colles l'adresse du site, tu choisis **Android**, et tu récupères un APK à installer directement (ou un fichier pour le Play Store, 25 $ une seule fois).

Un point à prévoir : pour que l'APK s'ouvre **sans barre d'adresse**, Android vérifie un fichier `/.well-known/assetlinks.json` à la **racine du domaine**. Sur `TON-PSEUDO.github.io/popote/`, la racine n'est pas à toi, donc la barre d'adresse resterait visible. Trois solutions, au choix le moment venu :
- renommer le dépôt en `TON-PSEUDO.github.io` (l'appli est alors à la racine) et créer la variable `BASE_PATH` = `/` ;
- utiliser un nom de domaine perso (quelques euros par an) ;
- déployer sur Netlify ou Vercel, qui donnent une adresse dédiée gratuite.

PWABuilder génère le fichier `assetlinks.json` : il suffira de le placer dans `public/.well-known/`.

---

## Structure

```
index.html              page d'accueil de l'appli
vite.config.js          configuration du build et de la PWA (manifest, cache hors-ligne)
public/                 icônes
src/main.js             interface (écrans, feuilles, événements)
src/store.js            données : mode local, Supabase, file d'attente hors-ligne, temps réel
src/logic.js            calculs : quantités, liste de courses, nutrition, dates
src/data.js             rayons, unités, profils d'équilibre, recettes d'exemple
src/style.css           styles (thème clair et sombre)
supabase/schema.sql     tables, sécurité et temps réel à créer dans Supabase
.github/workflows/      déploiement automatique sur GitHub Pages
```

## Dépannage

- **La page affiche « Local » alors que Supabase est configuré** : les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_KEY` manquent ou sont mal nommées dans GitHub. Corrige-les puis relance le workflow.
- **« Email ou mot de passe incorrect » juste après l'inscription** : la confirmation par email est active. Ouvre le lien reçu, ou désactive **Confirm email** (étape 2.3).
- **Page blanche sur GitHub Pages** : vérifie que **Settings → Pages → Source** est bien sur **GitHub Actions**.
- **Mot de passe oublié** : sur l'écran de connexion, saisis ton email puis touche « Mot de passe oublié ? ». Le lien reçu ouvre Popote pour choisir un nouveau mot de passe (l'étape « Site URL » de la section 3 doit être faite).
- **Les changements de l'autre n'apparaissent pas** : vérifie que le script SQL est passé en entier (dernier bloc « Temps réel »). L'appli se resynchronise aussi à chaque retour au premier plan.
