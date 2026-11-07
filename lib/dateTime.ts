// frontend/lib/dateTime.ts
// Robust date & time formatting utilities for messages, comments, and conversation feeds.

/**
 * Format timestamp into a clean, smart human-readable string with date and time.
 * Examples:
 * - "Today · 02:45 pm"
 * - "Yesterday · 04:15 pm"
 * - "Oct 27 · 02:45 pm"
 * - "Sep 10, 2025 · 10:30 am"
 */
export function formatSmartDateTime(rawDate: string | Date | number | undefined | null): string {
  if (!rawDate) return 'Just now';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return typeof rawDate === 'string' ? rawDate : 'Recently';

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Today · ${timeStr}`;
  }
  if (isYesterday) {
    return `Yesterday · ${timeStr}`;
  }

  const isSameYear = d.getFullYear() === now.getFullYear();
  const dateStr = d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(isSameYear ? {} : { year: 'numeric' }),
  });

  return `${dateStr} · ${timeStr}`;
}

/**
 * Format conversation list preview timestamp (WhatsApp/iMessage style)
 * Examples:
 * - Today: "2:45 PM"
 * - Yesterday: "Yesterday"
 * - This week: "Tue"
 * - Older: "Oct 24" (or "Oct 24, 2025")
 */
export function formatConversationTime(rawDate: string | Date | number | undefined | null): string {
  if (!rawDate) return '';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Yesterday';

  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays >= 0 && diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }

  const isSameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(isSameYear ? {} : { year: 'numeric' }),
  });
}

/**
 * Format date divider pill in chat message timeline
 * Examples:
 * - "Today"
 * - "Yesterday"
 * - "Monday, Oct 26" or "Oct 24, 2025"
 */
export function getMessageDateSeparator(rawDate: string | Date | number | undefined | null): string {
  if (!rawDate) return 'Today';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return 'Today';

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Yesterday';

  const isSameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(isSameYear ? {} : { year: 'numeric' }),
  });
}

/**
 * Check if two dates fall on the same calendar day
 */
export function isSameCalendarDay(
  d1: string | Date | number | undefined | null,
  d2: string | Date | number | undefined | null
): boolean {
  if (!d1 || !d2) return false;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;

  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

/**
 * Format active status / last seen text for chat header and conversation previews.
 * Examples:
 * - When online: "Active now"
 * - < 1 min ago: "Active just now"
 * - < 60 min ago: "Active 5m ago"
 * - < 24 hours ago (today): "Active today at 2:45 PM"
 * - Yesterday: "Active yesterday at 11:20 AM"
 * - Older: "Active on Oct 28 at 4:10 PM"
 * - No date: "Offline"
 */
export function formatLastSeen(
  isOnline: boolean,
  lastSeen?: string | Date | number | null
): string {
  if (isOnline) {
    return 'Active now';
  }
  if (!lastSeen) {
    return 'Offline';
  }
  const d = new Date(lastSeen);
  if (isNaN(d.getTime())) {
    return 'Offline';
  }

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 60) {
    return 'Active just now';
  }
  if (diffMin < 60) {
    return `Active ${diffMin}m ago`;
  }

  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Active today at ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `Active yesterday at ${timeStr}`;
  }

  const isSameYear = d.getFullYear() === now.getFullYear();
  const dateStr = d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(isSameYear ? {} : { year: 'numeric' }),
  });

  return `Active on ${dateStr} at ${timeStr}`;
}
