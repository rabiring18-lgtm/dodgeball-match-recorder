export const PLAYER_COUNT = 12
export const MEMBER_LIMIT = 8
export const MATCH_SECONDS = 5 * 60

export const STORAGE_KEYS = {
  players: 'dodgeballMatchRecorder.players',
  matchSetup: 'dodgeballMatchRecorder.matchSetup',
  opponentHistory: 'dodgeballMatchRecorder.opponentHistory',
  activeMatch: 'dodgeballMatchRecorder.activeMatch',
  savedMatches: 'dodgeballMatchRecorder.savedMatches',
}

export const defaultMatchSetup = createDefaultMatchSetup()

export function createDefaultMatchSetup(now = new Date()) {
  return {
    opponentName: '',
    matchMinutes: '5',
    possession: '',
    matchDate: formatDateInputValue(now),
    matchTime: formatTimeInputValue(now),
    firstHalfMemberIds: [],
    secondHalfMemberIds: [],
  }
}

export function formatDateInputValue(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatTimeInputValue(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function createMatchDateTimeValue(matchDate, matchTime) {
  const date = String(matchDate ?? '').trim()
  const time = String(matchTime ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return ''
  }

  const parsed = new Date(`${date}T${time}:00`)
  if (Number.isNaN(parsed.getTime())) return ''
  if (
    formatDateInputValue(parsed) !== date ||
    formatTimeInputValue(parsed) !== time
  ) {
    return ''
  }
  return `${date}T${time}`
}

export function normalizeMatchDateTime(value) {
  const rawValue = String(value ?? '').trim()
  if (!rawValue) return ''
  const normalizedValue = rawValue.length === 16 ? rawValue : rawValue.slice(0, 16)
  const parsed = new Date(normalizedValue)
  return Number.isNaN(parsed.getTime()) ? '' : normalizedValue
}

export function getMatchDateTimeParts(matchDateTime, fallbackValue = Date.now()) {
  const normalized = normalizeMatchDateTime(matchDateTime)
  const source = normalized || fallbackValue
  const date = new Date(source)
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date

  return {
    matchDate: formatDateInputValue(safeDate),
    matchTime: formatTimeInputValue(safeDate),
  }
}

export function getMatchDisplayDateTime(match, options = {}) {
  const fallbackValue = match?.createdAt || match?.completedAt || Date.now()
  const normalized = normalizeMatchDateTime(match?.matchDateTime)
  const date = new Date(normalized || fallbackValue)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(options.dateStyle ? { dateStyle: options.dateStyle } : {}),
  }).format(date)
}

export function getMatchFileDate(match) {
  const fallbackValue = match?.createdAt || match?.completedAt || Date.now()
  const normalized = normalizeMatchDateTime(match?.matchDateTime)
  const date = new Date(normalized || fallbackValue)
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date

  return formatDateInputValue(safeDate).replaceAll('-', '')
}

export const playEvents = {
  rocks: [
    { eventType: 'attack_hit', label: '当てた', symbol: '◎', tone: 'good' },
    { eventType: 'attack_miss', label: 'アタック失敗', symbol: '×', tone: 'bad' },
    {
      eventType: 'pass_error',
      label: 'パスミス',
      symbol: '△',
      tone: 'warn',
    },
    {
      eventType: 'pass_intercepted',
      label: 'パスカットされた',
      symbol: '◇',
      tone: 'warn',
    },
  ],
  opponent: [
    { eventType: 'catch_success', label: 'キャッチ', symbol: '○', tone: 'good' },
    { eventType: 'hit_received', label: '当てられた', symbol: '×', tone: 'bad' },
    {
      eventType: 'opponent_pass_error',
      label: '相手パスミス',
      symbol: '△',
      tone: 'warn',
    },
    {
      eventType: 'pass_interception',
      label: 'パスカット',
      symbol: '◇',
      tone: 'good',
    },
  ],
}

