import { useEffect, useMemo, useRef, useState } from 'react'

const PLAYER_COUNT = 12
const STORAGE_KEYS = {
  players: 'dodgeballMatchRecorder.players',
  matchSetup: 'dodgeballMatchRecorder.matchSetup',
  opponentHistory: 'dodgeballMatchRecorder.opponentHistory',
}
const PRESET_MINUTES = ['3', '5', '7']

const createEmptyPlayers = () =>
  Array.from({ length: PLAYER_COUNT }, (_, index) => ({
    id: index,
    number: '',
    name: '',
  }))

const defaultMatchSetup = {
  opponentName: '',
  matchMinutes: '5',
  matchTimePreset: '5',
  possession: '',
  firstHalfMemberIds: [],
  secondHalfMemberIds: [],
}

function readStorage(key, fallback) {
  try {
    const storedValue = window.localStorage.getItem(key)
    return storedValue ? JSON.parse(storedValue) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function normalizePlayers(players) {
  const basePlayers = createEmptyPlayers()

  if (!Array.isArray(players)) {
    return basePlayers
  }

  return basePlayers.map((player, index) => ({
    ...player,
    number: String(players[index]?.number ?? ''),
    name: String(players[index]?.name ?? ''),
  }))
}

function normalizeIdList(value) {
  return Array.isArray(value) ? value.filter((id) => Number.isInteger(id)) : []
}

function normalizeMatchSetup(value) {
  const storedSetup = value && typeof value === 'object' ? value : {}
  const storedMinutes = String(
    storedSetup.matchMinutes ?? defaultMatchSetup.matchMinutes,
  )
  const matchTimePreset = PRESET_MINUTES.includes(storedMinutes)
    ? storedMinutes
    : 'other'

  return {
    ...defaultMatchSetup,
    opponentName: String(storedSetup.opponentName ?? ''),
    matchMinutes: storedMinutes,
    matchTimePreset: storedSetup.matchTimePreset ?? matchTimePreset,
    possession: ['first', 'second'].includes(storedSetup.possession)
      ? storedSetup.possession
      : '',
    firstHalfMemberIds: normalizeIdList(storedSetup.firstHalfMemberIds),
    secondHalfMemberIds: normalizeIdList(storedSetup.secondHalfMemberIds),
  }
}

function normalizeOpponentHistory(value) {
  return Array.isArray(value)
    ? value.filter((name) => typeof name === 'string' && name.trim() !== '')
    : []
}

function isRegisteredPlayer(player) {
  return player.number.trim() !== '' && player.name.trim() !== ''
}

function isPositiveInteger(value) {
  return /^[1-9]\d*$/.test(String(value).trim())
}

function App() {
  const [players, setPlayers] = useState(() =>
    normalizePlayers(readStorage(STORAGE_KEYS.players, createEmptyPlayers())),
  )
  const [matchSetup, setMatchSetup] = useState(() =>
    normalizeMatchSetup(readStorage(STORAGE_KEYS.matchSetup, defaultMatchSetup)),
  )
  const [opponentHistory, setOpponentHistory] = useState(() =>
    normalizeOpponentHistory(readStorage(STORAGE_KEYS.opponentHistory, [])),
  )
  const [isPlayerEditorOpen, setIsPlayerEditorOpen] = useState(() => {
    const storedPlayers = normalizePlayers(
      readStorage(STORAGE_KEYS.players, createEmptyPlayers()),
    )
    return storedPlayers.filter(isRegisteredPlayer).length === 0
  })
  const [saveNotice, setSaveNotice] = useState('')
  const [readyMessage, setReadyMessage] = useState('')
  const saveTimerRef = useRef(null)
  const didSaveOnceRef = useRef({
    players: false,
    matchSetup: false,
    opponentHistory: false,
  })

  const registeredPlayers = useMemo(
    () => players.filter(isRegisteredPlayer),
    [players],
  )

  const registeredPlayerIds = useMemo(
    () => registeredPlayers.map((player) => player.id),
    [registeredPlayers],
  )

  const isMatchMinutesValid = isPositiveInteger(matchSetup.matchMinutes)

  const canStartPreparation =
    matchSetup.opponentName.trim() !== '' &&
    isMatchMinutesValid &&
    matchSetup.possession !== '' &&
    matchSetup.firstHalfMemberIds.length > 0 &&
    matchSetup.secondHalfMemberIds.length > 0

  useEffect(() => {
    writeStorage(STORAGE_KEYS.players, players)
    showSaveNoticeAfterFirstWrite('players', '選手情報を保存しました')
  }, [players])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.matchSetup, matchSetup)
    showSaveNoticeAfterFirstWrite('matchSetup', '自動保存済み')
  }, [matchSetup])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.opponentHistory, opponentHistory)
    showSaveNoticeAfterFirstWrite('opponentHistory', '自動保存済み')
  }, [opponentHistory])

  useEffect(() => {
    const registeredIds = new Set(registeredPlayerIds)

    setMatchSetup((current) => {
      const firstHalfMemberIds = current.firstHalfMemberIds.filter((id) =>
        registeredIds.has(id),
      )
      const secondHalfMemberIds = current.secondHalfMemberIds.filter((id) =>
        registeredIds.has(id),
      )

      if (
        firstHalfMemberIds.length === current.firstHalfMemberIds.length &&
        secondHalfMemberIds.length === current.secondHalfMemberIds.length
      ) {
        return current
      }

      return {
        ...current,
        firstHalfMemberIds,
        secondHalfMemberIds,
      }
    })
  }, [registeredPlayerIds])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  function showSaveNoticeAfterFirstWrite(target, message) {
    if (!didSaveOnceRef.current[target]) {
      didSaveOnceRef.current[target] = true
      return
    }

    setSaveNotice(message)

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = window.setTimeout(() => {
      setSaveNotice('')
    }, 1000)
  }

  function updatePlayer(playerId, field, value) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId ? { ...player, [field]: value } : player,
      ),
    )
  }

  function updateMatchSetup(field, value) {
    setReadyMessage('')
    setMatchSetup((current) => ({ ...current, [field]: value }))
  }

  function updateMatchTimePreset(value) {
    setReadyMessage('')
    setMatchSetup((current) => ({
      ...current,
      matchTimePreset: value,
      matchMinutes:
        value === 'other'
          ? PRESET_MINUTES.includes(current.matchMinutes)
            ? ''
            : current.matchMinutes
          : value,
    }))
  }

  function toggleMember(halfKey, playerId) {
    setReadyMessage('')
    setMatchSetup((current) => {
      const selectedIds = current[halfKey]
      const nextIds = selectedIds.includes(playerId)
        ? selectedIds.filter((id) => id !== playerId)
        : [...selectedIds, playerId]

      return { ...current, [halfKey]: nextIds }
    })
  }

  function setHalfMembers(halfKey, playerIds) {
    setReadyMessage('')
    setMatchSetup((current) => ({ ...current, [halfKey]: playerIds }))
  }

  function saveOpponentCandidate() {
    const opponentName = matchSetup.opponentName.trim()

    if (!opponentName) {
      return
    }

    setOpponentHistory((current) => [
      opponentName,
      ...current.filter((name) => name !== opponentName),
    ])
  }

  function handleStartPreparation() {
    if (!canStartPreparation) {
      return
    }

    saveOpponentCandidate()
    setReadyMessage('試合記録画面は次段階で実装予定')
  }

  return (
    <main className="app-shell">
      <header className="scoreboard-header">
        <div>
          <p className="eyebrow">DODGEBALL MATCH RECORDER</p>
          <h1>試合前設定</h1>
        </div>
        <div className="status-panel">
          <span>登録済み選手</span>
          <strong>{registeredPlayers.length}</strong>
        </div>
      </header>

      <section className="player-section" aria-labelledby="players-heading">
        <div className="player-summary">
          <div>
            <p className="eyebrow">ROCKS ROSTER</p>
            <h2 id="players-heading">ROCKS選手</h2>
            <p>{registeredPlayers.length}人登録済み</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setIsPlayerEditorOpen((current) => !current)}
          >
            {isPlayerEditorOpen ? '選手登録を閉じる' : '選手を登録・編集'}
          </button>
        </div>

        {isPlayerEditorOpen && (
          <div className="player-editor">
            <p className="helper-text">
              12人分の背番号と表示名を登録できます。空欄の選手は未登録として扱います。
            </p>
            <div className="player-grid">
              {players.map((player) => (
                <div className="player-row" key={player.id}>
                  <label>
                    <span>背番号</span>
                    <input
                      inputMode="numeric"
                      value={player.number}
                      onChange={(event) =>
                        updatePlayer(player.id, 'number', event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>表示名</span>
                    <input
                      value={player.name}
                      onChange={(event) =>
                        updatePlayer(player.id, 'name', event.target.value)
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="setup-section" aria-labelledby="match-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MATCH INFO</p>
            <h2 id="match-heading">試合情報</h2>
          </div>
        </div>

        <div className="match-info-grid">
          <label className="field opponent-field">
            <span>対戦相手名</span>
            <input
              list="opponent-history"
              value={matchSetup.opponentName}
              onBlur={saveOpponentCandidate}
              onChange={(event) =>
                updateMatchSetup('opponentName', event.target.value)
              }
            />
            <datalist id="opponent-history">
              {opponentHistory.map((name) => (
                <option value={name} key={name} />
              ))}
            </datalist>
          </label>

          <div className="field time-field">
            <span>試合時間</span>
            <div className="time-options" role="group" aria-label="試合時間">
              {[
                ['3', '3分'],
                ['5', '5分'],
                ['7', '7分'],
                ['other', 'その他'],
              ].map(([value, label]) => (
                <button
                  className={
                    matchSetup.matchTimePreset === value
                      ? 'small-choice-button selected'
                      : 'small-choice-button'
                  }
                  key={value}
                  type="button"
                  onClick={() => updateMatchTimePreset(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {matchSetup.matchTimePreset === 'other' && (
              <input
                className="custom-minute-input"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={matchSetup.matchMinutes}
                aria-label="その他の試合時間（分）"
                onChange={(event) =>
                  updateMatchSetup('matchMinutes', event.target.value)
                }
              />
            )}
          </div>
        </div>

        <div className="choice-group" aria-label="ROCKSの先攻または後攻">
          {[
            ['first', '先攻'],
            ['second', '後攻'],
          ].map(([value, label]) => (
            <button
              className={
                matchSetup.possession === value
                  ? 'choice-button selected'
                  : 'choice-button'
              }
              key={value}
              type="button"
              onClick={() => updateMatchSetup('possession', value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="members-layout">
        <MemberSelector
          heading="前半メンバー"
          players={registeredPlayers}
          selectedIds={matchSetup.firstHalfMemberIds}
          actions={[
            {
              label: '全員選択',
              onClick: () =>
                setHalfMembers('firstHalfMemberIds', registeredPlayerIds),
            },
            {
              label: '選択解除',
              onClick: () => setHalfMembers('firstHalfMemberIds', []),
            },
          ]}
          onToggle={(playerId) => toggleMember('firstHalfMemberIds', playerId)}
        />

        <MemberSelector
          heading="後半メンバー"
          players={registeredPlayers}
          selectedIds={matchSetup.secondHalfMemberIds}
          actions={[
            {
              label: '全員選択',
              onClick: () =>
                setHalfMembers('secondHalfMemberIds', registeredPlayerIds),
            },
            {
              label: '選択解除',
              onClick: () => setHalfMembers('secondHalfMemberIds', []),
            },
            {
              label: '前半メンバーをコピー',
              onClick: () =>
                setHalfMembers(
                  'secondHalfMemberIds',
                  matchSetup.firstHalfMemberIds.filter((id) =>
                    registeredPlayerIds.includes(id),
                  ),
                ),
            },
          ]}
          onToggle={(playerId) => toggleMember('secondHalfMemberIds', playerId)}
        />
      </div>

      <footer className="action-bar">
        <p className={canStartPreparation ? 'ready-text' : 'ready-text muted'}>
          {canStartPreparation
            ? '記録準備を開始できます。'
            : '必須項目を入力すると開始できます。'}
        </p>
        <button
          className="start-button"
          type="button"
          disabled={!canStartPreparation}
          onClick={handleStartPreparation}
        >
          記録準備開始
        </button>
      </footer>

      {readyMessage && <p className="next-step-message">{readyMessage}</p>}
      {saveNotice && <div className="save-toast">{saveNotice}</div>}
    </main>
  )
}

function MemberSelector({ heading, players, selectedIds, actions, onToggle }) {
  return (
    <section className="setup-section member-section" aria-labelledby={heading}>
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">MEMBERS</p>
          <h2 id={heading}>{heading}</h2>
        </div>
        <p>{selectedIds.length}人選択中</p>
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

            return (
              <button
                className={selected ? 'member-button selected' : 'member-button'}
                key={player.id}
                type="button"
                onClick={() => onToggle(player.id)}
              >
                <span>#{player.number}</span>
                <strong>{player.name}</strong>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default App
