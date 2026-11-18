# Umami sur le VPS — mise en place

Mesure d'audience de FRONTROW, hébergée sur ton VPS OVH (`148.113.243.29`),
accessible sur `https://stats.thefrontrow.fr`.

Principe : Umami et sa base Postgres tournent dans Docker, **uniquement sur
127.0.0.1:3010**. Caddy (déjà installé sur le serveur) fait le HTTPS devant.
Rien n'est exposé tant que le bloc Caddy n'est pas ajouté (étape 5), ce qui
permet de changer le mot de passe par défaut avant toute ouverture publique.

Les commandes `ssh` / `scp` se lancent depuis ton Mac, le reste **sur le VPS**.

## 1. DNS (OVH)

Zone DNS de `thefrontrow.fr` → ajouter une entrée :

| Type | Sous-domaine | Cible             |
| ---- | ------------ | ----------------- |
| A    | `stats`      | `148.113.243.29`  |

Vérification depuis ton Mac (peut prendre quelques minutes) :

```bash
dig +short stats.thefrontrow.fr
```

## 2. Copier les fichiers et créer les secrets

Depuis la racine du dépôt, sur ton Mac :

```bash
scp -r ops/umami root@148.113.243.29:/home/amel/umami
```

Sur le VPS :

```bash
cd /home/amel/umami
cp .env.example .env
chmod 600 .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 32)/" .env
sed -i "s/^APP_SECRET=.*/APP_SECRET=$(openssl rand -hex 32)/" .env
sed -i "s/^TWO_FACTOR_ENCRYPTION_KEY=.*/TWO_FACTOR_ENCRYPTION_KEY=$(openssl rand -hex 32)/" .env
```

Vérifie que les trois lignes sont remplies **sans afficher les valeurs** :

```bash
sed 's/=.*/=…/' .env
```

## 3. Démarrer

```bash
cd /home/amel/umami
docker compose up -d
docker compose ps
curl -s http://127.0.0.1:3010/api/heartbeat; echo
```

Les deux services doivent passer à `healthy` (patienter ~30 s) et le heartbeat
répondre par un petit JSON (sans erreur).

## 4. Premier accès, par tunnel SSH (avant toute ouverture publique)

Sur ton Mac :

```bash
ssh -L 3010:127.0.0.1:3010 root@148.113.243.29
```

Puis ouvre <http://localhost:3010> dans ton navigateur :

1. Connexion avec l'identifiant par défaut d'Umami (`admin`, mot de passe
   `umami`) puis **change immédiatement le mot de passe** (Paramètres → Profil).
2. Active la double authentification si tu veux (Paramètres → Profil).
3. Paramètres → Sites web → **Ajouter un site** : nom `FRONTROW`, domaine
   `thefrontrow.fr`.
4. Ouvre le site créé → Paramètres : copie son **ID du site** (un UUID). C'est
   lui qui va dans la page du site, il n'est pas secret.

## 5. Ouvrir en HTTPS (Caddy)

Sur le VPS, **après** que l'enregistrement DNS répond :

```bash
cat /home/amel/umami/Caddyfile.snippet >> /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

Caddy obtient le certificat tout seul (comme pour n8n et clip). Vérification
depuis ton Mac :

```bash
curl -sI https://stats.thefrontrow.fr/script.js | head -5
```

Tu dois voir `HTTP/2 200` et `content-type: application/javascript`.

## 6. Brancher le site

Envoie l'**ID du site** à Claude : il l'ajoute dans `index.html`, avec les
événements et la mention dans la politique de confidentialité. Le script ne
mesure que `thefrontrow.fr` (attribut `data-domains`) : les environnements de
test et de prévisualisation n'envoient rien.

## 7. Sauvegarde et purge automatiques

Sur le VPS :

```bash
cp /home/amel/umami/umami.cron /etc/cron.d/umami
chmod 644 /etc/cron.d/umami
/home/amel/umami/backup.sh
/home/amel/umami/purge.sh
ls -lh /home/amel/umami-backups
```

- `backup.sh` : export compressé chaque nuit à 03h17, gardé **14 jours**,
  dans `/home/amel/umami-backups` (lisible par root seulement).
- `purge.sh` : chaque nuit à 03h32, supprime les données de plus de
  **13 mois**. Les journaux sont dans `/var/log/umami-maintenance.log`.

Copie hebdomadaire sur ton Mac (facultative, à lancer depuis ton Mac) :

```bash
mkdir -p ~/umami-backups && scp "root@148.113.243.29:/home/amel/umami-backups/umami-$(date +%F).sql.gz" ~/umami-backups/
```

## 8. Restaurer une sauvegarde

```bash
cd /home/amel/umami
docker compose stop umami
gunzip -c /home/amel/umami-backups/umami-AAAA-MM-JJ.sql.gz | docker compose exec -T db psql -U umami -d umami
docker compose start umami
```

(Sur une base vide ; pour écraser une base existante, la recréer d'abord.)

## 9. Mettre à jour Umami

La version est épinglée dans `docker-compose.yml`. Pour monter de version :
changer le numéro de l'image, faire une sauvegarde (`./backup.sh`), puis :

```bash
cd /home/amel/umami
docker compose pull
docker compose up -d
```

## Ce qui n'est volontairement pas fait

- Aucun cookie, aucun identifiant d'utilisateur (`umami.identify` n'est pas
  utilisé), aucune adresse IP stockée : Umami s'en sert au moment de la
  requête pour déduire le pays et la ville, puis ne la conserve pas.
- Le texte tapé dans la recherche n'est jamais envoyé.
- Le signal « Do Not Track » du navigateur est respecté.
