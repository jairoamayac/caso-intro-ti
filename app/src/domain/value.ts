// Modelo de valor (docs/05-valor-riesgos-consideraciones.md §1). Mismas fórmulas que el documento.

export interface ValueInputs {
  monthlyVolume: number;
  amountPerCase: number;
  revenuePerPatient: number;
  coordinatorCost: number;
  coordinatorsReduced: number;
  denialRate: number;
  appealRate: number;
  appealSuccess: number;
  abandonRate: number;
  rotationSaving: number;
}

export const AS_IS = {
  denialRate: 0.184,
  appealRate: 0.41,
  appealSuccess: 0.31,
  abandonRate: 0.038,
  teamCost: 2_480_000,
};

export const SCENARIOS: Record<'Conservador' | 'Base' | 'Optimista', ValueInputs> = {
  Conservador: { monthlyVolume: 2400, amountPerCase: 620, revenuePerPatient: 1005, coordinatorCost: 120000, coordinatorsReduced: 3, denialRate: 0.14, appealRate: 0.7, appealSuccess: 0.33, abandonRate: 0.025, rotationSaving: 50000 },
  Base: { monthlyVolume: 2400, amountPerCase: 620, revenuePerPatient: 1005, coordinatorCost: 120000, coordinatorsReduced: 5, denialRate: 0.11, appealRate: 0.85, appealSuccess: 0.35, abandonRate: 0.015, rotationSaving: 94000 },
  Optimista: { monthlyVolume: 2400, amountPerCase: 620, revenuePerPatient: 1005, coordinatorCost: 120000, coordinatorsReduced: 6, denialRate: 0.09, appealRate: 0.9, appealSuccess: 0.38, abandonRate: 0.01, rotationSaving: 140000 },
};

export function lostToDenials(volume: number, denial: number, appeal: number, success: number, amount: number) {
  const denials = volume * denial;
  return (denials - denials * appeal * success) * amount;
}

export function computeValue(i: ValueInputs) {
  const V = i.monthlyVolume * 12;
  const asIsLost = lostToDenials(V, AS_IS.denialRate, AS_IS.appealRate, AS_IS.appealSuccess, i.amountPerCase);
  const toBeLost = lostToDenials(V, i.denialRate, i.appealRate, i.appealSuccess, i.amountPerCase);
  const labor = i.coordinatorsReduced * i.coordinatorCost;
  const denials = asIsLost - toBeLost;
  const patientsRecovered = Math.max(0, (AS_IS.abandonRate - i.abandonRate) * V);
  const abandonment = patientsRecovered * i.revenuePerPatient;
  const total = labor + denials + abandonment + i.rotationSaving;
  return {
    annualVolume: V,
    asIsLost,
    toBeLost,
    labor,
    denials,
    abandonment,
    rotation: i.rotationSaving,
    patientsRecovered,
    total,
    teamCostReductionPct: labor / AS_IS.teamCost,
  };
}

export const usd = (n: number, digits = 2) =>
  Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(digits)} M` : `$${Math.round(n / 1e3).toLocaleString('es-CO')} k`;
