// Shapka — pre-game screens: Home, Create, Join, Lobby and How to play.
// Server calls are named in comments; the app shell (shapka-app.jsx) simulates them.
const G = window.ShapkaGame;

// ── Home ──────────────────────────────────────────────────────────────────
// Replaces home.html. The resume card replaces checkActiveGameExists():
// the app keeps {gameId, name, token} in secure storage and asks /is_in_game.
const HomeScreen = ({ act, resume, dark }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, color: "#fff",
    background: "radial-gradient(120% 70% at 50% 18%, var(--stage-2), var(--stage) 70%)" }}>
    <div style={{ paddingTop: "var(--status-top)", display: "flex", justifyContent: "space-between", padding: "var(--status-top) 8px 0" }}>
      <IconButton icon="help_outline" label="How to play" color="rgba(255,255,255,.85)" onClick={act.howTo} />
      <IconButton icon={dark ? "light_mode" : "dark_mode"} label={dark ? "Light theme" : "Dark theme"} color="rgba(255,255,255,.85)" onClick={act.toggleTheme} />
    </div>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 24px", minHeight: 0 }}>
      <div style={{ position: "relative" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: -30, borderRadius: "50%", background: "radial-gradient(circle, rgba(206,147,216,.35), transparent 65%)" }} />
        <HatLogo size={168} bob />
      </div>
      <Wordmark size={64} color="#fff" style={{ marginTop: 4, textShadow: "0 4px 18px rgba(206,147,216,.55)" }} />
      <div style={{ fontSize: 16, color: "rgba(255,255,255,.75)", textAlign: "center", lineHeight: 1.4, maxWidth: 270 }}>
        Words in a hat. Teams of two. Three rounds of chaos.
      </div>
    </div>
    <div style={{ padding: "0 20px calc(var(--safe-bottom) + 18px)", display: "flex", flexDirection: "column", gap: 12 }}>
      {resume && <Pressable onClick={act.resume} label={`Rejoin game ${resume.id}`} style={{ borderRadius: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 18,
          background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)", animation: "fadeUp 400ms ease-out" }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "#4ADE80", animation: "livePulse 1.6s ease-in-out infinite", marginLeft: 4 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Game {resume.id} is still going</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", marginTop: 2 }}>{resume.detail}</div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#E1BEE7", display: "flex", alignItems: "center" }}>Rejoin<MI name="chevron_right" size={22} /></div>
        </div>
      </Pressable>}
      <Button label="Create" icon="add_circle" tone="light" onClick={act.goCreate} glow={!resume} />
      <Pressable onClick={act.goJoin} label="Join" style={{ borderRadius: 16 }}>
        <div style={{ height: 56, borderRadius: 16, border: "2px solid rgba(255,255,255,.4)", display: "flex", alignItems: "center",
          justifyContent: "center", gap: 8, fontSize: 17, fontWeight: 700 }}><MI name="login" size={22} />Join</div>
      </Pressable>
    </div>
  </div>
);

// ── Create ────────────────────────────────────────────────────────────────
const ROUND_KIND_ICONS = { 1: "record_voice_over", 2: "looks_one", 3: "sports_kabaddi" };

