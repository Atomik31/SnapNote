# Journal de bord — SnapNote

> Notes prises au fil de la construction. Matière première du guide de la démo pour les élèves.
> Règle : chaque étape documente **ce qu'on fait, pourquoi, les commandes, et les pièges**.

---

## Contexte et choix de l'application

**Objectif pédagogique :** voir de bout en bout la conception d'une app, du PRD au déploiement, en assemblant :
React · authentification · base de données · API/IA · automatisation n8n · backend · CI/CD · Harness IA.

**Comment on a choisi l'idée (à raconter aux élèves, c'est une vraie démarche produit) :**
- Idées écartées : app de feedback (pas assez marquante), météo (aucun lien avec le besoin : *une API doit servir le produit, pas décorer*), FrigoMalin (le code-barres ne donne **pas** la date de péremption, et la saisie par produit est trop lourde pour l'utilisateur).
- Critères retenus : l'utilisateur saisit presque rien · chaque brique technique a une vraie raison d'exister · problème réel et connu de tous.
- **Idée retenue : SnapNote** — photographier un ticket ou une facture, lire les informations automatiquement, l'envoyer au comptable.
- Leçon produit : *on remplace une contrainte utilisateur par de l'automatisation, et on vérifie qu'un cas d'usage tient avant de coder.*

**Deux versions de l'app (le contraste fait la démo) :**

| | Starter (élèves) | Final |
|---|---|---|
| Photo | oui | oui |
| Champs | saisie manuelle | lecture automatique par IA |
| Accès | libre | login par employé |
| Données | perdues au rechargement | Supabase, traçabilité par employé |
| Comptable | rien | email automatique via n8n |
| Qualité | rien | CI + CD |

Dossiers : `snapnote-starter` (starter d'origine) · `snapnote-final` (celui qu'on enrichit).

---

## Étape 0 — PRD et Harness

**Fait**
- [prd.md](prd.md) : vision, utilisateurs, user stories avec critères d'acceptation, modèle de données, architecture, plan.
- [CLAUDE.md](CLAUDE.md) : stack, commandes, règles absolues, conventions.
- [.claude/settings.json](.claude/settings.json) : permissions (autoriser les commandes courantes, demander confirmation pour `git push` / `git commit` / `npm install`, interdire l'accès à `.env` et les commandes destructrices).

**Pourquoi**
- Le PRD est le contrat : l'IA code à partir de lui, pas de ses suppositions.
- Le Harness = le cadre de l'IA (outils, permissions, règles). Principe du **moindre privilège** : l'IA a ce dont elle a besoin, rien de plus.

---

## Étape 1 — Starter fonctionnel

**Fait** : application React + Vite avec prise de photo (`<input type="file" capture="environment">`), saisie manuelle (enseigne, date, catégorie, HT, TTC), TVA calculée (TTC − HT), liste avec total du mois. Tout est en état local.

**Notes**
- Logique de calcul isolée dans `src/lib/amounts.js` (fonctions pures) : facile à tester en CI.
- La caméra exige le **HTTPS** : OK en `localhost`, et sur Vercel. Sur iPhone : ouvrir dans Safari, pas dans un navigateur intégré (Instagram, Notes…).

---

## Étape 2 — Authentification Supabase

**Demande :** page de login pour les employés, **sans création de compte** depuis la page.

### Changement de structure
Le projet est remonté à la **racine** du dossier (plus de sous-dossier `starter/`), pour que `package.json`, `.env`, `CLAUDE.md` et `.claude/` soient au même niveau. Piège rencontré : `npm install` lancé à la racine échouait (`package.json` introuvable) tant que le projet était dans `starter/`.

### Variables d'environnement
- Le `.env` contient l'URL du projet Supabase et la clé **publishable** (l'ancienne clé « anon »).
- **Piège : le préfixe `VITE_`.** Vite n'envoie au navigateur que les variables qui commencent par `VITE_`. Il faut donc :
  ```
  VITE_SUPABASE_URL=...
  VITE_SUPABASE_PUBLISHABLE_KEY=...
  ```
  Après toute modification du `.env`, **relancer** `npm run dev`.
- La clé publishable est faite pour être publique : c'est la **RLS** (étape 3) qui protège les données. Ne jamais utiliser la clé `service_role` dans le front.
- Le `.env` est dans `.gitignore` ; on documente les variables dans `.env.example`.

### Code ajouté
| Fichier | Rôle |
|---|---|
| `src/lib/supabase.js` | Crée le client Supabase depuis les variables `VITE_*` |
| `src/lib/useSession.js` | Hook qui suit la session (`getSession` + `onAuthStateChange`) |
| `src/lib/authErrors.js` | Traduit les erreurs Supabase en messages français (fonction pure, testable) |
| `src/components/Login.jsx` | Formulaire email + mot de passe, `signInWithPassword`, **aucun lien d'inscription** |
| `src/App.jsx` | Aiguillage : config manquante → message · chargement · pas de session → Login · session → app |

Dépendance ajoutée : `@supabase/supabase-js` (seule bibliothèque nécessaire ; pas de routeur, l'app bascule selon la session pour rester simple).

### À faire dans le dashboard Supabase (manuel)
1. **Ajouter un utilisateur** (obligatoire, sinon personne ne peut se connecter) : Authentication → Users → *Add user* → *Create new user* → email + mot de passe, et cocher **Auto Confirm User**. C'est l'administrateur qui crée les comptes des employés : c'est le rôle de cette étape.
2. **Désactiver l'inscription publique** : Authentication → Sign In / Providers → décocher **Allow new users to sign up**.
   *Pourquoi :* masquer le bouton ne suffit pas, l'API Supabase reste appelable par n'importe qui. La vraie sécurité est côté serveur.
3. **Confirm email, si besoin** : Authentication → Sign In / Providers → Email → option **Confirm email**.
   - Si elle est activée et qu'un utilisateur n'a pas été confirmé, la connexion échoue avec « Email not confirmed » (l'app affiche : « Ton compte n'est pas encore activé »).
   - Deux solutions : cocher *Auto Confirm User* à la création du compte (recommandé pour la démo), ou désactiver *Confirm email*.
   - En production avec une vraie boîte mail d'entreprise, on peut la laisser activée.

### Vérifications
- `npm run build` : OK.
- Test à faire à la main : mauvais mot de passe → message clair · bon identifiant → l'app s'affiche avec l'email et le bouton de déconnexion · rechargement de la page → toujours connecté.

### Points pédagogiques
- Authentification (qui es-tu ?) ≠ autorisation (qu'as-tu le droit de voir ?) : la seconde arrive à l'étape 3 avec la RLS.
- Sécurité côté interface vs côté serveur.
- Variables publiques vs secrètes.

---

## Étape 4 — IA de lecture des tickets (backend)

> Remarque : on a fait l'étape 4 avant l'étape 3 (base de données). Les deux sont indépendantes. Les notes restent donc en état local pour l'instant ; l'étape 3 les enregistrera dans Supabase.

**Demande :** un modèle d'IA lit le ticket et remplit automatiquement les champs du formulaire.

### Les variables d'environnement
La clé et l'URL de l'API IA sont fournies par Jedha (app.jedha.co) et ajoutées dans le `.env` :
```
JEDHA_AI_API_KEY=...        # SECRÈTE
JEDHA_AI_BASE_URL=...       # URL de l'API (format compatible OpenAI)
JEDHA_AI_MODEL=...          # optionnel, défaut : openai/gpt-4.1-mini
```
**Pas de préfixe `VITE_`** : ces variables ne doivent jamais arriver dans le navigateur.

### Architecture : pourquoi un backend ?
```
Navigateur ──(photo + jeton de session)──▶ /api/extract ──(clé secrète)──▶ API IA
   ◀───────── champs lus + avertissements ◀──────────────┘
```
- Si le navigateur appelait l'IA directement, la clé serait visible dans l'onglet Réseau : n'importe qui pourrait la voler et la consommer.
- Le backend est la **seule** partie qui connaît la clé. C'est la démonstration concrète de l'utilité d'un backend.

### Choix du modèle (à raconter : on a testé)
On a listé les modèles disponibles (`GET /v1/models`) puis testé deux modèles économiques sur des tickets fictifs :

| Modèle | Résultat | Tokens consommés |
|---|---|---|
| `openai/gpt-4o-mini` | correct | ~14 000 |
| `openai/gpt-4.1-mini` | correct | ~500 |

Même qualité, **près de 30 fois moins de tokens** : on retient `gpt-4.1-mini`. Leçon : *tester plusieurs modèles avant de choisir, le coût peut varier énormément pour le même résultat.*

### Code ajouté
| Fichier | Rôle |
|---|---|
| `api/extract.js` | Fonction serverless : vérifie la session, valide l'image, appelle l'IA |
| `api/_lib/auth.js` | Vérifie le jeton de session auprès de Supabase (`/auth/v1/user`) |
| `api/_lib/extract.js` | Prompt système + appel au modèle de vision |
| `api/_lib/sanitize.js` | Nettoie et valide la réponse de l'IA (fonctions pures, testables) |
| `src/lib/image.js` | Réduit la photo (1600 px max, JPEG) avant l'envoi |
| `src/lib/receiptApi.js` | Appelle `/api/extract` avec le jeton de session |
| `src/components/ReceiptForm.jsx` | Lance la lecture dès la photo et pré-remplit les champs |
| `vite.config.js` | Plugin `devApi` : fait tourner `api/` avec `npm run dev` |
| `public/samples/` | Deux tickets **fictifs** pour la démo |

Le dossier `api/` est reconnu automatiquement par Vercel : chaque fichier devient une route. Le sous-dossier `_lib` (préfixe `_`) n'est **pas** exposé comme route.

### Les principes à faire retenir
1. **Ne jamais faire confiance à l'IA** : sa réponse est lue (`parseModelJson`), validée champ par champ (date réelle, montants positifs, catégorie dans la liste) et contrôlée (HT + TVA = TTC ?). Les incohérences sont **signalées** à l'employé, pas corrigées en silence.
2. **L'humain garde la main** : les champs sont pré-remplis, jamais verrouillés, avec un message « vérifie avant d'enregistrer ».
3. **Dégradation douce** : si l'IA échoue, l'app reste utilisable en saisie manuelle.
4. **Un prompt = un cahier des charges** : on impose le format JSON, `null` si illisible, « n'invente rien ».
5. **Le backend authentifie aussi** : sans session valide, `/api/extract` répond 401. Sinon la clé IA serait consommable par n'importe qui.
6. **Réduire l'image** avant l'envoi : moins de données, plus rapide, moins cher. Vercel limite d'ailleurs le corps d'une requête à ~4,5 Mo.

### Vérifications faites
- `npm run build` : OK.
- Extraction réelle sur les deux tickets fictifs : enseigne, date, HT, TVA, TTC et catégorie corrects, aucun avertissement.
- Backend (serveur de dev) : `GET` → 405 · sans jeton → 401 · faux jeton → 401 · JSON invalide → 400.
- **À tester à la main** : se connecter, choisir `public/samples/ticket-restaurant.png`, vérifier le pré-remplissage ; puis essayer un faux ticket (une photo quelconque) pour voir les avertissements.

### Pièges
- Après avoir ajouté des variables dans le `.env`, **redémarrer** `npm run dev`.
- Les noms de modèles de cette API sont préfixés (`openai/gpt-4.1-mini`).
- Sur Vercel (étape 7), il faudra recréer ces variables dans *Settings → Environment Variables* : le `.env` n'est jamais déployé.
- Pas de limitation du nombre d'appels par utilisateur pour l'instant : en production, on ajouterait un quota.

---

## Étape 3 — Base de données et stockage des photos (traçabilité)

**Demande :** enregistrer chaque note et sa photo, en gardant la trace de l'employé qui l'a scannée.

### À faire dans Supabase (manuel, une seule fois)
1. Ouvrir **SQL Editor → New query**.
2. Coller le contenu de [supabase/001_receipts.sql](supabase/001_receipts.sql), puis **Run**.
3. Vérifier : *Table Editor* → table `receipts` · *Storage* → bucket `receipts` (privé).

> Piège rencontré : l'outil MCP de Claude n'avait pas accès au projet Supabase de l'app (un autre projet était visible). On n'applique **jamais** une migration sur un projet qui n'est pas celui de l'app. D'où le script SQL à exécuter à la main, ce qui est aussi la méthode la plus simple pour les élèves.

### Ce que fait le script
| Élément | Rôle |
|---|---|
| Table `receipts` | Une ligne = une note : enseigne, date, HT, TVA, TTC, catégorie, chemin de la photo, source (`manual` / `ai`), statut (`draft` / `sent`) |
| `user_id` + `user_email` | **Qui** a scanné · `created_at` : **quand** |
| Trigger `receipts_enforce_trace` | La base **impose** auteur, email, date et statut à l'insertion, et les verrouille à la modification. Le navigateur ne peut pas les falsifier. |
| RLS (4 policies) | Un employé ne lit, n'ajoute, ne modifie, ne supprime que **ses** notes. Une note `sent` ne se modifie ni ne se supprime plus. |
| Bucket `receipts` | **Privé**, 5 Mo max, JPEG/PNG/WebP uniquement |
| Policies Storage | Chemin `<id employé>/<id note>.jpg` : chacun n'accède qu'à son dossier |

### Code ajouté ou modifié
| Fichier | Rôle |
|---|---|
| `src/lib/receipts.js` | Couche d'accès aux données : `listReceipts`, `createReceipt`, `deleteReceipt` (les composants n'appellent jamais Supabase directement) |
| `src/lib/image.js` | `resizeImage` renvoie maintenant un Blob : la **même** image réduite sert à l'IA et au stockage |
| `src/App.jsx` | Charge les notes au démarrage, ajoute et supprime via Supabase |
| `ReceiptForm.jsx` | Envoie la note + la photo, affiche « Enregistrement… » et une erreur sans perdre la saisie |
| `ReceiptList.jsx` | Affiche « Scanné par … le … », le tag « envoyée », et cache la suppression des notes envoyées |

### Les principes à faire retenir
1. **La RLS, c'est la vraie sécurité.** La clé publishable est visible de tous : sans RLS, n'importe qui lirait toutes les notes. Avec la RLS, la base filtre elle-même.
2. **Ne pas faire confiance au navigateur pour la traçabilité.** Le client n'envoie jamais `user_id` ni `user_email` : la base les remplit (`auth.uid()` + trigger). Sinon un employé pourrait signer à la place d'un autre.
3. **Bucket privé + URLs signées** : on n'expose jamais un justificatif par une URL publique ; on génère un lien temporaire (1 h) pour l'afficher.
4. **Convention de chemin = règle de sécurité** : `<id employé>/…` permet à la policy Storage de vérifier le propriétaire.
5. **Cohérence photo/ligne** : on envoie la photo, puis la ligne ; si la ligne échoue, on supprime la photo orpheline.
6. **La RLS bloque en silence** : un `DELETE` refusé ne renvoie pas d'erreur, il supprime 0 ligne. Le code le vérifie (`.select('id')`) avant d'effacer la photo.
7. **Règle métier dans la base** : une note envoyée au comptable devient intouchable.

### Vérifications à faire à la main (après avoir exécuté le SQL)
- Se connecter, ajouter `public/samples/ticket-restaurant.png` : la note apparaît avec « lu par l'IA », la miniature, et « Scanné par <email> · <date> ».
- Recharger la page : la note est toujours là.
- Table Editor : la ligne contient bien `user_id` et `user_email` ; Storage : la photo est dans le dossier de l'employé.
- Créer un **second employé** (Authentication → Users) et se connecter avec : il ne voit **pas** les notes du premier. C'est la démonstration de la RLS.
- Supprimer une note : la ligne et la photo disparaissent.
- Dans Table Editor, passer une note à `status = 'sent'` : elle n'a plus de bouton de suppression, et un `DELETE` direct est refusé.

---

## Étape 5 — n8n : envoi automatique au comptable

**Demande :** quand une note est enregistrée, un workflow n8n la récupère, prépare un récapitulatif et l'envoie par email, avec la photo en pièce jointe.

### Décision de conception (à raconter)
Au départ, on avait prévu un bouton « Envoyer au comptable » qui passe par le backend. La demande est devenue **« dès qu'une note est enregistrée »**. On a donc retenu un **webhook de base de données Supabase** : l'app n'a plus rien à faire, c'est la base qui prévient n8n à chaque `INSERT`.
Conséquence produit à assumer : l'envoi est immédiat, donc **une note ne peut plus être supprimée ni corrigée après coup** (statut `sent`). La relecture se fait avant l'enregistrement, c'est pourquoi l'IA pré-remplit sans enregistrer toute seule.

### Le workflow « SnapNote - Note de frais vers comptable » (9 nœuds)
```
Webhook (POST, secret en en-tête)
  → Configuration (email du comptable, expéditeur, URL Supabase)
  → Préparer la note (Code : mise en forme + échappement HTML)
  → Photo disponible ?
       oui → Télécharger la photo (Storage) → Envoyer (avec photo) ┐
       non →                                  Envoyer (sans photo) ┤
                                                                   └→ Marquer la note « envoyée »
```
| Nœud | Pourquoi |
|---|---|
| Webhook | Reçoit l'évènement Supabase. Refuse tout appel sans le bon secret. Ne s'exécute que pour `type = INSERT`. |
| Configuration | Regroupe les valeurs à modifier au même endroit (comptable, expéditeur, URL). |
| Préparer la note | Formate montants (`30,00 €`), dates (`12/11/2026`), heure de Paris, et **échappe le HTML** (une enseigne lue par l'IA ne doit pas pouvoir injecter de balises dans l'email). |
| Télécharger la photo | Lit le fichier dans le bucket **privé** avec la clé service_role. |
| Envoyer au comptable | Email HTML via SMTP, photo en pièce jointe. |
| Marquer la note « envoyée » | `PATCH` sur la ligne : `status = sent`, `sent_at = maintenant`. Placé **après** l'email : si l'envoi échoue, la note reste `draft`. |

### À configurer une seule fois
1. **Dans n8n** (le workflow est créé mais **inactif**) :
   - **Webhook** : créer un identifiant *Header Auth*. Nom : `x-snapnote-secret`, valeur : un secret long et aléatoire. ⚠️ À la création, n8n a rattaché par erreur un identifiant existant (un jeton WhatsApp) : **le remplacer** par ce nouvel identifiant.
   - **Télécharger la photo** et **Marquer la note** : créer l'identifiant *Custom Auth* « Supabase SnapNote (service role) » avec la clé `service_role` (Supabase → Project Settings → API) dans les en-têtes `apikey` et `Authorization: Bearer …`.
   - **Envoyer au comptable** (×2) : vérifier l'identifiant SMTP (expéditeur autorisé par le fournisseur).
   - **Configuration** : remplacer `comptable@example.com` et `snapnote@example.com`.
   - **Publier** le workflow.
2. **Dans Supabase** : *Database → Webhooks → Create a new hook*
   - Table : `receipts` · Évènement : **Insert** · Type : HTTP Request · Méthode : **POST**
   - URL : l'URL **de production** du webhook n8n (`…/webhook/snapnote-receipt`, pas `webhook-test`)
   - En-tête HTTP : `x-snapnote-secret` = le même secret que dans n8n.

### Les principes à faire retenir
1. **Événement plutôt que bouton** : la base prévient n8n, l'app n'a pas à s'en occuper. Moins de code, moins de pannes possibles côté utilisateur.
2. **Deux clés, deux rôles** : la clé *publishable* (front, bridée par la RLS) et la clé *service_role* (n8n, contourne la RLS). La seconde ne vit **que** dans n8n.
3. **Le service_role contourne la RLS, donc le trigger aussi** : c'est pour cela que le trigger de l'étape 3 ne force les colonnes que lorsqu'un utilisateur est connecté, ce qui permet à n8n de passer la note en `sent`.
4. **Secret partagé** entre Supabase et n8n pour que n'importe qui ne puisse pas déclencher l'envoi d'emails.
5. **Ordre des étapes = garantie** : le statut `sent` n'est écrit qu'après un envoi réussi.
6. **Réutiliser un identifiant par commodité est dangereux** : n8n a rattaché automatiquement un identifiant existant à un autre usage. Toujours vérifier les credentials d'un workflow généré.

### Vérifications à faire à la main
- Exécuter le workflow en test avec les données d'exemple (épingler la sortie du webhook) : l'email doit contenir le tableau et la photo.
- Enregistrer une vraie note dans l'app : l'email arrive chez le comptable en quelques secondes.
- Table Editor : la note est passée à `sent` avec `sent_at` renseigné.
- Recharger l'app : le tag « envoyée » apparaît et le bouton de suppression a disparu.
- Appeler le webhook **sans** l'en-tête secret : refus (403).
- Couper le SMTP puis enregistrer une note : elle reste `draft`.

### Penser à Vercel (déploiement final, étape 7)
- **Le webhook n8n ne dépend pas de Vercel** : c'est Supabase qui l'appelle, depuis la base. L'app n'appelle jamais n8n, donc **aucune variable n8n à créer dans Vercel**. Il faut juste un workflow **publié** et l'URL de **production** dans Supabase.
- Ce qui dépend de Vercel, c'est le backend `api/extract.js`. Variables à créer dans *Vercel → Settings → Environment Variables* (le `.env` n'est jamais déployé) :
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `JEDHA_AI_API_KEY`, `JEDHA_AI_BASE_URL` (et `JEDHA_AI_MODEL` si besoin).
- Les variables `VITE_*` sont lues **au build** : après les avoir modifiées, il faut **redéployer**.
- Le backend lit `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` pour vérifier la session : pas besoin de doublons côté serveur.
- `vercel.json` porte la durée maximale de `/api/extract` à 30 s (l'appel à l'IA prend quelques secondes ; par défaut Vercel coupe plus tôt sur le plan gratuit).
- Supabase → Authentication → URL Configuration : renseigner l'URL Vercel comme *Site URL* (bonne pratique, indispensable si on ajoute un jour la réinitialisation de mot de passe).
- La caméra de l'iPhone exige le HTTPS : Vercel le fournit, c'est le moment de tester le scan sur téléphone.
- **Sécurité du secret** : il n'existe que dans Supabase et n8n. Le déploiement sur Vercel n'ajoute donc aucun endroit où il pourrait fuiter.

### Résultat du test réel (à montrer aux élèves)
| Essai | Résultat |
|---|---|
| 1er essai | Exécution **en erreur** au nœud d'envoi : `553 5.7.1 Sender address rejected: not owned by user …`. La note est **restée `draft`** : preuve que le statut `sent` n'est écrit qu'après un envoi réussi. |
| Après correction de l'expéditeur | Exécution **réussie** en moins d'une seconde : email envoyé, note passée à `sent` avec `sent_at` renseigné. |

Comment on a diagnostiqué : Supabase → table `net._http_response` (réponse reçue de n8n : 200), puis n8n → **Executions** → ouvrir l'exécution → le nœud en rouge donne le message exact.

### Pièges rencontrés
- **Expéditeur SMTP** : le champ *From* doit être une adresse **que le compte SMTP a le droit d'utiliser**. Mettre une adresse Gmail comme expéditeur sur un serveur SMTP d'entreprise est refusé (anti-usurpation). Le destinataire (le comptable) peut être n'importe quelle adresse, pas l'expéditeur.
- **Nouvelles clés Supabase** : avec une clé `sb_secret_…` (et non l'ancienne `service_role` en `eyJ…`), le template n8n ne contient que l'en-tête `apikey` : `{"headers":{"apikey":"{{api_key}}"}}`. Elle fonctionne pour le Storage comme pour l'API REST.
- **L'en-tête du webhook Supabase peut ne pas être enregistré** si on valide le formulaire sans avoir ajouté la ligne : on le vérifie dans la base (`pg_trigger`), pas dans la liste des webhooks qui n'affiche pas les en-têtes.
- **Un workflow généré peut hériter d'identifiants existants** (ici un jeton WhatsApp rattaché au webhook) : toujours contrôler les credentials.
- Un webhook créé **avant** la publication du workflow, ou une note créée **avant** le webhook, ne déclenche rien : seule une nouvelle insertion le fait.
- L'URL de test (`/webhook-test/`) ne marche que pendant l'écoute dans l'éditeur ; Supabase doit viser l'URL de **production**, avec le workflow publié.
- Un webhook Supabase a un délai court : le workflow répond immédiatement (« onReceived ») et travaille ensuite.
- Juste après l'enregistrement, l'app affiche encore la note en brouillon : le statut `sent` apparaît au rechargement.

---

## Design de l'application

**Demande :** une interface soignée, pro, qui ne ressemble pas à ce qu'une IA produit par défaut, avec une image parlante en fond de la page de connexion.

### Démarche (à raconter : c'est un vrai processus de design)
On a exploré **quatre directions** avant de choisir, chacune en maquette HTML ouverte dans le navigateur (dossier `design/`) :

| Version | Idée | Verdict |
|---|---|---|
| V1 · Indigo | SaaS classique, dégradé bleu-violet | Trop « généré par IA » (dégradé, émojis, étincelles, pastilles partout) |
| V2 · Papier | Carnet comptable, serif, vert encre | Belle, mais trop éloignée d'une app mobile |
| V3 · Produit | Conventions des outils de notes de frais (vue scindée, onglets par statut) | Sobre, mais pas assez de caractère |
| **V4 · Sombre** | **Inspirée d'une capture d'application bancaire fournie comme référence** | **Retenue** |
| V5 · Rouge | Noir et rouge vif, textures de barres verticales, tuiles en mosaïque, navigation blanche flottante (référence : application de portefeuille) | Alternative explorée |
| V6 · Menthe | Thème clair pastel, cartes blanches très arrondies, case « Envoyer au comptable » (référence : application d'assurance santé) | Alternative explorée |
| V7 · Braise | Dégradé bordeaux vers orange, verre dépoli, courbe avec infobulle, bulles de répartition (référence : application bancaire) | Alternative explorée |

Leçons :
- **Une capture de référence vaut mille adjectifs.** C'est elle qui a débloqué la direction : fond noir, halo orange, chiffre géant, tuiles teintées par statut.
- **Maquetter avant de coder.** Changer de couleur dans une page HTML coûte une minute ; dans une app, des heures.
- **Ce qui rend un design « généré par IA »** : dégradé indigo-violet, émojis, icônes d'étincelles, trois cartes d'indicateurs identiques, halos lumineux, pastilles arrondies partout. Le design.md interdit ces réflexes.

### Ce qui a été mis en place
- Tout le style passe par des **variables CSS** (`src/styles.css`). Changer l'orange de la marque = modifier une ligne.
- **Police Geist hébergée dans le projet** (`public/fonts/`) plutôt que chargée depuis Google : aucune requête externe, aucun problème hors ligne ou de confidentialité. Récupérée une fois depuis Google Fonts.
- **Icônes SVG intégrées** (`Icons.jsx`) : aucune bibliothèque installée.
- **Composants** : `Topbar`, `Hero` (total du mois), `ReceiptList` (tuiles teintées selon le statut), `ReceiptForm` (viseur photo + champs), `Login`.
- **Mobile d'abord** : sur téléphone, le panneau « Nouvelle note » devient une feuille qui remonte du bas dès qu'on prend une photo.
- **`design.md`** : le document de référence du design, pour les élèves **et pour l'IA** (section « Règles pour l'IA »). Référencé dans `CLAUDE.md`.

### L'image de la page de connexion
- Générée avec un modèle d'image (ElevenLabs, Seedream 5 Pro) à partir d'un prompt décrit dans `design.md` : coût d'environ **0,30 $ pour 2 variantes**, on en garde une.
- On a **chiffré avant de générer** (le service permet d'estimer le coût) et limité le nombre de variantes.
- Optimisée à 1920 px de large, 270 Ko. Un dégradé CSS la surmonte pour garder le texte lisible.
- Règle : pas de visage, pas de logo, pas de texte lisible dans l'image (droits et confidentialité).

### Pièges rencontrés
- **Aperçu photo qui disparaît** : une URL locale créée avec `URL.createObjectURL` est libérée quand le composant la remplace. Si la note enregistrée garde cette URL, la miniature devient cassée. Dans le starter on ne la libère pas ; dans l'app finale la photo vient de Supabase (URL signée).
- **Feuille mobile fermée toujours accessible au clavier** : une feuille masquée seulement par `transform` reste « tabulable ». On ajoute `visibility: hidden` quand elle est fermée.
- **Tester le mobile** : un navigateur sans fenêtre impose une largeur minimale (~500 px) ; on le contourne en testant à 500 px, sous le seuil de 900 px du design.

---

## Évolutions après les premiers tests réels

Ces quatre changements viennent de l'usage : on teste, on constate, on corrige. C'est le cycle normal d'un produit.

### 1. Nouvelle catégorie « Carburant »
- **Côté interface** : une ligne dans `src/lib/categories.js`, une couleur (`--c-fuel`) et une icône de pompe (`Icons.jsx`). Un seul fichier de référence pour le nom, l'icône et la couleur.
- **Côté base de données** : la contrainte `receipts_category_check` n'autorisait que cinq valeurs. Sans la modifier, enregistrer une note « Carburant » aurait été **refusé par la base**. Script : `supabase/002_add_fuel_category.sql` (déjà inclus dans `001` pour les nouvelles bases).
- **Côté IA** : la catégorie est ajoutée au prompt et à la liste de validation (`api/_lib/extract.js`, `api/_lib/sanitize.js`). Test réel sur un ticket fictif de gazole (`public/samples/ticket-carburant.png`) : catégorie, date et montants correctement lus.
- **Leçon** : une valeur qui existe à trois endroits (interface, base, IA) doit être modifiée aux trois endroits.

### 2. Menu déroulant au design de l'app
Le `<select>` natif s'affiche avec le style du système (liste grise du navigateur), impossible à personnaliser. On l'a remplacé par un composant `Select` : icône colorée par catégorie, coche sur le choix actuel, mêmes arrondis et couleurs que le reste. Il reste accessible : flèches haut/bas, Entrée, Espace, Échap, rôles ARIA, fermeture en cliquant ailleurs. Le sélecteur de date reste natif (le calendrier du système est plus fiable sur mobile).

### 3. « Envoi en cours », puis « Envoyée » sans recharger la page
- **Constat** : après l'enregistrement, la note restait affichée « Brouillon » jusqu'au rechargement, alors que l'email était déjà parti.
- **Principe** : l'état affiché est **déduit** du statut en base et de l'âge de la note (`src/lib/status.js`).
  - `draft` depuis moins de 2 minutes → **Envoi en cours** (orange, icône qui tourne)
  - `sent` → **Envoyée** (vert)
  - `draft` depuis plus de 2 minutes → **Non envoyée** (l'envoi ne s'est pas confirmé : suppression possible)
- **Mise à jour automatique** (`src/lib/useSendStatus.js`) :
  1. **Supabase Realtime** : la base pousse le changement dès que n8n passe la note à `sent` (activé par `supabase/003_realtime.sql`).
  2. **Contrôle de secours** toutes les 4 secondes tant qu'une note est en cours d'envoi, au cas où la connexion temps réel serait coupée. Il s'arrête tout seul.
- **Sécurité** : le temps réel respecte la RLS, un employé ne reçoit que les changements de **ses** notes. On empêche aussi la suppression d'une note pendant son envoi.
- **Leçon** : le mot « brouillon » ne voulait plus rien dire une fois l'envoi automatique. Un libellé doit décrire l'état réel pour l'utilisateur.

### 4. Le « Total du mois » restait à 0,00 €
- **Cause** : le total ne comptait que les notes dont la **date imprimée sur le ticket** tombait dans le mois en cours. Or les tickets de test datent de 2018 ou de mars : ils s'affichaient dans la liste mais jamais dans le total.
- **Correction** : une note compte pour le **mois où elle est enregistrée** (`created_at`). Un ticket de mars scanné en novembre fait partie des notes de novembre. Vérifié sur un jeu de cas (total attendu 203,50 €, obtenu 203,50 €).
- **Leçon** : choisir la bonne date de référence est une décision produit. Pour un suivi comptable par date de dépense, on ajouterait un sélecteur de période (voir la maquette V5).

### 5. Tuiles uniformes : plus de vert
- **Constat** : avec les notes envoyées en vert et les autres en brun, la liste ressemblait à un patchwork de couleurs, et le vert en aplat n'appartenait pas à l'identité de la marque (noir et orange).
- **Correction** : toutes les tuiles ont maintenant la **même surface sombre**. L'état se lit dans le libellé et l'icône, et seuls la **coche et le mot « Envoyée » restent verts**. Un fin liseré à gauche n'apparaît que si la note demande de l'attention : **orange qui respire** pendant l'envoi, **rouge** si l'envoi n'est pas confirmé.
- **Leçon** : réserver la couleur à ce qui demande une action. Une information « tout va bien » n'a pas besoin de se voir de loin.

### 6. Email du comptable au design de l'app
- **Pourquoi** : l'email reprenait l'ancienne identité bleue. Un produit doit être cohérent de bout en bout, y compris dans ses emails.
- **Rendu** : fond noir, carte centrale qui vire à l'orange vers le bas, montant TTC géant en graisse légère (HT et TVA dessous), bandeau orange « Le justificatif est joint à cet email », puis une feuille sombre avec catégorie (pastille de la couleur de l'app), date, auteur (lien mail), date de scan, mode de saisie (lecture IA ou manuelle), et la référence courte de la note en pied.
- **Le code vit dans le dépôt** : `n8n/prepare-receipt.js` (le contenu du nœud « Préparer la note »). Pour le modifier : on édite le fichier, on le teste en local, puis on le colle dans le nœud n8n.
- **Pièges propres à l'email HTML** :
  - Les clients mail (Gmail, Outlook, Apple Mail) ne supportent ni les feuilles de style externes, ni les polices web, ni les mises en page modernes. On écrit donc en **tableaux avec des styles en ligne**, avec une pile de polices de secours (Geist si elle est installée, sinon la police du système).
  - **Les guillemets de la pile de polices ont cassé le rendu** : `font-family:'Geist',…` écrit dans un attribut `style='…'` ferme l'attribut trop tôt, et tout le style qui suit est ignoré. Le test visuel a révélé le défaut (texte en serif). On écrit `font-family:Geist,…` sans guillemets.
  - Le contenu venant de l'IA ou de l'utilisateur est **échappé** : une enseigne `<b>x</b>` s'affiche telle quelle, sans injecter de HTML.
  - Le fond sombre est forcé sur chaque cellule (`bgcolor` + `background`) pour résister aux clients qui réécrivent les couleurs.
- **Publier** : une modification enregistrée dans n8n est un brouillon. Elle ne sert qu'après **Publish**, sinon les emails continuent d'utiliser l'ancienne version.

---

## Étape 6 — CI : vérifier automatiquement le code (GitHub Actions)

**Objectif** : à chaque pull request, cinq contrôles tournent sans intervention. Une erreur est repérée avant la fusion, pas en production.

### Les cinq commandes

| Commande | Ce qu'elle vérifie | Exemple d'erreur attrapée |
|---|---|---|
| `npm ci` | Installation propre, exactement les versions du `package-lock.json` | Dépendance oubliée ou lockfile désynchronisé |
| `npm run lint` | Style et erreurs probables (ESLint) | Variable inutilisée, règle des hooks React non respectée |
| `npm run typecheck` | Cohérence des types, **sur du JavaScript** (`tsc` avec `checkJs`) | Composant appelé sans une prop obligatoire |
| `npm test` | Comportement des fonctions pures (Vitest) | Un calcul de TVA ou un statut d'envoi qui change |
| `npm run build` | L'application se compile pour la production | Import cassé |

### Le workflow (`.github/workflows/ci.yml`)

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

### Quand lancer la CI ? (à raconter)
- **Sur chaque pull request** : c'est le contrôle qui valide le code avant la fusion.
- **Sur chaque push vers `main`** : vérifie le résultat réel après la fusion (conflit invisible entre deux PR, par exemple).
- **Pas sur chaque push de chaque branche** : une branche qui a une PR ouverte lancerait la CI deux fois (push + PR). C'est du temps de calcul gaspillé et un double affichage.
- **Pour bloquer vraiment une fusion**, il faut activer une *protection de branche* sur `main` avec le contrôle « check » obligatoire (réglages du dépôt). Sans elle, la CI signale l'échec mais n'empêche rien. Cette protection n'est pas toujours disponible sur un dépôt privé en compte gratuit : à vérifier avant la démo.

### Ce qui a été ajouté au projet

| Fichier | Rôle |
|---|---|
| `.github/workflows/ci.yml` | Le workflow ci-dessus |
| `eslint.config.js` | Règles ESLint (React, hooks) |
| `tsconfig.json` + `src/vite-env.d.ts` | Vérification de types sur le JavaScript (`allowJs`, `checkJs`, `noEmit`) |
| `src/lib/*.test.js` | 23 tests : `amounts`, `status`, `format`, `categories` |
| `package.json` | Scripts `lint`, `typecheck`, `test` + devDependencies |

On teste en priorité les **fonctions pures** de `src/lib/` : elles ne dépendent ni de React, ni du réseau, ni de Supabase. C'est la raison pour laquelle la logique de calcul a été isolée dès l'étape 1.

### Les principes à faire retenir
- **La CI ne remplace pas la vigilance, elle l'automatise.** La règle « ne pas dire que c'est fini sans avoir lancé le build » de `CLAUDE.md` devient vérifiée par la machine.
- **Pas de secrets, pas de réseau dans les tests.** Les tests n'appellent jamais Supabase ni l'IA. Quand ces tests arriveront (nettoyage des réponses de l'IA, messages d'erreur d'authentification), on testera des fonctions pures avec des données fictives.
- **Les outils de qualité sont des dépendances de développement** (`devDependencies`) : ils ne sont pas embarqués dans l'application. La règle 6 de `CLAUDE.md` (pas de bibliothèque sans raison) est respectée : la raison, c'est la CI.

### Pièges rencontrés
- **Vitest et Vite** : la dernière version de Vitest exige Vite 6 ou plus ; le projet est en Vite 5. Solution : Vitest 2, compatible Vite 5. (Ne pas forcer l'installation avec `--force` : on obtiendrait un environnement qui « marche » sans qu'on sache pourquoi.)
- **ESLint 10 et les plugins React** : le plugin React ne gère pas encore ESLint 10. Solution : ESLint 9.
- **Le typecheck sur du JavaScript signale des erreurs réelles** (9 au premier lancement) : des props qu'on avait en pratique rendues optionnelles mais que `tsc` déduit comme obligatoires (`Topbar` appelé sans utilisateur dans le starter, `ReceiptList` sans `loading`), la variable CSS `--i` passée dans `style`, `document.activeElement` sans cast, l'import de `styles.css`. On les a corrigées avec des valeurs par défaut et des annotations JSDoc plutôt que de désactiver la vérification.
- **Version de Node** : la CI utilise Node 24 ; vérifier que la version locale est compatible (`node -v`).

### À montrer aux élèves : la CI qui échoue
1. Créer une branche, introduire une erreur volontaire (par exemple un test cassé : changer `88` en `89` dans un `expect`, ou écrire une couleur en dur).
2. Ouvrir une pull request.
3. Observer la **croix rouge** dans l'onglet *Checks* et lire le journal de l'étape qui échoue.
4. Corriger, pousser : la coche verte revient.

### Vérifications faites
- Les cinq commandes passent en local, puis sur GitHub (exécutions réussies sur `main`).
- Le déclenchement sur une vraie pull request n'a pas encore été testé : à faire avec la démonstration ci-dessus.

---

## Étapes suivantes
7. CD (Vercel)
8. Bonus : récapitulatif mensuel (cron n8n), export du workflow en JSON dans le dépôt

## Maquette finale (design/maquette)

Les maquettes exploratoires (V1 à V7) ont été supprimées une fois la direction choisie. Elles sont remplacées par **une seule maquette, générée à partir des vrais composants** (`node design/build-maquette.mjs`) : on fait rendre `Hero`, `ReceiptList`, `Login`, etc. en HTML statique avec la vraie feuille `styles.css`. Avantage : la maquette ne diverge jamais du code (une maquette dessinée à la main, elle, vieillit dès la première modification).

Piège trouvé grâce à elle : sur un écran de téléphone étroit, les champs « Date / Catégorie » débordaient du panneau. Cause : `grid-template-columns: 1fr 1fr` laisse chaque colonne grandir jusqu'à la taille de son contenu. Correctif : `minmax(0, 1fr)`.

## Export du workflow n8n (n8n/snapnote-workflow.json)

Le workflow construit à l'étape 5 est exporté dans le dépôt, **sans secret ni identifiant** : les élèves l'importent (Import from file) au lieu de le reconstruire, puis renseignent l'email du comptable, l'expéditeur, l'URL Supabase et leurs propres identifiants (Header Auth, clé secrète Supabase, SMTP). Le code du nœud « Préparer la note » vient de `n8n/prepare-receipt.js`.
