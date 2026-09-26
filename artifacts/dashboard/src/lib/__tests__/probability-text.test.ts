import { describe, expect, it } from 'vitest';
import { percentText, probabilityText } from '../probability-text';

// Same cases as ios/AmiseMedFlowTests/ProbabilityTextTests.swift.
describe('probability text never claims certainty', () => {
  it('fractions', () => {
    expect(probabilityText(1)).toBe('>99%');
    expect(probabilityText(0.996)).toBe('>99%');
    expect(probabilityText(0.994)).toBe('99%');
    expect(probabilityText(0.42)).toBe('42%');
    expect(probabilityText(0.005)).toBe('1%');
    expect(probabilityText(0.004)).toBe('<1%');
    expect(probabilityText(0)).toBe('<1%');
    expect(probabilityText(null)).toBe('—');
    expect(probabilityText(Number.NaN)).toBe('—');
  });
  it('whole percents', () => {
    expect(percentText(100)).toBe('>99%');
    expect(percentText(99)).toBe('99%');
    expect(percentText(37)).toBe('37%');
    expect(percentText(1)).toBe('1%');
    expect(percentText(0)).toBe('<1%');
  });
});
