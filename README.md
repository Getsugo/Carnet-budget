# Le Carnet — appli de suivi budgétaire

Appli web installable (PWA) de suivi de budget personnel : dépenses/revenus par catégorie, import automatique des relevés bancaires (CSV Crédit Agricole), suivi du patrimoine et d'un objectif d'épargne.

100 % locale : aucune donnée n'est envoyée sur un serveur. Tout est stocké uniquement sur l'appareil qui utilise l'appli (`localStorage` du navigateur).

## Fonctionnalités

- **Tableau de bord** : reste à vivre du mois, comparaison prévu/réel par catégorie, répartition des dépenses (donut), tendance des 6 derniers mois
- **Transactions** : ajout manuel, modification et suppression (tape sur une ligne pour l'éditer), import CSV avec catégorisation automatique et détection des doublons
- **Budget prévu** : montant prévu par catégorie, création/suppression de catégorie, changement d'icône
- **Année & objectif** : reste par mois sur l'année (graphique en barres), patrimoine total (compte courant calculé automatiquement + comptes ajoutés à la main), objectif d'épargne avec date cible et calcul du montant à épargner par mois
- **Sauvegarde manuelle** : export/import d'un fichier `.json` pour transférer ses données vers un autre appareil
- **Hors-ligne** : fonctionne sans connexion une fois installée (service worker)

## Structure des fichiers

```
index.html      squelette HTML de la page
app.js          toute la logique de l'appli (état, rendu des écrans, calculs, import CSV...)
style.css       le design (thème sombre)
manifest.json   métadonnées de l'appli installable (nom, icônes, couleurs)
sw.js           service worker : met les fichiers en cache pour le mode hors-ligne
icon-*.png      icônes de l'appli à différentes tailles
```

Le code est commenté dans `app.js` pour expliquer le rôle de chaque fonction.

## Déploiement (GitHub Pages)

1. Créer un repo GitHub (public)
2. Uploader tous les fichiers de ce dossier à la racine du repo (`Add file → Upload files`)
3. Aller dans `Settings → Pages`, choisir `Deploy from branch`, branche `main`, dossier `/ (root)`
4. L'appli est accessible à `https://<utilisateur>.github.io/<nom-du-repo>/`
5. Sur le téléphone, ouvrir ce lien puis "Ajouter à l'écran d'accueil" / "Installer l'application"

### Mettre à jour l'appli après une modification

1. Remonter les fichiers modifiés sur GitHub (mêmes noms, ça écrase les anciens)
2. Dans `sw.js`, incrémenter la valeur de `CACHE_NAME` (ex : `carnet-budget-v10` → `v11`) — c'est ce qui force les appareils à récupérer les nouveaux fichiers au lieu de garder l'ancienne version en cache
3. Fermer complètement puis rouvrir l'appli installée sur le téléphone

## Vie privée : le repo GitHub est-il public ?

Oui, le **code source** (les fichiers listés ci-dessus) est visible par n'importe qui ayant le lien du repo — comme pour n'importe quel projet GitHub Pages gratuit. En revanche, **aucune donnée personnelle n'y transite ni n'y est stockée** : les transactions, montants et catégories restent uniquement dans le navigateur de l'appareil qui les a saisis (`localStorage`). Personne d'autre que la personne ayant physiquement accès à l'appareil ne peut les consulter.

## Synchronisation entre appareils

Il n'y a pas de synchronisation automatique (l'appli n'a pas de serveur/base de données). Pour retrouver ses données sur un autre appareil (ex : téléphone → PC) :

1. Sur l'appareil source, onglet **Année & objectif → Sauvegarde → Exporter mes données** (télécharge un fichier `.json`)
2. Transférer ce fichier vers l'autre appareil (mail, Drive, clé USB...)
3. Sur l'autre appareil, **Importer une sauvegarde** et sélectionner ce fichier

⚠️ Importer une sauvegarde remplace entièrement les données déjà présentes sur l'appareil de destination.

## Capacité de stockage

Le navigateur alloue en général autour de 5 Mo de `localStorage` par site. Chaque transaction pèse environ 130 octets une fois enregistrée. Même avec un usage très intensif (plusieurs transactions par jour, tous les jours, pendant 10 ans), le volume total reste de l'ordre de 1 à 2 Mo — largement sous la limite. En usage normal, l'appli peut donc être utilisée pendant de nombreuses années sans risque de saturation. En cas de doute, l'export régulier (voir ci-dessus) sert aussi d'archive de sécurité.

## Stack technique

Aucune dépendance externe : HTML, CSS et JavaScript "vanilla" uniquement (pas de framework, pas de build, pas de `node_modules`). L'appli fonctionne en ouvrant simplement `index.html` dans un navigateur, ou en étant servie par n'importe quel hébergeur de fichiers statiques (GitHub Pages, Netlify, etc.).
