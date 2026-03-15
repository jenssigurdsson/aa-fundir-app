const FAVORITES_KEY = "aa-web-favorites";

export function loadFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function saveFavorites(favorites: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