// Collapsed by default; the header summarises the choice so defaults need no visit.
const AdvancedSettings = ({ turnSeconds, setTurnSeconds, rounds, setRounds }) => {
  const [open, setOpen] = useState(false);
  const isDefault = turnSeconds === G.LIMITS.defaultTurnSeconds && rounds.length === G.ROUNDS.length;
  const summary = `${turnSeconds}s turns · ${rounds.length === G.ROUNDS.length ? "all 3 rounds" : rounds.map(k => G.ROUNDS[k - 1].title).join(", ")}`;
  const toggle = kind => {
    if (rounds.includes(kind)) { if (rounds.length > 1) setRounds(rounds.filter(k => k !== kind)); }
    else setRounds([...rounds, kind].sort((a, b) => a - b));
  };
  return (
    <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 0 var(--border)", overflow: "hidden", flexShrink: 0 }}>
      <Pressable onClick={() => setOpen(!open)} label="Advanced settings" scale={0.99} expanded={open}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 12px 14px 16px" }}>
          <MI name="tune" size={22} color="var(--primary)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Advanced</div>
            <div style={{ fontSize: 13, color: isDefault ? "var(--text3)" : "var(--primary)", fontWeight: 600, marginTop: 2 }}>{summary}</div>
          </div>
          <MI name="expand_more" size={24} color="var(--text3)" style={{ transform: `rotate(${open ? 180 : 0}deg)`, transition: "transform 200ms" }} />
        </div>
      </Pressable>
      {open && <div style={{ padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: 18, animation: "fadeIn 200ms" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)", marginBottom: 8 }}>Turn length</div>
          <div role="radiogroup" aria-label="Turn length" style={{ display: "flex", gap: 6 }}>
            {G.LIMITS.turnSeconds.map(sec => {
              const on = sec === turnSeconds;
              return <Pressable key={sec} role="radio" checked={on} onClick={() => setTurnSeconds(sec)} label={`${sec} seconds`} style={{ flex: 1, borderRadius: 12 }}>
                <div className="tabular" style={{ height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, fontWeight: 800, background: on ? "var(--primary)" : "var(--surface-alt)", color: on ? "#fff" : "var(--text2)", transition: "background 150ms" }}>{sec}s</div>
              </Pressable>;
            })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)", marginBottom: 8 }}>Rounds</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {G.ROUNDS.map(r => {
              const on = rounds.includes(r.round);
              const locked = on && rounds.length === 1;
              return <Pressable key={r.round} role="checkbox" checked={on} disabled={locked} onClick={() => toggle(r.round)} label={r.title} style={{ borderRadius: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12,
                  background: on ? "var(--primary-light)" : "var(--surface-alt)", transition: "background 150ms" }}>
                  <MI name={ROUND_KIND_ICONS[r.round]} size={22} color={on ? "var(--primary)" : "var(--text3)"} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: on ? "var(--text)" : "var(--text2)" }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{r.rule}</div>
                  </div>
                  <MI name={on ? "check_box" : "check_box_outline_blank"} size={24} color={on ? (locked ? alpha("var(--primary)", 0.45) : "var(--primary)") : "var(--text3)"} />
                </div>
              </Pressable>;
            })}
          </div>
        </div>
      </div>}
    </div>
  );
};

// GET /create_game/<name>/<word_limit>  → { name, gameId, authToken }
const CreateScreen = ({ act, savedName }) => {
  const [name, setName] = useState(savedName || "");
  const [limit, setLimit] = useState(G.LIMITS.defaultWordsPerPlayer);
  const [turnSeconds, setTurnSeconds] = useState(G.LIMITS.defaultTurnSeconds);
  const [rounds, setRounds] = useState([1, 2, 3]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = () => {
    const v = G.validateName(name);
    if (!v.ok) { setError(v.error); return; }
    setBusy(true);
    setTimeout(() => act.create({ name: v.value, limit, turnSeconds, rounds }), 550);
  };
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <TopBar title="New game" onBack={act.home} />
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 20px", display: "flex", flexDirection: "column", gap: 24 }}>
        <TextField id="create-name" label="Your name" value={name} placeholder="e.g. Maya" autoFocus={!savedName} enterKeyHint="next"
          onChange={v => { setName(v); setError(null); }} error={error} onSubmit={submit} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)", margin: "0 4px 8px" }}>Words per player</div>
          <Stepper value={limit} min={G.LIMITS.minWordsPerPlayer} max={G.LIMITS.maxWordsPerPlayer} onChange={setLimit} label="words" />
        </div>
        <AdvancedSettings turnSeconds={turnSeconds} setTurnSeconds={setTurnSeconds} rounds={rounds} setRounds={setRounds} />
      </div>
      <BottomBar><Button label="Create game" onClick={submit} busy={busy} disabled={!name.trim()} /></BottomBar>
    </div>
  );
};

// ── Join ──────────────────────────────────────────────────────────────────
// GET /join_game/<game_id>/<name>. Errors map to the field they concern.
const JoinScreen = ({ act, savedName, initialCode = "" }) => {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(savedName || "");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = () => {
    const c = G.validateGameCode(code);
    const n = G.validateName(name);
    if (!c.ok || !n.ok) { setErrors({ code: c.ok ? null : c.error, name: n.ok ? null : n.error }); return; }
    setBusy(true);
    setTimeout(() => {
      const result = act.join({ code: c.value, name: n.value });
      setBusy(false);
      if (!result.ok) {
        const field = result.error === G.ERRORS.nameTaken ? "name" : "code";
        const copy = {
          [G.ERRORS.gameNotFound]: `There's no game ${c.value}. Check the code with the host.`,
          [G.ERRORS.nameTaken]: `Someone in this game is already called ${n.value}. Add an initial?`,
          [G.ERRORS.gameFull]: "This game is full (20 players).",
        }[result.error] || result.error;
        setErrors({ [field]: copy });
      }
    }, 600);
  };
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <TopBar title="Join game" onBack={act.home} />
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 20px", display: "flex", flexDirection: "column", gap: 24 }}>
        <TextField id="join-code" label="Game code" value={code} placeholder="Enter code" inputMode="numeric" big center maxLength={5} autoFocus
          onChange={v => { setCode(v.replace(/\D/g, "")); setErrors(e => ({ ...e, code: null })); }}
          error={errors.code} />
        <TextField id="join-name" label="Your name" value={name} placeholder="e.g. Maya" enterKeyHint="go" onSubmit={submit}
          onChange={v => { setName(v); setErrors(e => ({ ...e, name: null })); }} error={errors.name} />
      </div>
      <BottomBar><Button label="Join game" onClick={submit} busy={busy} disabled={!code || !name.trim()} /></BottomBar>
    </div>
  );
};

