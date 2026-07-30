import { LIVE_CALENDAR_DELETE_MARKER } from "@/lib/orchestration/calendarConstants";
import { isTimeOnlyCalendarReply, normalizeWhitespace } from "@/lib/orchestration/requestHeuristics";

// In plain terms: calendar-specific formatting and day-range resolution for live calendar intents.

export function formatEventSuccessMessage(event: {
  title: string;
  startIso: Date;
  endIso: Date;
  timeZone: string;
  htmlLink?: string | null;
}) {
  const startFormatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: event.timeZone,
  });
  const endFormatter = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: event.timeZone,
  });

  return `Your event is on the calendar.\n\n- Title: ${event.title}\n- Starts: ${startFormatter.format(event.startIso)}\n- Ends: ${endFormatter.format(event.endIso)}\n- Time zone: ${event.timeZone}${event.htmlLink ? `\n- Link: ${event.htmlLink}` : ""}`;
}

export function formatRememberedEventsMessage(
  events: Array<{
    title: string;
    startIso: Date;
    endIso: Date;
    timeZone: string;
    location?: string | null;
    htmlLink?: string | null;
  }>
) {
  if (events.length === 0) {
    return "I don't have any saved calendar events in memory yet.";
  }

  return `Here are the most recent calendar events I remember from Loco:\n\n${events
    .map((event) => {
      const formatter = new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: event.timeZone,
      });

      return `- ${event.title} on ${formatter.format(event.startIso)}${event.location ? ` at ${event.location}` : ""}${event.htmlLink ? `\n  Link: ${event.htmlLink}` : ""}`;
    })
    .join("\n")}`;
}

export function fallbackCalendarTitleFromRequest(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const patterns = [
    /(?:set[- ]?up|schedule|add|create|plan|book|put)\s+(?:a\s+)?(?:reminder|event|appointment|meeting)\s+(?:on\s+my\s+calend(?:a|e)r\s+)?to\s+(.+?)(?=\s+(?:on|at|around|tomorrow|today|tonight|later\s+today|next|this)\b|$)/i,
    /(?:remind(?: me)?(?: to)?|reminder)\s+(?:on\s+my\s+calend(?:a|e)r\s+)?to\s+(.+?)(?=\s+(?:on|at|around|tomorrow|today|tonight|later\s+today|next|this)\b|$)/i,
    /(?:remind(?: me)?(?: to)?|reminder)\s+(?:for|about)\s+(.+?)(?=\s+(?:on|at|around|tomorrow|today|tonight|later\s+today|next|this)\b|$)/i,
    /(?:reminder|event|appointment|meeting)\s+(?:for|about)\s+(.+?)(?=\s+(?:on|at|around|tomorrow|today|next|this)\b|$)/i,
    /(?:set[- ]?up|schedule|add|create|plan|book|put)\s+(?:a\s+)?(?:reminder|event|appointment|meeting)\s+(?:for|about)?\s*(.+?)(?=\s+(?:on|at|around|tomorrow|today|next|this)\b|$)/i,
    /(?:for)\s+(.+?)(?=\s+(?:on|at|around)\b|$)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const candidate = match?.[1]
      ?.replace(/^(?:a|an|the|my)\s+/i, "")
      ?.replace(/^on\s+my\s+calend(?:a|e)r\s+to\s+/i, "")
      .replace(/\s+(?:please|pls)$/i, "")
      .trim();
    if (candidate) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }

  return "Reminder";
}

export function mergeCalendarClarificationReply(originalRequest: string | null, followUp: string) {
  if (!originalRequest) {
    return followUp;
  }

  const trimmedFollowUp = followUp.trim();
  if (!trimmedFollowUp) {
    return originalRequest;
  }

  if (isTimeOnlyCalendarReply(trimmedFollowUp)) {
    return `${originalRequest} at ${trimmedFollowUp}`;
  }

  return `${originalRequest} ${trimmedFollowUp}`;
}

