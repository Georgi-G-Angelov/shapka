// Shapka — in-game screens. Replaces game.html + results.html.
// One GameScreen renders every role (explainer / guesser / spectator) and every
// phase from ShapkaGame.turnPhase(state), so a reconnecting phone always
// rebuilds the same view from GET /fetch_game_state.
var G = window.ShapkaGame;

const ROUND_ICONS = { 1: "record_voice_over", 2: "looks_one", 3: "sports_kabaddi" };

// ── Header ────────────────────────────────────────────────────────────────
// Position within the chosen rounds, named by kind: "Round 2/2 · Act it out".
const RoundPill = ({ state }) => {
  const r = G.roundInfo(state);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 99, background: "rgba(255,255,255,.14)", fontSize: 14, fontWeight: 800, whiteSpace: "nowrap" }}>
      <MI name={ROUND_ICONS[r.round]} size={17} />Round {state.round}/{G.roundCount(state)} · {r.title}
    </div>
  );
};

const ScoreStrip = ({ game, me, bump }) => {
  const s = game.state;
  const current = G.teamOf(game, s.turn_player);
  const mine = G.teamOf(game, me);
  const strip = useRef(null);
  useEffect(() => {
    const chip = strip.current?.children[current];
    if (chip) strip.current.scrollTo({ left: chip.offsetLeft - 16, behavior: "smooth" });
  }, [current]);
  return (
    <div ref={strip} role="list" aria-label="Team scores" style={{ display: "flex", gap: 8, overflowX: "auto", overscrollBehaviorX: "contain",
      width: "100%", minWidth: 0, position: "relative", padding: "0 16px 2px", scrollPaddingInline: 16 }}>
      {s.teams.map((team, i) => {
        const total = G.standings(game).find(r => r.team === i).total;
        const active = i === current;
        return (
          <div role="listitem" key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 6px", borderRadius: 99, flexShrink: 0,
            background: active ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.1)", color: active ? "#2A0F33" : "#fff", transition: "background 300ms, color 300ms" }}>
            <Pair names={team} color={teamColor(i)} size={24} onDark />
            <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{i === mine ? "You" : team.join(" & ")}</span>
            <span key={active ? bump : 0} className="tabular" style={{ fontSize: 15, fontWeight: 900, animation: active && bump ? "scoreBump 420ms ease-out" : undefined }}>{total}</span>
          </div>
        );
      })}
    </div>
  );
};

const HatCount = ({ game }) => (
  <div aria-label={`${G.wordsLeft(game)} of ${G.totalWords(game)} words left in the hat`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,.8)" }}>
    <img src="assets/shapka-logo.png" alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
    <span className="tabular">{G.wordsLeft(game)} of {G.totalWords(game)} left in the hat</span>
  </div>
);

const GameHeader = ({ game, me, act, bump }) => (
  <div style={{ paddingTop: "var(--status-top)", flexShrink: 0, minWidth: 0, maxWidth: "100%" }}>
    <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px" }}>
      <IconButton icon="menu" label="Game menu" color="#fff" onClick={act.menu} />
      <RoundPill state={game.state} />
      <IconButton icon="groups" label="Teams and scores" color="#fff" onClick={act.teams} />
    </div>
    <ScoreStrip game={game} me={me} bump={bump} />
  </div>
);

// ── Pieces ────────────────────────────────────────────────────────────────
// `kind` is the round type (1 Describe, 2 One word, 3 Act it out).
const RuleCard = ({ kind, compact = false }) => {
  const r = G.ROUNDS[kind - 1];
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: compact ? "10px 14px" : "14px 16px", borderRadius: 18,
      background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.14)", textAlign: "left" }}>
      <MI name={ROUND_ICONS[kind]} size={compact ? 24 : 30} color="#E1BEE7" />
      <div style={{ fontSize: compact ? 15 : 17, fontWeight: 800 }}>{r.title}</div>
    </div>
  );
};

const PersonLine = ({ name, color, label }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px 5px 5px", borderRadius: 99, background: "rgba(255,255,255,.12)" }}>
    <Avatar name={name} color={color} size={30} style={{ background: "#fff" }} />
    <span style={{ fontSize: 15, fontWeight: 700 }}>{label}</span>
  </div>
);

