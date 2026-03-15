import type { Coordinates, Meeting } from "./types";

export function formatMeetingTime(meeting: Meeting) {
  return `${meeting.dayLabel}${meeting.time ? ` kl. ${meeting.time}` : ""}`;
}

export function buildIcsDownload(meeting: Meeting) {
  if (!meeting.weekday || !meeting.time) {
    return null;
  }

  const [hourString, minuteString] = meeting.time.split(":");
  const eventDate = nextOccurrence(meeting.weekday, Number(hourString), Number(minuteString));
  const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000);

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AA Fundir//IS",
    "BEGIN:VEVENT",
    `UID:${meeting.id}@aa-fundir`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(eventDate)}`,
    `DTEND:${toIcsDate(endDate)}`,
    `SUMMARY:${escapeIcs(meeting.name)}`,
    `DESCRIPTION:${escapeIcs([meeting.venue, meeting.notes].filter(Boolean).join(" · "))}`,
    `LOCATION:${escapeIcs([meeting.location, meeting.address].filter(Boolean).join(", "))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
}

export function distanceKm(from: Coordinates, to: Coordinates) {
  const earthRadiusKm = 6371;
  const dLat = degToRad(to.lat - from.lat);
  const dLng = degToRad(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degToRad(from.lat)) * Math.cos(degToRad(to.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

function nextOccurrence(weekday: Meeting["weekday"], hour: number, minute: number) {
  const targetDay = weekdayToJsIndex(weekday);
  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);

  let daysToAdd = (targetDay - candidate.getDay() + 7) % 7;
  if (daysToAdd === 0 && candidate <= now) {
    daysToAdd = 7;
  }

  candidate.setDate(candidate.getDate() + daysToAdd);
  return candidate;
}

function weekdayToJsIndex(weekday: Meeting["weekday"]) {
  switch (weekday) {
    case "sun":
      return 0;
    case "mon":
      return 1;
    case "tue":
      return 2;
    case "wed":
      return 3;
    case "thu":
      return 4;
    case "fri":
      return 5;
    case "sat":
      return 6;
    default:
      return 0;
  }
}

function toIcsDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
