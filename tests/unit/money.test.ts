import { describe, expect, it } from 'vitest';
import { centsToInput, divRound, eurosToCents, formatEuro, formatPercent, parseAmount } from '@/lib/money';

describe('parseAmount', () => {
  it.each([
    ['', 0],
    ['0', 0],
    ['12', 1200],
    ['12,5', 1250],
    ['12.5', 1250],
    ['12,50', 1250],
    ['12.50', 1250],
    ['318,47', 31847],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1234.56', 123456],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['€ 2.071,19', 207119],
    [' 36 ', 3600],
    [',5', 50],
  ])('"%s" → %i centesimi', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['abc', '12,345', '-5', '1,2,3', '12..5', '1.23.4', '12,5x'])('rifiuta "%s"', (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe('formattazione', () => {
  it('formatta in euro con separatori italiani', () => {
    expect(formatEuro(123456)).toBe('€ 1.234,56');
    expect(formatEuro(0)).toBe('€ 0,00');
    expect(formatEuro(-207119)).toBe('-€ 2.071,19');
    expect(formatEuro(123456700)).toBe('€ 1.234.567,00');
  });

  it('formatta le percentuali', () => {
    expect(formatPercent(1 / 3)).toBe('33,33%');
  });

  it('prepara i valori per i campi', () => {
    expect(centsToInput(0)).toBe('');
    expect(centsToInput(1200)).toBe('12');
    expect(centsToInput(31847)).toBe('318,47');
    expect(centsToInput(1205)).toBe('12,05');
  });
});

describe('aritmetica intera', () => {
  it('arrotonda al centesimo più vicino', () => {
    expect(divRound(100000 * 10000, 12200)).toBe(81967);
    expect(divRound(5, 2)).toBe(3);
    expect(divRound(-5, 2)).toBe(-3);
    expect(divRound(4, 3)).toBe(1);
  });

  it('converte gli euro di Excel senza errori float', () => {
    expect(eurosToCents(318.47)).toBe(31847);
    expect(eurosToCents(2071.19)).toBe(207119);
    expect(eurosToCents(0.1 + 0.2)).toBe(30);
  });
});