export const foulEvents = [
  { eventType: 'line_cross', label: 'ラインクロス', tone: 'caution' },
  { eventType: 'overtime_violation', label: 'オーバータイム', tone: 'caution' },
]

export const playEventTypes = new Set(
  [...playEvents.rocks, ...playEvents.opponent].map((event) => event.eventType),
)

export const attackEventTypes = new Set(['attack_hit', 'attack_miss'])

export const attackFlowLabels = {
  pending: '判定待ち',
  single: '単発',
  possession_continued: '攻撃権継続',
  unknown: '記録なし',
}

export const eventLabels = [
  ...playEvents.rocks,
  ...playEvents.opponent,
  ...foulEvents,
].reduce((labels, event) => {
  labels[event.eventType] = event.label
  return labels
}, {})

export const teamOnlyPlayEventTypes = new Set(['opponent_pass_error', 'overtime_violation'])

export const defensiveTargetEventTypes = new Set(['catch_success', 'hit_received'])

export const coachImpressionEventTypes = new Set([
  'impression_judgment',
  'impression_rushed',
  'impression_catch_posture',
  'impression_stopped_feet',
  'impression_no_voice',
  'impression_mental',
])

export function isCoachImpressionEventType(eventType) {
  return coachImpressionEventTypes.has(String(eventType ?? ''))
}

export function removeCoachImpressionEvents(events) {
  return Array.isArray(events)
    ? events.filter((event) => !isCoachImpressionEventType(event?.eventType))
    : []
}

export function normalizeAttackFlow(eventType, value) {
  if (!attackEventTypes.has(eventType)) return null
  return Object.prototype.hasOwnProperty.call(attackFlowLabels, value)
    ? value
    : 'unknown'
}

export function normalizeLastPassScope(eventType, value) {
  if (!attackEventTypes.has(eventType)) return null
  return ['player', 'none', 'unknown'].includes(value) ? value : 'unknown'
}

export function createEmptyPlayers() {
  return Array.from({ length: PLAYER_COUNT }, (_, index) => ({
    id: index,
    name: '',
  }))
}

export function safeReadStorage(key, fallback) {
  try {
    const storedValue = window.localStorage.getItem(key)
    return storedValue ? JSON.parse(storedValue) : fallback
  } catch {
    return fallback
  }
}

export function safeWriteStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Storage may be unavailable in private mode. Keep the app usable.
    return false
  }
}

export function safeRemoveStorage(key) {
  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    // Ignore storage removal failures.
    return false
  }
}

export function normalizePlayers(players) {
  const basePlayers = createEmptyPlayers()

  if (!Array.isArray(players)) {
    return basePlayers
  }

  return basePlayers.map((player, index) => ({
    ...player,
    name: String(players[index]?.name ?? players[index]?.displayName ?? ''),
  }))
}

export function normalizeIdList(value) {
  return Array.isArray(value)
    ? value.filter((id) => Number.isInteger(id)).slice(0, MEMBER_LIMIT)
    : []
}

export function normalizeMatchSetup(value) {
  const storedSetup = value && typeof value === 'object' ? value : {}
  const fallbackSetup = createDefaultMatchSetup()

  return {
    ...fallbackSetup,
    opponentName: String(storedSetup.opponentName ?? ''),
    matchMinutes: '5',
    possession: ['first', 'second'].includes(storedSetup.possession)
      ? storedSetup.possession
      : '',
    matchDate:
      /^\d{4}-\d{2}-\d{2}$/.test(String(storedSetup.matchDate ?? ''))
        ? String(storedSetup.matchDate)
        : fallbackSetup.matchDate,
    matchTime:
      /^\d{2}:\d{2}$/.test(String(storedSetup.matchTime ?? ''))
        ? String(storedSetup.matchTime)
        : fallbackSetup.matchTime,
    firstHalfMemberIds: normalizeIdList(storedSetup.firstHalfMemberIds),
    secondHalfMemberIds: normalizeIdList(storedSetup.secondHalfMemberIds),
  }
}

