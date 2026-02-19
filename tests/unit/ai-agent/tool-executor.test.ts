import { describe, it, expect } from 'vitest';
import {
  sanitize,
  getAnchorPosition,
} from '@/features/ai-agent/services/tool-executor';

describe('sanitize', () => {
  it('returns empty string for empty input', () => {
    expect(sanitize('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(sanitize('hello')).toBe('hello');
  });

  it('strips simple HTML tags', () => {
    expect(sanitize('<b>bold</b>')).toBe('bold');
  });

  it('strips script tags (XSS prevention)', () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe('alert("xss")');
  });

  it('decodes &lt; and &gt; entities', () => {
    expect(sanitize('&lt;div&gt;')).toBe('<div>');
  });

  it('trims whitespace', () => {
    expect(sanitize('  spaced  ')).toBe('spaced');
  });

  it('decodes &amp;, &quot;, and &#x27; entities', () => {
    expect(sanitize('&amp;&quot;&#x27;')).toBe('&"\'');
  });

  it('strips nested HTML tags', () => {
    expect(sanitize('<div><span>text</span></div>')).toBe('text');
  });

  it('converts literal backslash-n to actual newlines', () => {
    expect(sanitize('line1\\nline2')).toBe('line1\nline2');
  });

  it('converts multiple literal backslash-n sequences', () => {
    expect(sanitize('a\\nb\\nc')).toBe('a\nb\nc');
  });
});

describe('getAnchorPosition', () => {
  it('returns top-center for "top"', () => {
    expect(getAnchorPosition(0, 0, 100, 80, 'top')).toEqual({ x: 50, y: 0 });
  });

  it('returns right-center for "right"', () => {
    expect(getAnchorPosition(0, 0, 100, 80, 'right')).toEqual({
      x: 100,
      y: 40,
    });
  });

  it('returns bottom-center for "bottom"', () => {
    expect(getAnchorPosition(0, 0, 100, 80, 'bottom')).toEqual({
      x: 50,
      y: 80,
    });
  });

  it('returns left-center for "left"', () => {
    expect(getAnchorPosition(0, 0, 100, 80, 'left')).toEqual({ x: 0, y: 40 });
  });

  it('returns center for unknown side (default)', () => {
    expect(getAnchorPosition(0, 0, 100, 80, 'center')).toEqual({
      x: 50,
      y: 40,
    });
  });

  it('handles "top-50" alias same as "top"', () => {
    expect(getAnchorPosition(10, 20, 100, 80, 'top-50')).toEqual({
      x: 60,
      y: 20,
    });
  });

  it('handles "right-50" alias same as "right"', () => {
    expect(getAnchorPosition(10, 20, 100, 80, 'right-50')).toEqual({
      x: 110,
      y: 60,
    });
  });

  it('handles "bottom-50" with offset origin', () => {
    expect(getAnchorPosition(10, 20, 100, 80, 'bottom-50')).toEqual({
      x: 60,
      y: 100,
    });
  });

  it('handles "left-50" with offset origin', () => {
    expect(getAnchorPosition(10, 20, 100, 80, 'left-50')).toEqual({
      x: 10,
      y: 60,
    });
  });
});
