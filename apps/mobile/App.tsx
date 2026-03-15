import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import { fetchMeetings } from "./src/api";
import { requestNotificationPermission, removeReminder, scheduleWeeklyReminder } from "./src/notifications";
import { loadFavorites, loadReminders, saveFavorites, saveReminders } from "./src/storage";
import type { Meeting, ReminderPreference } from "./src/types";

const REMINDER_OPTIONS = [15, 30, 60];
const DEFAULT_DAY = "all";

function formatMeetingTime(meeting: Meeting) {
  return `${meeting.dayLabel}${meeting.time ? ` kl. ${meeting.time}` : ""}`;
}

function formatLabel(meeting: Meeting) {
  if (meeting.format === "phone") {
    return "Símafundur";
  }

  if (meeting.format === "online") {
    return "Netfundur";
  }

  return "Staðfundur";
}

export default function App() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [reminders, setReminders] = useState<ReminderPreference[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState(DEFAULT_DAY);
  const [savedOnly, setSavedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const [dataset, storedFavorites, storedReminders] = await Promise.all([
          fetchMeetings(),
          loadFavorites(),
          loadReminders(),
        ]);

        setMeetings(dataset.meetings);
        setFavorites(storedFavorites);
        setReminders(storedReminders);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Ekki tókst að sækja fundi");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  const days = useMemo(() => {
    const unique = Array.from(new Set(meetings.map((meeting) => meeting.dayLabel).filter(Boolean)));
    return [DEFAULT_DAY, ...unique];
  }, [meetings]);

  const filteredMeetings = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return meetings.filter((meeting) => {
      const matchesSearch =
        searchTerm.length === 0 ||
        [
          meeting.name,
          meeting.dayLabel,
          meeting.location,
          meeting.address,
          meeting.region ?? "",
          meeting.country ?? "",
          meeting.meetingType ?? "",
          meeting.tags.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm);

      const matchesDay = selectedDay === DEFAULT_DAY || meeting.dayLabel === selectedDay;
      const matchesSaved = !savedOnly || favorites.includes(meeting.id);

      return matchesSearch && matchesDay && matchesSaved;
    });
  }, [favorites, meetings, savedOnly, search, selectedDay]);

  const nextSavedMeeting = useMemo(
    () => filteredMeetings.find((meeting) => favorites.includes(meeting.id)) ?? filteredMeetings[0] ?? null,
    [favorites, filteredMeetings],
  );

  async function toggleFavorite(meetingId: string) {
    const next = favorites.includes(meetingId)
      ? favorites.filter((favoriteId) => favoriteId !== meetingId)
      : [...favorites, meetingId];

    setFavorites(next);
    await saveFavorites(next);
  }

  async function toggleReminder(meeting: Meeting, minutesBefore: number) {
    const currentReminder = reminders.find((item) => item.meetingId === meeting.id);

    if (currentReminder && currentReminder.minutesBefore === minutesBefore) {
      await removeReminder(currentReminder);
      const next = reminders.filter((item) => item.meetingId !== meeting.id);
      setReminders(next);
      await saveReminders(next);
      return;
    }

    const permissionGranted = await requestNotificationPermission();
    if (!permissionGranted) {
      Alert.alert("Áminningar óvirkar", "Forritið þarf heimild til að senda tilkynningar.");
      return;
    }

    if (currentReminder) {
      await removeReminder(currentReminder);
    }

    const reminder = await scheduleWeeklyReminder(meeting, minutesBefore);
    if (!reminder) {
      Alert.alert("Áminning ekki möguleg", "Þessi fundur vantar skýran vikudag eða tíma.");
      return;
    }

    const next = [...reminders.filter((item) => item.meetingId !== meeting.id), reminder];
    setReminders(next);
    await saveReminders(next);
  }

  function renderMeeting({ item }: { item: Meeting }) {
    const isFavorite = favorites.includes(item.id);
    const reminder = reminders.find((entry) => entry.meetingId === item.id);
    const accentStyle =
      item.format === "phone"
        ? styles.cardTonePhone
        : item.format === "online"
          ? styles.cardToneOnline
          : styles.cardToneInPerson;

    return (
      <View style={[styles.card, accentStyle]}>
        <View style={styles.cardTopline}>
          <View style={styles.badgeRow}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{formatLabel(item)}</Text>
            </View>
            {item.region ? (
              <View style={styles.softBadge}>
                <Text style={styles.softBadgeText}>{item.region}</Text>
              </View>
            ) : null}
          </View>

          <Pressable
            style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
            onPress={() => toggleFavorite(item.id)}
          >
            <Text style={[styles.favoriteButtonText, isFavorite && styles.favoriteButtonTextActive]}>
              {isFavorite ? "Vistað" : "Vista"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardTime}>{formatMeetingTime(item)}</Text>
        <Text style={styles.cardPlace}>{[item.location, item.address].filter(Boolean).join(", ")}</Text>

        {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}

        {(item.meetingType || item.tags.length > 0) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metaChipRow}
          >
            {item.meetingType ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{item.meetingType}</Text>
              </View>
            ) : null}
            {item.tags.map((tag) => (
              <View key={`${item.id}-${tag}`} style={styles.metaChip}>
                <Text style={styles.metaChipText}>{tag}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reminderRow}
        >
          {REMINDER_OPTIONS.map((minutes) => {
            const active = reminder?.minutesBefore === minutes;

            return (
              <Pressable
                key={`${item.id}-${minutes}`}
                style={[styles.reminderChip, active && styles.reminderChipActive]}
                onPress={() => toggleReminder(item, minutes)}
              >
                <Text style={[styles.reminderChipText, active && styles.reminderChipTextActive]}>
                  {active ? `Áminning ${minutes} mín` : `${minutes} mín áður`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />

      <FlatList
        data={loading || error ? [] : filteredMeetings}
        keyExtractor={(item) => item.id}
        renderItem={renderMeeting}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <View style={styles.heroGlowLeft} />
              <View style={styles.heroGlowRight} />
              <Text style={styles.eyebrow}>AA Fundir</Text>
              <Text style={styles.title}>Fallegra app fyrir fundi, val og áminningar</Text>
              <Text style={styles.subtitle}>
                Veldu fundi sem skipta máli, síaðu eftir degi og hafðu næsta fund alltaf við höndina.
              </Text>

              <View style={styles.heroStats}>
                <View style={styles.heroStatCard}>
                  <Text style={styles.heroStatValue}>{meetings.length}</Text>
                  <Text style={styles.heroStatLabel}>fundir</Text>
                </View>
                <View style={styles.heroStatCard}>
                  <Text style={styles.heroStatValue}>{favorites.length}</Text>
                  <Text style={styles.heroStatLabel}>vistaðir</Text>
                </View>
                <View style={styles.heroStatCard}>
                  <Text style={styles.heroStatValue}>{reminders.length}</Text>
                  <Text style={styles.heroStatLabel}>áminningar</Text>
                </View>
              </View>
            </View>

            <View style={styles.panel}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Leita eftir fundi, stað eða tagi"
                placeholderTextColor="#7b8783"
                style={styles.searchInput}
              />

              <View style={styles.segmentedRow}>
                <Pressable
                  style={[styles.segmentButton, !savedOnly && styles.segmentButtonActive]}
                  onPress={() => setSavedOnly(false)}
                >
                  <Text style={[styles.segmentText, !savedOnly && styles.segmentTextActive]}>Allt</Text>
                </Pressable>
                <Pressable
                  style={[styles.segmentButton, savedOnly && styles.segmentButtonActive]}
                  onPress={() => setSavedOnly(true)}
                >
                  <Text style={[styles.segmentText, savedOnly && styles.segmentTextActive]}>Vistað</Text>
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipRow}
              >
                {days.map((day) => {
                  const active = selectedDay === day;
                  const label = day === DEFAULT_DAY ? "Allir dagar" : day;

                  return (
                    <Pressable
                      key={day}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => setSelectedDay(day)}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {nextSavedMeeting ? (
              <View style={styles.featureCard}>
                <Text style={styles.featureEyebrow}>Næst athyglisvert</Text>
                <Text style={styles.featureTitle}>{nextSavedMeeting.name}</Text>
                <Text style={styles.featureMeta}>{formatMeetingTime(nextSavedMeeting)}</Text>
                <Text style={styles.featureBody}>
                  {[nextSavedMeeting.location, nextSavedMeeting.address].filter(Boolean).join(", ")}
                </Text>
              </View>
            ) : null}

            {loading ? (
              <View style={styles.centerState}>
                <ActivityIndicator size="large" color="#145b75" />
                <Text style={styles.stateText}>Sæki fundi...</Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.centerState}>
                <Text style={styles.stateTitle}>Ekki tókst að hlaða fundum</Text>
                <Text style={styles.stateText}>{error}</Text>
              </View>
            ) : null}

            {!loading && !error ? (
              <View style={styles.resultsRow}>
                <Text style={styles.resultsText}>{filteredMeetings.length} fundir í sýn</Text>
                <Text style={styles.resultsText}>{savedOnly ? "Aðeins vistaðir" : "Allir sýndir"}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.emptyState}>
              <Text style={styles.stateTitle}>Engir fundir passa við síuna</Text>
              <Text style={styles.stateText}>Prófaðu að hreinsa leitina eða velja annan dag.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#efe7dc",
  },
  listContent: {
    paddingBottom: 40,
  },
  hero: {
    overflow: "hidden",
    marginHorizontal: 18,
    marginTop: 12,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    borderRadius: 30,
    backgroundColor: "#fff8ef",
    borderWidth: 1,
    borderColor: "#e9dccd",
  },
  heroGlowLeft: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "#ffd7b6",
    opacity: 0.55,
    top: -40,
    left: -30,
  },
  heroGlowRight: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: "#c5e7df",
    opacity: 0.7,
    right: -20,
    bottom: -36,
  },
  eyebrow: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    color: "#5f726c",
    marginBottom: 10,
  },
  title: {
    maxWidth: 280,
    fontSize: 30,
    lineHeight: 33,
    fontWeight: "800",
    color: "#182725",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#3f5650",
    maxWidth: 320,
  },
  heroStats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "#ece2d7",
  },
  heroStatValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1f2d2b",
  },
  heroStatLabel: {
    marginTop: 3,
    fontSize: 12,
    color: "#63746e",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  panel: {
    marginHorizontal: 18,
    marginTop: 14,
    padding: 16,
    borderRadius: 26,
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#eadfd3",
  },
  searchInput: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#162321",
    borderWidth: 1,
    borderColor: "#dfd8cf",
  },
  segmentedRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#eef2ef",
  },
  segmentButtonActive: {
    backgroundColor: "#163d37",
  },
  segmentText: {
    fontWeight: "700",
    color: "#36544d",
  },
  segmentTextActive: {
    color: "#ffffff",
  },
  filterChipRow: {
    gap: 10,
    paddingTop: 14,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f1ece5",
  },
  filterChipActive: {
    backgroundColor: "#e97b2c",
  },
  filterChipText: {
    color: "#4d5f5a",
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  featureCard: {
    marginHorizontal: 18,
    marginTop: 14,
    padding: 18,
    borderRadius: 26,
    backgroundColor: "#143d39",
    borderWidth: 1,
    borderColor: "#1d5a53",
  },
  featureEyebrow: {
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontSize: 11,
  },
  featureTitle: {
    marginTop: 6,
    fontSize: 22,
    lineHeight: 25,
    fontWeight: "800",
    color: "#ffffff",
  },
  featureMeta: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
    color: "#ffce9a",
  },
  featureBody: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.84)",
  },
  resultsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 8,
  },
  resultsText: {
    color: "#536661",
    fontSize: 14,
  },
  centerState: {
    marginHorizontal: 18,
    marginTop: 14,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: "#fffdf8",
    alignItems: "center",
  },
  emptyState: {
    marginHorizontal: 18,
    marginTop: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: "#fffdf8",
    alignItems: "center",
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1b2a27",
    textAlign: "center",
  },
  stateText: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    color: "#5c6f69",
    textAlign: "center",
  },
  card: {
    marginHorizontal: 18,
    marginTop: 12,
    padding: 16,
    borderRadius: 26,
    borderWidth: 1,
  },
  cardToneInPerson: {
    backgroundColor: "#fffaf3",
    borderColor: "#eadfce",
  },
  cardTonePhone: {
    backgroundColor: "#fff5ed",
    borderColor: "#f0d9c3",
  },
  cardToneOnline: {
    backgroundColor: "#f7f5ff",
    borderColor: "#ddd7f3",
  },
  cardTopline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    flex: 1,
  },
  typeBadge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "#dff0ec",
  },
  typeBadgeText: {
    color: "#145b75",
    fontWeight: "800",
    fontSize: 12,
  },
  softBadge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "#f0ece6",
  },
  softBadgeText: {
    color: "#5c6c67",
    fontWeight: "700",
    fontSize: 12,
  },
  favoriteButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#153f39",
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "transparent",
  },
  favoriteButtonActive: {
    backgroundColor: "#153f39",
  },
  favoriteButtonText: {
    color: "#153f39",
    fontWeight: "800",
  },
  favoriteButtonTextActive: {
    color: "#ffffff",
  },
  cardTitle: {
    marginTop: 14,
    fontSize: 23,
    lineHeight: 26,
    fontWeight: "800",
    color: "#1a2926",
  },
  cardTime: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "800",
    color: "#c15d12",
  },
  cardPlace: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: "#3d504b",
  },
  cardNotes: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#61726d",
  },
  metaChipRow: {
    gap: 8,
    paddingTop: 14,
  },
  metaChip: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: "#efe7db",
  },
  metaChipText: {
    color: "#536661",
    fontWeight: "700",
    fontSize: 12,
  },
  reminderRow: {
    gap: 10,
    paddingTop: 16,
  },
  reminderChip: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: "#ebf0ee",
  },
  reminderChipActive: {
    backgroundColor: "#e97b2c",
  },
  reminderChipText: {
    color: "#34544d",
    fontWeight: "800",
  },
  reminderChipTextActive: {
    color: "#ffffff",
  },
});