export function normalizeOpponentHistory(value) {
  return Array.isArray(value)
    ? value.filter((name) => typeof name === 'string' && name.trim() !== '')
    : []
}

export function normalizePeriodDurations(value) {
  const source = value && typeof value === 'object' ? value : {}
  const normalizeDuration = (duration) =>
    Number.isFinite(Number(duration)) ? Math.max(0, Math.round(Number(duration))) : null

  return {
    first_half: normalizeDuration(source.first_half),
    second_half: normalizeDuration(source.second_half),
  }
}

export function isRegisteredPlayer(player) {
  return player.name.trim() !== ''
}

export function normalizeMemberList(value) {
  return Array.isArray(value)
    ? value
        .filter((member) => member && typeof member === 'object')
        .map((member) => ({
          id: Number.isInteger(member.id) ? member.id : null,
          name: String(member.name ?? member.displayName ?? ''),
        }))
        .filter((member) => member.name.trim() !== '')
        .slice(0, MEMBER_LIMIT)
    : []
}

export function normalizeEvent(event) {
  const source = event && typeof event === 'object' ? event : {}
  const eventType = String(source.eventType ?? '')
  const isPassError = eventType === 'pass_error'
  const isTeamOnlyViolation = eventType === 'overtime_violation'
  const passErrorPasserId = isPassError && Number.isInteger(source.passerId)
    ? source.passerId
    : isPassError && Number.isInteger(source.playerId)
      ? source.playerId
      : null
  const isPlay = playEventTypes.has(eventType)
  const defaultScope = teamOnlyPlayEventTypes.has(eventType)
    ? 'team'
    : isPlay
      ? 'unknown'
      : 'unknown'
  const defaultName = defaultScope === 'team' ? 'チーム全体' : '記録なし'
  const targetScope = ['player', 'team', 'unknown'].includes(source.targetScope)
    ? source.targetScope
    : defaultScope

  return {
    eventId: String(source.eventId ?? createId('event')),
    matchId: String(source.matchId ?? ''),
    period: source.period === 'second_half' ? 'second_half' : 'first_half',
    eventType,
    possession: source.possession === 'opponent' ? 'opponent' : 'rocks',
    elapsedTime: Number.isFinite(Number(source.elapsedTime))
      ? Number(source.elapsedTime)
      : calculateElapsed(source.remainingTime),
    remainingTime: Math.max(0, Number(source.remainingTime) || 0),
    timestamp: Number(source.timestamp) || Date.now(),
    playerId: Number.isInteger(source.playerId) ? source.playerId : null,
    playerNameSnapshot: isTeamOnlyViolation
      ? null
      : String(source.playerNameSnapshot ?? defaultName),
    targetScope,
    attackFlow: normalizeAttackFlow(eventType, source.attackFlow),
    lastPasserId: Number.isInteger(source.lastPasserId) ? source.lastPasserId : null,
    lastPasserNameSnapshot:
      normalizeLastPassScope(eventType, source.lastPassScope) === 'player'
        ? String(source.lastPasserNameSnapshot ?? '記録なし')
        : null,
    lastPassScope: normalizeLastPassScope(eventType, source.lastPassScope),
    passerId: passErrorPasserId,
    passerNameSnapshot:
      passErrorPasserId !== null
        ? String(source.passerNameSnapshot ?? source.playerNameSnapshot ?? '記録なし')
        : null,
    receiverId: isPassError && Number.isInteger(source.receiverId) ? source.receiverId : null,
    receiverNameSnapshot:
      isPassError && Number.isInteger(source.receiverId)
        ? String(source.receiverNameSnapshot ?? '記録なし')
        : null,
    passErrorCause:
      isPassError && ['passer', 'receiver', 'both'].includes(source.passErrorCause)
        ? source.passErrorCause
        : null,
  }
}

