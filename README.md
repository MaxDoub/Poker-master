# Poker Master

PWA d'entraînement au poker, **100 % locale** : pas de backend, pas de compte, aucune
donnée qui sort du téléphone. Les ranges de référence sont les tiennes.

Écrite sans build step (modules ES natifs, aucune dépendance), donc rien à compiler :
les fichiers du dépôt *sont* l'application.

---

## Les exercices

| Exercice | Compétence travaillée | D'où vient la bonne réponse |
| --- | --- | --- |
| **Drill préflop** | Ranges d'ouverture par position et profondeur | Tes ranges, avec justification |
| **Drill chronométré** | Décider à la vitesse de la table | Tes ranges |
| **Révision ciblée** | Corriger tes erreurs récurrentes | Tes ranges + ton historique |
| **Cotes & équité** | Call ou fold face à un all-in | Monte-Carlo contre ta range de shove |
| **Combos & blockers** | Compter les combinaisons | Arithmétique pure |
| **Audit des ranges** | Repérer ce qui se contredit dans tes données | Tes ranges |
| **Que faire ?** | Consulter une main précise, hors exercice | Tes ranges, avec justification |

Le principe est constant : **l'app ne t'apprend jamais une stratégie qu'elle a inventée.**
Soit elle te compare à tes propres ranges, soit elle te donne un résultat purement
mathématique. Aucun solveur générique non validé n'est introduit en douce.

### Drill préflop

Table 6-max dessinée à l'écran, avec le **stack effectif en gros au centre** : c'est lui
qui commande l'action. Les joueurs déjà passés sont à gauche et grisés, ceux qui restent
à parler sont à droite, le bouton est sur BTN, et ton siège est nettement plus gros que
les autres. Tu vois ta position dans l'ordre de parole au lieu de la déduire d'une
abréviation.

Tout tient sur un écran d'iPhone : table, cartes et boutons d'action, sans défilement.
Sur l'écran de correction, le verdict et le bouton « Main suivante » sont côte à côte,
pour enchaîner sans jamais faire défiler la page.

Chaque réponse est justifiée en deux à quatre phrases — voir ci-dessous.

Hors mode révision, les cartes sont tirées d'un vrai jeu de 52 : les mains dépareillées
sortent donc 3 fois plus souvent que les assorties, comme à une vraie table.

### Drill chronométré

4, 8 ou 15 secondes par main. Au-delà, la main compte comme une erreur. Connaître la
bonne réponse et la trouver sous pression sont deux compétences distinctes.

### Révision ciblée

Environ 7 mains sur 10 sont tirées parmi tes erreurs récentes, pondérées par la fraîcheur
(une erreur d'il y a 30 jours ne pèse presque plus). Les 3 autres restent aléatoires pour
ne pas tunneliser sur un seul spot.

### Cotes & équité

Un adversaire part all-in ; l'app calcule ton équité réelle par Monte-Carlo (3000 mains
simulées) **contre sa range de shove — c'est-à-dire ta propre range pour cette position
et cette profondeur** — et la compare à l'équité nécessaire donnée par la cote du pot.

Convention utilisée : blindes 0,5 / 1, le vilain shove pour `S` BB, tout le monde fold,
tu es en BB. Le pot avant ton call vaut `S + 1,5` et il te reste `S − 1` à payer.

L'évaluateur de mains (7 cartes, toutes catégories jusqu'à la quinte flush, roue A-5
comprise) est vérifiable : AA vs KK donne 81 %, AKs vs QQ 46 %, 76s vs AA 23 %.

### Combos & blockers

Questions à choix multiple, réponses factuelles : combien de combinaisons de telle main
restent quand tu en bloques une, combien une main canonique en compte, quelle part des
combinaisons telle range joue. C'est le comptage qui rend le hand-reading possible.

### Que faire ?

Ce n'est pas un exercice : c'est une consultation. Tu donnes ta position, ton stack et
tes deux cartes (assorties ou non), l'app répond ce que tes ranges disent — et pourquoi,
avec les mêmes justifications que le drill.

La réponse est en haut de l'écran et se met à jour à chaque changement, sans bouton à
valider. La grille 13×13 en bas est cliquable : toucher une case consulte cette main.
La dernière consultation est mémorisée.

Accessible par l'onglet **Consulter** de la barre du bas, toujours visible, ainsi que
depuis l'accueil et l'écran Ranges.

### Audit des ranges

Ne juge pas ta stratégie — cherche les endroits où **tes ranges se contredisent entre
elles** :