export function getTimeZoneOffsetString(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const timeZoneName = parts.find((part) => part.type === "timeZoneName")?.value;

  if (!timeZoneName || timeZoneName === "GMT") {
    return "Z";
  }

  const match = timeZoneName.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) {
    return "Z";
  }

  const [, sign, hours, minutes] = match;
  return `${sign}${hours.padStart(2, "0")}:${(minutes || "00").padStart(2, "0")}`;
}

export function getTimeZoneDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);

  return {
    weekday: parts.find((part) => part.type === "weekday")?.value.toLowerCase() || "",
    year: Number(parts.find((part) => part.type === "year")?.value || "0"),
    month: Number(parts.find((part) => part.type === "month")?.value || "0"),
    day: Number(parts.find((part) => part.type === "day")?.value || "0"),
  };
}

export function addDaysInTimeZone(date: Date, timeZone: string, days: number) {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return getTimeZoneDateParts(shifted, timeZone);
}

export function buildZonedIso(parts: { year: number; month: number; day: number }, hours: number, minutes: number, seconds: number, timeZone: string) {
  const year = String(parts.year).padStart(4, "0");
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  const hour = String(hours).padStart(2, "0");
  const minute = String(minutes).padStart(2, "0");
  const second = String(seconds).padStart(2, "0");
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, Math.min(Math.max(hours, 0), 23), minutes, seconds));
  const offset = getTimeZoneOffsetString(probe, timeZone);

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

