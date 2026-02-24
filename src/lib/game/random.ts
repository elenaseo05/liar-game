export function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) {
    return 0;
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % maxExclusive;
  }

  return Math.floor(Math.random() * maxExclusive);
}

export function pickOne<T>(items: readonly T[]): T {
  return items[randomInt(items.length)];
}
