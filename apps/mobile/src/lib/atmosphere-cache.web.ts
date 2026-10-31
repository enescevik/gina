/** Browser storage can throw in private/denied-storage contexts; callers treat it as optional. */
export const atmosphereCache = {
  async getItem(key: string) { return typeof localStorage === "undefined" ? null : localStorage.getItem(key); },
  async setItem(key: string, value: string) { if (typeof localStorage !== "undefined") localStorage.setItem(key, value); },
};
