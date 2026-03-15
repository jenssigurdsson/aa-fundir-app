import * as cheerio from "cheerio";

import type { Coordinates, Meeting, MeetingDataset, Weekday } from "./types.js";

const BASE_URL = "https://aa.is/aa-fundir/allir-fundir";
const PAGE_SIZE = 15;

const WEEKDAY_MAP: Record<string, Weekday> = {
  sunnudagur: "sun",
  mánudagur: "mon",
  þriðjudagur: "tue",
  miðvikudagur: "wed",
  fimmtudagur: "thu",
  föstudagur: "fri",
  laugardagur: "sat",
};

const WEEKDAY_ORDER: Record<Weekday, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};

const COUNTRY_NAMES = new Set([
  "Danmörk",
  "England",
  "Frakkland",
  "Írland",
  "Kanada",
  "Luxemborg",
  "Noregur",
  "Spánn",
  "Svíþjóð",
  "Tæland",
  "Þýskaland",
  "Bandaríkin",
]);

const LOCATION_REFERENCE: Record<
  string,
  { coordinates: Coordinates; region: string; country?: string; city: string }
> = {
  akureyri: {
    coordinates: { lat: 65.6825, lng: -18.0901 },
    region: "Norðurland",
    city: "Akureyri",
  },
  akranes: {
    coordinates: { lat: 64.3218, lng: -22.0749 },
    region: "Vesturland",
    city: "Akranes",
  },
  berlin: {
    coordinates: { lat: 52.52, lng: 13.405 },
    region: "Erlendis",
    country: "Þýskaland",
    city: "Berlín",
  },
  borgarnes: {
    coordinates: { lat: 64.5383, lng: -21.9206 },
    region: "Vesturland",
    city: "Borgarnes",
  },
  gardabaer: {
    coordinates: { lat: 64.0886, lng: -21.9229 },
    region: "Höfuðborgarsvæðið",
    city: "Garðabær",
  },
  grindavik: {
    coordinates: { lat: 63.8424, lng: -22.4338 },
    region: "Suðurnes",
    city: "Grindavík",
  },
  hafnarfjordur: {
    coordinates: { lat: 64.0671, lng: -21.9377 },
    region: "Höfuðborgarsvæðið",
    city: "Hafnarfjörður",
  },
  husavik: {
    coordinates: { lat: 66.0449, lng: -17.3389 },
    region: "Norðurland",
    city: "Húsavík",
  },
  kopavogur: {
    coordinates: { lat: 64.1128, lng: -21.912 },
    region: "Höfuðborgarsvæðið",
    city: "Kópavogur",
  },
  keflavik: {
    coordinates: { lat: 63.9998, lng: -22.5584 },
    region: "Suðurnes",
    city: "Keflavík",
  },
  london: {
    coordinates: { lat: 51.5072, lng: -0.1276 },
    region: "Erlendis",
    country: "England",
    city: "London",
  },
  luxemborg: {
    coordinates: { lat: 49.6116, lng: 6.1319 },
    region: "Erlendis",
    country: "Luxemborg",
    city: "Luxemborg",
  },
  mosfellsbaer: {
    coordinates: { lat: 64.1667, lng: -21.7 },
    region: "Höfuðborgarsvæðið",
    city: "Mosfellsbær",
  },
  odinsve: {
    coordinates: { lat: 55.4038, lng: 10.4024 },
    region: "Erlendis",
    country: "Danmörk",
    city: "Óðinsvé",
  },
  pattaya: {
    coordinates: { lat: 12.9236, lng: 100.8825 },
    region: "Erlendis",
    country: "Tæland",
    city: "Pattaya",
  },
  reykjavik: {
    coordinates: { lat: 64.1466, lng: -21.9426 },
    region: "Höfuðborgarsvæðið",
    city: "Reykjavík",
  },
  selfoss: {
    coordinates: { lat: 63.9331, lng: -20.9971 },
    region: "Suðurland",
    city: "Selfoss",
  },
  seltjarnarnes: {
    coordinates: { lat: 64.1531, lng: -22.0021 },
    region: "Höfuðborgarsvæðið",
    city: "Seltjarnarnes",
  },
  torreveja: {
    coordinates: { lat: 37.978, lng: -0.6822 },
    region: "Erlendis",
    country: "Spánn",
    city: "Torreveja",
  },
  vestmannaeyjar: {
    coordinates: { lat: 63.4427, lng: -20.2734 },
    region: "Suðurland",
    city: "Vestmannaeyjar",
  },
};

function normaliseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normaliseKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function parseWeekday(value: string): Weekday | null {
  return WEEKDAY_MAP[normaliseWhitespace(value).toLowerCase()] ?? null;
}

function parseTime(value: string): string | null {
  const match = normaliseWhitespace(value).match(/\b(\d{1,2}:\d{2})\b/);
  return match?.[1] ?? null;
}

function extractSegments(cell: cheerio.Cheerio<any>): string[] {
  const html = cell.find(".left").html() ?? cell.html() ?? "";

  return html
    .split(/<br\s*\/?>/i)
    .map((segment) => segment.replace(/<[^>]+>/g, " "))
    .map(normaliseWhitespace)
    .filter(Boolean);
}

