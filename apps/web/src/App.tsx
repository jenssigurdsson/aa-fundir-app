import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import { fetchMeetings } from "./api";
import { loadFavorites, saveFavorites } from "./storage";
import { buildIcsDownload, distanceKm, formatMeetingTime } from "./utils";
import type { Coordinates, Meeting } from "./types";

const DEFAULT_CENTER: [number, number] = [64.1355, -21.8954];
const DEFAULT_ZOOM = 10;
const SELECTED_MEETING_ZOOM = 11;

export default function App() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");
  const [weekday, setWeekday] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      try {
        const dataset = await fetchMeetings();
        setMeetings(dataset.meetings);
        setFavorites(loadFavorites());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Ekki tókst að hlaða gögnum");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  const regions = useMemo(
    () => ["all", ...Array.from(new Set(meetings.map((meeting) => meeting.region).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "is"))],
    [meetings],
  );

  const weekdays = useMemo(
    () => ["all", ...Array.from(new Set(meetings.map((meeting) => meeting.dayLabel).filter(Boolean))).sort((a, b) => a.localeCompare(b, "is"))],
    [meetings],
  );

  const filteredMeetings = useMemo(() => {
    const query = search.trim().toLowerCase();

    let result = meetings.filter((meeting) => {
      const matchesQuery =
        query.length === 0 ||
        [
          meeting.name,
          meeting.location,
          meeting.address,
          meeting.region ?? "",
          meeting.country ?? "",
          meeting.notes ?? "",
          meeting.tags.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesRegion = region === "all" || meeting.region === region;
      const matchesWeekday = weekday === "all" || meeting.dayLabel === weekday;
      const matchesFavorite = !favoritesOnly || favorites.includes(meeting.id);

      return matchesQuery && matchesRegion && matchesWeekday && matchesFavorite;
    });

    if (userLocation) {
      result = [...result].sort((a, b) => {
        const distanceA = a.coordinates ? distanceKm(userLocation, a.coordinates) : Number.POSITIVE_INFINITY;
        const distanceB = b.coordinates ? distanceKm(userLocation, b.coordinates) : Number.POSITIVE_INFINITY;
        return distanceA - distanceB;
      });
    }

    return result;
  }, [favorites, favoritesOnly, meetings, region, search, userLocation, weekday]);

  const selectedMeeting = filteredMeetings.find((meeting) => meeting.id === selectedMeetingId) ?? null;

  const mapMeetings = filteredMeetings.filter((meeting) => meeting.coordinates);
  const mapCenter: [number, number] = selectedMeeting?.coordinates
    ? [selectedMeeting.coordinates.lat, selectedMeeting.coordinates.lng]
    : DEFAULT_CENTER;
  const mapZoom = selectedMeeting?.coordinates ? SELECTED_MEETING_ZOOM : DEFAULT_ZOOM;

  function toggleFavorite(meetingId: string) {
    const next = favorites.includes(meetingId)
      ? favorites.filter((favoriteId) => favoriteId !== meetingId)
      : [...favorites, meetingId];

    setFavorites(next);
    saveFavorites(next);
  }

  function locateUser() {
    if (!navigator.geolocation) {
      setError("Vafrinn styður ekki staðsetningu.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setError(null);
      },
      () => setError("Ekki tókst að lesa staðsetningu tækisins."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="page-shell">
      <header className="hero">
        <div className="hero-copy">
   <p className="kicker">AA Fundir á Íslandi</p>
<h1>Finndu næsta fund</h1>
<p className="hero-text">
  Skoðaðu fundi á korti, síaðu eftir degi og staðsetningu og vistaðu þá sem skipta þig máli.
</p>

          <div className="hero-stats">
            <div>
              <span>{meetings.length}</span>
              <p>fundir</p>
            </div>
            <div>
              <span>{regions.length - 1}</span>
              <p>svæði</p>
            </div>
            <div>
              <span>{favorites.length}</span>
              <p>vistaðir</p>
            </div>
          </div>
        </div>
      </header>

      <main className="dashboard">
        <section className="filters">
          <div className="filter-card search-card">
            <label htmlFor="search">Leita</label>
            <input
              id="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Fundur, staður, borg eða tag"
            />
          </div>

          <div className="filter-card">
            <label htmlFor="region">Svæði</label>
            <select id="region" value={region} onChange={(event) => setRegion(event.target.value)}>
              {regions.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "Öll svæði" : item}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-card">
            <label htmlFor="weekday">Dagur</label>
            <select id="weekday" value={weekday} onChange={(event) => setWeekday(event.target.value)}>
              {weekdays.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "Allir dagar" : item}
                </option>
              ))}
            </select>
          </div>

          <button className="filter-card action-card" onClick={() => setFavoritesOnly((value) => !value)}>
            <span>{favoritesOnly ? "Sýni aðeins vistaða" : "Sýna vistaða fundi"}</span>
            <small>{favorites.length} fundir í uppáhaldi</small>
          </button>

          <button className="filter-card action-card accent" onClick={locateUser}>
            <span>{userLocation ? "Raða eftir nálægð" : "Finna fundi nálægt mér"}</span>
            <small>{userLocation ? "Staðsetning virk" : "Notar geolocation í vafra"}</small>
          </button>
        </section>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <div className="loading-state">Sæki fundi...</div>
        ) : (
          <section className="content-grid">
            <div className="list-panel">
              <div className="panel-header">
                <div>
                  <p>Fundalisti</p>
                  <h3>{filteredMeetings.length} niðurstöður</h3>
                </div>
                <span>{selectedMeeting ? "Veldu fund á korti eða í lista" : "Engin gögn"}</span>
              </div>

              <div className="meeting-list">
                {filteredMeetings.map((meeting) => {
                  const isFavorite = favorites.includes(meeting.id);
                  const icsUrl = buildIcsDownload(meeting);
                  const distance =
                    userLocation && meeting.coordinates ? Math.round(distanceKm(userLocation, meeting.coordinates)) : null;

                  return (
                    <article
                      key={meeting.id}
                      className={`meeting-card ${selectedMeeting?.id === meeting.id ? "active" : ""}`}
                      onMouseEnter={() => setSelectedMeetingId(meeting.id)}
                    >
                      <div className="meeting-topline">
                        <span className={`format-pill ${meeting.format}`}>{meeting.format}</span>
                        <button className="ghost-button" onClick={() => toggleFavorite(meeting.id)}>
                          {isFavorite ? "Vistað" : "Vista"}
                        </button>
                      </div>

                      <h4>{meeting.name}</h4>
                      <p className="meeting-time">{formatMeetingTime(meeting)}</p>
                      <p className="meeting-place">{[meeting.location, meeting.address].filter(Boolean).join(", ")}</p>
                      {meeting.notes && <p className="meeting-notes">{meeting.notes}</p>}

                      <div className="meta-row">
                        {meeting.region && <span>{meeting.region}</span>}
                        {distance !== null && <span>{distance} km frá þér</span>}
                        {meeting.tags.slice(0, 2).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>

                      <div className="card-actions">
                        {icsUrl ? (
                          <a className="primary-link" href={icsUrl} download={`${meeting.id}.ics`}>
                            Bæta í dagatal
                          </a>
                        ) : (
                          <span className="muted-link">Dagatal óvirkt fyrir þennan fund</span>
                        )}
                        <a className="secondary-link" href={meeting.sourcePage} target="_blank" rel="noreferrer">
                          Uppruni á aa.is
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="map-panel">
              <div className="panel-header">
                <div>
                  <p>Kortayfirlit</p>
                  <h3>Fundir á korti</h3>
                </div>
                <span>{mapMeetings.length} með hnit</span>
              </div>
              <MapContainer
                key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}`}
                center={mapCenter}
                zoom={mapZoom}
                scrollWheelZoom
                className="map-canvas"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {mapMeetings.map((meeting) => (
                  <CircleMarker
                    key={meeting.id}
                    center={[meeting.coordinates!.lat, meeting.coordinates!.lng]}
                    pathOptions={{
                      color: meeting.id === selectedMeeting?.id ? "#f97316" : "#155e75",
                      fillColor: meeting.id === selectedMeeting?.id ? "#fb923c" : "#0f766e",
                      fillOpacity: 0.75,
                    }}
                    radius={meeting.id === selectedMeeting?.id ? 11 : 8}
                    eventHandlers={{
                      click: () => setSelectedMeetingId(meeting.id),
                    }}
                  >
                    <Popup>
                      <strong>{meeting.name}</strong>
                      <br />
                      {formatMeetingTime(meeting)}
                      <br />
                      {[meeting.location, meeting.address].filter(Boolean).join(", ")}
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
