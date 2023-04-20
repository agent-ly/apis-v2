export const toCoins = (robux: number, rate: number) => rate * (robux / 1e3);
export const toRate = (value: number) => parseFloat(value.toFixed(2));
