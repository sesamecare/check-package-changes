import { describe, expect, test } from 'vitest';

import { compareFiles } from './index.js';

describe('Module exports', () => {
  test('should export expected elements', () => {
    expect(typeof compareFiles).toBe('function');
  });
});
