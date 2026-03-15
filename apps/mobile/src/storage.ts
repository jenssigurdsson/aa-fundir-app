import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ReminderPreference } from "./types";

const FAVORITES_KEY = "aa-favorites";
const REMINDERS_KEY = "aa-reminders";

export async function loadFavorites(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(FAVORITES_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function saveFavorites(favorites: string[]): Promise<void> {
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

export async function loadReminders(): Promise<ReminderPreference[]> {
  const raw = await AsyncStorage.getItem(REMINDERS_KEY);
  return raw ? (JSON.parse(raw) as ReminderPreference[]) : [];
}

export async function saveReminders(reminders: ReminderPreference[]): Promise<void> {
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

