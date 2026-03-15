export type Weekday =
  | "sun"
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Meeting {
  id: string;
  name: string;
  dayLabel: string;
  weekday: Weekday | null;
  time: string | null;
  location: string;
  address: string;
  rawLocation: string;
  venue: string | null;
  country: string | null;
  city: string | null;
  streetAddress: string | null;
  region: string | null;
  meetingType: string | null;
  notes: string | null;
  tags: string[];
  coordinates: Coordinates | null;
  format: "in-person" | "phone" | "online" | "hybrid";
  sourcePage: string;
}

export interface MeetingDataset {
  source: string;
  updatedAt: string | null;
  total: number;
  meetings: Meeting[];
}

export interface ReminderPreference {
  meetingId: string;
  minutesBefore: number;
  notificationId: string;
}
