export function normalizeDecimalInput(value: string | number): string {
  return String(value).trim().replace(/\s/g, '').replace(',', '.');
}

export function kgToGrams(value: string | number): number {
  const normalized = normalizeDecimalInput(value);
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) {
    throw new Error('Ingrese un peso valido con hasta 3 decimales.');
  }
  const [whole, decimals = ''] = normalized.split('.');
  return Number(whole) * 1000 + Number(decimals.padEnd(3, '0'));
}

export function gramsToKg(grams: number): number {
  if (!Number.isInteger(grams)) throw new Error('Los gramos deben ser un entero.');
  return grams / 1000;
}

export function bsToCents(value: string | number): number {
  const normalized = normalizeDecimalInput(value);
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Ingrese un monto valido con hasta 2 decimales.');
  }
  const [whole, decimals = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
}

export function centsToBs(cents: number): number {
  if (!Number.isInteger(cents)) throw new Error('Los centavos deben ser un entero.');
  return cents / 100;
}

export function calculateNetWeight(grossG: number, tareG: number): number {
  if (grossG <= 0) throw new Error('El peso bruto debe ser mayor que cero.');
  if (tareG < 0) throw new Error('El peso del envase no puede ser negativo.');
  if (tareG > grossG) throw new Error('El peso del envase no puede ser mayor al peso bruto.');
  return grossG - tareG;
}

export function percentage(partG: number, totalG: number): number {
  if (totalG <= 0) return 0;
  return (partG / totalG) * 100;
}

export function rendimiento(productoBuenoG: number, pesoEntregadoG: number): number {
  return percentage(productoBuenoG, pesoEntregadoG);
}

export function productividadKgHora(pesoProcesadoG: number, horasTotales: number): number {
  if (horasTotales <= 0) return 0;
  return gramsToKg(pesoProcesadoG) / horasTotales;
}

export function saldoDisponible(pesoNetoLoteG: number, entregasActivasG: number): number {
  return Math.max(0, pesoNetoLoteG - entregasActivasG);
}

export function saldoPendiente(pesoEntregadoG: number, pesoProcesadoG: number): number {
  return Math.max(0, pesoEntregadoG - pesoProcesadoG);
}

export function assertNoSobreentrega(pesoSolicitadoG: number, disponibleG: number): void {
  if (pesoSolicitadoG > disponibleG) {
    throw new Error(`No se puede entregar ${gramsToKg(pesoSolicitadoG).toFixed(2)} kg. El lote solamente tiene ${gramsToKg(disponibleG).toFixed(2)} kg disponibles.`);
  }
}

export function nextSequentialCode(prefix: string, currentMax: number, width: number): string {
  return `${prefix}${String(currentMax + 1).padStart(width, '0')}`;
}

export function hoursBetween(startDate: string, startTime: string, endDate: string, endTime: string): number {
  const start = new Date(`${startDate}T${startTime || '00:00'}:00`);
  const end = new Date(`${endDate}T${endTime || '00:00'}:00`);
  const diff = end.getTime() - start.getTime();
  return diff > 0 ? diff / 36e5 : 0;
}