export function resolveCalendarDayRange(text: string, timeZone: string, now: Date, options?: { defaultToToday?: boolean }) {
  const normalized = normalizeWhitespace(text).toLowerCase();
  const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const current = getTimeZoneDateParts(now, timeZone);
  const currentWeekdayIndex = weekdayNames.indexOf(current.weekday);

  let label = "today";
  let target = current;

  if (/\bthis week\b/.test(normalized)) {
    const daysFromMonday = currentWeekdayIndex === 0 ? 6 : currentWeekdayIndex - 1;
    const weekStart = addDaysInTimeZone(now, timeZone, -daysFromMonday);
    const weekEnd = addDaysInTimeZone(now, timeZone, 7 - daysFromMonday);

    return {
      label: "this week",
      startIso: buildZonedIso(weekStart, 0, 0, 0, timeZone),
      endIso: buildZonedIso(weekEnd, 0, 0, 0, timeZone),
    };
  }

  if (/\bnext week\b/.test(normalized)) {
    const daysFromMonday = currentWeekdayIndex === 0 ? 6 : currentWeekdayIndex - 1;
    const nextWeekStart = addDaysInTimeZone(now, timeZone, 7 - daysFromMonday);
    const nextWeekEnd = addDaysInTimeZone(now, timeZone, 14 - daysFromMonday);

    return {
      label: "next week",
      startIso: buildZonedIso(nextWeekStart, 0, 0, 0, timeZone),
      endIso: buildZonedIso(nextWeekEnd, 0, 0, 0, timeZone),
    };
  }

  if (/\btomorrow\b/.test(normalized)) {
    label = "tomorrow";
    target = addDaysInTimeZone(now, timeZone, 1);
  } else if (/\btoday\b|\btonight\b|\bcurrent(?:ly)?\b|\bright now\b|\bnow\b/.test(normalized)) {
    label = "today";
    target = current;
  } else {
    const weekdayMatch = normalized.match(/\b(?:(this|next)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (!weekdayMatch) {
      if (options?.defaultToToday) {
        return {
          label,
          startIso: buildZonedIso(target, 0, 0, 0, timeZone),
          endIso: buildZonedIso(addDaysInTimeZone(new Date(Date.UTC(target.year, target.month - 1, target.day, 12, 0, 0)), timeZone, 1), 0, 0, 0, timeZone),
        };
      }

      return null;
    }

    const modifier = weekdayMatch[1] || "this";
    const requestedWeekday = weekdayMatch[2];
    const requestedIndex = weekdayNames.indexOf(requestedWeekday);
    if (requestedIndex === -1 || currentWeekdayIndex === -1) {
      return null;
    }

    let delta = (requestedIndex - currentWeekdayIndex + 7) % 7;
    if (modifier === "next") {
      delta = delta === 0 ? 7 : delta;
    }

    target = addDaysInTimeZone(now, timeZone, delta);
    label = modifier === "next" ? `next ${requestedWeekday}` : requestedWeekday;
  }

  const endTarget = addDaysInTimeZone(new Date(Date.UTC(target.year, target.month - 1, target.day, 12, 0, 0)), timeZone, 1);

  return {
    label,
    startIso: buildZonedIso(target, 0, 0, 0, timeZone),
    endIso: buildZonedIso(endTarget, 0, 0, 0, timeZone),
  };
}

export function formatLiveCalendarEventsMessage(
  events: Array<{
    title: string;
    startIso: string | null;
    endIso: string | null;
    isAllDay: boolean;
    location?: string | null;
    htmlLink?: string | null;
  }>,
  label: string,
  timeZone: string
) {
  if (events.length === 0) {
    return `Your Google Calendar looks clear for ${label}.`;
  }

  const shouldShowDate = /week/.test(label);

  const formattedEvents = events.map((event, index) => {
    const lines: string[] = [`${index + 1}. **${event.title}**`];

    if (!event.startIso) {
      if (event.htmlLink) {
        lines.push(`   Open: [Google Calendar](${event.htmlLink})`);
      }
      return lines.join("\n");
    }

    if (event.isAllDay) {
      if (shouldShowDate) {
        const start = new Date(event.startIso);
        const dateFormatter = new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone,
        });
        lines.push(`   When: ${dateFormatter.format(start)} · All day`);
      } else {
        lines.push("   Time: All day");
      }
    } else {
      const start = new Date(event.startIso);
      const end = event.endIso ? new Date(event.endIso) : null;
      const timeFormatter = new Intl.DateTimeFormat("en-US", {
        timeStyle: "short",
        timeZone,
      });
      const dateFormatter = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone,
      });

      lines.push(
        shouldShowDate
          ? `   When: ${dateFormatter.format(start)} · ${timeFormatter.format(start)}${end ? ` to ${timeFormatter.format(end)}` : ""}`
          : `   Time: ${timeFormatter.format(start)}${end ? ` to ${timeFormatter.format(end)}` : ""}`
      );
    }

    if (event.location) {
      lines.push(`   Location: ${event.location}`);
    }

    if (event.htmlLink) {
      lines.push(`   Open: [Google Calendar](${event.htmlLink})`);
    }

    return lines.join("\n");
  });

  return `Here is your Google Calendar for ${label}:\n\n${formattedEvents.join("\n\n")}`;
}

export function formatLiveCalendarDeleteConfirmation(
  events: Array<{
    title: string;
    startIso: string | null;
    endIso: string | null;
    isAllDay: boolean;
    location?: string | null;
  }>,
  label: string,
  timeZone: string
) {
  return `${LIVE_CALENDAR_DELETE_MARKER}\n\nI found ${events.length} event${events.length === 1 ? "" : "s"} on ${label}:\n${events
    .map((event) => {
      if (!event.startIso) {
        return `- ${event.title}`;
      }

      if (event.isAllDay) {
        return `- ${event.title} (all day)`;
      }

      const start = new Date(event.startIso);
      const end = event.endIso ? new Date(event.endIso) : null;
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeStyle: "short",
        timeZone,
      });

      return `- ${event.title} from ${formatter.format(start)}${end ? ` to ${formatter.format(end)}` : ""}${event.location ? ` at ${event.location}` : ""}`;
    })
    .join("\n")}\n\nReply with "yes" to delete them, or "no" to keep them.`;
}
