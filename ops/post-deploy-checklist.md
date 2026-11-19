# Après chaque déploiement

À faire une fois que Vercel affiche le déploiement en vert. Compter 3 minutes.

## 1. Le site répond
- Ouvrir <https://thefrontrow.fr> en navigation normale (Cmd+Maj+R), sans bloqueur de pub.
- Ouvrir une ligue, une page d'équipe, une fiche joueuse : les données s'affichent.

## 2. L'audience est mesurée
- Umami (<https://stats.thefrontrow.fr>) → Frontrow → **Realtime** : ta visite apparaît.

## 3. L'usage Vercel (important : au-delà des limites Hobby, le site entier est mis en pause)
Vercel → le projet → **Usage**. Relever, avec la date :

| Compteur | Limite Hobby | À surveiller |
| --- | --- | --- |
| Function Invocations | 1 000 000 / mois | > 50 % avant le 15 du mois |
| Fast Data Transfer | 100 Go / mois | > 50 % avant le 15 du mois |
| Fast Origin Transfer | 10 Go / mois | > 50 % avant le 15 du mois |

Si l'un dépasse 50 % de façon précoce, ne rien déployer de plus et me le dire :
on réduit les appels (durées de cache plus longues, moins de requêtes par page).

Alertes automatiques : Vercel → Settings → **Notifications** → activer les alertes
d'usage par e-mail. Sur le plan Hobby, Vercel choisit les seuils lui-même (les seuils
personnalisés sont réservés au plan Pro) : c'est un filet de sécurité, pas un
remplacement de la vérification ci-dessus.

## 4. Le point de passage ESPN (depuis le chantier B)
Depuis un terminal, remplacer `DATE` par la date du jour au format AAAAMMJJ :

```bash
curl -sI "https://thefrontrow.fr/api/espn?dates=DATE&kind=scoreboard&league=wnba" | grep -iE "^(HTTP|cache-control|x-vercel-cache|age)"
```

- `HTTP/2 200` et un `cache-control` avec `s-maxage=20` pour aujourd'hui.
- Relancer deux fois : `x-vercel-cache: HIT` doit apparaître (le cache fonctionne).
- Si c'est un `502` : ESPN ou la fonction a un problème. Le site doit continuer à
  afficher les données (le navigateur retombe sur ESPN en direct). Me le signaler.
