import { describe, expect, it } from 'vitest';
import { addMonths, fromInputValue, monthGrid, toInputValue } from './dates';

describe('dates', () => {
  it('converteix entre Date i el valor d\'un datetime-local', () => {
    const date = new Date(2030, 5, 15, 9, 5);
    expect(toInputValue(date)).toBe('2030-06-15T09:05');
    expect(fromInputValue('2030-06-15T09:05').getTime()).toBe(date.getTime());
    expect(fromInputValue('')).toBeNull();
  });

  it('suma mesos canviant d\'any', () => {
    expect(addMonths('2030-12', 1)).toBe('2031-01');
    expect(addMonths('2030-01', -1)).toBe('2029-12');
  });

  it('la graella del mes comença en dilluns', () => {
    // L'1 de juny de 2030 és dissabte: 5 buits (dl–dv) abans.
    const grid = monthGrid('2030-06');
    expect(grid.slice(0, 6)).toEqual([null, null, null, null, null, '2030-06-01']);
    expect(grid.at(-1)).toBe('2030-06-30');
  });
});