// One word in play: white card, huge type, full-width "Got it".
const WordCard = ({ word, onGotIt, small, hidden, index }) => (
  <div style={{ background: "#fff", color: "#1C1022", borderRadius: 26, padding: small ? "18px 18px 14px" : "28px 20px 18px", boxShadow: "0 22px 40px -18px rgba(0,0,0,.55)",
    animation: "popIn 360ms ease-out", position: "relative", overflow: "hidden" }}>
    {index != null && <div style={{ position: "absolute", top: 12, left: 16, fontSize: 12, fontWeight: 800, color: "#B39DBF", letterSpacing: 0.8 }}>WORD {index + 1}</div>}
    <div style={{ fontSize: small ? 34 : 46, fontWeight: 900, textAlign: "center", letterSpacing: -0.5, lineHeight: 1.1, margin: small ? "10px 0 14px" : "14px 0 22px",
      overflowWrap: "anywhere", filter: hidden ? "blur(14px)" : "none", transition: "filter 200ms" }}>{word}</div>
    <Pressable onClick={hidden ? undefined : onGotIt} label={`Got it: ${word}`} scale={0.96} style={{ borderRadius: 18 }}>
      <div style={{ height: small ? 52 : 64, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        background: "linear-gradient(180deg, #1DB954, #0E8A3C)", color: "#fff", fontSize: small ? 18 : 20, fontWeight: 800 }}>
        <MI name="check_circle" size={small ? 24 : 28} />Got it
      </div>
    </Pressable>
  </div>
);

const TurnTally = ({ words, label = "this turn", onDark = true }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
    <div key={words.length} className="tabular" style={{ fontSize: 54, fontWeight: 900, lineHeight: 1, animation: words.length ? "scoreBump 420ms ease-out" : undefined }}>{words.length}</div>
    <div style={{ fontSize: 14, fontWeight: 700, color: onDark ? "rgba(255,255,255,.7)" : "var(--text3)" }}>{words.length === 1 ? "word" : "words"} {label}</div>
  </div>
);

const GuessedChips = ({ words }) => words.length ? (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
    {words.map((w, i) => <span key={w + i} style={{ padding: "6px 11px", borderRadius: 99, background: "rgba(74,222,128,.18)", color: "#BBF7D0", fontSize: 14, fontWeight: 700,
      display: "inline-flex", alignItems: "center", gap: 4, animation: "fadeUp 260ms ease-out" }}><MI name="check" size={15} />{w}</span>)}
  </div>
) : null;

const Stage = ({ children, style = {} }) => (
  <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 20px", gap: 18, textAlign: "center", ...style }}>{children}</div>
);

const Waiting = ({ text }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 56, borderRadius: 16, background: "rgba(255,255,255,.1)", fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>
    <Spinner size={18} stroke={2.5} color="#fff" />{text}
  </div>
);

