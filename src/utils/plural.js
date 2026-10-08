/**
 * A number with its noun — "1 face", "3 faces". The plural is given rather than derived, so
 * "box / boxes" and "header box changed / header boxes changed" read right.
 */
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