// ── Lobby ─────────────────────────────────────────────────────────────────
// Replaces host.html + await.html. Live via /gameevents (new_player, new_word,
// word_removed, player_left, player_kicked, start_game) + 5s /has_game_started poll.
const GameCodeCard = ({ id, act }) => (
  <div style={{ borderRadius: 22, padding: "16px 18px", color: "#fff", display: "flex", alignItems: "center", gap: 12,
    background: "linear-gradient(135deg, var(--stage-2), var(--primary))", boxShadow: "var(--card-shadow)" }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, opacity: 0.75, textTransform: "uppercase" }}>Game code</div>
      <div className="tabular" style={{ fontSize: 40, fontWeight: 900, letterSpacing: 6, lineHeight: 1.1, marginTop: 2 }}>{id}</div>
    </div>
    <IconButton icon="content_copy" label="Copy code" color="#fff" bg="rgba(255,255,255,.16)" size={21} onClick={() => act.toast({ text: "Code copied", icon: "content_copy", kind: "success" })} />
    <IconButton icon="ios_share" label="Share invite" color="#fff" bg="rgba(255,255,255,.16)" size={21} onClick={() => act.toast({ text: `Invite shared: shapka.app/join/${id}`, icon: "ios_share", kind: "success" })} />
  </div>
);

const WordDots = ({ have, need, color = "var(--primary)" }) => (
  <div aria-label={`${have} of ${need} words`} style={{ display: "flex", gap: 4 }}>
    {Array.from({ length: need }, (_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: 4,
      background: i < have ? color : "var(--border)", transition: "background 250ms" }} />)}
  </div>
);

const MyWords = ({ game, me, act }) => {
  const mine = game.state.words_per_player[me] || [];
  const limit = game.wordLimit;
  const [word, setWord] = useState("");
  const [error, setError] = useState(null);
  const done = mine.length >= limit;
  const add = (value = word) => {
    const v = G.validateWord(value, mine);
    if (!v.ok) { setError(v.error); return; }
    const r = act.addWord(v.value);
    if (!r.ok) { setError(r.error); return; }
    setWord(""); setError(null);
  };
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{done ? "You're all set!" : "Add your words"}</div>
        </div>
        <div className="tabular" style={{ fontSize: 15, fontWeight: 800, color: done ? "var(--success)" : "var(--primary)", display: "flex", alignItems: "center", gap: 4 }}>
          {done && <MI name="check_circle" size={20} />}{mine.length}/{limit}
        </div>
      </div>
      {!done && <TextField id="word" nested value={word} placeholder={`Word ${mine.length + 1}`} autoCapitalize="none" enterKeyHint="done"
        onChange={v => { setWord(v); setError(null); }} onSubmit={() => add()} error={error}
        trailing={<IconButton icon="arrow_upward" label="Add word" onClick={word.trim() ? () => add() : undefined}
          color="#fff" bg={word.trim() ? "var(--primary)" : "var(--border)"} size={22} />} />}
      {mine.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: done ? 0 : 14 }}>
        {mine.map(w => (
          <Pressable key={w} onClick={() => act.deleteWord(w)} label={`Remove ${w}`} style={{ borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 8px 8px 12px", borderRadius: 12, animation: "popIn 280ms ease-out",
              background: "linear-gradient(180deg, var(--primary), var(--primary-deep))", color: "#fff", fontSize: 15, fontWeight: 700 }}>
              {w}<MI name="close" size={16} style={{ opacity: 0.75 }} />
            </div>
          </Pressable>))}
      </div>}
    </Card>
  );
};