- largeur d'ouverture par position × profondeur (matrice colorée) ;
- inversions de position (une position tardive plus serrée qu'une précoce) ;
- creux de profondeur (un palier plus serré que celui du dessus ET celui du dessous) ;
- mains dominées jouées alors que la main dominante est foldée ;
- mains fortes en raise simple alors qu'une main qu'elles dominent part à tapis ;
- part de raise non all-in sous 15 BB (pureté de la logique push/fold).

Le test de domination est volontairement strict : il ne compare que des mains dont la
carte haute est identique (A7s vs A5s), ou des paires entre elles, ou la version assortie
contre la dépareillée des mêmes rangs. Comparer K8s à 98s n'aurait aucun sens — la
seconde est connectée, et beaucoup de ranges légitimes la jouent en foldant la première.
Sans cette restriction, l'audit produit des centaines de faux positifs.

---

## Installer sur iPhone

Le service worker (mode hors ligne) exige HTTPS ou `localhost`.

### Via GitHub Pages (recommandé)

L'app n'a aucune étape de build : GitHub Pages sert la branche `main` telle quelle.
Le `.nojekyll` à la racine désactive le traitement Jekyll.

```bash
git add -A
git commit -m "Poker Master"
git branch -M main
git remote add origin https://github.com/<ton-compte>/poker-master.git
git push -u origin main
```

Puis sur GitHub : **Settings → Pages → Source → Deploy from a branch → `main` → `/ (root)`**.
Chaque push sur `main` republie le site.

> Une publication via GitHub Actions est possible aussi, mais elle exige un token ayant la
> portée `workflow`. Sans build à faire, le déploiement par branche suffit.

L'app arrive sur `https://<ton-compte>.github.io/poker-master/`. Tous les chemins sont
relatifs, donc le sous-dossier ne pose pas de problème.

Sur l'iPhone : Safari → cette URL → **Partager** → **Sur l'écran d'accueil**.

> **Tes ranges ne sont pas publiées.** `data/mes-ranges.json` est dans `.gitignore` : le
> dépôt peut rester public sans exposer ton jeu. Au premier lancement, importe
> `range_poker.xlsx` depuis l'écran Import — une seule fois, les ranges restent ensuite
> dans le téléphone (IndexedDB) et n'en sortent jamais.

### En local depuis le Mac

```bash
python3 tools/devserver.py 8765
```

`http://localhost:8765` sur le Mac. Depuis l'iPhone sur le même réseau
(`http://<ip-du-mac>:8765`), l'app s'affiche et s'installe, mais **le mode hors ligne ne
s'active pas** : Safari refuse les service workers hors HTTPS/localhost.

---

## Tes ranges

`range_poker.xlsx` donne 25 ranges : 169 mains × 5 profondeurs (10, 15, 20, 50, 100 BB)
× 5 positions (LJ, HJ, CO, BTN, SB). Les 845 lignes BB, sans décision, sont ignorées — la
range de défense n'est pas définie.

Le fichier converti (`data/mes-ranges.json`) reste **en local uniquement**, hors du dépôt.
L'app détecte son absence et t'invite alors à importer l'Excel toi-même.

### Réimporter après modification de l'Excel

Dans l'app, écran **Import** : `.xlsx` lu directement dans le navigateur (Safari 16.4+),
ou `.csv`, ou `.json`. En ligne de commande :

```bash
python3 tools/xlsx_to_json.py range_poker.xlsx -o data/mes-ranges.json
```

Stdlib uniquement, aucune dépendance. Les deux chemins donnent le même résultat.

### Format attendu

Colonnes (ordre libre, accents et casse ignorés) :

```
pocket card | suited | stack | place | décision
```

- `pocket card` : `A-K`, `7-7`, `A-10`, ou la notation compacte `AKs` / `AKo`
- `suited` : `suited` / `non suited` / `pairé`
- `stack` : profondeur en BB
- `place` : `SB`, `LJ`, `HJ`, `CO`, `BTN`, `BB` (`UTG` est lu comme `LJ`)
- `décision` : `fold`, `limp`, `call`, `raise`, `all-in`, ou une **décision mixte** avec
  un slash : `limp/raise`

Une colonne `scenario` est utilisée si elle existe, sinon tout est classé en `RFI`.
Les lignes sans décision sont ignorées sans erreur.

### Décisions mixtes

`limp/raise` est traité comme une décision mixte **sans fréquence** : les deux actions
comptent justes, le feedback affiche « Dans le mix ». Aucune pondération n'est inventée.
Si tu ajoutes des fréquences un jour, le format JSON les accepte :

```json
{ "AA": { "actions": ["limp", "raise"], "freq": { "limp": 0.3, "raise": 0.7 } } }
```

---

## Comment l'app note tes réponses

| Verdict | Quand |
| --- | --- |
| **Correct** | La range prévoit une seule action et c'est la tienne |
| **Dans le mix** | La range prévoit plusieurs actions et la tienne en fait partie |
| **Erreur** | Ton action n'est pas dans la range, ou le chrono a expiré |
| *non compté* | La main n'est pas renseignée pour ce spot |

Le choix du sizing a été retiré de l'écran : l'Excel n'en contient pas, il n'était donc
pas noté, et il coûtait la place nécessaire pour que les boutons tiennent sans défilement.
Le champ reste dans l'historique, prêt pour le jour où tu ajouteras des tailles.

### Les justifications

Après chaque main, l'app explique la réponse. Comme le reste, **rien n'est inventé** :
chaque phrase est un fait lu dans tes propres ranges.

- la largeur de ta range à cette position, et la place de la main dedans ;
- **la limite de sa famille** : pour AJo, jusqu'où va ta range A-x dépareillée
  (« A10o se joue, A9o se folde ») — c'est le repère qui se retient ;
- un point de comparaison pris ailleurs chez toi : la même main à une position plus
  tardive, ou à une autre profondeur ;
- en dessous de 15 BB, la part de tes combinaisons qui partent directement à tapis.

Quand une famille n'est pas monotone, l'app ne prétend pas y voir une limite nette : elle
signale l'irrégularité (« 99 se folde alors que 88, 77, 66, plus faibles, se jouent »).
Ce sont les mêmes anomalies que celles relevées par l'écran Audit.

---

## Structure

```
index.html              coquille de l'app
manifest.webmanifest    installation sur l'écran d'accueil
sw.js                   cache hors ligne
css/app.css             thème sombre/clair, mobile-first
js/
  app.js                routeur (navigation par hash)
  cards.js              cartes, 169 mains canoniques, grille 13x13
  card-art.js           cartes à jouer en SVG
  table.js              table 6-max en SVG
  ranges.js             modèle de range, actions, évaluation
  equity.js             évaluateur 7 cartes + Monte-Carlo + cotes
  parse.js              import CSV / JSON / XLSX
  drill.js              moteur de session, tirage, mode révision
  stats.js              historique et agrégats
  grid.js               rendu de la grille 13x13
  db.js                 IndexedDB
  ui.js / theme.js      aides DOM, thème
  views/                un fichier par écran (dont lookup.js, « Que faire ? »)
data/
  mes-ranges.json       tes 25 ranges
  demo-range.json       ranges génériques, pour tester l'app
  explain.js            justification d'une réponse, à partir de tes ranges
tools/
  xlsx_to_json.py       convertisseur Excel → JSON
  devserver.py          serveur local sans cache
  make_demo_range.py    génère data/demo-range.json
  make_icons.py         décline les icônes depuis icons/icon-512.png
```

L'icône de l'app est une photo ; `icons/icon-512.png` en est la source, les autres
formats en sont dérivés par `make_icons.py`.

---

## Développement

Après modification d'un fichier, **incrémente `VERSION` dans `sw.js`** — sinon le service
worker continue à servir l'ancienne version depuis son cache.

Les **Réglages** comparent deux versions : celle **chargée** dans le navigateur, lue dans
le nom du cache créé par le service worker actif, et celle **publiée** sur le serveur, lue
hors cache. Quand elles diffèrent, un encadré propose la mise à jour.

Ne pas lire `sw.js` pour connaître la version active : ce fichier n'est pas mis en cache,
la requête part sur le réseau et renvoie la version du serveur. Le service worker refuse
d'ailleurs d'intercepter sa propre copie, sinon la comparaison n'aurait aucun sens.

Pendant le développement, ouvre l'app avec `?nosw` :

```
http://localhost:8765/index.html?nosw#/train
```

Cela désenregistre le service worker et vide ses caches, pour ne jamais travailler sur
des modules périmés. `tools/devserver.py` renvoie par ailleurs `Cache-Control: no-store`.

---

## Limites connues

- Le MVP couvre le préflop et le scénario **RFI** (ouverture). Les scénarios `vs open`,
  `vs 3bet`, `vs all-in` sont câblés dans le modèle de données et l'import, mais tant que
  l'Excel ne contient pas de colonne `scenario`, tout arrive en RFI.
- L'exercice **Cotes & équité** suppose que l'adversaire shove exactement ta range pour
  cette position et cette profondeur. C'est une hypothèse explicite, pas une vérité.
- Pas de postflop : pas de c-bet, pas de texture de board, pas d'ICM.
- L'import `.xlsx` dans le navigateur s'appuie sur `DecompressionStream`, absent des
  Safari antérieurs à 16.4 ; dans ce cas l'app le dit et renvoie vers le CSV ou le script
  Python.

## Pistes pour la suite

- **Estimation d'équité** : main + board affichés, tu estimes ton équité, l'app note
  l'écart. Le moteur est déjà là, il ne manque que l'écran.
- **Ranges de défense BB** : la colonne est vide dans l'Excel ; une fois remplie, l'app
  les prend sans modification.
- **Scénarios vs open / vs 3bet** : ajouter une colonne `scenario` à l'Excel suffit.
- **Mode examen** : pas de feedback avant la fin de la session, plus proche du jeu réel.
