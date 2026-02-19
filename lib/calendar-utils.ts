/**
 * Calendar utilities for date ranges and navigation
 */

export type CalendarViewMode = 'day' | 'week' | 'month'

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function getStartOfWeek(d: Date, firstDayOfWeek = 0): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day - firstDayOfWeek + 7) % 7
  date.setDate(date.getDate() - diff)
  date.setHours(0, 0, 0, 0)
  return date
}

export function getEndOfWeek(d: Date, firstDayOfWeek = 0): Date {
  const start = getStartOfWeek(d, firstDayOfWeek)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

export function getWeekDays(d: Date, firstDayOfWeek = 0): Date[] {
  const start = getStartOfWeek(d, firstDayOfWeek)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return day
  })
}

export function getPrevNextForView(
  view: CalendarViewMode,
  anchor: Date,
  direction: 'prev' | 'next'
): Date {
  const d = new Date(anchor)
  if (view === 'day') {
    d.setDate(d.getDate() + (direction === 'next' ? 1 : -1))
  } else if (view === 'week') {
    d.setDate(d.getDate() + (direction === 'next' ? 7 : -7))
  } else {
    d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1))
  }
  return d
}

export function getDateRangeForView(
  view: CalendarViewMode,
  anchor: Date,
  firstDayOfWeek = 0
): { start: Date; end: Date; dates: Date[] } {
  const start = new Date(anchor)
  start.setHours(0, 0, 0, 0)
  const end = new Date(anchor)
  end.setHours(23, 59, 59, 999)

  if (view === 'day') {
    return { start, end, dates: [new Date(start)] }
  }

  if (view === 'week') {
    const weekStart = getStartOfWeek(anchor, firstDayOfWeek)
    const weekEnd = getEndOfWeek(anchor, firstDayOfWeek)
    return {
      start: weekStart,
      end: weekEnd,
      dates: getWeekDays(anchor, firstDayOfWeek),
    }
  }

  // month
  start.setDate(1)
  end.setMonth(end.getMonth() + 1)
  end.setDate(0)
  const dates: Date[] = []
  const cur = new Date(start)
  while (cur <= end) {
    dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return { start, end, dates }
}
