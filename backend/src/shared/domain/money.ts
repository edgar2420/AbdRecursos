/** Utilidades de dinero: siempre 2 decimales, redondeo half-up sobre centavos. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sum(values: number[]): number {
  return round2(values.reduce((acc, v) => acc + v, 0));
}

export function pct(base: number, percentage: number): number {
  return round2((base * percentage) / 100);
}
