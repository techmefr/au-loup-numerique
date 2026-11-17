# AU LOUP ! — Jeu numérique multijoueur

**Statut : spécification v0.1, prototype à construire avec Claude Code**  
**Univers : prairie miniature vivante, douce, lisible, adaptée aux enfants**  
**Joueurs : 2 à 8 · Age ciblé : 6 ans et plus · Application : web mobile + écran partagé optionnel**

> Une carte peut sembler être un mouton… puis se révéler être un loup ou un chien. On bluffe sur téléphone, on vote par glissement et on découvre les conséquences dans une prairie animée.

## Vision

Adapter **AU LOUP !** au jeu numérique, sans remplacer le jeu de société physique. Les joueurs rejoignent une salle via code ou QR, voient **leur propre main** et **leur tas de cartes**, sélectionnent **1 à 3 cartes**, les jouent face cachée, puis **les autres joueurs votent simultanément** en faisant glisser la pile vers la gauche (*AU LOUP !*) ou la droite (*Je valide*). Quand tous les votes sont arrivés, le serveur révèle les cartes et anime la prairie.

La prairie de référence est une **petite maquette 3D vue du dessus** avec de l'herbe en volume, des chemins, un cours d'eau, des arbres stylisés et de petits moutons autonomes. Les moutons peuvent être sélectionnés et recevoir des actions (sauter, brouter, dormir, bêler, courir, danser). Les autres joueurs voient les mêmes actions. Les moutons sauvés peuvent recevoir un **prénom personnalisé**.

Les effets révélés doivent rester **enfantins et non violents** :
- loup déguisé → enlève sa laine / sort du déguisement → poursuit les moutons ;
- chien déguisé → enlève sa laine → court derrière le loup → le fait fuir ;
- mouton dévoré → **disparaît dans une petite poussière de laine / un nuage rigolo**, sans blessure, sang, os ou animation traumatisante ;
- mouton sauvé → arrive en sautillant dans le troupeau ;
- tous les moutons du décor restent expressifs (petits sons, réactions, mouvements de groupe).

## Portée initiale

**MVP : un seul mode numérique de bluff collectif**. Ne pas implémenter d'office les six modes du jeu physique. Garder une architecture capable d'en ajouter, mais aucune règle non décidée ne doit être présentée comme définitive.

1. Créer/rejoindre une salle par code court + QR.
2. Démarrer une partie à 2–8 joueurs.
3. Distribuer une main numérique privée (cartes Mouton, Loup déguisé, Chien déguisé).
4. Afficher main privée, compteur de cartes en main, compteur du tas posé et compteur de pioche.
5. Sélectionner 1 à 3 cartes ; les déposer en pile face cachée.
6. Afficher l'annonce du poseur (ex. « Je pose 2 moutons ! » ou « 1 mouton sauvé ! » selon la variante réglée par la partie).
7. Vote privé simultané de chaque autre joueur : gauche = **AU LOUP !**, droite = **Je valide**.
8. Attendre **tous** les votes avant de révéler la pile et les votes.
9. Résoudre : **1 chien annule 1 loup** ; **1 loup restant mange au plus 1 mouton**.
10. Jouer une animation synchronisée avec le même résultat sur chaque écran, et sur la prairie grand écran optionnelle.
11. Laisser les joueurs cliquer sur un mouton et déclencher ses animations libres, sans incidence sur le jeu.
12. Répéter jusqu'à la fin de partie ; afficher un récapitulatif.

## Principes non négociables

- **Serveur autoritaire** sur cartes, pioches, votes, résultats, score et historique.
- Aucun joueur ne reçoit la main privée d'autrui dans les messages réseau.
- Pas de fuite de l'identité cachée d'un loup ou d'un chien via les animations, sons, temps de réponse ou données client.
- **Le nombre de cartes** peut être public ; leur identité reste secrète jusqu'à la révélation.
- Éviter les effets effrayants pour les enfants de 6 ans, et proposer un mode **sons désactivés / mouvements réduits**.
- Les interactions décoratives ne doivent pas bloquer les votes ni ralentir les tours.
- Fonctionnement correct sur un seul téléphone par joueur ; affichage TV/tablette facultatif.
- Reconnexion WebSocket sans perdre son tour ni divulguer des cartes.
- **Aucun achat, compte utilisateur ni monétisation en MVP.**

## Documents

- [SPEC.md](SPEC.md) — user stories, règles, state machine, cas particuliers et critères d'acceptation
- [ARCHITECTURE.md](ARCHITECTURE.md) — architecture temps réel, contrats de messages, données et sécurité
- [DESIGN.md](DESIGN.md) — style visuel, prairie, UI, animations, accessibilité
- [CLAUDE.md](CLAUDE.md) — instructions de réalisation et séquençage pour Claude Code
- [REFERENCES.md](REFERENCES.md) — références visuelles, fichiers disponibles et provenance

## Matériel original

Le jeu physique utilise **60 cartes** (36 moutons, 16 loups, 8 chiens déguisés) et **8 jetons de rôle** (6 moutons, 2 loups). L'application doit conserver la même identité visuelle et les trois types d'animaux. Les jetons de rôle ne sont pas nécessaires dans le premier mode numérique.

## Décisions ouvertes

Le cœur de l'expérience est validé, mais **pas encore les pénalités/récompenses des votes simultanés**, le mode exact de déclaration, les conditions de victoire ni la longueur de la partie. Implémenter ces choix comme paramètres **explicites et testables**, sans les inventer comme des règles officielles. Une configuration de démonstration peut être fournie et étiquetée comme telle.
