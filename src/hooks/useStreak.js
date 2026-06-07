import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth }  from '../context/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// Streak logic — "série de jours"
//
// A streak increments when the user opens the app on a CONSECUTIVE calendar day
// (Europe/Paris timezone). Missing a day resets the streak to 1.
//
// DB fields on profiles:
//   streak_current   SMALLINT  — current consecutive-day streak
//   streak_max       SMALLINT  — all-time best streak
//   streak_start     DATE      — start date of the current streak
//   streak_last_date DATE      — last day the user was active
//   streak_week_bits SMALLINT  — bitmask, bit 0=Mon … bit 6=Sun of current ISO week
//   streak_week_num  SMALLINT  — ISO week number (to detect week change)
// ─────────────────────────────────────────────────────────────────────────────

/** ISO week number (1–53) for a Date object */
function isoWeek(d) {
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7)
}

/** Today's date string in Europe/Paris timezone → 'YYYY-MM-DD' */
function todayParis() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Core tick — increments streak if today is a new day, resets if streak broken.
// Idempotent: safe to call multiple times per day (no-ops after first call).
// ─────────────────────────────────────────────────────────────────────────────
export async function tickStreak(userId) {
  const todayStr  = todayParis()
  const today     = new Date(todayStr)
  const todayWeek = isoWeek(today)
  const todayDow  = (today.getDay() + 6) % 7   // 0 = Monday … 6 = Sunday

  const { data: p, error } = await supabase
    .from('profiles')
    .select('streak_current,streak_max,streak_start,streak_last_date,streak_week_bits,streak_week_num')
    .eq('id', userId)
    .single()

  if (error || !p) return {
    streak_current: 0, streak_max: 0,
    streak_week_bits: 0, streak_start: null,
  }

  // Already counted today — nothing to do
  if (p.streak_last_date === todayStr) return p

  const last     = p.streak_last_date ? new Date(p.streak_last_date) : null
  const diffDays = last ? Math.round((today - last) / 86400000) : null

  let newStreak, newStart, newMax, newWeekBits, newWeekNum

  if (!last || diffDays > 1) {
    // First ever login, OR streak was broken (gap > 1 day)
    newStreak   = 1
    newStart    = todayStr
    newMax      = Math.max(p.streak_max ?? 0, 1)
    newWeekBits = 1 << todayDow
    newWeekNum  = todayWeek
  } else {
    // Consecutive day (diffDays === 1) — extend the streak
    newStreak   = (p.streak_current ?? 0) + 1
    newStart    = p.streak_start ?? todayStr
    newMax      = Math.max(p.streak_max ?? 0, newStreak)
    const prevWeek = p.streak_week_num ?? 0
    newWeekBits = todayWeek !== prevWeek
      ? (1 << todayDow)                            // new week: reset, mark today
      : ((p.streak_week_bits ?? 0) | (1 << todayDow)) // same week: add today
    newWeekNum  = todayWeek
  }

  const updates = {
    streak_current:   newStreak,
    streak_max:       newMax,
    streak_start:     newStart,
    streak_last_date: todayStr,
    streak_week_bits: newWeekBits,
    streak_week_num:  newWeekNum,
  }

  await supabase.from('profiles').update(updates).eq('id', userId)
  return { ...p, ...updates }
}

// ─────────────────────────────────────────────────────────────────────────────
// React hook — ticks on mount (once per session) and returns streak data.
// ─────────────────────────────────────────────────────────────────────────────
export function useStreak() {
  const { user }        = useAuth()
  const [data, setData] = useState(null)
  const hasRun          = useRef(false)

  useEffect(() => {
    if (!user?.id || hasRun.current) return
    hasRun.current = true
    tickStreak(user.id).then(setData).catch(() => {})
  }, [user?.id])

  return data ?? {
    streak_current:   0,
    streak_max:       0,
    streak_week_bits: 0,
    streak_start:     null,
  }
}
