# Direction artistique et expérience — AU LOUP !

## Référence centrale

**Univers déjà créé :** prairies claires et lumineuses, animaux tout ronds, loups et chiens déguisés en moutons, arbres en boules, ruisseau bleu, chemin beige, fleurs et lumière douce. Des illustrations de cartes et un fascicule illustré existent dans la conversation originale.

Visuel de la prairie partagé par l'auteur : maquette vue du dessus avec moutons blancs répartis dans des champs verts, rivière à gauche, chemin au milieu, arbres en périphérie.

**Révélations souhaitées :** mouton déguisé qui se transforme en loup ou en chien, chien qui poursuit le loup, petit troupeau qui réagit ; **style amusant, jamais violent**.

## Palette indicative (à ajuster avec les assets originaux)

- Herbe #8FC765 / ombres #6BA34C
- Vert forêt #2F613F
- Papier crème #FFF1D3
- Brun bois #8E623B
- Accent alerte #B74733
- Eau #4F9DD7
- Laine #FFF5DB

Typographie : titres généreux et chaleureux, texte UI très lisible. Ne pas imiter un dashboard SaaS ni un site corporate ; l'UI doit ressembler à un petit jeu illustré.

## Plan de l'interface

### Mobile en portrait
1. Petite barre salon, phase, compteurs.
2. Fenêtre de prairie en haut (tap pour plein écran).
3. Zone de pile cachée et nombre de cartes.
4. Main privée de 3–N cartes en éventail ; sélection visuelle avec légère levée des cartes.
5. CTA en bas pour jouer, puis interface de vote sur la pile.
6. Le menu radial d'un mouton doit se placer sans sortir de l'écran ; prévoir version liste accessible.

### Affichage partagé (tablette / télévision)
- Prairie plein cadre, moutons animés, compteur de moutons sauvés, état de la manche, petit encart du poseur et de la pile.
- Jamais de main privée, jamais de révélation anticipée.

## Interactions de cartes
- Carte 63:88 en ratio proche du format physique.
- Même dos illustré (mouton vu du dessus).
- Sélection de 1 à 3 cartes avec feedback de position et son discret.
- Confirmation → animation des cartes qui rejoignent le tas face cachée.
- Vote : swipe gauche « AU LOUP ! » rouge chaleureux, swipe droit « Je valide » vert forêt.
- Alternatives boutons pour accessibilité ; ne pas baser l'interface uniquement sur la couleur.

## Menu radial sur mouton
- **Sauter** : petit bond, laine qui rebondit.
- **Brouter** : tête baissée, herbe qui bouge.
- **Dormir** : se couche, bulle Zzz.
- **Bêler** : mini bulle « Bêêê ! » + son doux optionnel.
- **Courir** : trottine sur quelques mètres.
- **Danser** : mouvements latéraux rigolos.

Interaction facultative, jamais un pouvoir ni une information de gameplay.

## Séquences de révélation (storyboard)

1. Avant révélation : trois cartes mouton retournées, suspense doux.
2. **Loup révélé** : déguisement de laine explose en confettis de coton, loup malicieux, réactions des moutons.
3. **Chien révélé** : son déguisement tombe, il aboie gentiment.
4. **Chien chasse le loup** : poursuite cartoonesque courte et non agressive.
5. **Mouton perdu** : nuage de laine / petit tourbillon, disparition sans blessure.
6. **Mouton sauvé** : arrive en sautillant et peut recevoir un prénom.
7. Résumé : nombre de moutons sauvés et perdus, votes révélés et effets.

Durée cible : 3–6 secondes par séquence complète, réglage rapide / passer l'animation ; **ce sont des valeurs de design proposées**.

## Contrôle qualité visuel
- Prairie reconnaissable même sur écran de 360px de large.
- Éviter les animaux minuscules impossibles à sélectionner ; zones tactiles généreuses.
- Animations 30–60 FPS selon matériel, dégradation gracieuse.
- Mode sans sons et réduction des mouvements.
- S'assurer que les moutons, chiens et loups restent distincts quand révélés.
- Cohérence totale entre cartes, livret et scène 3D/2D.

## Attention aux images
Les illustrations conversationnelles peuvent servir de **références artistiques**. Le développeur doit importer les véritables assets source lorsqu'ils sont disponibles, sans prétendre qu'un nom de fichier Markdown est un asset présent dans le dépôt. Ne pas réutiliser d'images trouvées sur internet sans vérifier leur licence.
