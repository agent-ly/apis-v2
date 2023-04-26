const formatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export const toCoins = (value: number, rate: number) =>
  parseFloat(formatter.format(value / rate));

export const toRate = (value: number) => parseFloat(formatter.format(value));
