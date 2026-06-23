import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MATCH_SECONDS,
  MEMBER_LIMIT,
  STORAGE_KEYS,
  attackEventTypes,
  attackFlowLabels,
  buildPlayerStats,
  buildPlayerSummary,
  buildStats,
  createEmptyPlayers,
  createEvent,
  createMatchFromSetup,
  defaultMatchSetup,
  eventLabels,
  foulEvents,
  formatTime,
  getBackupFileName,
  getCurrentRemaining,
  getEventTargetLabel,
  getEventsForScope,
  getPlayersByIds,
  isRegisteredPlayer,
  normalizeMatch,
  normalizeMatchSetup,
  normalizeOpponentHistory,
  normalizePlayers,
  normalizeSavedMatches,
  playEvents,
  safeReadStorage,
  safeRemoveStorage,
  safeWriteStorage,
  teamOnlyPlayEventTypes,
  validateBackup,
  defensiveTargetEventTypes,
} from './appData'

const scopeTabs = [
  ['first_half', '前半'],
  ['second_half', '後半'],
  ['all', '全体'],
]

const modeTabs = [
  ['team', 'チーム全体'],
  ['player', '選手別'],
]

function App() {
  const storedActiveMatch = normalizeMatch(
    safeReadStorage(STORAGE_KEYS.activeMatch, null),
  )
  const [screen, setScreen] = useState('setup')
  const [players, setPlayers] = useState(() =>
    normalizePlayers(safeReadStorage(STORAGE_KEYS.players, createEmptyPlayers())),
  )
  const [matchSetup, setMatchSetup] = useState(() =>
    normalizeMatchSetup(safeReadStorage(STORAGE_KEYS.matchSetup, defaultMatchSetup)),
  )
  const [opponentHistory, setOpponentHistory] = useState(() =>
    normalizeOpponentHistory(safeReadStorage(STORAGE_KEYS.opponentHistory, [])),
  )
  const [savedMatches, setSavedMatches] = useState(() =>
    normalizeSavedMatches(safeReadStorage(STORAGE_KEYS.savedMatches, [])),
  )
  const [activeMatch, setActiveMatch] = useState(null)
  const [resultMatch, setResultMatch] = useState(null)
  const [restoreCandidate, setRestoreCandidate] = useState(() =>
    storedActiveMatch?.status && storedActiveMatch.status !== 'completed'
      ? storedActiveMatch
      : null,
  )
  const [isPlayerEditorOpen, setIsPlayerEditorOpen] = useState(() => {
    const storedPlayers = normalizePlayers(
      safeReadStorage(STORAGE_KEYS.players, createEmptyPlayers()),
    )
    return storedPlayers.filter(isRegisteredPlayer).length === 0
  })
  const [notice, setNotice] = useState('')
  const [saveNotice, setSaveNotice] = useState('')
  const [isDataPanelOpen, setIsDataPanelOpen] = useState(false)
  const [isOperationPanelOpen, setIsOperationPanelOpen] = useState(false)
  const [selectedResultScope, setSelectedResultScope] = useState('all')
  const [selectedResultMode, setSelectedResultMode] = useState('team')
  const [isResultRecordListOpen, setIsResultRecordListOpen] = useState(false)
  const [selectedResultRecordPeriod, setSelectedResultRecordPeriod] = useState('first_half')
  const [analysisMode, setAnalysisMode] = useState('team')
  const [selectedSavedMatch, setSelectedSavedMatch] = useState(null)
  const [targetPicker, setTargetPicker] = useState(null)
  const [lastPassPicker, setLastPassPicker] = useState(null)
  const [passErrorPicker, setPassErrorPicker] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [zeroRosterPrompt, setZeroRosterPrompt] = useState(null)
  const [dismissedZeroRosterKey, setDismissedZeroRosterKey] = useState(null)
  const noticeTimerRef = useRef(null)
  const saveTimerRef = useRef(null)
  const importInputRef = useRef(null)
  const didSaveOnceRef = useRef({
    players: false,
    matchSetup: false,
    opponentHistory: false,
    savedMatches: false,
  })

  const registeredPlayers = useMemo(
    () => players.filter(isRegisteredPlayer),
    [players],
  )
  const registeredPlayerIds = useMemo(
    () => registeredPlayers.map((player) => player.id),
    [registeredPlayers],
  )
  const firstHalfMembers = useMemo(
    () => getPlayersByIds(registeredPlayers, matchSetup.firstHalfMemberIds),
    [registeredPlayers, matchSetup.firstHalfMemberIds],
  )
  const secondHalfMembers = useMemo(
    () => getPlayersByIds(registeredPlayers, matchSetup.secondHalfMemberIds),
    [registeredPlayers, matchSetup.secondHalfMemberIds],
  )
  const displayedResultMatch = selectedSavedMatch || resultMatch

  const canStartPreparation =
    matchSetup.opponentName.trim() !== '' &&
    matchSetup.possession !== '' &&
    matchSetup.firstHalfMemberIds.length > 0 &&
    matchSetup.firstHalfMemberIds.length <= MEMBER_LIMIT &&
    matchSetup.secondHalfMemberIds.length > 0 &&
    matchSetup.secondHalfMemberIds.length <= MEMBER_LIMIT

  useEffect(() => {
    safeWriteStorage(STORAGE_KEYS.players, players)
    showSaveNoticeAfterFirstWrite('players', '選手情報を保存しました')
  }, [players])

  useEffect(() => {
    safeWriteStorage(STORAGE_KEYS.matchSetup, { ...matchSetup, matchMinutes: '5' })
    showSaveNoticeAfterFirstWrite('matchSetup', '自動保存済み')
  }, [matchSetup])

  useEffect(() => {
    safeWriteStorage(STORAGE_KEYS.opponentHistory, opponentHistory)
    showSaveNoticeAfterFirstWrite('opponentHistory', '自動保存済み')
  }, [opponentHistory])

  useEffect(() => {
    safeWriteStorage(STORAGE_KEYS.savedMatches, savedMatches)
    showSaveNoticeAfterFirstWrite('savedMatches', '保存済み試合を更新しました')
  }, [savedMatches])

  useEffect(() => {
    if (activeMatch && activeMatch.status !== 'completed') {
      safeWriteStorage(STORAGE_KEYS.activeMatch, activeMatch)
    } else if (!activeMatch) {
      safeRemoveStorage(STORAGE_KEYS.activeMatch)
    }
  }, [activeMatch])

  useEffect(() => {
    const registeredIds = new Set(registeredPlayerIds)
    setMatchSetup((current) => {
      const firstHalfMemberIds = current.firstHalfMemberIds
        .filter((id) => registeredIds.has(id))
        .slice(0, MEMBER_LIMIT)
      const secondHalfMemberIds = current.secondHalfMemberIds
        .filter((id) => registeredIds.has(id))
        .slice(0, MEMBER_LIMIT)

      if (
        current.matchMinutes === '5' &&
        firstHalfMemberIds.length === current.firstHalfMemberIds.length &&
        secondHalfMemberIds.length === current.secondHalfMemberIds.length
      ) {
        return current
      }

      return { ...current, matchMinutes: '5', firstHalfMemberIds, secondHalfMemberIds }
    })
  }, [registeredPlayerIds])

  useEffect(() => {
    if (screen !== 'game' || !activeMatch?.timerRunning) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setActiveMatch((current) => {
        if (!current?.timerRunning) {
          return current
        }

        const remainingTime = getCurrentRemaining(current)
        if (remainingTime <= 0) {
          return {
            ...current,
            remainingTime: 0,
            timerRunning: false,
            timerEndAt: null,
            updatedAt: Date.now(),
          }
        }

        return { ...current, remainingTime, updatedAt: Date.now() }
      })
    }, 250)

    return () => window.clearInterval(timerId)
  }, [screen, activeMatch?.timerRunning])

  useEffect(() => {
    if (screen !== 'game' || !activeMatch) {
      setZeroRosterPrompt(null)
      setDismissedZeroRosterKey(null)
      return
    }

    const members =
      activeMatch.period === 'first_half'
        ? activeMatch.firstHalfMembers
        : activeMatch.secondHalfMembers
    const periodEvents = getEventsForScope(activeMatch.events, activeMatch.period)
    const score = getCurrentRosterScore(periodEvents, members.length)
    const hasZeroRoster = score.rocks === 0 || score.opponent === 0

    if (!hasZeroRoster) {
      if (zeroRosterPrompt) setZeroRosterPrompt(null)
      if (dismissedZeroRosterKey) setDismissedZeroRosterKey(null)
      return
    }

    const key = createZeroRosterKey(activeMatch)
    if (zeroRosterPrompt?.key === key || dismissedZeroRosterKey === key) {
      return
    }

    setZeroRosterPrompt({
      key,
      period: activeMatch.period,
      score,
    })
  }, [activeMatch, dismissedZeroRosterKey, screen, zeroRosterPrompt])

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    }
  }, [])

  function showNotice(message) {
    setNotice(message)
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 900)
  }

  function showSaveNoticeAfterFirstWrite(target, message) {
    if (!didSaveOnceRef.current[target]) {
      didSaveOnceRef.current[target] = true
      return
    }

    setSaveNotice(message)
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => setSaveNotice(''), 1000)
  }

  function updatePlayer(playerId, value) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId ? { ...player, name: value } : player,
      ),
    )
  }

  function updateMatchSetup(field, value) {
    setMatchSetup((current) => ({ ...current, [field]: value, matchMinutes: '5' }))
  }

  function toggleMember(halfKey, playerId) {
    setMatchSetup((current) => {
      const selectedIds = current[halfKey]
      const isSelected = selectedIds.includes(playerId)
      if (!isSelected && selectedIds.length >= MEMBER_LIMIT) return current

      return {
        ...current,
        matchMinutes: '5',
        [halfKey]: isSelected
          ? selectedIds.filter((id) => id !== playerId)
          : [...selectedIds, playerId],
      }
    })
  }

  function setHalfMembers(halfKey, playerIds) {
    setMatchSetup((current) => ({
      ...current,
      matchMinutes: '5',
      [halfKey]: playerIds.slice(0, MEMBER_LIMIT),
    }))
  }

  function saveOpponentCandidate() {
    const opponentName = matchSetup.opponentName.trim()
    if (!opponentName) return
    setOpponentHistory((current) => [
      opponentName,
      ...current.filter((name) => name !== opponentName),
    ])
  }

  function handleStartPreparation() {
    if (!canStartPreparation) return
    saveOpponentCandidate()
    setScreen('waiting')
  }

  function handleGameStart() {
    if (activeMatch?.status === 'second_half_waiting') {
      const secondPossession =
        activeMatch.firstPossession === 'rocks' ? 'opponent' : 'rocks'
      updateActiveMatch((current) => ({
        ...current,
        status: 'second_half_in_progress',
        screen: 'game',
        period: 'second_half',
        currentPossession: secondPossession,
        remainingTime: MATCH_SECONDS,
        timerRunning: true,
        timerEndAt: Date.now() + MATCH_SECONDS * 1000,
      }))
      setScreen('game')
      return
    }

    const match = createMatchFromSetup(matchSetup, firstHalfMembers, secondHalfMembers)
    setActiveMatch(match)
    setScreen('game')
  }

  function updateActiveMatch(updater) {
    setActiveMatch((current) => {
      if (!current) return current
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater }
      return { ...next, updatedAt: Date.now() }
    })
  }

  function handleTimerToggle() {
    updateActiveMatch((current) => {
      if (current.timerRunning) {
        return {
          ...current,
          remainingTime: getCurrentRemaining(current),
          timerRunning: false,
          timerEndAt: null,
        }
      }

      const remainingTime = Math.max(0, current.remainingTime)
      return {
        ...current,
        timerRunning: remainingTime > 0,
        timerEndAt: remainingTime > 0 ? Date.now() + remainingTime * 1000 : null,
      }
    })
  }

  function adjustTime(delta) {
    updateActiveMatch((current) => {
      const remainingTime = Math.max(0, getCurrentRemaining(current) + delta)
      return {
        ...current,
        remainingTime,
        timerRunning: current.timerRunning && remainingTime > 0,
        timerEndAt:
          current.timerRunning && remainingTime > 0
            ? Date.now() + remainingTime * 1000
            : null,
      }
    })
  }

  function setPossession(possession, shouldNotify = true) {
    updateActiveMatch((current) => {
      const shouldFinalize =
        current.currentPossession === 'rocks' && possession === 'opponent'
      return {
        ...(shouldFinalize
          ? finalizePendingAttackFlow(current, current.period, 'single')
          : current),
        currentPossession: possession,
      }
    })
    if (shouldNotify) {
      showNotice(`${possession === 'rocks' ? 'ROCKS' : '相手'}ボールに切り替えました`)
    }
  }

  function openTargetPicker(eventType) {
    if (!activeMatch || !activeMatch.timerRunning) return
    if (teamOnlyPlayEventTypes.has(eventType)) {
      recordTeamOnlyEvent(eventType)
      return
    }
    if (eventType === 'pass_error') {
      setPassErrorPicker({
        eventType,
        label: eventLabels[eventType],
        stage: 'passer',
        passer: null,
        receiver: null,
      })
      return
    }

    setTargetPicker({
      eventType,
      label: eventLabels[eventType],
      kind: 'play',
    })
  }

  function getAutoPossession(eventType) {
    if (
      eventType === 'catch_success' ||
      eventType === 'opponent_pass_error' ||
      eventType === 'pass_interception'
    ) {
      return 'rocks'
    }
    if (
      eventType === 'pass_error' ||
      eventType === 'pass_intercepted' ||
      eventType === 'line_cross' ||
      eventType === 'overtime_violation'
    ) {
      return 'opponent'
    }
    return null
  }

  function recordTeamOnlyEvent(eventType) {
    const label = eventLabels[eventType]
    const autoPossession = getAutoPossession(eventType)

    setActiveMatch((current) => {
      if (!current?.timerRunning) return current
      const event = createEvent(current, eventType, {
        targetScope: 'team',
        playerId: null,
        playerNameSnapshot: 'チーム',
      })
      const baseMatch =
        autoPossession === 'opponent'
          ? finalizePendingAttackFlow(current, current.period, 'single')
          : current
      return {
        ...baseMatch,
        events: [...baseMatch.events, event],
        currentPossession: autoPossession || baseMatch.currentPossession,
        remainingTime: event.remainingTime,
        updatedAt: Date.now(),
      }
    })

    showNotice(`「${label}」を記録しました`)
    if (autoPossession) {
      window.setTimeout(() => {
        showNotice(`${autoPossession === 'rocks' ? 'ROCKS' : '相手'}ボールに切り替えました`)
      }, 260)
    }
  }

  function openEventEditor(event) {
    if (targetPicker || lastPassPicker || passErrorPicker || zeroRosterPrompt) return
    setEditingEvent(event)
  }

  function updateResultMatchEvents(targetEvent, updater) {
    const sourceMatch = displayedResultMatch
    if (!sourceMatch || !targetEvent) return
    const updated = recalculateAttackFlows(
      {
        ...sourceMatch,
        events: updater(sourceMatch.events),
        updatedAt: Date.now(),
      },
      targetEvent.period,
      sourceMatch.status === 'completed',
    )

    setResultMatch((current) =>
      current?.matchId === updated.matchId ? updated : current,
    )
    setSelectedSavedMatch((current) =>
      current?.matchId === updated.matchId ? updated : current,
    )
    setSavedMatches((current) =>
      current.map((match) => (match.matchId === updated.matchId ? updated : match)),
    )
  }

  function saveEditedEvent(eventId, updates) {
    let savedLabel = ''
    const target =
      screen === 'result'
        ? displayedResultMatch?.events.find((event) => event.eventId === eventId)
        : activeMatch?.events.find((event) => event.eventId === eventId)
    if (!target) return

    const updateEvents = (events) =>
      events.map((event) => {
        if (event.eventId !== eventId) return event
        const nextEvent = {
          ...event,
          ...updates,
          eventId: event.eventId,
          matchId: event.matchId,
          eventType: event.eventType,
          period: event.period,
          possession: event.possession,
          elapsedTime: event.elapsedTime,
          remainingTime: event.remainingTime,
          timestamp: event.timestamp,
        }

        if (
          attackEventTypes.has(nextEvent.eventType) &&
          nextEvent.lastPassScope === 'player' &&
          nextEvent.lastPasserId === nextEvent.playerId
        ) {
          return {
            ...nextEvent,
            lastPasserId: null,
            lastPasserNameSnapshot: null,
            lastPassScope: 'unknown',
          }
        }

        return nextEvent
      })

    savedLabel = eventLabels[target.eventType] || '記録'

    if (screen === 'result') {
      updateResultMatchEvents(target, updateEvents)
      setEditingEvent(null)
      showNotice(`「${savedLabel}」を更新しました`)
      return
    }

    updateActiveMatch((current) => {
      const target = current.events.find((event) => event.eventId === eventId)
      if (!target) return current
      const nextEvents = updateEvents(current.events)

      return recalculateAttackFlows(
        {
          ...current,
          events: nextEvents,
        },
        target.period,
      )
    })
    setEditingEvent(null)
    showNotice(`「${savedLabel}」を更新しました`)
  }

  function deleteEditingEvent() {
    if (!editingEvent) return
    if (!window.confirm(`「${eventLabels[editingEvent.eventType]}」を削除しますか？`)) return
    const target = editingEvent
    if (screen === 'result') {
      updateResultMatchEvents(target, (events) =>
        events.filter((event) => event.eventId !== target.eventId),
      )
      setEditingEvent(null)
      showNotice(`「${eventLabels[target.eventType]}」を削除しました`)
      return
    }

    updateActiveMatch((current) =>
      recalculateAttackFlows(
        {
          ...current,
          events: current.events.filter((event) => event.eventId !== target.eventId),
        },
        target.period,
      ),
    )
    setEditingEvent(null)
    showNotice(`「${eventLabels[target.eventType]}」を削除しました`)
  }

  function commitTargetedEvent(target) {
    if (!targetPicker || !activeMatch) return
    const { eventType, label } = targetPicker
    if (attackEventTypes.has(eventType)) {
      setLastPassPicker({ eventType, label, attacker: target })
      setTargetPicker(null)
      return
    }

    const autoPossession = getAutoPossession(eventType)

    setActiveMatch((current) => {
      if (!current) return current
      const baseMatch = autoPossession === 'opponent'
          ? finalizePendingAttackFlow(current, current.period, 'single')
          : current
      const event = createEvent(baseMatch, eventType, {
        ...target,
      })
      return {
        ...baseMatch,
        events: [...baseMatch.events, event],
        currentPossession: autoPossession || baseMatch.currentPossession,
        remainingTime: event.remainingTime,
        updatedAt: Date.now(),
      }
    })

    setTargetPicker(null)
    showNotice(`「${label}」を記録しました`)
    if (autoPossession) {
      window.setTimeout(() => {
        showNotice(`${autoPossession === 'rocks' ? 'ROCKS' : '相手'}ボールに切り替えました`)
      }, 260)
    }
  }

  function selectPassErrorPasser(passer) {
    setPassErrorPicker((current) =>
      current
        ? {
            ...current,
            stage: 'receiver',
            passer,
          }
        : current,
    )
  }

  function selectPassErrorReceiver(receiver) {
    setPassErrorPicker((current) =>
      current
        ? {
            ...current,
            stage: 'cause',
            receiver,
          }
        : current,
    )
  }

  function commitPassError(cause) {
    if (!passErrorPicker || !activeMatch) return
    const { eventType, label, passer, receiver } = passErrorPicker
    if (!passer || !receiver) return

    setActiveMatch((current) => {
      if (!current) return current
      const baseMatch = finalizePendingAttackFlow(current, current.period, 'single')
      const event = createEvent(baseMatch, eventType, {
        targetScope: 'player',
        playerId: passer.id,
        playerNameSnapshot: passer.name,
        passerId: passer.id,
        passerNameSnapshot: passer.name,
        receiverId: receiver.id,
        receiverNameSnapshot: receiver.name,
        passErrorCause: cause,
      })
      return {
        ...baseMatch,
        events: [...baseMatch.events, event],
        currentPossession: 'opponent',
        remainingTime: event.remainingTime,
        updatedAt: Date.now(),
      }
    })

    setPassErrorPicker(null)
    showNotice(`「${label}」を記録しました`)
    window.setTimeout(() => {
      showNotice('相手ボールに切り替えました')
    }, 260)
  }

  function commitAttackWithLastPass(lastPass) {
    if (!lastPassPicker || !activeMatch) return
    const { eventType, label, attacker } = lastPassPicker

    setActiveMatch((current) => {
      if (!current) return current
      const baseMatch = recalculateAttackFlows(current, current.period)
      const event = createEvent(baseMatch, eventType, {
        ...attacker,
        ...lastPass,
        attackFlow: 'pending',
      })
      return recalculateAttackFlows({
        ...baseMatch,
        events: [...baseMatch.events, event],
        remainingTime: event.remainingTime,
        updatedAt: Date.now(),
      }, current.period)
    })

    setLastPassPicker(null)
    showNotice(`「${label}」を記録しました`)
  }

  function undoLastEvent() {
    if (!activeMatch?.events.length || targetPicker || lastPassPicker || passErrorPicker || editingEvent) return
    const lastEvent = activeMatch.events[activeMatch.events.length - 1]
    updateActiveMatch((current) =>
      recalculateAttackFlows(
        {
          ...current,
          events: current.events.slice(0, -1),
        },
        lastEvent.period,
      ),
    )
    showNotice(`「${eventLabels[lastEvent.eventType]}」を取り消しました`)
  }

  function deleteEvent(eventId) {
    if (targetPicker || lastPassPicker || passErrorPicker || editingEvent) return
    const sourceMatch = screen === 'result' ? displayedResultMatch : activeMatch
    const target = sourceMatch?.events.find((event) => event.eventId === eventId)
    if (!target) return
    if (!window.confirm(`「${eventLabels[target.eventType]}」を削除しますか？`)) return
    if (screen === 'result') {
      updateResultMatchEvents(target, (events) =>
        events.filter((event) => event.eventId !== eventId),
      )
      showNotice(`「${eventLabels[target.eventType]}」を削除しました`)
      return
    }
    updateActiveMatch((current) =>
      recalculateAttackFlows(
        {
          ...current,
          events: current.events.filter((event) => event.eventId !== eventId),
        },
        target.period,
      ),
    )
    showNotice(`「${eventLabels[target.eventType]}」を削除しました`)
  }

  function finishFirstHalf(options = {}) {
    if (!options.skipConfirm && !window.confirm('前半を終了してハーフタイム分析へ進みますか？')) return
    updateActiveMatch((current) => ({
      ...recalculateAttackFlows(current, current.period, true),
      status: 'halftime',
      screen: 'halftime',
      remainingTime: getCurrentRemaining(current),
      timerRunning: false,
      timerEndAt: null,
    }))
    setAnalysisMode('team')
    setIsOperationPanelOpen(false)
    setZeroRosterPrompt(null)
    setDismissedZeroRosterKey(null)
    setScreen('halftime')
  }

  function goBackToFirstHalf() {
    if (!window.confirm('前半記録へ戻りますか？')) return
    updateActiveMatch((current) => ({
      ...current,
      status: 'first_half_in_progress',
      screen: 'game',
      period: 'first_half',
      timerRunning: false,
      timerEndAt: null,
    }))
    setScreen('game')
  }

  function prepareSecondHalf() {
    const secondPossession = activeMatch.firstPossession === 'rocks' ? 'opponent' : 'rocks'
    updateActiveMatch((current) => ({
      ...current,
      status: 'second_half_waiting',
      screen: 'waiting',
      period: 'second_half',
      currentPossession: secondPossession,
      remainingTime: MATCH_SECONDS,
      timerRunning: false,
      timerEndAt: null,
    }))
    setScreen('waiting')
  }

  function handleWaitingBack() {
    if (activeMatch?.status === 'second_half_waiting') {
      updateActiveMatch((current) => ({
        ...current,
        status: 'halftime',
        screen: 'halftime',
        period: 'first_half',
        timerRunning: false,
        timerEndAt: null,
      }))
      setScreen('halftime')
      return
    }

    setScreen('setup')
  }

  function finishMatch(options = {}) {
    if (!options.skipConfirm && !window.confirm('試合を終了して試合結果を表示しますか？')) return
    const completedBase = recalculateAttackFlows(
      activeMatch,
      activeMatch.period,
      true,
    )
    const completed = {
      ...completedBase,
      status: 'completed',
      screen: 'result',
      remainingTime: getCurrentRemaining(activeMatch),
      timerRunning: false,
      timerEndAt: null,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    }
    setSavedMatches((current) => [
      completed,
      ...current.filter((match) => match.matchId !== completed.matchId),
    ])
    setResultMatch(completed)
    setSelectedResultScope('all')
    setSelectedResultMode('team')
    setIsResultRecordListOpen(false)
    setSelectedResultRecordPeriod('first_half')
    setActiveMatch(null)
    safeRemoveStorage(STORAGE_KEYS.activeMatch)
    setIsOperationPanelOpen(false)
    setZeroRosterPrompt(null)
    setDismissedZeroRosterKey(null)
    setScreen('result')
  }

  function newMatch() {
    if (!window.confirm('新しい試合を設定しますか？')) return
    setMatchSetup(defaultMatchSetup)
    setActiveMatch(null)
    setResultMatch(null)
    setSelectedSavedMatch(null)
    setSelectedResultScope('all')
    setSelectedResultMode('team')
    setIsResultRecordListOpen(false)
    setSelectedResultRecordPeriod('first_half')
    safeRemoveStorage(STORAGE_KEYS.activeMatch)
    setScreen('setup')
  }

  function resumeActiveMatch() {
    const remainingTime = getCurrentRemaining(restoreCandidate)
    const restored = recalculateAttackFlows({
      ...restoreCandidate,
      remainingTime,
      timerRunning: restoreCandidate.timerRunning && remainingTime > 0,
      timerEndAt:
        restoreCandidate.timerRunning && remainingTime > 0
          ? Date.now() + remainingTime * 1000
          : null,
      updatedAt: Date.now(),
    }, restoreCandidate.period)
    setActiveMatch(restored)
    setRestoreCandidate(null)
    setScreen(restored.screen || (restored.status === 'halftime' ? 'halftime' : 'game'))
  }

  function discardActiveMatch() {
    if (!window.confirm('記録途中の試合を破棄しますか？')) return
    safeRemoveStorage(STORAGE_KEYS.activeMatch)
    setRestoreCandidate(null)
  }

  function exportBackup() {
    const backup = {
      version: 2,
      exportedAt: Date.now(),
      players,
      opponentHistory,
      savedMatches: normalizeSavedMatches(savedMatches),
      activeMatch: normalizeMatch(activeMatch),
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getBackupFileName()
    link.click()
    URL.revokeObjectURL(url)
  }

  function importBackup(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        if (!validateBackup(data)) {
          throw new Error('invalid backup')
        }
        if (!window.confirm('現在のデータをバックアップ内容で置き換えますか？')) {
          return
        }
        const nextActive = normalizeMatch(data.activeMatch)
        const recalculatedActive = nextActive
          ? recalculateAttackFlows(nextActive, nextActive.period)
          : null
        setPlayers(normalizePlayers(data.players))
        setOpponentHistory(normalizeOpponentHistory(data.opponentHistory))
        setSavedMatches(normalizeSavedMatches(data.savedMatches))
        setActiveMatch(recalculatedActive)
        setRestoreCandidate(null)
        setScreen(recalculatedActive?.screen || 'setup')
        showNotice('バックアップを読み込みました')
      } catch {
        window.alert('バックアップJSONの形式が正しくありません。既存データは変更していません。')
      } finally {
        if (importInputRef.current) importInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  function deleteSavedMatch(matchId) {
    if (!window.confirm('保存済み試合を削除しますか？')) return
    setSavedMatches((current) => current.filter((match) => match.matchId !== matchId))
    if (selectedSavedMatch?.matchId === matchId) {
      setSelectedSavedMatch(null)
    }
  }

  function deleteAllSavedMatches() {
    if (!window.confirm('保存済み試合をすべて削除しますか？')) return
    setSavedMatches([])
    setSelectedSavedMatch(null)
  }

  const sharedPanel = (
    <DataPanel
      isOpen={isDataPanelOpen}
      players={players}
      opponentHistory={opponentHistory}
      savedMatches={savedMatches}
      activeMatch={activeMatch}
      importInputRef={importInputRef}
      onClose={() => setIsDataPanelOpen(false)}
      onExport={exportBackup}
      onImport={importBackup}
      onView={(match) => {
        setSelectedSavedMatch(match)
        setResultMatch(match)
        setSelectedResultScope('all')
        setSelectedResultMode('team')
        setIsResultRecordListOpen(false)
        setSelectedResultRecordPeriod('first_half')
        setScreen('result')
        setIsDataPanelOpen(false)
      }}
      onDelete={deleteSavedMatch}
      onDeleteAll={deleteAllSavedMatches}
    />
  )

  if (restoreCandidate) {
    return (
      <main className="app-shell">
        <section className="restore-card">
          <p className="eyebrow">RESTORE</p>
          <h1>記録途中の試合があります</h1>
          <p>ROCKS vs {restoreCandidate.opponentName}</p>
          <strong>
            {restoreCandidate.period === 'first_half' ? '前半' : '後半'}・残り
            {formatTime(getCurrentRemaining(restoreCandidate))}
          </strong>
          <div className="restore-actions">
            <button className="start-button" type="button" onClick={resumeActiveMatch}>
              記録を再開
            </button>
            <button className="secondary-button" type="button" onClick={discardActiveMatch}>
              この記録を破棄
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (screen === 'waiting') {
    return (
      <>
        <WaitingScreen
          matchSetup={matchSetup}
          activeMatch={activeMatch}
          firstHalfMembers={firstHalfMembers}
          secondHalfMembers={secondHalfMembers}
          onGameStart={handleGameStart}
          onBack={handleWaitingBack}
        />
        {notice && <div className="top-notice">{notice}</div>}
        {saveNotice && <div className="save-toast">{saveNotice}</div>}
        {sharedPanel}
      </>
    )
  }

  if (screen === 'game' && activeMatch) {
    const gameMembers =
      activeMatch.period === 'first_half'
        ? activeMatch.firstHalfMembers
        : activeMatch.secondHalfMembers

    return (
      <>
        <GameScreen
          match={activeMatch}
          members={gameMembers}
          operationPanelOpen={isOperationPanelOpen}
          targetPickerOpen={Boolean(targetPicker || lastPassPicker || passErrorPicker || editingEvent || zeroRosterPrompt)}
          onToggleOperationPanel={() => setIsOperationPanelOpen(true)}
          onCloseOperationPanel={() => setIsOperationPanelOpen(false)}
          onToggleTimer={handleTimerToggle}
          onAdjustTime={adjustTime}
          onPossessionChange={setPossession}
          onRecord={openTargetPicker}
          onEditEvent={openEventEditor}
          onUndo={undoLastEvent}
          onDeleteEvent={deleteEvent}
          onFinishFirstHalf={finishFirstHalf}
          onFinishMatch={finishMatch}
        />
        {targetPicker && (
          <TargetPicker
            pending={targetPicker}
            members={gameMembers}
            outPlayerIds={getOutPlayerIds(activeMatch.events, activeMatch.period)}
            onSelect={commitTargetedEvent}
            onCancel={() => setTargetPicker(null)}
          />
        )}
        {lastPassPicker && (
          <LastPassPicker
            attacker={lastPassPicker.attacker}
            members={gameMembers}
            onSelect={commitAttackWithLastPass}
            onCancel={() => setLastPassPicker(null)}
          />
        )}
        {passErrorPicker && (
          <PassErrorPicker
            pending={passErrorPicker}
            members={gameMembers}
            onSelectPasser={selectPassErrorPasser}
            onSelectReceiver={selectPassErrorReceiver}
            onSelectCause={commitPassError}
            onCancel={() => setPassErrorPicker(null)}
          />
        )}
        {editingEvent && (
          <EventEditor
            event={editingEvent}
            members={gameMembers}
            onSave={saveEditedEvent}
            onDelete={deleteEditingEvent}
            onCancel={() => setEditingEvent(null)}
          />
        )}
        {zeroRosterPrompt && (
          <ZeroRosterPrompt
            prompt={zeroRosterPrompt}
            onConfirm={() => {
              if (zeroRosterPrompt.period === 'first_half') {
                finishFirstHalf({ skipConfirm: true })
              } else {
                finishMatch({ skipConfirm: true })
              }
            }}
            onBack={() => {
              setDismissedZeroRosterKey(zeroRosterPrompt.key)
              setZeroRosterPrompt(null)
            }}
          />
        )}
        {notice && <div className="top-notice">{notice}</div>}
        {saveNotice && <div className="save-toast">{saveNotice}</div>}
        {sharedPanel}
      </>
    )
  }

  if (screen === 'halftime' && activeMatch) {
    return (
      <>
        <AnalysisScreen
          title="ハーフタイム分析"
          match={activeMatch}
          scope="first_half"
          mode={analysisMode}
          members={activeMatch.firstHalfMembers}
          onModeChange={setAnalysisMode}
          onPrimary={prepareSecondHalf}
          primaryLabel="後半準備へ"
          onSecondary={goBackToFirstHalf}
          secondaryLabel="前半記録へ戻る"
        />
        {notice && <div className="top-notice">{notice}</div>}
        {saveNotice && <div className="save-toast">{saveNotice}</div>}
        {sharedPanel}
      </>
    )
  }

  if (screen === 'result' && displayedResultMatch) {
    return (
      <>
        <ResultScreen
          match={displayedResultMatch}
          selectedScope={selectedResultScope}
          selectedMode={selectedResultMode}
          isRecordListOpen={isResultRecordListOpen}
          selectedRecordPeriod={selectedResultRecordPeriod}
          onScopeChange={setSelectedResultScope}
          onModeChange={setSelectedResultMode}
          onToggleRecordList={() => setIsResultRecordListOpen((current) => !current)}
          onRecordPeriodChange={setSelectedResultRecordPeriod}
          onEditEvent={openEventEditor}
          onDeleteEvent={deleteEvent}
          onNewMatch={newMatch}
          onOpenData={() => setIsDataPanelOpen(true)}
        />
        {editingEvent && (
          <EventEditor
            event={editingEvent}
            members={
              editingEvent.period === 'first_half'
                ? displayedResultMatch.firstHalfMembers
                : displayedResultMatch.secondHalfMembers
            }
            onSave={saveEditedEvent}
            onDelete={deleteEditingEvent}
            onCancel={() => setEditingEvent(null)}
          />
        )}
        {notice && <div className="top-notice">{notice}</div>}
        {saveNotice && <div className="save-toast">{saveNotice}</div>}
        {sharedPanel}
      </>
    )
  }

  return (
    <>
      <SetupScreen
        players={players}
        registeredPlayers={registeredPlayers}
        registeredPlayerIds={registeredPlayerIds}
        matchSetup={matchSetup}
        opponentHistory={opponentHistory}
        canStartPreparation={canStartPreparation}
        isPlayerEditorOpen={isPlayerEditorOpen}
        onTogglePlayerEditor={() => setIsPlayerEditorOpen((current) => !current)}
        onPlayerChange={updatePlayer}
        onMatchSetupChange={updateMatchSetup}
        onToggleMember={toggleMember}
        onSetHalfMembers={setHalfMembers}
        onOpponentBlur={saveOpponentCandidate}
        onStart={handleStartPreparation}
        onOpenData={() => setIsDataPanelOpen(true)}
      />
      {notice && <div className="top-notice">{notice}</div>}
      {saveNotice && <div className="save-toast">{saveNotice}</div>}
      {sharedPanel}
    </>
  )
}

function SetupScreen({
  players,
  registeredPlayers,
  registeredPlayerIds,
  matchSetup,
  opponentHistory,
  canStartPreparation,
  isPlayerEditorOpen,
  onTogglePlayerEditor,
  onPlayerChange,
  onMatchSetupChange,
  onToggleMember,
  onSetHalfMembers,
  onOpponentBlur,
  onStart,
  onOpenData,
}) {
  return (
    <main className="app-shell">
      <header className="scoreboard-header">
        <div>
          <p className="eyebrow">DODGEBALL RECORDER</p>
          <h1>試合前設定</h1>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={onOpenData}>
            データ管理
          </button>
          <div className="status-panel">
            <span>試合時間</span>
            <strong>5分</strong>
          </div>
        </div>
      </header>

      <section className="player-section">
        <div className="player-summary">
          <div>
            <p className="eyebrow">ROCKS PLAYERS</p>
            <h2>ROCKS選手</h2>
            <p>{registeredPlayers.length}人登録済み</p>
          </div>
          <button className="secondary-button" type="button" onClick={onTogglePlayerEditor}>
            {isPlayerEditorOpen ? '選手登録を閉じる' : '選手を登録・編集'}
          </button>
        </div>
        {isPlayerEditorOpen && (
          <div className="player-editor">
            <p className="helper-text">12人分の表示名を登録できます。空欄は未登録として扱います。</p>
            <div className="player-grid">
              {players.map((player, index) => (
                <label className="player-row" key={player.id}>
                  <span>表示名 {index + 1}</span>
                  <input
                    value={player.name}
                    onChange={(event) => onPlayerChange(player.id, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="setup-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MATCH INFO</p>
            <h2>試合情報</h2>
          </div>
        </div>
        <div className="match-info-grid">
          <label className="field opponent-field">
            <span>対戦相手名</span>
            <input
              list="opponent-history"
              value={matchSetup.opponentName}
              onBlur={onOpponentBlur}
              onChange={(event) => onMatchSetupChange('opponentName', event.target.value)}
            />
            <datalist id="opponent-history">
              {opponentHistory.map((name) => (
                <option value={name} key={name} />
              ))}
            </datalist>
          </label>
          <div className="fixed-time-card" aria-label="試合時間 5分">
            <span>試合時間</span>
            <strong>5分</strong>
          </div>
        </div>
        <div className="choice-group" aria-label="ROCKSの先攻または後攻">
          {[
            ['first', '先攻'],
            ['second', '後攻'],
          ].map(([value, label]) => (
            <button
              className={
                matchSetup.possession === value ? 'choice-button selected' : 'choice-button'
              }
              key={value}
              type="button"
              onClick={() => onMatchSetupChange('possession', value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="members-layout">
        <MemberSelector
          heading="前半メンバー"
          headingId="first-half-members"
          players={registeredPlayers}
          selectedIds={matchSetup.firstHalfMemberIds}
          actions={[
            {
              label: '全員選択',
              onClick: () => onSetHalfMembers('firstHalfMemberIds', registeredPlayerIds),
            },
            { label: '選択解除', onClick: () => onSetHalfMembers('firstHalfMemberIds', []) },
          ]}
          onToggle={(playerId) => onToggleMember('firstHalfMemberIds', playerId)}
        />
        <MemberSelector
          heading="後半メンバー"
          headingId="second-half-members"
          players={registeredPlayers}
          selectedIds={matchSetup.secondHalfMemberIds}
          actions={[
            {
              label: '全員選択',
              onClick: () => onSetHalfMembers('secondHalfMemberIds', registeredPlayerIds),
            },
            { label: '選択解除', onClick: () => onSetHalfMembers('secondHalfMemberIds', []) },
          ]}
          onToggle={(playerId) => onToggleMember('secondHalfMemberIds', playerId)}
        />
      </div>

      <footer className="action-bar">
        <p className={canStartPreparation ? 'ready-text' : 'ready-text muted'}>
          {canStartPreparation
            ? '記録準備を開始できます。'
            : '必須項目を入力すると開始できます。'}
        </p>
        <button className="start-button" type="button" disabled={!canStartPreparation} onClick={onStart}>
          記録準備開始
        </button>
      </footer>
    </main>
  )
}

function MemberSelector({ heading, headingId, players, selectedIds, actions, onToggle }) {
  const selectionLimitReached = selectedIds.length >= MEMBER_LIMIT

  return (
    <section className="setup-section member-section" aria-labelledby={headingId}>
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">MEMBERS</p>
          <h2 id={headingId}>{heading}</h2>
        </div>
        <p>
          {selectedIds.length}人選択中 / 最大{MEMBER_LIMIT}人
        </p>
      </div>
      <div className="member-actions">
        {actions.map((action) => (
          <button
            className="mini-button"
            key={action.label}
            type="button"
            onClick={action.onClick}
            disabled={players.length === 0}
          >
            {action.label}
          </button>
        ))}
      </div>
      {players.length === 0 ? (
        <p className="empty-state">登録済み選手がまだありません。</p>
      ) : (
        <div className="member-grid">
          {players.map((player) => {
            const selected = selectedIds.includes(player.id)
            const disabled = !selected && selectionLimitReached
            return (
              <button
                className={selected ? 'member-button selected' : 'member-button'}
                disabled={disabled}
                key={player.id}
                type="button"
                onClick={() => onToggle(player.id)}
              >
                {player.name}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

function WaitingScreen({ matchSetup, activeMatch, firstHalfMembers, secondHalfMembers, onGameStart, onBack }) {
  const isSecondHalf = activeMatch?.status === 'second_half_waiting'
  const members = isSecondHalf ? secondHalfMembers : firstHalfMembers
  const possession = isSecondHalf
    ? activeMatch.currentPossession
    : matchSetup.possession === 'first'
      ? 'rocks'
      : 'opponent'

  return (
    <main className="app-shell waiting-shell">
      <header className="scoreboard-header">
        <div>
          <p className="eyebrow">READY TO START</p>
          <h1>{isSecondHalf ? '後半開始待機' : '試合開始待機'}</h1>
        </div>
        <div className="status-panel">
          <span>試合時間</span>
          <strong>5分</strong>
        </div>
      </header>
      <section className="versus-panel">
        <p className="eyebrow">MATCHUP</p>
        <h2>ROCKS vs {activeMatch?.opponentName || matchSetup.opponentName}</h2>
        <div className="match-summary-grid">
          <div>
            <span>初期ボール保持</span>
            <strong>{possession === 'rocks' ? 'ROCKSボール' : '相手ボール'}</strong>
          </div>
        </div>
      </section>
      <div className="waiting-members-layout single">
        <WaitingMemberList heading={isSecondHalf ? '後半メンバー' : '前半メンバー'} members={members} />
      </div>
      <section className="waiting-action-row">
        <button className="secondary-button back-button" type="button" onClick={onBack}>
          {isSecondHalf ? 'ハーフタイムへ戻る' : '設定に戻る'}
        </button>
        <button className="game-start-button" type="button" onClick={onGameStart}>
          {isSecondHalf ? '後半ゲームスタート' : 'ゲームスタート'}
        </button>
      </section>
    </main>
  )
}

function WaitingMemberList({ heading, members }) {
  return (
    <section className="setup-section waiting-member-section">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">MEMBERS</p>
          <h2>{heading}</h2>
        </div>
        <p>{members.length}人</p>
      </div>
      <div className="waiting-member-grid">
        {members.map((member) => (
          <div className="waiting-member-name" key={member.id}>
            {member.name}
          </div>
        ))}
      </div>
    </section>
  )
}

function GameScreen({
  match,
  members,
  operationPanelOpen,
  targetPickerOpen,
  onToggleOperationPanel,
  onCloseOperationPanel,
  onToggleTimer,
  onAdjustTime,
  onPossessionChange,
  onRecord,
  onEditEvent,
  onUndo,
  onDeleteEvent,
  onFinishFirstHalf,
  onFinishMatch,
}) {
  const currentEvents = getEventsForScope(match.events, match.period)
  const recentEvents = currentEvents.slice(-3).reverse()
  const availablePlays = playEvents[match.currentPossession]
  const disabled = !match.timerRunning || targetPickerOpen
  const rosterScore = getCurrentRosterScore(currentEvents, members.length)

  return (
    <main className="app-shell game-shell">
      <header className="game-top">
        <div>
          <p className="eyebrow">{match.period === 'first_half' ? 'FIRST HALF' : 'SECOND HALF'}</p>
          <h1>ROCKS vs {match.opponentName}</h1>
          <p>{match.timerRunning ? '試合進行中' : 'タイマー停止中'}</p>
        </div>
        <div className="game-top-actions">
          <button className="undo-button" type="button" onClick={onUndo} disabled={!match.events.length || targetPickerOpen}>
            ↶ 直前取消
          </button>
          <button className="secondary-button" type="button" onClick={onToggleOperationPanel}>
            試合操作
          </button>
        </div>
      </header>

      <section className={match.timerRunning ? 'timer-card' : 'timer-card paused'}>
        <span>{match.period === 'first_half' ? '前半' : '後半'} 残り時間</span>
        <strong>{formatTime(match.remainingTime)}</strong>
      </section>

      <section className="live-roster-score" aria-label="現在の内野人数">
        <span>ROCKS</span>
        <strong>{rosterScore.rocks}</strong>
        <b>－</b>
        <strong>{rosterScore.opponent}</strong>
        <span>相手</span>
      </section>

      {match.period === 'second_half' && (
        <SecondHalfGoalPanel match={match} secondScore={rosterScore} />
      )}

      <section className="ball-toggle large">
        {[
          ['rocks', 'ROCKSボール'],
          ['opponent', '相手ボール'],
        ].map(([value, label]) => (
          <button
            className={match.currentPossession === value ? 'ball-button selected' : 'ball-button'}
            key={value}
            type="button"
            onClick={() => onPossessionChange(value)}
            disabled={targetPickerOpen}
          >
            <span>{match.currentPossession === value ? '●' : '○'}</span>
            {label}
          </button>
        ))}
      </section>

      <section className={`play-grid ${match.currentPossession}`}>
        {availablePlays.map((event) => (
          <button
            className={`play-button ${event.tone}`}
            key={event.eventType}
            type="button"
            onClick={() => onRecord(event.eventType)}
            disabled={disabled}
          >
            <span>{event.symbol}</span>
            {event.label}
          </button>
        ))}
      </section>

      {match.currentPossession === 'rocks' && (
        <section className="foul-grid" aria-label="ROCKSの反則">
          {foulEvents.map((event) => (
            <button
              className={`foul-button ${event.tone}`}
              key={event.eventType}
              type="button"
              onClick={() => onRecord(event.eventType)}
              disabled={disabled}
            >
              {event.label}
            </button>
          ))}
        </section>
      )}

      <div className="game-bottom-layout">
        <section className="history-panel">
          <div className="section-heading compact">
            <h2>直近履歴</h2>
          </div>
          {recentEvents.length === 0 ? (
            <p className="empty-state">記録はまだありません</p>
          ) : (
            recentEvents.map((event) => (
              <div
                className={`history-row ${getHistoryTone(event.eventType)}`}
                key={event.eventId}
                role="button"
                tabIndex={0}
                onClick={() => onEditEvent(event)}
                onKeyDown={(keyEvent) => {
                  if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                    keyEvent.preventDefault()
                    onEditEvent(event)
                  }
                }}
              >
                <span>{formatTime(event.remainingTime)}</span>
                <strong>
                  {getHistoryTargetLabel(event) && (
                    <span className="history-target">{getHistoryTargetLabel(event)}</span>
                  )}
                  {getHistoryEventLabel(event)}
                  {attackEventTypes.has(event.eventType) && (
                    <span className="history-subline">
                      ラストパス：{getLastPassLabel(event)}
                    </span>
                  )}
                  {event.eventType === 'pass_error' &&
                    getPassErrorHistoryLines(event).map((line) => (
                      <span className="history-subline" key={line}>
                        {line}
                      </span>
                    ))}
                </strong>
                <button
                  type="button"
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation()
                    onDeleteEvent(event.eventId)
                  }}
                  disabled={targetPickerOpen}
                >
                  削除
                </button>
              </div>
            ))
          )}
        </section>
        <section className="game-member-list">
          <div className="section-heading compact">
            <h2>{match.period === 'first_half' ? '前半メンバー' : '後半メンバー'}</h2>
            <p>{members.length}人</p>
          </div>
          <div className="compact-member-grid">
            {members.map((member) => (
              <span key={member.id}>{member.name}</span>
            ))}
          </div>
        </section>
      </div>

      {operationPanelOpen && (
        <aside className="operation-panel">
          <h2>試合操作</h2>
          <button type="button" onClick={onToggleTimer}>
            {match.timerRunning ? '一時停止' : '再開'}
          </button>
          <button type="button" onClick={() => onAdjustTime(10)}>
            残り時間＋10秒
          </button>
          <button type="button" onClick={() => onAdjustTime(-10)}>
            残り時間−10秒
          </button>
          {match.period === 'first_half' ? (
            <button type="button" onClick={onFinishFirstHalf}>
              前半終了
            </button>
          ) : (
            <button type="button" onClick={onFinishMatch}>
              試合終了
            </button>
          )}
          <button type="button" onClick={onCloseOperationPanel}>
            パネルを閉じる
          </button>
        </aside>
      )}
    </main>
  )
}

function TargetPicker({ pending, members, outPlayerIds, onSelect, onCancel }) {
  const shouldBlockOutPlayers = defensiveTargetEventTypes.has(pending.eventType)
  const targetQuestion =
    pending.eventType === 'line_cross' ? 'ラインクロスした選手は？' : '誰のプレーですか？'

  return (
    <div className="target-overlay" role="presentation">
      <section className="target-modal" role="dialog" aria-modal="true">
        <p className="eyebrow">PLAY TARGET</p>
        <h2>{pending.label}を記録</h2>
        <p>{targetQuestion}</p>
        <div className="target-player-grid">
          {members.map((member) => {
            const isOut = shouldBlockOutPlayers && outPlayerIds.has(member.id)
            return (
              <button
                className={isOut ? 'target-player-button out' : 'target-player-button'}
                disabled={isOut}
                key={member.id}
                type="button"
                onClick={() =>
                  onSelect({
                    targetScope: 'player',
                    playerId: member.id,
                    playerNameSnapshot: member.name,
                  })
                }
              >
                <span>{member.name}</span>
                {isOut && <small>アウト</small>}
              </button>
            )
          })}
        </div>
        <div className="target-option-row">
          <button
            className="target-unknown-button"
            type="button"
            onClick={() =>
              onSelect({
                targetScope: 'unknown',
                playerId: null,
                playerNameSnapshot: '不明',
              })
            }
          >
            選手不明
          </button>
          <button className="target-cancel-button" type="button" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      </section>
    </div>
  )
}

function LastPassPicker({ attacker, members, onSelect, onCancel }) {
  return (
    <div className="target-overlay" role="presentation">
      <section className="target-modal" role="dialog" aria-modal="true">
        <p className="eyebrow">LAST PASS</p>
        <h2>アタック前のラストパスは？</h2>
        <p>パスを出した選手、パスなし、不明を選んでください</p>
        <div className="target-player-grid">
          {members.map((member) => {
            const isAttacker = member.id === attacker.playerId
            return (
              <button
                className={
                  isAttacker ? 'target-player-button unavailable' : 'target-player-button'
                }
                disabled={isAttacker}
                key={member.id}
                type="button"
                onClick={() =>
                  onSelect({
                    lastPassScope: 'player',
                    lastPasserId: member.id,
                    lastPasserNameSnapshot: member.name,
                  })
                }
              >
                <span>{member.name}</span>
                {isAttacker && <small>アタック選手</small>}
              </button>
            )
          })}
        </div>
        <div className="target-option-row">
          <button
            className="target-none-button"
            type="button"
            onClick={() =>
              onSelect({
                lastPassScope: 'none',
                lastPasserId: null,
                lastPasserNameSnapshot: null,
              })
            }
          >
            パスなし
          </button>
          <button
            className="target-unknown-button"
            type="button"
            onClick={() =>
              onSelect({
                lastPassScope: 'unknown',
                lastPasserId: null,
                lastPasserNameSnapshot: null,
              })
            }
          >
            不明
          </button>
          <button className="target-cancel-button" type="button" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      </section>
    </div>
  )
}

function PassErrorPicker({
  pending,
  members,
  onSelectPasser,
  onSelectReceiver,
  onSelectCause,
  onCancel,
}) {
  const isReceiverStage = pending.stage === 'receiver'
  const isCauseStage = pending.stage === 'cause'
  const title = pending.stage === 'passer'
    ? '投げた選手は？'
    : isReceiverStage
      ? '受ける予定だった選手は？'
      : '主な原因は？'

  return (
    <div className="target-overlay" role="presentation">
      <section className="target-modal" role="dialog" aria-modal="true">
        <p className="eyebrow">PASS ERROR</p>
        <h2>{title}</h2>
        <p>
          {isCauseStage
            ? `${pending.passer?.name ?? ''} から ${pending.receiver?.name ?? ''} へのパス`
            : '出場メンバーから選んでください'}
        </p>

        {!isCauseStage && (
          <div className="target-player-grid">
            {members.map((member) => {
              const isPasser = isReceiverStage && member.id === pending.passer?.id
              return (
                <button
                  className={
                    isPasser ? 'target-player-button unavailable' : 'target-player-button'
                  }
                  disabled={isPasser}
                  key={member.id}
                  type="button"
                  onClick={() =>
                    isReceiverStage
                      ? onSelectReceiver(member)
                      : onSelectPasser(member)
                  }
                >
                  <span>{member.name}</span>
                  {isPasser && <small>投げ手</small>}
                </button>
              )
            })}
          </div>
        )}

        {isCauseStage && (
          <div className="target-option-row pass-cause-row">
            <button
              className="target-cause-button"
              type="button"
              onClick={() => onSelectCause('passer')}
            >
              投げ手
            </button>
            <button
              className="target-cause-button"
              type="button"
              onClick={() => onSelectCause('receiver')}
            >
              受け手
            </button>
            <button
              className="target-cause-button"
              type="button"
              onClick={() => onSelectCause('both')}
            >
              両方
            </button>
          </div>
        )}

        <div className="target-option-row single-action-row">
          <button className="target-cancel-button" type="button" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      </section>
    </div>
  )
}

const simplePlayerEditEventTypes = new Set([
  'catch_success',
  'hit_received',
  'pass_interception',
  'pass_intercepted',
  'line_cross',
])

function EventEditor({ event, members, onSave, onDelete, onCancel }) {
  const [playerId, setPlayerId] = useState(Number.isInteger(event.playerId) ? event.playerId : null)
  const [targetScope, setTargetScope] = useState(event.targetScope === 'player' ? 'player' : 'unknown')
  const [lastPassScope, setLastPassScope] = useState(event.lastPassScope || 'unknown')
  const [lastPasserId, setLastPasserId] = useState(
    Number.isInteger(event.lastPasserId) ? event.lastPasserId : null,
  )
  const [passerId, setPasserId] = useState(
    Number.isInteger(event.passerId)
      ? event.passerId
      : Number.isInteger(event.playerId)
        ? event.playerId
        : null,
  )
  const [receiverId, setReceiverId] = useState(Number.isInteger(event.receiverId) ? event.receiverId : null)
  const [passErrorCause, setPassErrorCause] = useState(event.passErrorCause || '')
  const isAttack = attackEventTypes.has(event.eventType)
  const isPassError = event.eventType === 'pass_error'
  const isSimplePlayerEdit = simplePlayerEditEventTypes.has(event.eventType)
  const isReadOnly = event.eventType === 'overtime_violation' || event.eventType === 'opponent_pass_error'
  const eventLabel = eventLabels[event.eventType] || event.eventType
  const selectedPlayer = members.find((member) => member.id === playerId)
  const selectedPasser = members.find((member) => member.id === passerId)
  const selectedReceiver = members.find((member) => member.id === receiverId)
  const selectedLastPasser = members.find((member) => member.id === lastPasserId)

  function choosePlayer(member) {
    setPlayerId(member.id)
    setTargetScope('player')
    if (isAttack && member.id === lastPasserId) {
      setLastPassScope('unknown')
      setLastPasserId(null)
    }
  }

  function handleSave() {
    if (isAttack) {
      const playerUpdates =
        targetScope === 'player' && selectedPlayer
          ? {
              targetScope: 'player',
              playerId: selectedPlayer.id,
              playerNameSnapshot: selectedPlayer.name,
            }
          : {
              targetScope: 'unknown',
              playerId: null,
              playerNameSnapshot: '不明',
            }
      const lastPassUpdates =
        lastPassScope === 'player' && selectedLastPasser
          ? {
              lastPassScope: 'player',
              lastPasserId: selectedLastPasser.id,
              lastPasserNameSnapshot: selectedLastPasser.name,
            }
          : {
              lastPassScope,
              lastPasserId: null,
              lastPasserNameSnapshot: null,
            }
      onSave(event.eventId, { ...playerUpdates, ...lastPassUpdates })
      return
    }

    if (isPassError && selectedPasser && selectedReceiver && passErrorCause) {
      onSave(event.eventId, {
        targetScope: 'player',
        playerId: selectedPasser.id,
        playerNameSnapshot: selectedPasser.name,
        passerId: selectedPasser.id,
        passerNameSnapshot: selectedPasser.name,
        receiverId: selectedReceiver.id,
        receiverNameSnapshot: selectedReceiver.name,
        passErrorCause,
      })
      return
    }

    if (isSimplePlayerEdit) {
      const updates =
        targetScope === 'player' && selectedPlayer
          ? {
              targetScope: 'player',
              playerId: selectedPlayer.id,
              playerNameSnapshot: selectedPlayer.name,
            }
          : {
              targetScope: 'unknown',
              playerId: null,
              playerNameSnapshot: '不明',
            }
      onSave(event.eventId, updates)
    }
  }

  const canSave =
    !isReadOnly &&
    ((isAttack && (targetScope === 'unknown' || selectedPlayer)) ||
      (isPassError && selectedPasser && selectedReceiver && selectedPasser.id !== selectedReceiver.id && passErrorCause) ||
      (isSimplePlayerEdit && (targetScope === 'unknown' || selectedPlayer)))

  return (
    <div className="target-overlay" role="presentation">
      <section className="target-modal event-editor-modal" role="dialog" aria-modal="true">
        <p className="eyebrow">EDIT RECORD</p>
        <h2>{eventLabel}を編集</h2>
        <div className="event-edit-meta">
          <span>記録時刻 {formatTime(event.remainingTime)}</span>
          <span>{event.period === 'first_half' ? '前半' : '後半'}</span>
        </div>
        <p>現在: {getEventEditSummary(event)}</p>

        {isAttack && (
          <>
            <EventEditSection title="アタックした選手">
              <PlayerEditGrid
                members={members}
                selectedId={targetScope === 'player' ? playerId : null}
                onSelect={choosePlayer}
              />
              <OptionButton selected={targetScope === 'unknown'} onClick={() => setTargetScope('unknown')}>
                選手不明
              </OptionButton>
            </EventEditSection>
            <EventEditSection title="ラストパス">
              <PlayerEditGrid
                members={members}
                selectedId={lastPassScope === 'player' ? lastPasserId : null}
                unavailableId={targetScope === 'player' ? playerId : null}
                unavailableLabel="アタック選手"
                onSelect={(member) => {
                  setLastPassScope('player')
                  setLastPasserId(member.id)
                }}
              />
              <div className="target-option-row">
                <OptionButton selected={lastPassScope === 'none'} onClick={() => setLastPassScope('none')}>
                  パスなし
                </OptionButton>
                <OptionButton selected={lastPassScope === 'unknown'} onClick={() => setLastPassScope('unknown')}>
                  不明
                </OptionButton>
              </div>
            </EventEditSection>
          </>
        )}

        {isPassError && (
          <>
            <EventEditSection title="投げ手">
              <PlayerEditGrid members={members} selectedId={passerId} onSelect={(member) => setPasserId(member.id)} />
            </EventEditSection>
            <EventEditSection title="受け手">
              <PlayerEditGrid
                members={members}
                selectedId={receiverId}
                unavailableId={passerId}
                unavailableLabel="投げ手"
                onSelect={(member) => setReceiverId(member.id)}
              />
            </EventEditSection>
            <EventEditSection title="原因">
              <div className="target-option-row pass-cause-row">
                <OptionButton selected={passErrorCause === 'passer'} onClick={() => setPassErrorCause('passer')}>
                  投げ手
                </OptionButton>
                <OptionButton selected={passErrorCause === 'receiver'} onClick={() => setPassErrorCause('receiver')}>
                  受け手
                </OptionButton>
                <OptionButton selected={passErrorCause === 'both'} onClick={() => setPassErrorCause('both')}>
                  両方
                </OptionButton>
              </div>
            </EventEditSection>
          </>
        )}

        {isSimplePlayerEdit && (
          <EventEditSection title="対象選手">
            <PlayerEditGrid members={members} selectedId={targetScope === 'player' ? playerId : null} onSelect={choosePlayer} />
            <OptionButton selected={targetScope === 'unknown'} onClick={() => setTargetScope('unknown')}>
              選手不明
            </OptionButton>
          </EventEditSection>
        )}

        {isReadOnly && (
          <p className="event-edit-readonly">この記録は選手情報を持ちません。削除のみ可能です。</p>
        )}

        <div className="event-edit-actions">
          <button className="primary-button" type="button" onClick={handleSave} disabled={!canSave}>
            変更を保存
          </button>
          <button className="target-cancel-button" type="button" onClick={onCancel}>
            キャンセル
          </button>
          <button className="event-edit-delete-button" type="button" onClick={onDelete}>
            この記録を削除
          </button>
        </div>
      </section>
    </div>
  )
}

function EventEditSection({ title, children }) {
  return (
    <section className="event-edit-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function PlayerEditGrid({ members, selectedId, unavailableId, unavailableLabel, onSelect }) {
  return (
    <div className="target-player-grid">
      {members.map((member) => {
        const isSelected = member.id === selectedId
        const isUnavailable = Number.isInteger(unavailableId) && member.id === unavailableId
        return (
          <button
            className={[
              'target-player-button',
              isSelected ? 'selected' : '',
              isUnavailable ? 'unavailable' : '',
            ].filter(Boolean).join(' ')}
            disabled={isUnavailable}
            key={member.id}
            type="button"
            onClick={() => onSelect(member)}
          >
            <span>{member.name}</span>
            {isUnavailable && <small>{unavailableLabel}</small>}
          </button>
        )
      })}
    </div>
  )
}

function OptionButton({ selected, onClick, children }) {
  return (
    <button
      className={selected ? 'target-cause-button selected' : 'target-cause-button'}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function ZeroRosterPrompt({ prompt, onConfirm, onBack }) {
  const isFirstHalf = prompt.period === 'first_half'
  const actionLabel = isFirstHalf ? '前半終了' : '試合終了'
  const leadText = getZeroRosterLeadText(prompt.score)
  const questionText = isFirstHalf
    ? '前半を終了しますか？'
    : '試合を終了しますか？'

  return (
    <div className="target-overlay" role="presentation">
      <section className="target-modal zero-roster-modal" role="dialog" aria-modal="true">
        <p className="eyebrow">ROSTER CHECK</p>
        <h2>{leadText}</h2>
        <p>{questionText}</p>
        <div className="zero-roster-score">
          <span>ROCKS</span>
          <strong>{prompt.score.rocks}</strong>
          <b>－</b>
          <strong>{prompt.score.opponent}</strong>
          <span>相手</span>
        </div>
        <div className="zero-roster-actions">
          <button className="zero-roster-confirm" type="button" onClick={onConfirm}>
            {actionLabel}
          </button>
          <button className="zero-roster-back" type="button" onClick={onBack}>
            記録へ戻る
          </button>
        </div>
      </section>
    </div>
  )
}

function AnalysisScreen({
  title,
  match,
  scope,
  mode,
  members,
  onModeChange,
  onPrimary,
  primaryLabel,
  onSecondary,
  secondaryLabel,
}) {
  return (
    <main className="app-shell analysis-shell">
      <header className="scoreboard-header">
        <div>
          <p className="eyebrow">ANALYSIS</p>
          <h1>{title}</h1>
        </div>
      </header>
      <ModeTabs selectedMode={mode} onModeChange={onModeChange} />
      <HalftimeGoalPanel match={match} />
      <RosterTrendSection match={match} scope={scope} />
      <StatsView match={match} scope={scope} mode={mode} members={members} compactPlayer />
      <div className="analysis-actions">
        <button className="start-button" type="button" onClick={onPrimary}>
          {primaryLabel}
        </button>
        <button className="secondary-button" type="button" onClick={onSecondary}>
          {secondaryLabel}
        </button>
      </div>
    </main>
  )
}

function ResultScreen({
  match,
  selectedScope,
  selectedMode,
  isRecordListOpen,
  selectedRecordPeriod,
  onScopeChange,
  onModeChange,
  onToggleRecordList,
  onRecordPeriodChange,
  onEditEvent,
  onDeleteEvent,
  onNewMatch,
  onOpenData,
}) {
  const members = getMembersForScope(match, selectedScope)

  return (
    <main className="app-shell result-shell">
      <header className="scoreboard-header">
        <div>
          <p className="eyebrow">RESULT</p>
          <h1>試合結果</h1>
          <p>ROCKS vs {match.opponentName}</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={onToggleRecordList}>
            記録を確認・修正
          </button>
          <button className="secondary-button" type="button" onClick={onOpenData}>
            データ管理
          </button>
          <div className="status-panel">
            <span>{match.firstPossession === 'rocks' ? '先攻' : '後攻'}</span>
            <strong>記録完了</strong>
          </div>
        </div>
      </header>
      <div className="result-meta">
        <span>日時: {new Date(match.createdAt).toLocaleString()}</span>
        <span>前半メンバー: {match.firstHalfMembers.map((member) => member.name).join('、')}</span>
        <span>後半メンバー: {match.secondHalfMembers.map((member) => member.name).join('、')}</span>
      </div>
      <MatchRosterResult match={match} />
      {isRecordListOpen && (
        <ResultRecordReview
          match={match}
          selectedPeriod={selectedRecordPeriod}
          onPeriodChange={onRecordPeriodChange}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
        />
      )}
      <div className="scope-tabs">
        {scopeTabs.map(([value, label]) => (
          <button
            className={selectedScope === value ? 'selected' : ''}
            key={value}
            type="button"
            onClick={() => onScopeChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <ModeTabs selectedMode={selectedMode} onModeChange={onModeChange} />
      <StatsView match={match} scope={selectedScope} mode={selectedMode} members={members} />
      <RosterTrendSection match={match} scope={selectedScope} />
      <div className="analysis-actions">
        <button className="start-button" type="button" onClick={onNewMatch}>
          新しい試合を設定
        </button>
        <button className="secondary-button" type="button" onClick={onOpenData}>
          JSONバックアップ / 保存済み試合一覧
        </button>
      </div>
    </main>
  )
}

function ResultRecordReview({
  match,
  selectedPeriod,
  onPeriodChange,
  onEditEvent,
  onDeleteEvent,
}) {
  const events = getEventsForScope(match.events || [], selectedPeriod)
    .sort((a, b) => (a.elapsedTime ?? 0) - (b.elapsedTime ?? 0) || (a.timestamp ?? 0) - (b.timestamp ?? 0))

  return (
    <section className="result-record-review">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">RECORD REVIEW</p>
          <h2>記録を確認・修正</h2>
        </div>
      </div>
      <div className="scope-tabs record-period-tabs">
        {[
          ['first_half', '前半'],
          ['second_half', '後半'],
        ].map(([value, label]) => (
          <button
            className={selectedPeriod === value ? 'selected' : ''}
            key={value}
            type="button"
            onClick={() => onPeriodChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="result-record-list">
        {events.length === 0 ? (
          <p className="empty-state">記録はありません</p>
        ) : (
          events.map((event) => (
            <div
              className={`history-row result-history-row ${getHistoryTone(event.eventType)}`}
              key={event.eventId}
              role="button"
              tabIndex={0}
              onClick={() => onEditEvent(event)}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                  keyEvent.preventDefault()
                  onEditEvent(event)
                }
              }}
            >
              <span>{formatTime(event.remainingTime)}</span>
              <strong>
                {getHistoryTargetLabel(event) && (
                  <span className="history-target">{getHistoryTargetLabel(event)}</span>
                )}
                {getHistoryEventLabel(event)}
                {attackEventTypes.has(event.eventType) && (
                  <span className="history-subline">
                    ラストパス: {getLastPassLabel(event)}
                  </span>
                )}
                {event.eventType === 'pass_error' &&
                  getPassErrorHistoryLines(event).map((line) => (
                    <span className="history-subline" key={line}>
                      {line}
                    </span>
                  ))}
              </strong>
              <button
                type="button"
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation()
                  onDeleteEvent(event.eventId)
                }}
              >
                削除
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function HalftimeGoalPanel({ match }) {
  const firstScore = getPeriodRosterScore(match, 'first_half')
  const guidance = getHalftimeGuidance(firstScore)

  return (
    <section className="match-goal-card halftime-goal">
      <p className="eyebrow">HALFTIME TARGET</p>
      <h2>前半結果</h2>
      <HalftimeScoreboard score={firstScore} />
      <strong className="goal-status">{guidance.status}</strong>
      <div className="goal-guidance">
        <p className="goal-main">{guidance.main}</p>
        {guidance.details.map((detail) => (
          <span key={detail}>{detail}</span>
        ))}
      </div>
    </section>
  )
}

function HalftimeScoreboard({ score }) {
  return (
    <div className="halftime-scoreboard" aria-label="前半結果">
      <span>ROCKS</span>
      <strong>{score.rocks}</strong>
      <em>－</em>
      <strong>{score.opponent}</strong>
      <span>相手</span>
    </div>
  )
}

function SecondHalfGoalPanel({ match, secondScore }) {
  const firstScore = getPeriodRosterScore(match, 'first_half')
  const outlook = getSecondHalfOutlook(firstScore, secondScore)

  return (
    <section className="second-half-outlook">
      <div className="outlook-score-grid">
        <RosterScoreLine label="前半" score={firstScore} />
        <RosterScoreLine label="後半" score={secondScore} />
        <RosterScoreLine label="合計" score={outlook.totalScore} strong />
      </div>
      <div className="outlook-message-grid">
        <strong>{outlook.status}</strong>
        {outlook.clinch && <span>{outlook.clinch}</span>}
        <span>{outlook.allowableHits}</span>
      </div>
    </section>
  )
}

function MatchRosterResult({ match }) {
  const result = getMatchRosterResult(match)

  return (
    <section className="match-roster-result">
      <div>
        <p className="eyebrow">REMAINING PLAYERS</p>
        <h2>残り内野人数</h2>
      </div>
      <div className="result-score-lines">
        <RosterScoreLine label="前半" score={result.firstScore} />
        <RosterScoreLine label="後半" score={result.secondScore} />
        <RosterScoreLine label="合計" score={result.totalScore} strong />
      </div>
      <strong className={`result-verdict ${result.verdictTone}`}>{result.verdict}</strong>
    </section>
  )
}

function RosterScoreLine({ label, score, strong = false }) {
  const className = [
    'roster-score-line',
    strong ? 'strong' : '',
    label ? '' : 'no-label',
  ].filter(Boolean).join(' ')

  return (
    <div className={className}>
      {label && <span>{label}</span>}
      <b>ROCKS</b>
      <strong>{score.rocks}</strong>
      <em>－</em>
      <strong>{score.opponent}</strong>
      <b>相手</b>
    </div>
  )
}

function ModeTabs({ selectedMode, onModeChange }) {
  return (
    <div className="mode-tabs">
      {modeTabs.map(([value, label]) => (
        <button
          className={selectedMode === value ? 'selected' : ''}
          key={value}
          type="button"
          onClick={() => onModeChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function getMembersForScope(match, scope) {
  if (scope === 'first_half') return match.firstHalfMembers
  if (scope === 'second_half') return match.secondHalfMembers

  const memberMap = new Map()
  ;[...match.firstHalfMembers, ...match.secondHalfMembers].forEach((member) => {
    memberMap.set(member.id, member)
  })
  return Array.from(memberMap.values())
}

function getOutPlayerIds(events, period) {
  return new Set(
    (events || [])
      .filter(
        (event) =>
          event.period === period &&
          event.eventType === 'hit_received' &&
          Number.isInteger(event.playerId),
      )
      .map((event) => event.playerId),
  )
}

function createZeroRosterKey(match) {
  return `${match.matchId}:${match.period}:zero-roster`
}

function getZeroRosterLeadText(score) {
  if (score.rocks === 0 && score.opponent === 0) {
    return '両チームの内野が0人になりました'
  }
  if (score.rocks === 0) {
    return 'ROCKSの内野が0人になりました'
  }
  return '相手の内野が0人になりました'
}

function finalizePendingAttackFlow(match, period, nextAttackFlow) {
  if (!match?.events?.length) return match

  let pendingIndex = -1
  for (let index = match.events.length - 1; index >= 0; index -= 1) {
    const event = match.events[index]
    if (
      event.period === period &&
      attackEventTypes.has(event.eventType) &&
      event.attackFlow === 'pending'
    ) {
      pendingIndex = index
      break
    }
  }

  if (pendingIndex < 0) return match

  return {
    ...match,
    events: match.events.map((event, index) =>
      index === pendingIndex ? { ...event, attackFlow: nextAttackFlow } : event,
    ),
  }
}

function recalculateAttackFlows(match, period, finalizeOpenAttack = false) {
  if (!match?.events?.length) return match

  const events = match.events.map((event) => ({ ...event }))
  const significantEventTypes = new Set([
    'attack_hit',
    'attack_miss',
    'pass_error',
    'pass_intercepted',
    'line_cross',
    'overtime_violation',
  ])

  events.forEach((event, index) => {
    if (
      event.period !== period ||
      !attackEventTypes.has(event.eventType) ||
      event.attackFlow === 'unknown' ||
      event.attackFlow === 'single'
    ) {
      return
    }

    const nextSignificant = events
      .slice(index + 1)
      .find(
        (nextEvent) =>
          nextEvent.period === period && significantEventTypes.has(nextEvent.eventType),
      )

    if (nextSignificant && attackEventTypes.has(nextSignificant.eventType)) {
      event.attackFlow = 'possession_continued'
      return
    }

    if (
      nextSignificant?.eventType === 'pass_error' ||
      nextSignificant?.eventType === 'pass_intercepted' ||
      nextSignificant?.eventType === 'line_cross' ||
      nextSignificant?.eventType === 'overtime_violation' ||
      finalizeOpenAttack
    ) {
      event.attackFlow = 'single'
      return
    }

    event.attackFlow = 'pending'
  })

  return { ...match, events }
}

function getHistoryEventLabel(event) {
  const label = eventLabels[event.eventType]
  if (!attackEventTypes.has(event.eventType)) {
    return label
  }

  return `${label}／${attackFlowLabels[event.attackFlow || 'unknown']}`
}

function getHistoryTone(eventType) {
  if (['attack_hit', 'catch_success', 'pass_interception'].includes(eventType)) {
    return 'success'
  }
  if (
    [
      'attack_miss',
      'pass_error',
      'pass_intercepted',
      'opponent_pass_error',
    ].includes(eventType)
  ) {
    return 'attention'
  }
  if (eventType === 'hit_received') {
    return 'received'
  }
  if (['line_cross', 'overtime_violation'].includes(eventType)) {
    return 'foul'
  }
  return 'neutral'
}

function getHistoryTargetLabel(event) {
  if (event.eventType === 'overtime_violation') return ''
  return getEventTargetLabel(event)
}

function getLastPassLabel(event) {
  if (event.lastPassScope === 'player') {
    return event.lastPasserNameSnapshot || '不明'
  }
  if (event.lastPassScope === 'none') {
    return 'なし'
  }
  return '不明'
}

function getPassErrorHistoryLines(event) {
  const passerName = event.passerNameSnapshot || event.playerNameSnapshot || '不明'
  const receiverName = event.receiverNameSnapshot
  const causeLabel = getPassErrorCauseLabel(event.passErrorCause)

  if (!receiverName || !causeLabel) {
    return [`投げ手：${passerName}`, '受け手・原因：記録なし']
  }

  return [
    `投げ手：${passerName}　受け手：${receiverName}`,
    `原因：${causeLabel}`,
  ]
}

function getPassErrorCauseLabel(cause) {
  if (cause === 'passer') return '投げ手'
  if (cause === 'receiver') return '受け手'
  if (cause === 'both') return '両方'
  return null
}

function getEventEditSummary(event) {
  if (attackEventTypes.has(event.eventType)) {
    return `${getEventTargetLabel(event)} / ラストパス: ${getLastPassLabel(event)}`
  }
  if (event.eventType === 'pass_error') {
    const passerName = event.passerNameSnapshot || event.playerNameSnapshot || '不明'
    const receiverName = event.receiverNameSnapshot || '記録なし'
    const causeLabel = getPassErrorCauseLabel(event.passErrorCause) || '記録なし'
    return `投げ手: ${passerName} / 受け手: ${receiverName} / 原因: ${causeLabel}`
  }
  if (event.eventType === 'overtime_violation' || event.eventType === 'opponent_pass_error') {
    return 'チーム記録'
  }
  return getEventTargetLabel(event)
}

function RosterTrendSection({ match, scope }) {
  const charts =
    scope === 'all'
      ? [
          {
            key: 'first_half',
            title: '前半 人数推移',
            events: getEventsForScope(match.events || [], 'first_half'),
            startCount: match.firstHalfMembers.length,
          },
          {
            key: 'second_half',
            title: '後半 人数推移',
            events: getEventsForScope(match.events || [], 'second_half'),
            startCount: match.secondHalfMembers.length,
          },
        ]
      : [
          {
            key: scope,
            title: `${scope === 'first_half' ? '前半' : '後半'} 人数推移`,
            events: getEventsForScope(match.events || [], scope),
            startCount:
              scope === 'first_half'
                ? match.firstHalfMembers.length
                : match.secondHalfMembers.length,
          },
        ]

  return (
    <section className={scope === 'all' ? 'roster-trend-layout all' : 'roster-trend-layout'}>
      {charts.map((chart) => (
        <RosterTrendChart
          events={chart.events}
          key={chart.key}
          startCount={chart.startCount}
          title={chart.title}
        />
      ))}
    </section>
  )
}

function RosterTrendChart({ title, events, startCount }) {
  const width = 720
  const height = 260
  const padding = { top: 28, right: 26, bottom: 42, left: 44 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const maxCount = Math.max(1, startCount)
  const x = (seconds) => padding.left + (Math.max(0, Math.min(MATCH_SECONDS, seconds)) / MATCH_SECONDS) * innerWidth
  const y = (count) => padding.top + (1 - Math.max(0, Math.min(maxCount, count)) / maxCount) * innerHeight
  const data = buildRosterTrend(events, startCount)
  const timeTicks = [0, 60, 120, 180, 240, 300]
  const countTicks = Array.from({ length: maxCount + 1 }, (_, index) => index)

  return (
    <article className="roster-trend-card">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">FLOW</p>
          <h2>{title}</h2>
        </div>
        <div className="trend-legend" aria-label="凡例">
          <span className="rocks-line">ROCKS</span>
          <span className="opponent-line">相手</span>
        </div>
      </div>
      <svg
        className="roster-trend-svg"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        aria-label={`${title}グラフ`}
      >
        <rect x={padding.left} y={padding.top} width={innerWidth} height={innerHeight} />
        {countTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line className="grid-line" x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} />
            <text className="axis-label" x={padding.left - 12} y={y(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {timeTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line className="grid-line vertical" x1={x(tick)} x2={x(tick)} y1={padding.top} y2={height - padding.bottom} />
            <text className="axis-label" x={x(tick)} y={height - 15} textAnchor="middle">
              {formatElapsedTick(tick)}
            </text>
          </g>
        ))}
        <path className="trend-line rocks" d={buildStepPath(data.rocks, x, y)} />
        <path className="trend-line opponent" d={buildStepPath(data.opponent, x, y)} />
        {data.rocksChanges.map((point) => (
          <circle className="trend-marker rocks" cx={x(point.elapsedTime)} cy={y(point.count)} key={`r-${point.elapsedTime}-${point.count}`} r="4" />
        ))}
        {data.opponentChanges.map((point) => (
          <circle className="trend-marker opponent" cx={x(point.elapsedTime)} cy={y(point.count)} key={`o-${point.elapsedTime}-${point.count}`} r="4" />
        ))}
      </svg>
    </article>
  )
}

function buildRosterTrend(events, startCount) {
  const sortedEvents = [...(events || [])]
    .filter((event) => event.eventType === 'attack_hit' || event.eventType === 'hit_received')
    .sort((a, b) => (a.elapsedTime ?? 0) - (b.elapsedTime ?? 0) || (a.timestamp ?? 0) - (b.timestamp ?? 0))
  let score = createInitialRosterScore(startCount)
  const rocks = [{ elapsedTime: 0, count: score.rocks }]
  const opponent = [{ elapsedTime: 0, count: score.opponent }]
  const rocksChanges = []
  const opponentChanges = []

  sortedEvents.forEach((event) => {
    const elapsedTime = Math.max(0, Math.min(MATCH_SECONDS, Number(event.elapsedTime) || 0))
    if (event.eventType === 'hit_received') {
      score = applyRosterEvent(score, event)
      const point = { elapsedTime, count: score.rocks }
      rocks.push(point)
      rocksChanges.push(point)
    }
    if (event.eventType === 'attack_hit') {
      score = applyRosterEvent(score, event)
      const point = { elapsedTime, count: score.opponent }
      opponent.push(point)
      opponentChanges.push(point)
    }
  })

  rocks.push({ elapsedTime: MATCH_SECONDS, count: score.rocks })
  opponent.push({ elapsedTime: MATCH_SECONDS, count: score.opponent })
  return { rocks, opponent, rocksChanges, opponentChanges }
}

function getCurrentRosterScore(events, startCount) {
  return [...(events || [])]
    .filter((event) => event.eventType === 'attack_hit' || event.eventType === 'hit_received')
    .sort((a, b) => (a.elapsedTime ?? 0) - (b.elapsedTime ?? 0) || (a.timestamp ?? 0) - (b.timestamp ?? 0))
    .reduce((score, event) => applyRosterEvent(score, event), createInitialRosterScore(startCount))
}

function getPeriodRosterScore(match, period) {
  const members = period === 'first_half' ? match.firstHalfMembers : match.secondHalfMembers
  return getCurrentRosterScore(getEventsForScope(match.events || [], period), members.length)
}

function getMatchRosterResult(match) {
  const firstScore = getPeriodRosterScore(match, 'first_half')
  const secondScore = getPeriodRosterScore(match, 'second_half')
  const totalScore = addRosterScores(firstScore, secondScore)
  const diff = totalScore.rocks - totalScore.opponent

  return {
    firstScore,
    secondScore,
    totalScore,
    verdict: diff > 0 ? 'ROCKS勝利' : diff < 0 ? '相手勝利' : '同点',
    verdictTone: diff > 0 ? 'win' : diff < 0 ? 'loss' : 'draw',
  }
}

function addRosterScores(firstScore, secondScore) {
  return {
    rocks: firstScore.rocks + secondScore.rocks,
    opponent: firstScore.opponent + secondScore.opponent,
  }
}

function getHalftimeGuidance(firstScore) {
  const firstDiff = firstScore.rocks - firstScore.opponent

  if (firstDiff > 0) {
    const allowedLoss = firstDiff - 1
    return {
      status: `現在${firstDiff}人リード`,
      main:
        allowedLoss > 0
          ? `後半は${allowedLoss}人差以内の負けなら勝利`
          : '後半は同点以上で勝利',
      details: [
        `${firstDiff}人差で負けると同点`,
        `${firstDiff + 1}人差以上で負けると逆転される`,
      ],
    }
  }

  if (firstDiff < 0) {
    const neededWin = Math.abs(firstDiff) + 1
    return {
      status: `現在${Math.abs(firstDiff)}人ビハインド`,
      main: `後半は${neededWin}人差以上で勝てば逆転`,
      details: [`${Math.abs(firstDiff)}人差で同点`],
    }
  }

  return {
    status: '現在同点',
    main: '後半は1人差以上で勝てば勝利',
    details: [],
  }
}

function getSecondHalfOutlook(firstScore, secondScore) {
  const totalScore = addRosterScores(firstScore, secondScore)
  const totalDiff = totalScore.rocks - totalScore.opponent
  const status =
    totalDiff < 0
      ? `逆転まで あと${totalScore.opponent - totalScore.rocks + 1}人`
      : totalDiff === 0
        ? '勝ち越しまで あと1人'
        : `現在${totalDiff}人リード`
  const clinchNeed = firstScore.opponent + secondScore.opponent - firstScore.rocks + 1
  const canClinch = clinchNeed > 0 && clinchNeed <= secondScore.opponent
  const clinch =
    firstScore.rocks > firstScore.opponent + secondScore.opponent
      ? '勝利確定'
      : canClinch
        ? `勝利確定まで あと${clinchNeed}人`
        : ''
  const rawAllowableHits = firstScore.rocks + secondScore.rocks - firstScore.opponent - 1
  const allowableHits = Math.min(secondScore.rocks, Math.max(0, rawAllowableHits))
  const allowableMessage =
    rawAllowableHits < 0
      ? '逆転不能'
      : allowableHits === 0
        ? '次に当てられると逆転不能'
        : `許容被ヒット あと${allowableHits}人`

  return {
    totalScore,
    status,
    clinch,
    allowableHits: allowableMessage,
  }
}

function createInitialRosterScore(startCount) {
  const safeStartCount = Math.max(0, Number(startCount) || 0)
  return { rocks: safeStartCount, opponent: safeStartCount }
}

function applyRosterEvent(score, event) {
  if (event.eventType === 'attack_hit') {
    return { ...score, opponent: Math.max(0, score.opponent - 1) }
  }
  if (event.eventType === 'hit_received') {
    return { ...score, rocks: Math.max(0, score.rocks - 1) }
  }
  return score
}

function buildStepPath(points, x, y) {
  if (!points.length) return ''
  let path = `M ${x(points[0].elapsedTime)} ${y(points[0].count)}`
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const point = points[index]
    path += ` L ${x(point.elapsedTime)} ${y(previous.count)} L ${x(point.elapsedTime)} ${y(point.count)}`
  }
  return path
}

function formatElapsedTick(seconds) {
  return `${Math.floor(seconds / 60)}:00`
}

function StatsView({ match, scope, mode = 'team', members = [], compactPlayer = false }) {
  const events = getEventsForScope(match.events || [], scope)

  if (mode === 'player') {
    return <PlayerStatsView events={events} members={members} compact={compactPlayer} />
  }

  const stats = buildStats(events)

  return (
    <>
      <section className="stats-grid">
      <div className="stat-card">
        <h2>攻撃</h2>
        <StatLine label="総アタック数" value={stats.attack.total} />
        <StatLine label="アタック成功数" value={stats.attack.hit} />
        <StatLine label="アタック失敗数" value={stats.attack.miss} />
        <StatLine label="アタック成功率" value={`${stats.attack.rate}%`} />
      </div>
      <div className="stat-card">
        <h2>アタック展開</h2>
        <StatLine label="単発" value={`${stats.attack.flow.single}回`} />
        <StatLine label="攻撃権継続" value={`${stats.attack.flow.possessionContinued}回`} />
        <StatLine
          label="攻撃権継続率"
          value={
            stats.attack.flow.continuationRate === null
              ? '—'
              : `${stats.attack.flow.continuationRate}%`
          }
        />
        <StatLine label="オーバータイム" value={`${stats.fouls.overtimeViolations}回`} />
      </div>
      <div className="stat-card">
        <h2>守備</h2>
        <StatLine label="相手アタック数" value={stats.defense.opponentAttack} />
        <StatLine label="キャッチ数" value={stats.defense.catch} />
        <StatLine label="当てられた数" value={stats.defense.hitReceived} />
        <StatLine label="キャッチ成功率" value={`${stats.defense.rate}%`} />
      </div>
      <div className="stat-card">
        <h2>パス</h2>
        <StatLine label="ラストパス" value={stats.pass.lastPasses} />
        <StatLine label="ラストパス成功" value={stats.pass.lastPassHits} />
        <StatLine
          label="ラストパス成功率"
          value={stats.pass.lastPassHitRate === null ? '－' : `${stats.pass.lastPassHitRate}%`}
        />
        <StatLine label="パスミス" value={stats.pass.rocksPassErrors} />
      </div>
      </section>
      <PlayerSummary events={events} members={members} scope={scope} />
    </>
  )
}

function PlayerSummary({ events, members, scope }) {
  const summary = buildPlayerSummary(events, members)
  const items = [...summary.success, ...summary.review]

  return (
    <article className="stat-card player-summary-card">
      <h2>{getPlayerSummaryTitle(scope)}</h2>
      <div className="summary-department-list">
        {items.map((item) => (
          <PlayerSummaryDepartment
            item={item}
            key={item.key}
            showRank={summary.success.some((successItem) => successItem.key === item.key)}
          />
        ))}
      </div>
    </article>
  )
}

function PlayerSummaryDepartment({ item, showRank }) {
  return (
    <div className={showRank ? 'summary-department success' : 'summary-department review'}>
      <strong>{item.label}</strong>
      {item.players.length === 0 ? (
        <span className="summary-empty">記録なし</span>
      ) : (
        <div className="summary-chip-row">
          {item.players.map((player, index) => (
            <span className="summary-chip" key={player.key}>
              {showRank && <small>{getSummaryRank(item.players, index)}位</small>}
              <em>{player.name}</em>
              <b>{player.count}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function getPlayerSummaryTitle(scope) {
  if (scope === 'second_half') return '後半選手サマリー'
  if (scope === 'all') return '試合全体 選手サマリー'
  return '前半選手サマリー'
}

function getSummaryRank(players, index) {
  const current = players[index]
  const firstSameCountIndex = players.findIndex((player) => player.count === current.count)
  return firstSameCountIndex + 1
}

function PlayerStatsView({ events, members, compact = false }) {
  const stats = buildPlayerStats(events, members)

  if (stats.length === 0) {
    return <p className="empty-state">対象メンバーがありません。</p>
  }

  const rankMaps = {
    hits: buildRankMap(stats, 'hits'),
    catches: buildRankMap(stats, 'catches'),
    lastPassHits: buildRankMap(stats, 'lastPassHits'),
  }

  return (
    <section className="player-stats-grid">
      {stats.map((player) => (
        <article className="player-stat-card" key={player.id}>
          <h2>{player.name}</h2>
          <div className="mini-stat-grid">
            <StatLine label="アタック" value={player.attacks} />
            <StatLine label="アタック成功" value={player.hits} rank={rankMaps.hits.get(player.id)} />
            <StatLine label="成功率" value={player.attackRate === null ? '—' : `${player.attackRate}%`} />
            {!compact && <StatLine label="アタック失敗" value={player.misses} />}
            {!compact && <StatLine label="単発" value={player.singleAttacks} />}
            {!compact && <StatLine label="攻撃権継続" value={player.continuedAttacks} />}
            {!compact && (
              <StatLine
                label="継続率"
                value={player.continuationRate === null ? '—' : `${player.continuationRate}%`}
              />
            )}
            <StatLine label="キャッチ" value={player.catches} rank={rankMaps.catches.get(player.id)} />
            <StatLine label="当てられた" value={player.hitReceived} />
            {!compact && <StatLine label="キャッチ率" value={player.catchRate === null ? '—' : `${player.catchRate}%`} />}
            <StatLine
              label="パスミス"
              value={compact ? player.passErrorResponsibility : player.passErrors}
              tone={(compact ? player.passErrorResponsibility : player.passErrors) > 0 ? 'caution' : undefined}
            />
            {!compact && <StatLine label="投げ手パスミス" value={player.passErrorAsPasser} />}
            {!compact && <StatLine label="受け手パスミス" value={player.passErrorAsReceiver} />}
            {!compact && <StatLine label="投げ手原因" value={player.passerCauseErrors} />}
            {!compact && <StatLine label="受け手原因" value={player.receiverCauseErrors} />}
            {!compact && <StatLine label="両方原因関与" value={player.bothCausePassErrors} />}
            <StatLine label="パスカットされた" value={player.passIntercepted} tone={player.passIntercepted > 0 ? 'caution' : undefined} />
            {!compact && <StatLine label="パスカット" value={player.passInterceptions} />}
            <StatLine label="ラインクロス" value={player.lineCrosses} tone={player.lineCrosses > 0 ? 'caution' : undefined} />
            <StatLine label="ラストパス" value={player.lastPasses} />
            <StatLine label="ラストパス成功" value={player.lastPassHits} rank={rankMaps.lastPassHits.get(player.id)} />
            {!compact && (
              <StatLine
                label="ラストパス成功率"
                value={player.lastPassHitRate === null ? '—' : `${player.lastPassHitRate}%`}
              />
            )}
          </div>
        </article>
      ))}
    </section>
  )
}

function buildRankMap(players, field) {
  const ranked = [...players]
    .filter((player) => Number(player[field]) > 0)
    .sort((a, b) => Number(b[field]) - Number(a[field]) || a.name.localeCompare(b.name, 'ja'))
    .slice(0, 3)

  return new Map(
    ranked.map((player) => {
      const firstSameCountIndex = ranked.findIndex(
        (rankedPlayer) => Number(rankedPlayer[field]) === Number(player[field]),
      )
      return [player.id, firstSameCountIndex + 1]
    }),
  )
}

function StatLine({ label, value, rank, tone }) {
  return (
    <div className={tone ? `stat-line ${tone}` : 'stat-line'}>
      <span>{label}</span>
      <strong>
        {value}
        {rank && <small className="rank-badge">{rank}位</small>}
      </strong>
    </div>
  )
}

function DataPanel({
  isOpen,
  players,
  opponentHistory,
  savedMatches,
  activeMatch,
  importInputRef,
  onClose,
  onExport,
  onImport,
  onView,
  onDelete,
  onDeleteAll,
}) {
  if (!isOpen) return null

  return (
    <aside className="data-panel">
      <h2>データ管理</h2>
      <div className="panel-actions">
        <button type="button" onClick={onExport}>
          JSONバックアップ
        </button>
        <button type="button" onClick={() => importInputRef.current?.click()}>
          JSON読み込み
        </button>
        <input
          accept="application/json"
          hidden
          ref={importInputRef}
          type="file"
          onChange={(event) => onImport(event.target.files?.[0])}
        />
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>
      <p className="helper-text">
        書き出し対象: 登録選手{players.length}件、相手履歴{opponentHistory.length}
        件、保存済み試合{savedMatches.length}件、記録途中
        {activeMatch ? 'あり' : 'なし'}
      </p>
      <div className="saved-match-list">
        <div className="section-heading compact">
          <h3>保存済み試合一覧</h3>
          <button type="button" onClick={onDeleteAll} disabled={!savedMatches.length}>
            全削除
          </button>
        </div>
        {savedMatches.length === 0 ? (
          <p className="empty-state">保存済み試合はありません</p>
        ) : (
          savedMatches.map((match) => (
            <div className="saved-match-row" key={match.matchId}>
              <div>
                <strong>ROCKS vs {match.opponentName}</strong>
                <span>{new Date(match.createdAt).toLocaleString()}</span>
              </div>
              <button type="button" onClick={() => onView(match)}>
                閲覧
              </button>
              <button type="button" onClick={() => onDelete(match.matchId)}>
                削除
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

export default App
