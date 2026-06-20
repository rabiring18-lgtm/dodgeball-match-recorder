import { useEffect, useMemo, useState } from 'react'

const PLAYER_COUNT = 12
const STORAGE_KEYS = {
  players: 'dodgeballMatchRecorder.players',
  matchSetup: 'dodgeballMatchRecorder.matchSetup',
  opponentHistory: 'dodgeballMatchRecorder.opponentHistory',
}

const createEmptyPlayers = () =>
  Array.from({ length: PLAYER_COUNT }, (_, index) => ({
    id: index,
    number: '',
    name: '',
  }))

const defaultMatchSetup = {
  opponentName: '',
  matchMinutes: '5',
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
    number: players[index]?.number ?? '',
    name: players[index]?.name ?? '',
  }))
}

function isRegisteredPlayer(player) {
  return player.number.trim() !== '' && player.name.trim() !== ''
}

function App() {
  const [players, setPlayers] = useState(() =>
    normalizePlayers(readStorage(STORAGE_KEYS.players, createEmptyPlayers())),
  )
  const [matchSetup, setMatchSetup] = useState(() => ({
    ...defaultMatchSetup,
    ...readStorage(STORAGE_KEYS.matchSetup, defaultMatchSetup),
  }))
  const [opponentHistory, setOpponentHistory] = useState(() =>
    readStorage(STORAGE_KEYS.opponentHistory, []),
  )
  const [readyMessage, setReadyMessage] = useState('')

  const registeredPlayers = useMemo(
    () => players.filter(isRegisteredPlayer),
    [players],
  )

  useEffect(() => {
    writeStorage(STORAGE_KEYS.players, players)
  }, [players])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.matchSetup, matchSetup)
  }, [matchSetup])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.opponentHistory, opponentHistory)
  }, [opponentHistory])

  useEffect(() => {
    const registeredIds = new Set(registeredPlayers.map((player) => player.id))

    setMatchSetup((current) => ({
      ...current,
      firstHalfMemberIds: current.firstHalfMemberIds.filter((id) =>
        registeredIds.has(id),
      ),
      secondHalfMemberIds: current.secondHalfMemberIds.filter((id) =>
        registeredIds.has(id),
      ),
    }))
  }, [registeredPlayers])

  const canStartPreparation =
    matchSetup.opponentName.trim() !== '' &&
    Number(matchSetup.matchMinutes) > 0 &&
    matchSetup.possession !== '' &&
    matchSetup.firstHalfMemberIds.length > 0 &&
    matchSetup.secondHalfMemberIds.length > 0

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
        <div className="section-heading">
          <div>
            <p className="eyebrow">ROCKS ROSTER</p>
            <h2 id="players-heading">ROCKS選手登録</h2>
          </div>
          <p>12人分の背番号と表示名を登録できます。</p>
        </div>

        <div className="player-grid">
          {players.map((player, index) => (
            <div className="player-row" key={player.id}>
              <span className="slot-number">{index + 1}</span>
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
      </section>

      <div className="setup-layout">
        <section className="setup-section" aria-labelledby="match-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MATCH INFO</p>
              <h2 id="match-heading">試合情報</h2>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
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

            <label className="field">
              <span>試合時間（分）</span>
              <input
                type="number"
                min="1"
                step="1"
                list="match-minute-options"
                value={matchSetup.matchMinutes}
                onChange={(event) =>
                  updateMatchSetup('matchMinutes', event.target.value)
                }
              />
              <datalist id="match-minute-options">
                <option value="3" />
                <option value="5" />
                <option value="7" />
                <option value="10" />
              </datalist>
            </label>
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

        <MemberSelector
          heading="前半メンバー"
          players={registeredPlayers}
          selectedIds={matchSetup.firstHalfMemberIds}
          onToggle={(playerId) => toggleMember('firstHalfMemberIds', playerId)}
        />

        <MemberSelector
          heading="後半メンバー"
          players={registeredPlayers}
          selectedIds={matchSetup.secondHalfMemberIds}
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
    </main>
  )
}

function MemberSelector({ heading, players, selectedIds, onToggle }) {
  return (
    <section className="setup-section member-section" aria-labelledby={heading}>
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">MEMBERS</p>
          <h2 id={heading}>{heading}</h2>
        </div>
        <p>{selectedIds.length}人選択中</p>
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
