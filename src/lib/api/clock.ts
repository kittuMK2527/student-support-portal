let fixed: Date | null = null;
export const now = (): Date => (fixed ? new Date(fixed) : new Date());
export const nowIso = (): string => now().toISOString();
export const setClock = (d: Date | null) => {
  fixed = d ? new Date(d) : null;
};
export const daysAgo = (n: number, from = new Date()) => new Date(from.getTime() - n * 864e5);
