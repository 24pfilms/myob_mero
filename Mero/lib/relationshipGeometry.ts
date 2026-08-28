export interface RelationshipCard {
  itemId: string;
  noteId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenCard extends RelationshipCard {
  centerX: number;
  centerY: number;
}

export interface RelationshipPair {
  left: ScreenCard;
  right: ScreenCard;
  score: number;
}

export function visibleCards(cards: RelationshipCard[], viewport: { width: number; height: number }, panZoom: { x: number; y: number; k: number }, limit = 50): ScreenCard[] {
  const margin = 120;
  return cards.flatMap(card => {
    const left = card.x * panZoom.k + panZoom.x;
    const top = card.y * panZoom.k + panZoom.y;
    const width = card.width * panZoom.k;
    const height = card.height * panZoom.k;
    if (left + width < -margin || top + height < -margin || left > viewport.width + margin || top > viewport.height + margin) return [];
    return [{ ...card, centerX: left + width / 2, centerY: top + height / 2 }];
  }).slice(0, limit);
}

export function relationshipPairs(cards: ScreenCard[], ids: string[], matrix: number[][], threshold: number): RelationshipPair[] {
  const index = new Map(ids.map((id, position) => [id, position]));
  const pairs: RelationshipPair[] = [];
  for (let left = 0; left < cards.length; left += 1) {
    for (let right = left + 1; right < cards.length; right += 1) {
      if (cards[left].noteId === cards[right].noteId) continue;
      const leftIndex = index.get(cards[left].noteId);
      const rightIndex = index.get(cards[right].noteId);
      const score = leftIndex === undefined || rightIndex === undefined ? NaN : matrix[leftIndex]?.[rightIndex];
      if (Number.isFinite(score) && score > 0 && score >= threshold) pairs.push({ left: cards[left], right: cards[right], score });
    }
  }
  return pairs;
}

export function cubicPath(pair: RelationshipPair): string {
  const dx = Math.abs(pair.right.centerX - pair.left.centerX) * 0.45;
  const direction = pair.right.centerX >= pair.left.centerX ? 1 : -1;
  return `M ${pair.left.centerX} ${pair.left.centerY} C ${pair.left.centerX + dx * direction} ${pair.left.centerY}, ${pair.right.centerX - dx * direction} ${pair.right.centerY}, ${pair.right.centerX} ${pair.right.centerY}`;
}