const GameBottom = ({ children }) => (
  <div style={{ flexShrink: 0, padding: "10px 20px calc(var(--safe-bottom) + 12px)", display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
);

// ── Explainer ─────────────────────────────────────────────────────────────
const ExplainerView = ({ game, me, phase, turn, act }) => {
  const s = game.state;
  const mate = G.teammateOf(game, me);
  const color = teamColor(G.teamOf(game, me));
  const next = G.upNext(game);
  const canDraw = s.words_in_play.length < G.LIMITS.maxWordsInPlay && s.words_to_guess.length > 0;
  const lastGuess = turn.guesses[turn.guesses.length - 1];

  if (phase === "ready") {
    const carried = s.timer < s.turn_length;
    return <>
      <Stage style={{ justifyContent: "center" }}>
        <div style={{ animation: "fadeUp 400ms ease-out" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#E1BEE7", letterSpacing: 1, textTransform: "uppercase" }}>{carried ? "Keep going" : "You're up"}</div>
          <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>Your turn, {me}!</div>
        </div>
        <PersonLine name={mate} color={color} label={`Explain to ${mate}`} />
        <TimerRing ms={s.timer} total={s.turn_length} size={176} onDark />
      </Stage>
      <GameBottom>
        <Button label={`Start · ${Math.ceil(s.timer / 1000)}s`} icon="play_arrow" tone="light" glow onClick={act.startTurn} />
      </GameBottom>
    </>;
  }

  if (phase === "live" || phase === "paused") {
    const paused = phase === "paused";
    return <>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px 0", flexShrink: 0 }}>
        <Pressable onClick={paused ? act.resumeTurn : act.pauseTurn} label={paused ? "Resume" : "Pause"} style={{ borderRadius: "50%" }}>
          <TimerRing ms={s.timer} total={s.turn_length} size={84} onDark paused={paused} />
        </Pressable>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.7)" }}>Explaining to</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{mate}</div>
          <div className="tabular" style={{ fontSize: 13, fontWeight: 700, color: "#BBF7D0", marginTop: 4 }}>+{turn.guesses.length} this turn · {G.wordsLeft(game)} left</div>
        </div>
        <IconButton icon={paused ? "play_arrow" : "pause"} label={paused ? "Resume" : "Pause"} color="#2A0F33" bg="#fff" size={26} onClick={paused ? act.resumeTurn : act.pauseTurn} />
      </div>
      <Stage style={{ justifyContent: "center", gap: 14 }}>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          {s.words_in_play.map((w, i) => <WordCard key={w} word={w} small={s.words_in_play.length > 1} hidden={paused}
            index={s.words_in_play.length > 1 ? i : null} onGotIt={() => act.gotIt(w)} />)}
        </div>
        {paused && <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,.85)", display: "flex", gap: 6, alignItems: "center" }}><MI name="pause_circle" size={20} />Paused. Words hidden.</div>}
      </Stage>
      <GameBottom>
        {!paused && <Pressable onClick={canDraw ? act.drawWord : undefined} disabled={!canDraw} label="Draw another word" style={{ borderRadius: 16 }}>
          <div style={{ height: 52, borderRadius: 16, border: "2px solid rgba(255,255,255,.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontSize: 16, fontWeight: 700, opacity: canDraw ? 1 : 0.4 }}>
            <MI name="style" size={20} />{s.words_in_play.length > 1 ? "Holding two words" : "Stuck? Draw a second word"}
          </div>
        </Pressable>}
        {lastGuess && !paused && <Pressable onClick={act.undo} label={`Undo ${lastGuess}`} style={{ alignSelf: "center", borderRadius: 99 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 99, background: "rgba(255,255,255,.1)", fontSize: 14, fontWeight: 700 }}>
            <MI name="undo" size={18} />Undo “{lastGuess}”
          </div>
        </Pressable>}
      </GameBottom>
    </>;
  }

  if (phase === "timesUp") {
    return <>
      <Stage style={{ justifyContent: "center" }}>
        <div style={{ width: 84, height: 84, borderRadius: 42, background: "rgba(255,77,106,.18)", display: "flex", alignItems: "center", justifyContent: "center", animation: "popIn 400ms ease-out" }}>
          <MI name="notifications_active" size={46} color="#FF8FA3" style={{ animation: "ring 1.4s ease-in-out infinite" }} />
        </div>
        <div style={{ fontSize: 36, fontWeight: 900 }}>Time's up!</div>
        <TurnTally words={turn.guesses} label={`with ${mate}`} />
        <GuessedChips words={turn.guesses} />
      </Stage>
      <GameBottom>
        {turn.alarm && <TextButton label="Stop alarm" icon="volume_off" color="#fff" onClick={act.stopAlarm} style={{ alignSelf: "center" }} />}
        <Button label={`Pass to ${next.explainer}`} icon="arrow_forward" tone="light" glow onClick={act.nextTurn} />
      </GameBottom>
    </>;
  }
  return null;
};

// ── Guesser & spectator ───────────────────────────────────────────────────
const WatcherView = ({ game, me, phase, turn, role }) => {
  const s = game.state;
  const explainer = s.turn_player;
  const guesser = G.teammateOf(game, explainer);
  const color = teamColor(G.teamOf(game, explainer));
  const next = G.upNext(game);
  const meNext = next && (next.explainer === me || next.guesser === me);
  const guessing = role === "guesser";

  const title = guessing ? "You're guessing!" : "Other team's turn";
  const subtitle = guessing ? `Listen to ${explainer}` : `${explainer} is explaining to ${guesser}`;

  if (phase === "timesUp") {
    return <>
      <Stage style={{ justifyContent: "center" }}>
        <MI name="alarm" size={52} color="#FF8FA3" />
        <div style={{ fontSize: 32, fontWeight: 900 }}>Time's up!</div>
        <TurnTally words={turn.guesses} label={guessing ? "you got together" : `for ${explainer} & ${guesser}`} />
        {next && <div style={{ fontSize: 16, fontWeight: 700, color: meNext ? "#FDE68A" : "rgba(255,255,255,.8)" }}>
          {next.explainer === me ? "You explain next. Get ready!" : next.guesser === me ? `${next.explainer} explains to you next` : `Next: ${next.explainer} → ${next.guesser}`}</div>}
      </Stage>
      <GameBottom><Waiting text={`Waiting for ${explainer} to pass the turn`} /></GameBottom>
    </>;
  }

  const live = phase === "live";
  return <>
    <Stage style={{ justifyContent: "center" }}>
      <div style={{ animation: "fadeUp 400ms ease-out" }}>
        <div style={{ fontSize: guessing ? 34 : 28, fontWeight: 900 }}>{title}</div>
        <div style={{ marginTop: 10 }}><PersonLine name={explainer} color={color} label={subtitle} /></div>
      </div>
      <TimerRing ms={s.timer} total={s.turn_length} size={guessing ? 210 : 180} onDark paused={phase === "paused"}>
        {phase === "paused" && <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,.75)", marginTop: 6 }}>PAUSED</div>}
        {phase === "ready" && <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,.75)", marginTop: 6 }}>GET READY</div>}
      </TimerRing>
      {(live || phase === "paused") ? <TurnTally words={turn.guesses} label={guessing ? "guessed" : "this turn"} />
        : <div style={{ fontSize: 15, color: "rgba(255,255,255,.8)", fontWeight: 600 }}>{explainer} will start the clock.</div>}
    </Stage>
    <GameBottom>
      {!guessing && next && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 700,
        color: meNext ? "#FDE68A" : "rgba(255,255,255,.7)", padding: "8px 0" }}>
        <MI name={meNext ? "bolt" : "schedule"} size={18} />
        {next.explainer === me ? "You explain next" : next.guesser === me ? `You guess next, with ${next.explainer}` : `Up next: ${next.explainer} → ${next.guesser}`}
      </div>}
      <HatCount game={game} />
    </GameBottom>
  </>;
};

// ── Round over (everyone) ─────────────────────────────────────────────────
const RoundOverView = ({ game, me, phase, act }) => {
  const s = game.state;
  const isExplainer = s.turn_player === me;
  const finished = phase === "gameOver";
  const rows = s.teams.map((team, i) => ({ team, i, score: G.roundScore(game, i) })).sort((a, b) => b.score - a.score);
  const keeps = s.timer >= G.LIMITS.keepTurnMinMs;
  const nextRule = finished ? null : G.roundInfo(s, s.round + 1);
  return <>
    <Stage style={{ justifyContent: "center" }}>
      <div style={{ animation: "popIn 420ms ease-out" }}><HatLogo size={92} /></div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#E1BEE7", letterSpacing: 1, textTransform: "uppercase" }}>Round {s.round} complete</div>
        <div style={{ fontSize: 32, fontWeight: 900, marginTop: 6 }}>{finished ? "That's the game!" : "The hat is empty!"}</div>
      </div>
      <div style={{ width: "100%", background: "rgba(255,255,255,.08)", borderRadius: 20, padding: "6px 14px" }}>
        {rows.map((r, k) => <div key={r.i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: k ? "1px solid rgba(255,255,255,.1)" : "none" }}>
          <Pair names={r.team} color={teamColor(r.i)} size={28} onDark />
          <div style={{ flex: 1, textAlign: "left", fontSize: 15, fontWeight: 700 }}>{r.team.join(" & ")}{r.team.includes(me) && <span style={{ color: "rgba(255,255,255,.6)" }}> (you)</span>}</div>
          <div className="tabular" style={{ fontSize: 18, fontWeight: 900 }}>+{r.score}</div>
        </div>)}
      </div>
      {!finished && <div style={{ width: "100%" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,.6)", letterSpacing: 1, textAlign: "left", margin: "0 4px 8px" }}>NEXT: ROUND {s.round + 1}</div>
        <RuleCard kind={nextRule.round} />
      </div>}
    </Stage>
    <GameBottom>
      {finished ? <Button label="See the results" icon="emoji_events" tone="light" glow onClick={act.showResults} />
        : isExplainer ? <>
          {!keeps && <div style={{ fontSize: 14, color: "rgba(255,255,255,.75)", textAlign: "center" }}>{G.upNext(game).explainer} goes next.</div>}
          <Button label={`Start round ${s.round + 1} · ${nextRule.title}`} icon="skip_next" tone="light" glow onClick={act.nextRound} />
        </> : <Waiting text={`Waiting for ${s.turn_player} to start round ${s.round + 1}`} />}
    </GameBottom>
  </>;
};

const GameScreen = ({ game, me, turn, act, bump }) => {
  const phase = G.turnPhase(game.state);
  const role = G.roleOf(game, me);
  let body;
  if (phase === "roundOver" || phase === "gameOver") body = <RoundOverView game={game} me={me} phase={phase} act={act} />;
  else if (role === "explainer") body = <ExplainerView game={game} me={me} phase={phase} turn={turn} act={act} />;
  else body = <WatcherView game={game} me={me} phase={phase} turn={turn} role={role} />;
  const urgent = phase === "live" && game.state.timer <= 10000;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, color: "#fff", position: "relative",
      background: urgent ? "radial-gradient(120% 80% at 50% 30%, #6B1236, var(--stage) 75%)" : "radial-gradient(120% 80% at 50% 30%, var(--stage-2), var(--stage) 75%)",
      transition: "background 600ms" }}>
      <GameHeader game={game} me={me} act={act} bump={bump} />
      {body}
    </div>
  );
};

