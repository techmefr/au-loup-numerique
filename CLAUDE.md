# Instructions pour Claude Code — AU LOUP !

Construire un **jeu web temps réel**, non un site marketing. Référence obligatoire : [README](README.md), [SPEC](SPEC.md), [ARCHITECTURE](ARCHITECTURE.md), [DESIGN](DESIGN.md) et [REFERENCES](REFERENCES.md).

## Ordre de développement

1. Lire l'ensemble des fichiers Markdown.
2. Décrire en 10 lignes les décisions déjà validées et les **questions encore ouvertes**. Ne pas transformer les hypothèses en règles officielles.
3. Initialiser le projet TypeScript mobile-first avec tests.
4. Implémenter d'abord le **moteur pur de résolution** Mouton/Loup/Chien et ses tests.
5. Développer les salles WebSocket, les états, le serveur autoritaire, les messages privés et la reconnexion.
6. Créer la main mobile, la sélection 1–3 cartes, le tas caché et les compteurs.
7. Implémenter le vote simultané swipe gauche/droite + boutons accessibles.
8. Implémenter la révélation commune, synchronisée, et les comptes de moutons.
9. Construire la prairie stylisée autonome (commencer simple, évoluer vers la diorama de référence).
10. Ajouter les six actions sur les moutons + renommage et diffusion des interactions.
11. Ajouter les animations de révélations douces (loup, chien, poursuite, nuage de laine).
12. Tester avec 2, 3 et 8 clients réels ; vérifier l'absence de fuite des mains.
13. Préparer le mode grand écran `/display/[code]` en lecture seule.
14. Mettre à jour documentation et checklist ; fournir des scripts de lancement simples.

## Contraintes de travail

- Ne pas inventer des cartes, rôles, objets, monnaies ou modes de jeu.
- Le mode numérique cible **2–8** joueurs, mais les règles de bluff à votes simultanés **restent à finaliser**.
- Pas de faux multiplayer : un vrai serveur et de vrais messages WebSocket.
- Pas de confiance accordée au client pour les résultats.
- Ne jamais exposer au navigateur les cartes privées des autres.
- Pas de compte obligatoire, paiement, publicité, abonnement ou analytics invasive.
- Les illustrations de la conversation ne sont pas automatiquement accessibles : utiliser des placeholders seulement provisoirement et clairement les signaler.
- Ne pas déclarer « terminé » tant que tests de connexion, vote, révélation, animation et reconnexion n'ont pas été exécutés.
- Favoriser les petites PR/commits logiques, avec tests.
- Ne pas copier l'identité visuelle des livrets de jeux pris comme références.

## Definition of done MVP

- Salle réelle, deux joueurs minimum, URL de partage.
- Main secrète, pose et compteur synchronisés.
- Swipe de vote et boutons alternatifs.
- Votes non révélés avant clôture.
- Résolution correctement calculée par serveur.
- Prairie vivante avec moutons touchables + six actions synchronisées.
- Transformation enfantine des loups / chiens et poursuite du chien.
- Mode réduction des animations et mute.
- Test e2e 2 clients + test multiroom + test reconnect.
- Documentation de démarrage local et de déploiement.

## Démarrage suggéré

- Faire une maquette simple de l'écran de main et de la prairie.
- Écrire les tests du moteur de règles avant de développer les animations.
- Mettre les choix ouverts en configuration, avec valeurs de **démo** documentées.
- Demander à l'auteur une validation explicite des règles de pénalité des votes avant de les publier comme définitives.