export function normalizeMatch(match) {
  if (!match || typeof match !== 'object' || !match.matchId) {
    return null
  }

  const period = match.period === 'second_half' ? 'second_half' : 'first_half'
  const firstPossession = match.firstPossession === 'opponent' ? 'opponent' : 'rocks'
  const matchDateTime = normalizeMatchDateTime(match.matchDateTime)

  const normalizedMatch = {
    ...match,
    matchId: String(match.matchId),
    status: String(match.status ?? 'waiting'),
    screen: String(match.screen ?? 'game'),
    period,
    opponentName: String(match.opponentName ?? ''),
    firstPossession,
    currentPossession: match.currentPossession === 'opponent' ? 'opponent' : 'rocks',
    firstHalfMembers: normalizeMemberList(match.firstHalfMembers),
    secondHalfMembers: normalizeMemberList(match.secondHalfMembers),
    events: removeCoachImpressionEvents(match.events).map(normalizeEvent),
    remainingTime: Math.max(0, Number(match.remainingTime) || 0),
    timerRunning: Boolean(match.timerRunning),
    timerEndAt: match.timerEndAt ? Number(match.timerEndAt) : null,
    periodDurations: normalizePeriodDurations(match.periodDurations),
    createdAt: Number(match.createdAt) || Date.now(),
    updatedAt: Number(match.updatedAt) || Date.now(),
    completedAt: match.completedAt ? Number(match.completedAt) : null,
  }

  return matchDateTime ? { ...normalizedMatch, matchDateTime } : normalizedMatch
}

export function normalizeSavedMatches(value) {
  return Array.isArray(value)
    ? value.map(normalizeMatch).filter(Boolean).sort((a, b) => b.createdAt - a.createdAt)
    : []
}

export function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function getPlayersByIds(players, ids) {
  const playerMap = new Map(players.map((player) => [player.id, player]))
  return ids
    .map((id) => playerMap.get(id))
    .filter(Boolean)
    .slice(0, MEMBER_LIMIT)
}

export function getCurrentRemaining(match) {
  if (!match) {
    return MATCH_SECONDS
  }

  if (match.timerRunning && match.timerEndAt) {
    return Math.max(0, Math.ceil((match.timerEndAt - Date.now()) / 1000))
  }

  return Math.max(0, Number(match.remainingTime) || 0)
}

export function calculateElapsed(remainingTime) {
  return Math.max(0, MATCH_SECONDS - Math.max(0, Number(remainingTime) || 0))
}

export function createMatchFromSetup(matchSetup, firstHalfMembers, secondHalfMembers) {
  const now = Date.now()
  const firstPossession = matchSetup.possession === 'first' ? 'rocks' : 'opponent'
  const matchDateTime = createMatchDateTimeValue(matchSetup.matchDate, matchSetup.matchTime)

  return {
    matchId: createId('match'),
    status: 'first_half_in_progress',
    screen: 'game',
    period: 'first_half',
    opponentName: matchSetup.opponentName.trim(),
    matchDateTime,
    firstPossession,
    currentPossession: firstPossession,
    firstHalfMembers,
    secondHalfMembers,
    events: [],
    remainingTime: MATCH_SECONDS,
    timerRunning: true,
    timerEndAt: now + MATCH_SECONDS * 1000,
    periodDurations: {
      first_half: null,
      second_half: null,
    },
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }
}

