export const toUnique = <T>(array: T[]): T[] => [...new Set(array)];

export const toStrs = (ints: number[]): string[] =>
  ints.map((int) => int.toString());

export const toInts = (strs: string[]): number[] =>
  strs.map((str) => parseInt(str, 10));

type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export const sumBy = <T extends Record<string, any>>(
  array: T[],
  key: KeysOfType<T, number>
): number => array.reduce((sum, item) => sum + item[key], 0);

export const pickBy = <T extends Record<string, any>, K extends keyof T>(
  array: T[],
  key: K
): T[K][] => array.map((item) => item[key]);

export const pickByPredicate = <T extends Record<string, any>, U>(
  array: T[],
  predicate: (item: T) => U
): U[] => array.map(predicate);

export const groupBy = <T extends Record<string, any>, K extends keyof T>(
  array: T[],
  key: K
): Map<T[K], T[]> =>
  array.reduce((groups, item) => {
    const value = item[key];
    let group = groups.get(value);
    if (!group) {
      group = [value];
    } else {
      group.push(value);
    }
    groups.set(value, group);
    return groups;
  }, new Map());

export const groupByPredicate = <T extends Record<string, any>, U>(
  array: T[],
  predicate: (item: T) => U
): Map<U, T[]> =>
  array.reduce((groups, item) => {
    const value = predicate(item);
    let group = groups.get(value);
    if (!group) {
      group = [value];
    } else {
      group.push(value);
    }
    groups.set(value, group);
    return groups;
  }, new Map());
