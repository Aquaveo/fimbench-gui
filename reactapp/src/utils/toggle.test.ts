import { describe, it, expect } from 'vitest';
import { toggleInSet, toggleInArray } from './toggle';

describe('toggleInSet', () => {
  it('adds a value that is not in the set', () => {
    const result = toggleInSet(new Set(['a', 'b']), 'c');
    expect(result.has('c')).toBe(true);
    expect(result.size).toBe(3);
  });

  it('removes a value that is already in the set', () => {
    const result = toggleInSet(new Set(['a', 'b']), 'a');
    expect(result.has('a')).toBe(false);
    expect(result.size).toBe(1);
  });

  it('does not mutate the original set', () => {
    const original = new Set(['a', 'b']);
    toggleInSet(original, 'c');
    expect(original.size).toBe(2);
  });

  it('adds to an empty set', () => {
    const result = toggleInSet(new Set(), 'x');
    expect([...result]).toEqual(['x']);
  });

  it('removing the only element produces an empty set', () => {
    const result = toggleInSet(new Set(['x']), 'x');
    expect(result.size).toBe(0);
  });
});

describe('toggleInArray', () => {
  it('appends a value not in the array', () => {
    expect(toggleInArray(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });

  it('removes a value that is in the array', () => {
    expect(toggleInArray(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('does not mutate the original array', () => {
    const original = ['a', 'b'];
    toggleInArray(original, 'c');
    expect(original).toEqual(['a', 'b']);
  });

  it('works on an empty array', () => {
    expect(toggleInArray([], 'x')).toEqual(['x']);
  });

  it('removing the only element produces an empty array', () => {
    expect(toggleInArray(['x'], 'x')).toEqual([]);
  });

  it('preserves order of remaining elements', () => {
    expect(toggleInArray(['a', 'b', 'c', 'd'], 'b')).toEqual(['a', 'c', 'd']);
  });
});
