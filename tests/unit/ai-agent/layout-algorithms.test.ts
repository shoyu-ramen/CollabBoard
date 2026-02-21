import { describe, it, expect } from 'vitest';
import { parseFlowchartSteps } from '@/features/ai-agent/services/tool-executor';

describe('parseFlowchartSteps', () => {
  it('parses numbered list', () => {
    const input = '1. Login\n2. Validate\n3. Redirect';
    expect(parseFlowchartSteps(input)).toEqual([
      'Login',
      'Validate',
      'Redirect',
    ]);
  });

  it('parses comma-separated list', () => {
    const input = 'Login, Validate, Redirect';
    expect(parseFlowchartSteps(input)).toEqual([
      'Login',
      'Validate',
      'Redirect',
    ]);
  });

  it('parses newline-separated list', () => {
    const input = 'Login\nValidate\nRedirect';
    expect(parseFlowchartSteps(input)).toEqual([
      'Login',
      'Validate',
      'Redirect',
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(parseFlowchartSteps('')).toEqual([]);
  });

  it('returns single-item array for unparseable input', () => {
    expect(parseFlowchartSteps('just one step')).toEqual([
      'just one step',
    ]);
  });
});