export function createEvent(match, eventType, target = {}) {
  const remainingTime = getCurrentRemaining(match)
  const isPassError = eventType === 'pass_error'
  const isTeamOnlyViolation = eventType === 'overtime_violation'
  const targetScope = ['player', 'team', 'unknown'].includes(target.targetScope)
    ? target.targetScope
    : playEventTypes.has(eventType)
      ? 'unknown'
      : 'team'

  return {
    eventId: createId('event'),
    matchId: match.matchId,
    period: match.period,
    eventType,
    possession: match.currentPossession,
    elapsedTime: calculateElapsed(remainingTime),
    remainingTime,
    timestamp: Date.now(),
    playerId: targetScope === 'player' && Number.isInteger(target.playerId) ? target.playerId : null,
    playerNameSnapshot:
      isTeamOnlyViolation
        ? null
        : target.playerNameSnapshot ??
      (targetScope === 'team' ? 'チーム全体' : targetScope === 'unknown' ? '記録なし' : null),
    targetScope,
    attackFlow: normalizeAttackFlow(eventType, target.attackFlow),
    lastPasserId:
      normalizeLastPassScope(eventType, target.lastPassScope) === 'player' &&
      Number.isInteger(target.lastPasserId)
        ? target.lastPasserId
        : null,
    lastPasserNameSnapshot:
      normalizeLastPassScope(eventType, target.lastPassScope) === 'player'
        ? String(target.lastPasserNameSnapshot ?? '記録なし')
        : null,
    lastPassScope: normalizeLastPassScope(eventType, target.lastPassScope),
    passerId:
      isPassError && Number.isInteger(target.passerId) ? target.passerId : null,
    passerNameSnapshot:
      isPassError && Number.isInteger(target.passerId)
        ? String(target.passerNameSnapshot ?? target.playerNameSnapshot ?? '記録なし')
        : null,
    receiverId:
      isPassError && Number.isInteger(target.receiverId) ? target.receiverId : null,
    receiverNameSnapshot:
      isPassError && Number.isInteger(target.receiverId)
        ? String(target.receiverNameSnapshot ?? '記録なし')
        : null,
    passErrorCause:
      isPassError && ['passer', 'receiver', 'both'].includes(target.passErrorCause)
        ? target.passErrorCause
        : null,
  }
}

export function getEventsForScope(events, scope) {
  const normalizedEvents = removeCoachImpressionEvents(events).map(normalizeEvent)
  if (scope === 'all') {
    return normalizedEvents
  }

  return normalizedEvents.filter((event) => event.period === scope)
}

export function buildStats(events) {
  const normalizedEvents = removeCoachImpressionEvents(events).map(normalizeEvent)
  const count = (eventType) =>
    normalizedEvents.filter((event) => event.eventType === eventType).length
  const attackHit = count('attack_hit')
  const attackMiss = count('attack_miss')
  const catchSuccess = count('catch_success')
  const hitReceived = count('hit_received')
  const totalAttack = attackHit + attackMiss
  const opponentAttack = catchSuccess + hitReceived
  const attackFlowCount = (attackFlow) =>
    normalizedEvents.filter(
      (event) => attackEventTypes.has(event.eventType) && event.attackFlow === attackFlow,
    ).length
  const singleAttacks = attackFlowCount('single')
  const continuedAttacks = attackFlowCount('possession_continued')
  const unknownAttacks = attackFlowCount('unknown')
  const knownFlowTotal = singleAttacks + continuedAttacks
  const rocksPassErrors = count('pass_error')
  const rocksPassIntercepted = count('pass_intercepted')
  const opponentPassErrors = count('opponent_pass_error')
  const rocksPassInterceptions = count('pass_interception')
  const lineCrosses = count('line_cross')
  const overtimeViolations = count('overtime_violation')
  const lastPassEvents = normalizedEvents.filter(
    (event) => attackEventTypes.has(event.eventType) && event.lastPassScope === 'player',
  )
  const lastPasses = lastPassEvents.length
  const lastPassHits = lastPassEvents.filter(
    (event) => event.eventType === 'attack_hit',
  ).length
  const passErrorCauseCount = (cause) =>
    normalizedEvents.filter(
      (event) => event.eventType === 'pass_error' && event.passErrorCause === cause,
    ).length

  return {
    attack: {
      total: totalAttack,
      hit: attackHit,
      miss: attackMiss,
      rate: totalAttack > 0 ? Math.round((attackHit / totalAttack) * 100) : 0,
      flow: {
        single: singleAttacks,
        possessionContinued: continuedAttacks,
        unknown: unknownAttacks,
        continuationRate:
          knownFlowTotal > 0 ? Math.round((continuedAttacks / knownFlowTotal) * 100) : null,
      },
    },
    defense: {
      opponentAttack,
      catch: catchSuccess,
      hitReceived,
      rate:
        opponentAttack > 0 ? Math.round((catchSuccess / opponentAttack) * 100) : 0,
    },
    pass: {
      errors: rocksPassErrors,
      lastPasses,
      lastPassHits,
      lastPassHitRate:
        lastPasses > 0 ? Math.round((lastPassHits / lastPasses) * 100) : null,
      rocksPassErrors,
      rocksPassIntercepted,
      opponentPassErrors,
      rocksPassInterceptions,
      passErrorCauses: {
        passer: passErrorCauseCount('passer'),
        receiver: passErrorCauseCount('receiver'),
        both: passErrorCauseCount('both'),
      },
    },
    fouls: {
      lineCrosses,
      overtimeViolations,
    },
  }
}

