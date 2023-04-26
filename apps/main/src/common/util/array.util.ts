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

export const groupBy = <T extends Record<string, any>, K extends keyof T>(
  array: T[],
  key: K
): Map<T[K], T> =>
  array.reduce((map, item) => {
    const value = item[key];
    if (value === undefined || value === null) {
      return map;
    }
    if (map.has(value)) {
      return map;
    }
    map.set(value, item);
    return map;
  }, new Map());

export const groupAllBy = <T extends Record<string, any>, K extends keyof T>(
  array: T[],
  key: K
): Map<T[K], T[]> =>
  array.reduce((map, item) => {
    const value = item[key];
    if (value === undefined || value === null) {
      return map;
    }
    let group = map.get(value);
    if (!group) {
      group = [item];
    } else {
      group.push(item);
    }
    map.set(value, group);
    return map;
  }, new Map());
