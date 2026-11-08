# 🏀 FRONTROW

Une application web moderne pour suivre le sport en temps réel : scores, classements, équipes et statistiques joueurs.

---

## 🚀 Démo

👉 https://thefrontrow.fr/

---

## ✨ Fonctionnalités

- 🏠 Page d'accueil (landing) avec présentation de l'app
- 📅 Suivi des matchs du jour (scores, statut LIVE / FINISHED / UPCOMING), mis à jour automatiquement pendant les matchs en direct
- 🏐 Volley féminin NCAA : scores en sets avec le détail point par set, classement par conférence, tableau du tournoi national, et classements des joueuses par catégorie (kills, aces, blocs, digs…) depuis NCAA.com via un petit proxy (`api/ncaa/volleyball`) — stats par joueuse dans le détail d'un match (box score NCAA.com, rafraîchi en direct), effectifs avec avatars à initiales et fiche par joueuse (totaux, moyennes par set, match par match) calculée à partir des box scores de la saison — ESPN ne fournit ni effectifs ni stats de joueuses pour cette ligue, donc pas de page Joueuses globale
- ⚽ Football féminin : Première Ligue, Ligue des champions, NWSL, WSL, Liga F et Coupe du monde — scores avec minute, prolongations et tirs au but, classement en points avec zones de qualification et de relégation, effectifs, fiches joueuses (buts, passes, arrêts…) et détail de match (chronologie des buts et cartons, statistiques d'équipe, compositions). Les playoffs et les classements de buteuses ne sont pas encore pris en charge pour le football
- 🏆 Classements par ligue
- 🥇 Tableau des playoffs (têtes de série projetées, résultats en direct puis dernier tournoi terminé, selon la saison)
- 👥 Liste des équipes et fiche détaillée par équipe, avec tous ses matchs (résultats et à venir, paginés)
- 🧑‍🤝‍🧑 Liste des joueurs et profil détaillé par joueur
- 📊 Statistiques
- 🔗 Aperçus de liens (WhatsApp, iMessage, Discord, X, Telegram, Slack…) : titre, description et image propres à chaque page (ligues, équipes, joueuses) via `api/share.js` et `api/og.js` (images 1200×630 générées avec satori + resvg, en JPEG pour rester légères), en français par défaut (`?lang=en|es`)
- 🌍 Multilingue : Français / Anglais / Espagnol
- 🎨 Interface moderne (typo Bebas Neue + Inter, palette bleu foncé + violet)

---

## ⚙️ Stack utilisée

- React 19 (Vite)
- React Router
- i18next / react-i18next (internationalisation)
- JavaScript (ES6+)
- CSS moderne (dark UI)
- ESLint

---

## 📁 Installation locale

```bash
git clone https://github.com/amelbdj/wnba-tracker.git
cd wnba-tracker
npm install
npm run dev
```

## 🛠️ Scripts disponibles

- `npm run dev` — lance le serveur de développement
- `npm run build` — build de production
- `npm run preview` — prévisualise le build de production
- `npm run lint` — vérifie le code avec ESLint
- `npm test` — lance les tests unitaires (Vitest, ~100 tests, moins d'une seconde) ; `npm run test:watch` pour les relancer à chaque modification

## ✅ Tests et intégration continue

Les tests couvrent la logique pure (appariement des équipes ESPN/NCAA, statuts et rythme de rafraîchissement des matchs, tableau des playoffs, box scores et fiches de volley, conférences corrigées, recherche, chargeur de saison) et la fonction serverless `api/ncaa/volleyball` (validation des requêtes, relances face aux refus de NCAA.com, en-têtes de cache). Ils tournent sans réseau ni navigateur.

GitHub Actions (`.github/workflows/ci.yml`) exécute lint, tests et build à chaque push sur `main` et à chaque pull request.

## 🚀 Déploiement

Chaque push sur `main` déclenche un déploiement Vercel, dont le nombre est limité par mois. `scripts/vercel-ignore-build.sh` (branché via `ignoreCommand` dans `vercel.json`) saute le déploiement quand, depuis le dernier déploiement réussi, seuls le README, les tests, la config CI ou les sources de design (`design/`) ont changé. En cas de doute (aucun déploiement précédent, commit introuvable), il déploie.