export function buildPlayerStats(events, members, options = {}) {
  const normalizedEvents = removeCoachImpressionEvents(events).map(normalizeEvent)
  const allEvents = options.match?.events
    ? removeCoachImpressionEvents(options.match.events).map(normalizeEvent)
    : normalizedEvents
  const memberMap = new Map((members || []).map((member) => [member.id, member]))
  const survivalScope = options.scope || 'all'
  const survivalPeriods =
    survivalScope === 'all'
      ? ['first_half', 'second_half']
      : ['first_half', 'second_half'].includes(survivalScope)
        ? [survivalScope]
        : []

  return (members || []).map((member) => {
    const playerEvents = normalizedEvents.filter(
      (event) => event.targetScope === 'player' && event.playerId === member.id,
    )
    const count = (eventType) =>
      playerEvents.filter((event) => event.eventType === eventType).length
    const hits = count('attack_hit')
    const misses = count('attack_miss')
    const attacks = hits + misses
    const lastPassEvents = normalizedEvents.filter(
      (event) =>
        attackEventTypes.has(event.eventType) &&
        event.lastPassScope === 'player' &&
        event.lastPasserId === member.id,
    )
    const lastPasses = lastPassEvents.length
    const lastPassHits = lastPassEvents.filter(
      (event) => event.eventType === 'attack_hit',
    ).length
    const flowCount = (attackFlow) =>
      playerEvents.filter(
        (event) => attackEventTypes.has(event.eventType) && event.attackFlow === attackFlow,
      ).length
    const singleAttacks = flowCount('single')
    const continuedAttacks = flowCount('possession_continued')
    const knownFlowTotal = singleAttacks + continuedAttacks
    const catches = count('catch_success')
    const hitReceived = count('hit_received')
    const defenseTotal = catches + hitReceived
    const lineCrosses = count('line_cross')
    const passErrorAsPasser = normalizedEvents.filter(
      (event) => event.eventType === 'pass_error' && event.passerId === member.id,
    )
    const passErrorAsReceiver = normalizedEvents.filter(
      (event) => event.eventType === 'pass_error' && event.receiverId === member.id,
    )
    const passerCauseErrors = passErrorAsPasser.filter(
      (event) => event.passErrorCause === 'passer',
    ).length
    const receiverCauseErrors = passErrorAsReceiver.filter(
      (event) => event.passErrorCause === 'receiver',
    ).length
    const bothCausePassErrors = normalizedEvents.filter(
      (event) =>
        event.eventType === 'pass_error' &&
        event.passErrorCause === 'both' &&
        (event.passerId === member.id || event.receiverId === member.id),
    ).length
    const passErrorResponsibility =
      passerCauseErrors + receiverCauseErrors + bothCausePassErrors
    const survival = buildPlayerSurvivalStats(
      member,
      allEvents,
      options.match,
      survivalPeriods,
    )
    return {
      id: member.id,
      name: memberMap.get(member.id)?.name ?? member.name,
      attacks,
      hits,
      misses,
      attackRate: attacks > 0 ? Math.round((hits / attacks) * 100) : null,
      singleAttacks,
      continuedAttacks,
      unknownAttackFlow: flowCount('unknown'),
      continuationRate:
        knownFlowTotal > 0 ? Math.round((continuedAttacks / knownFlowTotal) * 100) : null,
      catches,
      hitReceived,
      defenseTotal,
      catchRate: defenseTotal > 0 ? Math.round((catches / defenseTotal) * 100) : null,
      passErrors: count('pass_error'),
      passErrorAsPasser: passErrorAsPasser.length,
      passErrorAsReceiver: passErrorAsReceiver.length,
      passerCauseErrors,
      receiverCauseErrors,
      bothCausePassErrors,
      passErrorResponsibility,
      passIntercepted: count('pass_intercepted'),
      passInterceptions: count('pass_interception'),
      lastPasses,
      lastPassHits,
      lastPassHitRate:
        lastPasses > 0 ? Math.round((lastPassHits / lastPasses) * 100) : null,
      lineCrosses,
      survivalSeconds: survival.seconds,
      survivalRate: survival.rate,
      survivalPlayed: survival.played,
    }
  })
}