// ── Sheets ────────────────────────────────────────────────────────────────
const TeamsSheet = ({ open, onClose, game, me }) => {
  if (!game?.state.has_game_started) return <Sheet open={false} onClose={onClose} />;
  const s = game.state;
  const table = G.standings(game);
  return (
    <Sheet open={open} onClose={onClose} label="Teams and scores">
      <SheetTitle title="Teams & scores" subtitle={`Round ${s.round} of ${G.roundCount(s)} · ${G.wordsLeft(game)} words left in the hat`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {table.map(row => <Card key={row.team} pad={14} style={{ boxShadow: "none", border: row.players.includes(me) ? `2px solid ${teamColor(row.team)}` : "2px solid transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Pair names={row.players} color={teamColor(row.team)} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{row.players.join(" & ")}</div>
              <div className="tabular" style={{ fontSize: 13, color: "var(--text3)", marginTop: 3 }}>{row.perRound.map(r => `R${r.round} ${r.round <= s.round ? r.words.length : "–"}`).join(" · ")}</div>
            </div>
            <div className="tabular" style={{ fontSize: 24, fontWeight: 900, color: teamColor(row.team) }}>{row.total}</div>
          </div>
        </Card>)}
      </div>
    </Sheet>
  );
};

const GameMenuSheet = ({ open, onClose, act, game }) => (
  <Sheet open={open} onClose={onClose} label="Game menu">
    <SheetTitle title={`Game ${game?.id ?? ""}`} />
    {[["groups", "Teams & scores", act.teams], ["help_outline", "How to play", act.howTo], ["home", "Back to home", act.home, "You can rejoin from the home screen."]].map(([icon, label, onClick, sub]) => (
      <Pressable key={label} onClick={() => { onClose(); onClick(); }} label={label} style={{ borderRadius: 16, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 16, background: "var(--surface)" }}>
          <MI name={icon} size={24} color="var(--primary)" />
          <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700 }}>{label}</div>{sub && <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 2 }}>{sub}</div>}</div>
          <MI name="chevron_right" size={22} color="var(--text3)" />
        </div>
      </Pressable>))}
  </Sheet>
);

