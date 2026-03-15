import * as Notifications from "expo-notifications";

import type { Meeting, ReminderPreference, Weekday } from "./types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const WEEKDAY_INDEX: Record<Weekday, number> = {
  sun: 1,
  mon: 2,
  tue: 3,
  wed: 4,
  thu: 5,
  fri: 6,
  sat: 7,
};

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();

  if (settings.granted) {
    return true;
  }

  const updated = await Notifications.requestPermissionsAsync();
  return updated.granted;
}

export async function removeReminder(reminder?: ReminderPreference): Promise<void> {
  if (!reminder) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
}

export async function scheduleWeeklyReminder(
  meeting: Meeting,
  minutesBefore: number,
): Promise<ReminderPreference | null> {
  if (!meeting.weekday || !meeting.time) {
    return null;
  }

  const [hourString, minuteString] = meeting.time.split(":");
  const totalMinutes = Number(hourString) * 60 + Number(minuteString) - minutesBefore;
  const adjustedMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(adjustedMinutes / 60);
  const minute = adjustedMinutes % 60;

  let weekday = WEEKDAY_INDEX[meeting.weekday];
  if (totalMinutes < 0) {
    weekday = weekday === 1 ? 7 : weekday - 1;
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Fundur framundan: ${meeting.name}`,
      body: `${meeting.location} - hefst ${meeting.dayLabel} kl. ${meeting.time}`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday,
      hour,
      minute,
    },
  });

  return {
    meetingId: meeting.id,
    minutesBefore,
    notificationId,
  };
}