function parseLocation(rawLocation: string, segments: string[]) {
  let country: string | null = null;
  let city: string | null = null;
  let streetAddress: string | null = null;

  if (segments.length >= 3 && COUNTRY_NAMES.has(segments[0])) {
    [country, city] = [segments[0], segments[1]];
    streetAddress = segments.slice(2).join(", ") || null;
  } else if (segments.length >= 2 && COUNTRY_NAMES.has(segments[0])) {
    [country, city] = [segments[0], segments[1]];
    streetAddress = segments.slice(2).join(", ") || null;
  } else if (segments.length >= 2) {
    [city] = [segments[0]];
    streetAddress = segments.slice(1).join(", ") || null;
  } else if (segments.length === 1) {
    const [firstWord, ...rest] = segments[0].split(" ");
    if (rest.length > 0 && firstWord && COUNTRY_NAMES.has(firstWord)) {
      country = firstWord;
      city = rest.join(" ");
    } else {
      city = segments[0];
    }
  }

  const key = normaliseKey(city ?? rawLocation);
  const reference = LOCATION_REFERENCE[key];

  return {
    country: country ?? reference?.country ?? null,
    city: city ?? reference?.city ?? rawLocation,
    streetAddress,
    region: reference?.region ?? (country ? "Erlendis" : null),
    coordinates: reference?.coordinates ?? null,
  };
}

function inferFormat(time: string | null, venue: string | null, rawLocation: string, groupName: string | null) {
  const joined = [venue, rawLocation, groupName].filter(Boolean).join(" ").toLowerCase();

  if (!time || joined.includes("sími")) {
    return "phone" as const;
  }

  if (joined.includes("zoom") || joined.includes("teams") || joined.includes("netfund")) {
    return "online" as const;
  }

  return "in-person" as const;
}

function rowToMeeting(row: cheerio.Cheerio<any>, sourcePage: string): Meeting | null {
  const cells = row.find("td");
  if (cells.length < 5) {
    return null;
  }

  const timeLabel = normaliseWhitespace(cells.eq(0).text());
  const rawLocation = normaliseWhitespace(cells.eq(1).text());
  const venue = normaliseWhitespace(cells.eq(2).text()) || null;
  const groupCell = cells.eq(3).clone();
  const tags = groupCell
    .find(".label")
    .toArray()
    .map((element) => normaliseWhitespace(cheerio.load(element).text()))
    .filter(Boolean);
  groupCell.find(".label").remove();
  const groupName = normaliseWhitespace(groupCell.text()) || null;
  const dayLabel = normaliseWhitespace(cells.eq(4).text());

  const locationSegments = extractSegments(cells.eq(1));
  const time = parseTime(timeLabel);
  const weekday = parseWeekday(dayLabel);
  const parsedLocation = parseLocation(rawLocation, locationSegments);
  const format = inferFormat(time, venue, rawLocation, groupName);

  const name =
    groupName ??
    venue ??
    [parsedLocation.city, parsedLocation.streetAddress].filter(Boolean).join(", ") ??
    rawLocation;

  const notes = venue && venue !== parsedLocation.streetAddress ? venue : null;

  return {
    id: slugify(`${name}-${dayLabel}-${timeLabel}-${rawLocation}`),
    name: name || "AA fundur",
    dayLabel,
    weekday,
    time,
    location: parsedLocation.city ?? rawLocation,
    address: parsedLocation.streetAddress ?? venue ?? "",
    rawLocation,
    venue,
    country: parsedLocation.country,
    city: parsedLocation.city,
    streetAddress: parsedLocation.streetAddress,
    region: parsedLocation.region,
    meetingType: groupName,
    notes,
    tags,
    coordinates: parsedLocation.coordinates,
    format,
    sourcePage,
  };
}

async function fetchPage(offset: number): Promise<string> {
  const url = offset === 0 ? BASE_URL : `${BASE_URL}?start=${offset}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "AA-Fundir-App/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Mistókst að sækja ${url}: ${response.status}`);
  }

  return response.text();
}

function parsePage(html: string, sourcePage: string): Meeting[] {
  const $ = cheerio.load(html);

  return $("table tbody tr")
    .map((_, row) => rowToMeeting($(row), sourcePage))
    .get()
    .filter((meeting): meeting is Meeting => Boolean(meeting));
}

export async function scrapeMeetings(): Promise<MeetingDataset> {
  const meetings: Meeting[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const sourcePage = offset === 0 ? BASE_URL : `${BASE_URL}?start=${offset}`;
    const html = await fetchPage(offset);
    const pageMeetings = parsePage(html, sourcePage);

    if (pageMeetings.length === 0) {
      break;
    }

    meetings.push(...pageMeetings);

    if (pageMeetings.length < PAGE_SIZE) {
      break;
    }
  }

  const dedupedMeetings = Array.from(new Map(meetings.map((meeting) => [meeting.id, meeting])).values()).sort((a, b) => {
    const weekdayA = a.weekday ? WEEKDAY_ORDER[a.weekday] : 99;
    const weekdayB = b.weekday ? WEEKDAY_ORDER[b.weekday] : 99;

    if (weekdayA !== weekdayB) {
      return weekdayA - weekdayB;
    }

    const timeOrder = (a.time ?? "").localeCompare(b.time ?? "", "is");
    if (timeOrder !== 0) {
      return timeOrder;
    }

    return a.name.localeCompare(b.name, "is");
  });

  return {
    source: BASE_URL,
    updatedAt: new Date().toISOString(),
    total: dedupedMeetings.length,
    meetings: dedupedMeetings,
  };
}
