import { describe, expect, it } from 'vitest';
import {
  assertNoSobreentrega,
  calculateNetWeight,
  gramsToKg,
  kgToGrams,
  nextSequentialCode,
  productividadKgHora,
  rendimiento,
  saldoDisponible,
  saldoPendiente
} from '../shared/calculations';

describe('calculos centrales', () => {
  it('convierte kg a gramos', () => {
    expect(kgToGrams('10,250')).toBe(10250);
    expect(kgToGrams('0.100')).toBe(100);
  });

  it('convierte gramos a kg', () => {
    expect(gramsToKg(10250)).toBe(10.25);
  });

  it('calcula peso neto', () => {
    expect(calculateNetWeight(120000, 5000)).toBe(115000);
  });

  it('calcula rendimiento', () => {
    expect(rendimiento(80000, 100000)).toBe(80);
  });

  it('calcula productividad', () => {
    expect(productividadKgHora(30000, 2)).toBe(15);
  });

  it('calcula saldo disponible', () => {
    expect(saldoDisponible(100000, 35000)).toBe(65000);
  });

  it('calcula saldo pendiente', () => {
    expect(saldoPendiente(40000, 12500)).toBe(27500);
  });

  it('genera codigos correlativos', () => {
    expect(nextSequentialCode('TRA-', 2, 3)).toBe('TRA-003');
    expect(nextSequentialCode('ENT-', 41, 6)).toBe('ENT-000042');
  });

  it('valida sobreentrega', () => {
    expect(() => assertNoSobreentrega(120000, 85500)).toThrow('85.50 kg disponibles');
  });
});