// ── Results ───────────────────────────────────────────────────────────────
const MEDAL = { gold: "var(--gold)", silver: "var(--silver)", bronze: "var(--bronze)" };

const ResultsScreen = ({ game, me, act }) => {
  const table = G.standings(game);
  const winners = table.filter(r => r.place === 1);
  const iWon = winners.some(r => r.players.includes(me));
  const [open, setOpen] = useState(null);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }}>
      <Confetti />
      <div style={{ background: "radial-gradient(120% 90% at 50% 10%, var(--stage-2), var(--stage) 80%)", color: "#fff", borderRadius: "0 0 32px 32px", flexShrink: 0 }}>
        <TopBar title={`Game ${game.id}`} onBack={act.home} backIcon="close" color="#fff" />
        <div style={{ textAlign: "center", padding: "0 20px 26px" }}>
          <MI name="emoji_events" size={58} color="var(--gold)" style={{ animation: "popIn 600ms ease-out", filter: "drop-shadow(0 6px 14px rgba(226,169,21,.5))" }} />
          <div style={{ fontSize: 15, fontWeight: 800, color: "#E1BEE7", letterSpacing: 1, textTransform: "uppercase", marginTop: 8 }}>{winners.length > 1 ? "It's a tie!" : iWon ? "You won!" : "Winners"}</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6, lineHeight: 1.2 }}>{winners.map(w => w.players.join(" & ")).join("  ·  ")}</div>
          <div className="tabular" style={{ fontSize: 15, color: "rgba(255,255,255,.75)", marginTop: 6 }}>{winners[0].total} words over {G.roundCount(game.state)} {G.roundCount(game.state) === 1 ? "round" : "rounds"}</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {table.map((row, k) => {
          const expanded = open === row.team;
          const medal = MEDAL[row.medal];
          return <Card key={row.team} pad={0} style={{ overflow: "hidden", animation: `fadeUp ${300 + k * 120}ms ease-out`, border: medal ? `2px solid ${medal}` : "2px solid transparent", boxShadow: "none" }}>
            <Pressable onClick={() => setOpen(expanded ? null : row.team)} label={`${row.players.join(" and ")}, ${row.total} words`} scale={0.99}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 14px" }}>
                <div style={{ width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15,
                  background: medal || "var(--surface-alt)", color: medal ? "#fff" : "var(--text3)" }}>{row.place}</div>
                <Pair names={row.players} color={teamColor(row.team)} size={30} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 800 }}>{row.players.join(" & ")}{row.players.includes(me) && <span style={{ color: "var(--text3)", fontWeight: 600 }}> (you)</span>}</div>
                <div className="tabular" style={{ fontSize: 22, fontWeight: 900 }}>{row.total}</div>
                <MI name={expanded ? "expand_less" : "expand_more"} size={22} color="var(--text3)" />
              </div>
            </Pressable>
            {expanded && <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10, animation: "fadeIn 200ms" }}>
              {row.perRound.map(r => <div key={r.round}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text3)", letterSpacing: 0.8, marginBottom: 6 }}>ROUND {r.round} · {r.title.toUpperCase()} · {r.words.length}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {r.words.length ? r.words.map(w => <span key={w} style={{ fontSize: 13, fontWeight: 700, padding: "4px 9px", borderRadius: 99, background: alpha(teamColor(row.team), 0.12), color: teamColor(row.team) }}>{w}</span>)
                    : <span style={{ fontSize: 13, color: "var(--text3)" }}>No words this round</span>}
                </div>
              </div>)}
            </div>}
          </Card>;
        })}
        <div style={{ textAlign: "center", fontFamily: "'Metal Mania', cursive", fontSize: 24, color: "var(--primary)", margin: "10px 0 4px" }}>Thanks for playing!</div>
      </div>
      <BottomBar>
        <Button label="Play again" icon="replay" onClick={act.playAgain} />
      </BottomBar>
    </div>
  );
};

Object.assign(window, { GameScreen, TeamsSheet, GameMenuSheet, ResultsScreen });
