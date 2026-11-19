# Contrôles quotidiens (n8n) — mise en place

Un workflow sur ton n8n (`https://n8n.thefrontrow.fr`) lit chaque jour à **8 h (heure de
Paris)** une vingtaine d'adresses clés et t'écrit sur **Discord** quand quelque chose
cloche : réponse vide, erreur, source injoignable, ou **champ clé qui a changé de nom ou de
type** (même si la réponse est « 200 »).

## Ce qui est contrôlé

| Groupe | Contrôles |
| --- | --- |
| Basket | ESPN WNBA (matchs d'un jour, classement, feuille de match, fiche d'équipe, effectif, fiche joueuse) · ESPN NCAA basket (matchs d'un jour) · recherche de joueuses |
| Volley | ESPN NCAA volley (matchs d'un jour, classement par conférence) · relais NCAA public (classement des joueuses, matchs d'un jour, feuille de match) |
| Football | ESPN Première Ligue (matchs d'un jour, classement) · ESPN Ligue des champions (matchs d'un jour) |
| FRONTROW | page d'accueil · point de passage `/api/espn` · données NCAA via le site (et **quel relais a répondu**) · Umami |

Choix qui évitent les fausses alertes :
- les **scores** sont lus sur un **jour passé fixe** : jamais vide, même hors saison ;
- les **classements** sont lus tels quels ;
- chaque réponse doit contenir des **champs précis, du bon type** (par exemple
  `events[0].competitions[0].competitors[0].team.id`). Le message te dit lequel manque.

## Ce que tu reçois

- **🔴 en échec** : un contrôle est tombé. Tu le revois **chaque jour** (« depuis N jours »)
  tant que ce n'est pas réglé.
- **🟠 à surveiller** : ça marche mais pas comme prévu, par exemple le relais NCAA privé ne
  répond plus et c'est le relais public qui sert.
- **🟢 rétabli** : un contrôle qui était en échec est revenu.
- **✅ tout va bien**, **chaque lundi** : sans lui, tu ne saurais pas si le contrôle
  lui-même s'est arrêté. **S'il n'arrive pas un lundi, vérifie n8n.**

## 1. Créer le webhook Discord

Dans ton serveur Discord, sur un salon d'alertes : *Modifier le salon* → *Intégrations* →
*Webhooks* → *Nouveau webhook* → **Copier l'URL du webhook**. Cette adresse est un secret :
ne la partage pas et ne la mets jamais dans le dépôt.

## 2. Importer le workflow dans n8n

1. Dans n8n : *Workflows* → *Create workflow* (ou le menu `⋯`) → **Import from file**.
2. Choisir `ops/n8n/frontrow-monitor.workflow.json`.
3. Ouvrir le nœud **« Envoyer sur Discord »** et remplacer dans le champ **URL**
   `COLLE_ICI_L_URL_DU_WEBHOOK_DISCORD` par l'URL copiée à l'étape 1. Enregistrer.

## 3. Vérifier Discord, essayer, puis activer

1. **Vérifier que le webhook fonctionne**, avant même n8n. Dans un terminal sur ton Mac,
   en deux commandes. La première te demande l'URL du webhook (colle-la dans le champ
   masqué : elle ne s'affiche pas et n'entre pas dans l'historique) :

   ```bash
   read -rs "U?Colle l'URL du webhook Discord, puis Entrée : "; echo
   ```

   Colle l'URL, Entrée, puis :

   ```bash
   echo "longueur : ${#U}"; curl -s -o /dev/null -w "code HTTP : %{http_code}\n" -H 'Content-Type: application/json' -d '{"content":"Test FRONTROW : le webhook fonctionne."}' "$U"; unset U
   ```

   Il faut `code HTTP : 204` et une longueur proche de 120 ; le message doit apparaître
   dans ton salon Discord. (Ne pas passer par `pbpaste` : copier la commande remplace
   l'URL dans le presse-papiers.)
2. Dans n8n, cliquer **Execute workflow** (le déclencheur « Lancer à la main »). Compter 20 à
   30 secondes : les adresses sont lues une par une, 0,7 s d'écart, pour ne pas dépasser les
   3 requêtes par seconde du relais NCAA public.
3. Si tout va bien **hors lundi**, aucun message n'est envoyé : c'est normal. Les nœuds
   doivent être verts jusqu'à « Analyser les réponses ». Un message Discord n'arrive que si
   un contrôle échoue ou que c'est lundi.
4. **Activer** le workflow (interrupteur « Active » en haut à droite). Sans cela, le
   déclencheur de 8 h ne part pas : seul le lancement à la main fonctionne.

> Les essais à la main ne conservent pas l'état « déjà signalé » : seul le déclencheur
> programmé (workflow activé) retient depuis quand un contrôle est en échec.

## Quand une alerte arrive

1. Lire le message : le contrôle, le champ ou le code HTTP, et depuis combien de jours.
2. Depuis ton Mac, voir la même chose en direct :

   ```bash
   node ops/n8n/run-live.js
   ```

   Il lance les mêmes contrôles et affiche chaque ligne en OK, ATTENTION ou ÉCHEC.
3. Si la source a vraiment changé (un champ renommé, par exemple), l'application est
   probablement touchée aussi : le champ cité dans le message est celui que le site lit.

## Modifier les contrôles

La logique est dans `ops/n8n/checks.js` (testée par `scripts/n8nChecks.test.js`). Après
une modification :

```bash
npm test
node scripts/buildN8nWorkflow.js      # régénère le fichier du workflow
node ops/n8n/run-live.js              # vérifie contre les vraies sources
```

Puis dans n8n : supprimer l'ancien workflow, **réimporter** le fichier mis à jour et
remettre l'URL du webhook (étape 2.3). Un test échoue si le fichier du workflow n'est pas
à jour avec `checks.js`.

## Limites à connaître

- **Un contrôle par jour** : une panne d'une heure entre deux passages n'est pas vue.
- **Les copies en cache** : les contrôles « Site · … » passent par le cache de Vercel et
  peuvent montrer une copie plus ancienne ; les contrôles ESPN et relais lisent directement
  la source.
- **Cibles fixes** : les jours passés utilisés (voir `DAY` dans `checks.js`) existent
  encore dans ESPN pour des années ; si l'un disparaît, le contrôle l'indique.
- **Testé** sur n8n 2.48.6 (image `docker.n8n.io/n8nio/n8n:latest` du 19 novembre 2026).
  Si une version future change le format des nœuds, l'import peut demander des ajustements.
- **Aucun secret** dans le workflow ni dans le dépôt, hormis l'URL Discord que tu colles
  toi-même dans n8n.
