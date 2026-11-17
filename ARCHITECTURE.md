# Architecture technique proposée

## Stack suggérée (adaptable)

- **Frontend** : SvelteKit + TypeScript, application web mobile-first / PWA optionnelle.
- **UI** : composants accessibles, animation des cartes CSS/Web Animations ou Motion.
- **Prairie** : rendu Canvas 2D / PixiJS pour le MVP ; une version 3D (Three.js) peut être évaluée après avoir validé le gameplay. **Ne pas commencer par la 3D si elle bloque les interactions.**
- **Backend** : service Node.js TypeScript avec WebSocket (Socket.IO ou ws) et logique de jeu côté serveur. SvelteKit server ou backend séparé : décision à documenter avant implémentation.
- **Persistance MVP** : mémoire en développement + sauvegarde courte des salles et événements ; Redis si plusieurs instances. Aucune authentification requise au départ.
- **Tests** : Vitest pour moteur de règles, tests e2e pour deux clients simultanés.

Ce sont des recommandations techniques, **pas des choix définitivement validés**.

## Séparation en modules

```
src/
  lib/
    game/
      engine/              # calculs purs, pioche, validation, phases
      domain/              # types, rôles, rounds, événements
      contracts/           # schémas Zod messages client/serveur
    realtime/              # connexion, replay, reconnexion, présence
    meadow/                # rendu prairie, moutons, actions, animations
    components/
      cards/               # main, sélection, dos, pile
      voting/              # vote par swipe et boutons
      lobby/               # salle, QR, joueurs
      meadow/              # menu radial, info mouton
  routes/
    /                      # accueil
    /room/[code]           # salle + partie
    /display/[code]        # écran partagé (lecture seule)
```

**Séparation indispensable :** les animations ne décident jamais du score ; elles ne font que représenter les événements validés par le moteur côté serveur.

## Contrats WebSocket (proposition de noms)

### Client → serveur
- `room:create` : `{displayName}`
- `room:join` : `{code,displayName,resumeToken?}`
- `room:ready` : `{ready:true|false}`
- `game:start` : `{roomId}`
- `cards:submit` : `{roundId,cardIds:string[],claim:{kind:"all-sheep"|"survivors",count?:number}}`
- `vote:submit` : `{roundId,choice:"wolf"|"trust"}`
- `sheep:action` : `{sheepId,action:"jump"|"graze"|"sleep"|"bleat"|"run"|"dance"}`
- `sheep:rename` : `{sheepId,name}`

### Serveur → client
- `room:snapshot` : joueurs, phase, round, compteurs, **main du destinataire uniquement**
- `game:turn_started` : poseur et round
- `cards:played` : nombre de cartes, dos, annonce, **jamais leurs types**
- `vote:progress` : nombre de réponses reçues, pas leur contenu
- `round:revealed` : vraies cartes + votes + résolution **après** clôture
- `meadow:sheep_added` / `meadow:sheep_removed` : IDs et transitions
- `meadow:sheep_action` : ID, action et seed/timestamp pour synchronisation
- `match:ended` : résultats

Chaque événement porte `roomId`, `roundId` ou un `eventId` idempotent selon besoin. Tous les payloads sont validés par schéma côté serveur.

## Modèle de données minimal

```ts
type Animal = 'sheep' | 'wolf' | 'dog';
type Vote = 'wolf' | 'trust';
type Phase = 'lobby' | 'select' | 'voting' | 'reveal' | 'result' | 'finished';

interface Card { id: string; type: Animal; }
interface Player { id: string; displayName: string; connected: boolean; hand: Card[]; }
interface Round {
  id: string; authorPlayerId: string; submittedCardIds: string[];
  claim: { kind: 'all-sheep' } | { kind: 'survivors'; count: number };
  votes: Record<string, Vote>;
  phase: Phase;
}
interface SheepEntity { id: string; name?: string; x: number; y: number; state: string; }
```

Ne jamais sérialiser `Player.hand` complet dans un broadcast. Construire un **snapshot par destinataire**.

## Fair-play et sécurité

- Mélange et tirage côté serveur avec générateur robuste.
- Une carte ne peut être jouée si elle n'est plus dans la main du joueur.
- Votes valables seulement pour les autres joueurs, une seule fois par round, pendant la phase voting.
- Le serveur ignore les positions et scores calculés par le client.
- Rate-limit et cooldown pour sheep:action ; modération basique de noms.
- Jetons de reprise de session signés/aléatoires ; sécuriser l'accès aux salles privées.
- Ne jamais faire confiance aux déclarations du navigateur sur son identité.
- Prévoir tests d'intégrité des broadcasts et de reconnexion.

## Synchronisation des animations

Le serveur émet un **événement sémantique** (ex. `wolf_chased`, `sheep_saved`, `sheep_removed`) avec ID, ordre, départ et durée. Chaque client interpole localement. Aucun streaming de positions frame par frame par WebSocket.

Le client peut sauter instantanément à l'état final si l'animation est désactivée ou interrompue.

## Observabilité

Logs structurés des transitions de phases, compteurs de connexions, erreurs de validation, et métriques de durée des manches. Ne pas journaliser les mains privées en clair en production.

## Tests prioritaires

- Moteur pur pour toutes les combinaisons de 1 à 3 cartes.
- Tests d'événements et d'idempotence.
- Tests de deux clients connectés avec vote simultané.
- Test d'absence de fuite des mains d'autres joueurs.
- Test de reconnexion et reprise d'une manche.
- Test de charge de 8 joueurs, plus 1 display passif.
