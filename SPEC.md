# Spécification fonctionnelle — AU LOUP ! numérique

## 1. Utilisateurs et écrans

### A. Accueil
- Titre AU LOUP !, ambiance prairie, boutons **Créer une partie**, **Rejoindre une partie**, **Comment jouer**.
- Pas de connexion nécessaire. Pseudonyme et avatar mouton non identifiants.
- Choix accessibilité (sons, animations réduites).

### B. Salle
- Création d'un code court / lien partageable / QR code.
- Participants et présence en temps réel (connecté, déconnecté, prêt).
- Hôte : lancement, fermeture, paramètres de test (max joueurs, durée de vote).
- Salon public uniquement à ses membres ; pas de recherche de salons dans MVP.
- Compteurs 2–8 joueurs, pas de démarrage au-delà.

### C. Main du joueur
- Prairie miniature visible, réduite si nécessaire.
- Cartes de main visibles **uniquement** sur le téléphone de leur propriétaire ; sélection tactile multiple 1 à 3.
- Pile personnelle de cartes jouées **face cachée**, avec compteur visible.
- Pioche restante (nombre), main propre (nombre) et nombre de cartes des autres joueurs.
- Action « Jouer 1/2/3 cartes » avec confirmation.
- Après confirmation, les cartes sortent de la main avec mouvement vers le tas ; même dos de carte sur tous les écrans.
- Les autres joueurs voient uniquement le nombre de cartes déposées et l'annonce, jamais leurs faces.

### D. Vote
- Une pile de cartes *dos mouton* au milieu ; nombre annoncé, nom du poseur.
- Glisser à **gauche** = « AU LOUP ! », à **droite** = « Je valide ».
- Accessible sans geste via deux boutons équivalents.
- Chaque joueur ne vote qu'une fois (sauf changement explicitement autorisé par configuration).
- Vote privé. État public « 3/4 joueurs ont voté », **pas** les choix.
- L'auteur de la pose ne vote pas contre lui-même.
- Au dernier vote : verrouillage + révélation collective. Timeout configurable avec gestion explicite (ne pas inventer un vote silencieux).

### E. Prairie partagée
- Top-down légèrement isométrique ; chemin, rivière, arbres, fleurs.
- Petits moutons individualisés (ID stable et prénom facultatif).
- Clic/tap sur un mouton : menu radial **Sauter**, **Brouter**, **Dormir**, **Bêler**, **Courir**, **Danser**.
- Les moutons sont autonomes : marcher, brouter, se regrouper, dormir ; comportement local déterministe ou animé, sans effet sur score.
- Voir les actions des autres via serveur, mais avec cooldown pour éviter spam réseau/audio.
- Les loups/chiens cachés ne doivent pas avoir d'animation distincte avant révélation.
- Pendant révélation : passage à la scène de la bergerie, transformations et poursuite enfantine.
- Moutons sauvés rejoignent la prairie ; moutons mangés disparaissent via nuage de laine rigolo (jamais gore).
- Interaction de renommage de mouton : champ court, filtre basique et édition limitée au créateur/organisateur (décision configurable).

### F. Fin
- Résultat du round et du match, votes et révélations dans un historique simple.
- Boutons **Rejouer**, **Retour à la salle**.
- Pas de création de comptes ni de classement mondial.

## 2. Règles issues du jeu physique

### Cartes
| Type | Quantité | Effet à la révélation |
|---|---:|---|
| Mouton | 36 | +1 mouton potentiellement sauvé |
| Loup déguisé | 16 | mange 1 mouton après annulation des loups par les chiens |
| Chien déguisé | 8 | chasse 1 loup |
| Total | 60 | dos strictement identiques |

**Résolution** d'une combinaison jouée :
```
loups_restants = max(0, loups - chiens)
moutons_devores = min(moutons, loups_restants)
moutons_sauves = moutons - moutons_devores
```
Exemples :
- M + M + L = 1 sauvé, 1 dévoré
- M + L + C = 1 sauvé, 0 dévoré
- M + L + L = 0 sauvé, 1 dévoré
- M + M + C = 2 sauvés, 0 dévoré

Les loups sans mouton n'en mangent pas. Les chiens surnuméraires ne créent pas de moutons.

### Variantes d'annonce (choix avant partie, non cumulées)

**Annonce de type A — Bluff classique :** poser 1 à 3 cartes et annoncer « Ce sont des moutons ». La présence d'un loup constitue le mensonge. Un chien est autorisé comme joker.

**Annonce de type B — Compte tes moutons :** poser 1 à 3 cartes et annoncer un nombre entre 0 et 3 de moutons **survivants après résolution**. Le mensonge n'existe que si le nombre annoncé est faux.

Le mode hybride numériques à **votes simultanés** ne reprend pas automatiquement les sanctions du Menteur traditionnel (ramasser la pile), puisqu'il peut y avoir plusieurs accusateurs. C'est une **règle nouvelle à définir en test**.

## 3. Phases et transitions

```
LOBBY
  └─ host.start ─→ DEAL
DEAL
  └─ ready ─→ PLAYER_SELECTS
PLAYER_SELECTS
  └─ cards.submit ─→ VOTING
VOTING
  └─ allEligibleVotesReceived ─→ REVEAL
REVEAL
  └─ animationAck / timeout ─→ ROUND_RESULT
ROUND_RESULT
  ├─ matchEnded ─→ GAME_OVER
  └─ continue ─→ PLAYER_SELECTS
GAME_OVER
  └─ playAgain ─→ DEAL
```

Le serveur attribue un identifiant unique à chaque round, joue une seule fois chaque transition, et conserve un journal des événements.

## 4. Cas limites

- Double tap sur Jouer : une seule pose validée.
- Double vote, votes tardifs, votes de l'auteur, requêtes d'une autre salle : rejet.
- Déconnexion pendant un vote : maintien de la partie ; timeout avec **politique explicite et configurable**, sans autovalidation silencieuse.
- Déconnexion de l'hôte : reprise / transfert après délai ; pas de suppression immédiate.
- Joueur rejoignant pendant la partie : spectateur ou attente de prochaine manche, jamais accès aux mains.
- Pioche vide : pas de repioche ; fin de partie décidée par la règle sélectionnée.
- Appareil lent : réduire les effets visuels sans modifier le résultat serveur.
- Collision de prénoms de moutons : autorisée avec ID unique.
- Clavier/souris, lecteur d'écran et contraste : interaction équivalente au swipe.

## 5. Critères d'acceptation

- Deux téléphones ouvrent une salle et voient les joueurs en temps réel.
- Les cartes privées du joueur A sont **absentes** des messages envoyés à B.
- Un joueur choisit 1, 2 ou 3 cartes ; le tas et tous les compteurs sont à jour.
- Chaque non-poseur vote gauche ou droite ; aucun choix n'est révélé avant clôture.
- Au dernier vote, toutes les sessions montrent **la même combinaison** et le même résultat.
- La résolution M/L/C est testée avec les 27 combinaisons possibles de 0–3 cartes (en excluant la pose vide).
- Les moutons sauvés apparaissent dans la prairie.
- Toucher un mouton permet 6 actions ; tous les écrans les voient.
- La reconnexion réhydrate l'état autorisé, sans changer la donne.
- Le mode à mouvement réduit désactive les poursuites sans masquer les résultats.
- Un seul écran mobile suffit ; une TV rejoint en affichage lecture seule.