function buildPlayerSurvivalStats(member, events, match, periods) {
  const periodStats = periods
    .filter((period) => isMemberInPeriod(member, match, period))
    .map((period) => {
      const periodEvents = events.filter((event) => event.period === period)
      const duration = getActualPeriodSeconds(match, period, periodEvents)
      const hitEvent = periodEvents
        .filter((event) => isHitReceivedByMember(event, member))
        .sort((a, b) => (a.elapsedTime ?? 0) - (b.elapsedTime ?? 0) || (a.timestamp ?? 0) - (b.timestamp ?? 0))[0]
      const survivalSeconds = Math.min(
        duration,
        Math.max(0, hitEvent ? Math.round(Number(hitEvent.elapsedTime) || 0) : duration),
      )

      return { duration, survivalSeconds }
    })

  if (periodStats.length === 0) {
    return { played: false, seconds: null, rate: null }
  }

  const totalSurvival = periodStats.reduce((sum, period) => sum + period.survivalSeconds, 0)
  const totalDuration = periodStats.reduce((sum, period) => sum + period.duration, 0)
  const averageSurvival = Math.round(totalSurvival / periodStats.length)

  return {
    played: true,
    seconds: averageSurvival,
    rate: totalDuration > 0 ? Math.round((totalSurvival / totalDuration) * 100) : null,
  }
}

function isMemberInPeriod(member, match, period) {
  if (!match) return true
  const periodMembers =
    period === 'first_half' ? match.firstHalfMembers : match.secondHalfMembers
  return periodMembers.some(
    (periodMember) =>
      periodMember.id === member.id ||
      (!Number.isInteger(periodMember.id) && periodMember.name === member.name),
  )
}

function isHitReceivedByMember(event, member) {
  if (event.eventType !== 'hit_received') return false
  if (Number.isInteger(event.playerId) && Number.isInteger(member.id)) {
    return event.playerId === member.id
  }
  return Boolean(event.playerNameSnapshot && event.playerNameSnapshot === member.name)
}

export function getActualPeriodSeconds(match, period, events = []) {
  const storedDuration = normalizePeriodDurations(match?.periodDurations)[period]
  if (storedDuration !== null) {
    return storedDuration
  }

  const periodEvents = events.filter((event) => event.period === period)
  const maxElapsed = periodEvents.reduce(
    (max, event) => Math.max(max, Math.round(Number(event.elapsedTime) || 0)),
    0,
  )

  if (match?.period === period && !match.timerRunning && Number.isFinite(Number(match.remainingTime))) {
    const elapsedFromTimer = Math.max(
      0,
      MATCH_SECONDS - Math.max(0, Math.round(Number(match.remainingTime))),
    )
    return Math.max(elapsedFromTimer, maxElapsed)
  }

  if (maxElapsed > MATCH_SECONDS) {
    return maxElapsed
  }

  return MATCH_SECONDS
}

