import { useEffect, useMemo, useRef, useState } from 'react'

const PLAYER_COUNT = 12
const MEMBER_LIMIT = 8
const FIXED_MATCH_MINUTES = '5'
const STORAGE_KEYS = {
  players: 'dodgeballMatchRecorder.players',
  matchSetup: 'dodgeballMatchRecorder.matchSetup',
  opponentHistory: 'dodgeballMatchRecorder.opponentHistory',
}

const createEmptyPlayers = () =>
  Array.from({ length: PLAYER_COUNT }, (_, index) => ({
    id: index,
    name: '',
  }))

const defaultMatchSetup = {
  opponentName: '',
  matchMinutes: FIXED_MATCH_MINUTES,
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
    name: String(players[index]?.name ?? ''),
  }))
}

function normalizeIdList(value) {
  return Array.isArray(value)
    ? value.filter((id) => Number.isInteger(id)).slice(0, MEMBER_LIMIT)
    : []
}

function normalizeMatchSetup(value) {
  const storedSetup = value && typeof value === 'object' ? value : {}

  return {
    ...defaultMatchSetup,
    opponentName: String(storedSetup.opponentName ?? ''),
    matchMinutes: FIXED_MATCH_MINUTES,
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
  return player.name.trim() !== ''
}

function App() {
  const [screen, setScreen] = useState('setup')
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
  const [gameStartMessage, setGameStartMessage] = useState('')
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

  const firstHalfMembers = useMemo(
    () => getPlayersByIds(registeredPlayers, matchSetup.firstHalfMemberIds),
    [registeredPlayers, matchSetup.firstHalfMemberIds],
  )

  const secondHalfMembers = useMemo(
    () => getPlayersByIds(registeredPlayers, matchSetup.secondHalfMemberIds),
    [registeredPlayers, matchSetup.secondHalfMemberIds],
  )

  const canStartPreparation =
    matchSetup.opponentName.trim() !== '' &&
    matchSetup.possession !== '' &&
    matchSetup.firstHalfMemberIds.length > 0 &&
    matchSetup.firstHalfMemberIds.length <= MEMBER_LIMIT &&
    matchSetup.secondHalfMemberIds.length > 0 &&
    matchSetup.secondHalfMemberIds.length <= MEMBER_LIMIT

  useEffect(() => {
    writeStorage(STORAGE_KEYS.players, players)
    showSaveNoticeAfterFirstWrite('players', '選手情報を保存しました')
  }, [players])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.matchSetup, {
      ...matchSetup,
      matchMinutes: FIXED_MATCH_MINUTES,
    })
    showSaveNoticeAfterFirstWrite('matchSetup', '自動保存済み')
  }, [matchSetup])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.opponentHistory, opponentHistory)
    showSaveNoticeAfterFirstWrite('opponentHistory', '自動保存済み')
  }, [opponentHistory])

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
        current.matchMinutes === FIXED_MATCH_MINUTES &&
        firstHalfMemberIds.length === current.firstHalfMemberIds.length &&
        secondHalfMemberIds.length === current.secondHalfMemberIds.length
      ) {
        return current
      }

      return {
        ...current,
        matchMinutes: FIXED_MATCH_MINUTES,
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

  function updatePlayer(playerId, value) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId ? { ...player, name: value } : player,
      ),
    )
  }

  function updateMatchSetup(field, value) {
    setGameStartMessage('')
    setMatchSetup((current) => ({
      ...current,
      [field]: value,
      matchMinutes: FIXED_MATCH_MINUTES,
    }))
  }

  function toggleMember(halfKey, playerId) {
    setGameStartMessage('')
    setMatchSetup((current) => {
      const selectedIds = current[halfKey]
      const isSelected = selectedIds.includes(playerId)

      if (!isSelected && selectedIds.length >= MEMBER_LIMIT) {
        return current
      }

      const nextIds = isSelected
        ? selectedIds.filter((id) => id !== playerId)
        : [...selectedIds, playerId]

      return {
        ...current,
        matchMinutes: FIXED_MATCH_MINUTES,
        [halfKey]: nextIds,
      }
    })
  }

  function setHalfMembers(halfKey, playerIds) {
    setGameStartMessage('')
    setMatchSetup((current) => ({
      ...current,
      matchMinutes: FIXED_MATCH_MINUTES,
      [halfKey]: playerIds.slice(0, MEMBER_LIMIT),
    }))
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
    setGameStartMessage('')
    setScreen('waiting')
  }

  function handleBackToSetup() {
    setGameStartMessage('')
    setScreen('setup')
  }

  function handleGameStart() {
    setGameStartMessage('ゲーム画面は次の段階で実装予定')
  }

  if (screen === 'waiting') {
    return (
      <WaitingScreen
        matchSetup={matchSetup}
        firstHalfMembers={firstHalfMembers}
        secondHalfMembers={secondHalfMembers}
        gameStartMessage={gameStartMessage}
        onGameStart={handleGameStart}
        onBack={handleBackToSetup}
      />
    )
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
              12人分の表示名を登録できます。空欄の選手は未登録として扱います。
            </p>
            <div className="player-grid">
              {players.map((player, index) => (
                <label className="player-row" key={player.id}>
                  <span>表示名 {index + 1}</span>
                  <input
                    value={player.name}
                    onChange={(event) =>
                      updatePlayer(player.id, event.target.value)
                    }
                  />
                </label>
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
          headingId="first-half-members"
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
          headingId="second-half-members"
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

      {saveNotice && <div className="save-toast">{saveNotice}</div>}
    </main>
  )
}

function getPlayersByIds(players, ids) {
  const playerMap = new Map(players.map((player) => [player.id, player]))
  return ids
    .map((id) => playerMap.get(id))
    .filter(Boolean)
    .slice(0, MEMBER_LIMIT)
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

function WaitingScreen({
  matchSetup,
  firstHalfMembers,
  secondHalfMembers,
  gameStartMessage,
  onGameStart,
  onBack,
}) {
  return (
    <main className="app-shell waiting-shell">
      <header className="scoreboard-header">
        <div>
          <p className="eyebrow">READY TO START</p>
          <h1>試合開始待機</h1>
        </div>
        <div className="status-panel">
          <span>試合時間</span>
          <strong>5分</strong>
        </div>
      </header>

      <section className="versus-panel" aria-labelledby="versus-heading">
        <p className="eyebrow">MATCHUP</p>
        <h2 id="versus-heading">ROCKS vs {matchSetup.opponentName}</h2>
        <div className="match-summary-grid">
          <div>
            <span>ROCKS</span>
            <strong>{matchSetup.possession === 'first' ? '先攻' : '後攻'}</strong>
          </div>
        </div>
      </section>

      <div className="waiting-members-layout">
        <WaitingMemberList heading="前半メンバー" members={firstHalfMembers} />
        <WaitingMemberList heading="後半メンバー" members={secondHalfMembers} />
      </div>

      <section className="waiting-action-row" aria-label="試合開始操作">
        <button className="secondary-button back-button" type="button" onClick={onBack}>
          設定に戻る
        </button>
        <button className="game-start-button" type="button" onClick={onGameStart}>
          ゲームスタート
        </button>
      </section>

      {gameStartMessage && (
        <p className="next-step-message waiting-message">{gameStartMessage}</p>
      )}
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

export default App