const PlayerRow = ({ p, me, isHostView, act, first }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: first ? "none" : "1px solid var(--border)", animation: "fadeUp 300ms ease-out" }}>
    <Avatar name={p.name} size={40} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
        {p.name === me && <span style={{ fontSize: 13, color: "var(--text3)", fontWeight: 600 }}>(you)</span>}
        {p.host && <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, color: "var(--primary)", background: "var(--primary-light)", padding: "2px 7px", borderRadius: 99 }}>HOST</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
        {p.done ? <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}><MI name="check" size={16} />Ready</span>
          : <><WordDots have={p.have} need={p.need} /><span style={{ fontSize: 13, color: "var(--text3)", fontWeight: 600 }}>adding words</span></>}
      </div>
    </div>
    {isHostView && p.name !== me && <IconButton icon="person_remove" label={`Remove ${p.name}`} color="var(--text3)" size={22} onClick={() => act.askKick(p.name)} />}
  </div>
);

const LobbyScreen = ({ game, me, act }) => {
  const status = G.lobbyStatus(game);
  const isHost = game.host === me;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <TopBar title={isHost ? "Your game" : `${possessive(game.host)} game`} onBack={isHost ? act.home : act.askLeave} backIcon="close"
        trailing={<IconButton icon="help_outline" label="How to play" onClick={act.howTo} />} />
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <GameCodeCard id={game.id} act={act} />
        <MyWords game={game} me={me} act={act} />
        <Card>
          <SectionLabel trailing={<span className="tabular" style={{ fontSize: 13, color: "var(--text3)", fontWeight: 700 }}>
            {status.totalWords}/{status.targetWords} words in the hat</span>}>Players · {status.count}</SectionLabel>
          {status.progress.map((p, i) => <PlayerRow key={p.name} p={p} me={me} isHostView={isHost} act={act} first={i === 0} />)}
          {status.count < G.LIMITS.maxPlayers && <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 10, borderTop: "1px solid var(--border)", color: "var(--text3)" }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}><MI name="person_add" size={20} /></div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Waiting for friends to join with code {game.id}…</span>
          </div>}
        </Card>
      </div>
      <BottomBar>
        {isHost ? <>
          {status.blocker && <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: "var(--text2)", textAlign: "center", lineHeight: 1.35 }}>
            <MI name={status.blocker.kind === "odd" ? "group_add" : status.blocker.kind === "alone" ? "person_add" : "hourglass_top"} size={18} color="var(--text3)" />
            <span>{status.blocker.message}</span></div>}
          <Button label={status.canStart ? `Start game · ${status.count / 2} teams` : "Start game"} icon="play_arrow" disabled={!status.canStart} glow onClick={act.start} />
        </> : <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", height: 56, borderRadius: 16, background: "var(--surface-alt)", fontSize: 15, fontWeight: 700, color: "var(--text2)" }}>
            <Spinner size={18} stroke={2.5} />Waiting for {game.host} to start
          </div>
          <TextButton label="Leave game" color="var(--danger)" onClick={act.askLeave} style={{ alignSelf: "center", padding: "4px 12px" }} />
        </>}
      </BottomBar>
    </div>
  );
};

// ── How to play ───────────────────────────────────────────────────────────
const HowToPlaySheet = ({ open, onClose }) => (
  <Sheet open={open} onClose={onClose} label="How to play">
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}><HatLogo size={72} /></div>
    <SheetTitle title="How to play" subtitle="Everyone sits together. The app keeps the words, the teams and the clock." />
    {[
      ["edit_note", "Fill the hat", "Everyone secretly adds the same number of words."],
      ["groups", "Pair up", "Players are split into random teams of two. Sit opposite your partner."],
      ["timer", "Take turns", "Before time runs out, explain as many words as you can to your partner. Tap ✓ for each one they get."],
      ["skip_next", "Stuck?", "Draw a second word and come back to the first one later."],
    ].map(([icon, title, body]) => (
      <div key={icon} style={{ display: "flex", gap: 14, padding: "10px 0" }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--primary-light)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MI name={icon} size={22} /></div>
        <div><div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div><div style={{ fontSize: 14, color: "var(--text2)", marginTop: 3, lineHeight: 1.4 }}>{body}</div></div>
      </div>))}
    <SectionLabel style={{ marginTop: 14 }}>Rounds · same words each time</SectionLabel>
    <div style={{ display: "flex", gap: 8 }}>
      {G.ROUNDS.map(r => <div key={r.round} style={{ flex: 1, background: "var(--surface)", borderRadius: 16, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)" }}>ROUND {r.round}</div>
        <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{r.title}</div>
        <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4, lineHeight: 1.35 }}>{r.rule}</div>
      </div>)}
    </div>
    <div style={{ marginTop: 20 }}><Button label="Got it" onClick={onClose} /></div>
  </Sheet>
);

Object.assign(window, { HomeScreen, CreateScreen, JoinScreen, LobbyScreen, HowToPlaySheet, WordDots });
