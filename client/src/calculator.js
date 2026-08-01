export function estimateSolar(monthlyBill, tariff) {
  const safeTariff = Math.max(tariff, 1);
  const monthlyUnits = Math.max(monthlyBill, 0) / safeTariff;
  const capacityKw = Math.max(0.5, Math.round((monthlyUnits / 120) * 10) / 10);
  return {
    capacityKw,
    annualGeneration: Math.round(capacityKw * 1400),
    annualSavings: Math.round(capacityKw * 1400 * safeTariff),
    roofAreaSqFt: Math.round(capacityKw * 100)
  };
}
