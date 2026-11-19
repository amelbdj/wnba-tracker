# Relais NCAA sur le VPS — mise en place

Le relais est le projet open source [henrygd/ncaa-api](https://github.com/henrygd/ncaa-api)
(licence MIT). Il lit ncaa.com pour le compte de la fonction `api/ncaa/volleyball` de
FRONTROW, qui l'utilise en premier et garde le relais public (`ncaa-api.henrygd.me`)
en secours.

Il tourne dans Docker, **uniquement sur 127.0.0.1:3011**. Caddy (déjà sur le serveur)
fait le HTTPS devant, sur `https://ncaa.thefrontrow.fr`. Sans le jeton `x-ncaa-key`, il
répond 401.

Les commandes `scp` se lancent depuis ton Mac, le reste **sur le VPS**.

## 1. DNS (OVH)

Zone DNS de `thefrontrow.fr` → ajouter :

| Type | Sous-domaine | Cible            |
| ---- | ------------ | ---------------- |
| A    | `ncaa`       | `148.113.243.29` |

Vérification depuis ton Mac :

```bash
dig +short ncaa.thefrontrow.fr
```

## 2. Copier les fichiers et créer le jeton

Depuis la racine du dépôt, sur ton Mac :

```bash
scp -r ops/ncaa-relay root@148.113.243.29:/home/amel/ncaa-relay
```

Sur le VPS :

```bash
cd /home/amel/ncaa-relay
cp .env.example .env
chmod 600 .env
sed -i "s/^NCAA_HEADER_KEY=.*/NCAA_HEADER_KEY=$(openssl rand -hex 32)/" .env
```

Vérifie que les deux lignes sont remplies **sans afficher le jeton** :

```bash
sed 's/=.*/=…/' .env
```

## 3. Démarrer

```bash
cd /home/amel/ncaa-relay
docker compose up -d
docker compose ps
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}'
```

Le conteneur `ncaa-relay-ncaa-api-1` doit être `Up`. Sa mémoire doit rester très
inférieure à la limite de 256 Mo.

## 4. Le test décisif : ncaa.com répond-il à l'adresse du VPS ?

```bash
cd /home/amel/ncaa-relay
./check.sh
```

Il vérifie que le relais refuse l'accès sans jeton, lit trois pages de ncaa.com
(classement des joueuses, matchs d'un jour, feuille de match) et les compare à celles du
relais public. Résultat attendu : `RÉSULTAT : tout est bon.`

**Si la partie 2 échoue** (HTTP 5xx, 403, réponse qui n'est pas du JSON), ncaa.com refuse
probablement l'adresse d'OVH. Ne va pas plus loin : récupère les journaux avec
`docker compose logs --tail 40`, envoie-les à Claude, et arrête avec
`docker compose down`. Rien d'autre n'a été modifié : le relais public reste en place.

## 5. Ouvrir en HTTPS (Caddy)

Seulement si l'étape 4 est réussie et que le DNS répond :

```bash
cat /home/amel/ncaa-relay/Caddyfile.snippet >> /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

Puis, toujours sur le VPS (le jeton est lu dans `.env`, il ne s'affiche pas) :

```bash
cd /home/amel/ncaa-relay
./check.sh https://ncaa.thefrontrow.fr
```

## 6. Fixer la version exacte de l'image

Le premier test utilise `henrygd/ncaa-api:latest`. Pour que le relais ne change pas
tout seul de version, on remplace par l'empreinte de l'image testée :

```bash
cd /home/amel/ncaa-relay
docker image inspect henrygd/ncaa-api:latest --format '{{index .RepoDigests 0}}'
```

Copier le résultat (de la forme `henrygd/ncaa-api@sha256:…`) dans `.env`, ligne
`NCAA_API_IMAGE=`, puis :

```bash
docker compose up -d
./check.sh https://ncaa.thefrontrow.fr
```

## 7. Brancher la fonction (variables Vercel)

Dans Vercel → Settings → Environment Variables, ajouter :

| Nom | Valeur |
| --- | --- |
| `NCAA_API_URL` | `https://ncaa.thefrontrow.fr` |
| `NCAA_API_KEY` | le jeton (valeur de `NCAA_HEADER_KEY` dans le `.env` du VPS) |

Pour lire le jeton et le coller directement dans Vercel (ne l'envoie à personne,
Claude compris) :

```bash
grep '^NCAA_HEADER_KEY=' /home/amel/ncaa-relay/.env
```

Les variables ne sont prises en compte qu'au déploiement suivant. Sans elles, la
fonction continue d'utiliser le relais public.

## Exploitation

- **Revenir au relais public d'urgence :** supprimer `NCAA_API_URL` dans Vercel et
  redéployer. (Si le relais privé tombe tout seul, la fonction bascule déjà seule sur le
  public.)
- **Journaux :** `docker compose logs --tail 50` dans `/home/amel/ncaa-relay`.
- **Changer le jeton :** régénérer la ligne dans `.env`, `docker compose up -d`, puis
  mettre la même valeur dans `NCAA_API_KEY` sur Vercel et redéployer.
- **Mettre à jour le relais :** `docker pull henrygd/ncaa-api:latest`, relancer
  `./check.sh` sur une copie de test avant de changer l'empreinte dans `.env`.