export function buildPlayerSummary(events, members = []) {
  const normalizedEvents = removeCoachImpressionEvents(events).map(normalizeEvent)
  const memberMap = new Map((members || []).map((member) => [member.id, member.name]))
  const createBucket = () => new Map()
  const buckets = {
    attackHit: createBucket(),
    catchSuccess: createBucket(),
    lastPassHit: createBucket(),
    passError: createBucket(),
    passIntercepted: createBucket(),
    lineCross: createBucket(),
  }
  const addCount = (bucket, id, snapshotName) => {
    const hasId = Number.isInteger(id)
    const name = String(snapshotName || (hasId ? memberMap.get(id) : '') || '').trim()
    if (!hasId && !name) return
    const key = hasId ? `id:${id}` : `name:${name}`
    const current = bucket.get(key) || {
      key,
      playerId: hasId ? id : null,
      name: name || '記録なし',
      count: 0,
    }
    bucket.set(key, {
      ...current,
      name: current.name || name || '記録なし',
      count: current.count + 1,
    })
  }
  const ranked = (bucket) =>
    Array.from(bucket.values())
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))
      .slice(0, 3)

  normalizedEvents.forEach((event) => {
    if (event.eventType === 'attack_hit') {
      addCount(buckets.attackHit, event.playerId, event.playerNameSnapshot)
      if (event.lastPassScope === 'player') {
        addCount(buckets.lastPassHit, event.lastPasserId, event.lastPasserNameSnapshot)
      }
      return
    }

    if (event.eventType === 'catch_success') {
      addCount(buckets.catchSuccess, event.playerId, event.playerNameSnapshot)
      return
    }

    if (event.eventType === 'pass_intercepted') {
      addCount(buckets.passIntercepted, event.playerId, event.playerNameSnapshot)
      return
    }

    if (event.eventType === 'line_cross') {
      addCount(buckets.lineCross, event.playerId, event.playerNameSnapshot)
      return
    }

    if (event.eventType === 'pass_error') {
      if (event.passErrorCause === 'passer') {
        addCount(buckets.passError, event.passerId, event.passerNameSnapshot)
      }
      if (event.passErrorCause === 'receiver') {
        addCount(buckets.passError, event.receiverId, event.receiverNameSnapshot)
      }
      if (event.passErrorCause === 'both') {
        addCount(buckets.passError, event.passerId, event.passerNameSnapshot)
        addCount(buckets.passError, event.receiverId, event.receiverNameSnapshot)
      }
    }
  })

  return {
    success: [
      { key: 'attackHit', label: 'アタック成功', players: ranked(buckets.attackHit) },
      { key: 'catchSuccess', label: 'キャッチ', players: ranked(buckets.catchSuccess) },
      { key: 'lastPassHit', label: 'ラストパス成功', players: ranked(buckets.lastPassHit) },
    ],
    review: [
      { key: 'passError', label: 'パスミス', players: ranked(buckets.passError) },
      { key: 'passIntercepted', label: 'パスカットされた', players: ranked(buckets.passIntercepted) },
      { key: 'lineCross', label: 'ラインクロス', players: ranked(buckets.lineCross) },
    ],
  }
}

export function getEventTargetLabel(event) {
  const normalizedEvent = normalizeEvent(event)
  if (normalizedEvent.targetScope === 'team') {
    return normalizedEvent.playerNameSnapshot || 'チーム全体'
  }
  if (normalizedEvent.targetScope === 'unknown') return '記録なし'
  return normalizedEvent.playerNameSnapshot || '記録なし'
}

export function validateBackup(data) {
  return (
    data &&
    typeof data === 'object' &&
    [1, 2].includes(data.version) &&
    Array.isArray(data.players) &&
    Array.isArray(data.opponentHistory) &&
    Array.isArray(data.savedMatches) &&
    Object.prototype.hasOwnProperty.call(data, 'activeMatch')
  )
}

export function getBackupFileName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join('')

  return `dodgeball-match-recorder-backup-${stamp}.json`
}
