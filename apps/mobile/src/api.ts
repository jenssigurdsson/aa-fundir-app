import type { MeetingDataset } from "./types";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api";

export async function fetchMeetings(): Promise<MeetingDataset> {
  const response = await fetch(`${API_URL}/meetings`);

  if (!response.ok) {
    throw new Error(`API villa: ${response.status}`);
  }

  return response.json() as Promise<MeetingDataset>;
}

