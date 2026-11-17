export type Animal = 'sheep' | 'wolf' | 'dog';
export type Claim = { kind: 'all-sheep' } | { kind: 'survivors'; count: number };

export interface Resolution {
  sheepSaved: number;
  sheepEaten: number;
  wolvesChased: number;
  wolvesLeft: number;
}

export function resolve(cards: Animal[]): Resolution {
  const sheep = cards.filter((c) => c === 'sheep').length;
  const wolves = cards.filter((c) => c === 'wolf').length;
  const dogs = cards.filter((c) => c === 'dog').length;
  const wolvesLeft = Math.max(0, wolves - dogs);
  const sheepEaten = Math.min(sheep, wolvesLeft);
  return {
    sheepSaved: sheep - sheepEaten,
    sheepEaten,
    wolvesChased: Math.min(wolves, dogs),
    wolvesLeft,
  };
}

export function isLie(cards: Animal[], claim: Claim): boolean {
  if (claim.kind === 'all-sheep') return cards.some((c) => c === 'wolf');
  return resolve(cards).sheepSaved !== claim.count;
}
