// Shapka — app shell: navigation, theme, the simulated server and other players, tweaks.
// Everything another phone would do (joining, adding words, explaining) is
// simulated here with the real rules from shapka-game.js. Nothing touches the network.
const { IOSDevice, TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakSelect, TweakToggle, TweakButton } = window;
var G = window.ShapkaGame;
const S = window.ShapkaSample;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "platform": "ios",
  "phone": "regular",
  "speed": "1",
  "sound": true,
  "connection": "live",
  "resumeCard": false
}/*EDITMODE-END*/;

// lib/theme.dart kLightPalette / kDarkPalette. --stage is the immersive game background.
const PALETTES = {
  light: {
    "--primary": "#8E24AA", "--primary-deep": "#6A1B9A", "--primary-light": "#F3E5F7", "--on-primary": "#FFFFFF",
    "--bg": "#F6F1F8", "--surface": "#FFFFFF", "--surface-alt": "#EEE6F2", "--border": "#E2D6E8",
    "--text": "#1C1022", "--text2": "#4B3D53", "--text3": "#877A8F",
    "--success": "#11883F", "--success-light": "#DDF6E5", "--danger": "#C62842", "--danger-light": "#FDE6E9", "--warning": "#E07B00",
    "--stage": "#3A0D48", "--stage-2": "#8E24AA", "--card-shadow": "0 10px 30px -14px rgba(74, 21, 89, .35)",
  },
  dark: {
    "--primary": "#B04CC8", "--primary-deep": "#7B1FA2", "--primary-light": "#36203F", "--on-primary": "#FFFFFF",
    "--bg": "#130A17", "--surface": "#20152A", "--surface-alt": "#2B1F35", "--border": "#3B2D45",
    "--text": "#F7EEF9", "--text2": "#CDBFD4", "--text3": "#94879C",
    "--success": "#34D17A", "--success-light": "#173322", "--danger": "#FF5C73", "--danger-light": "#3B1A21", "--warning": "#FFB347",
    "--stage": "#14061A", "--stage-2": "#4A1559", "--card-shadow": "0 10px 30px -18px rgba(0, 0, 0, .7)",
  },
};
const applyTheme = dark => Object.entries(PALETTES[dark ? "dark" : "light"]).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));

const ALARMS = ["mbt_gadove", "mbt_nema_kvo", "mbt_risk"];
const alarmSrc = name => `assets/audio/${name}.${new Audio().canPlayType("audio/ogg") ? "ogg" : "m4a"}`;
const IMMERSIVE = new Set(["home", "game"]);
const ORDER = ["home", "create", "join", "lobby", "game", "results"];

// Shown once when the host starts: teams are random, so everyone needs to find their partner.
const TeamReveal = ({ game, me, onDone }) => {
  const s = game.state;
  const mine = G.teamOf(game, me);
  const mate = G.teammateOf(game, me);
  return (
    <div role="dialog" aria-label="Teams" style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", color: "#fff",
      background: "radial-gradient(120% 80% at 50% 25%, var(--stage-2), var(--stage) 75%)", animation: "fadeIn 300ms", padding: "calc(var(--status-top) + 24px) 20px calc(var(--safe-bottom) + 14px)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, textAlign: "center", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, animation: "popIn 500ms ease-out" }}>
          <Avatar name={me} size={76} color={teamColor(mine)} style={{ background: "#fff" }} />
          <MI name="favorite" size={30} color="#FF8FA3" />
          <Avatar name={mate} size={76} color={teamColor(mine)} style={{ background: "#fff" }} />
        </div>
        <div style={{ fontSize: 30, fontWeight: 900 }}>Your teammate is {mate}</div>
        <div style={{ width: "100%", background: "rgba(255,255,255,.08)", borderRadius: 20, padding: "4px 14px", marginTop: 6 }}>
          {s.teams.map((team, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i ? "1px solid rgba(255,255,255,.1)" : "none", animation: `fadeUp ${400 + i * 120}ms ease-out` }}>
            <Pair names={team} color={teamColor(i)} size={28} onDark />
            <div style={{ flex: 1, textAlign: "left", fontSize: 15, fontWeight: 700 }}>{team.join(" & ")}</div>
            {i === mine && <span style={{ fontSize: 12, fontWeight: 800, color: "#E1BEE7" }}>YOU</span>}
          </div>)}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#FDE68A", display: "flex", gap: 6, alignItems: "center" }}>
          <MI name="campaign" size={20} />{s.turn_player === me ? "You explain first!" : `${s.turn_player} explains first`}
        </div>
      </div>
      <Button label="Let's go" tone="light" glow onClick={onDone} />
    </div>
  );
};

const ConfirmSheet = ({ open, onClose, icon, title, subtitle, confirm, onConfirm }) => (
  <Sheet open={open} onClose={onClose} label={title}>
    <SheetTitle icon={icon} title={title} subtitle={subtitle} color="var(--danger)" />
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Button label={confirm} tone="danger" onClick={onConfirm} />
      <Button label="Cancel" tone="ghost" onClick={onClose} />
    </div>
  </Sheet>
);

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const query = useMemo(() => new URLSearchParams(location.search), []);
  // URL overrides: Shapka.html?screen=lobby&theme=dark&platform=android&phone=compact&speed=3
  useEffect(() => {
    const edits = {};
    for (const key of ["theme", "platform", "phone", "speed", "connection"]) if (query.get(key)) edits[key] = query.get(key);
    if (Object.keys(edits).length) setTweak(edits);
  }, []);

  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const q = matchMedia("(prefers-color-scheme: dark)");
    const on = () => setSystemDark(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  const dark = tweaks.theme === "dark" || (tweaks.theme === "system" && systemDark);
  useEffect(() => applyTheme(dark), [dark]);

  // ── App state ──
  const gameRef = useRef(null);
  const [, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  const [phase, setPhase] = useState("home");
  const [reverse, setReverse] = useState(false);
  const [me, setMe] = useState(S.ME);
  const [savedName, setSavedName] = useState("");
  const [live, setLive] = useState(false); // lobby simulation: "host" | "player" | false
  const [turn, setTurn] = useState({ guesses: [], alarm: false });
  const [bump, setBump] = useState(0);
  const [toast, setToastState] = useState(null);
  const [sheet, setSheet] = useState(null); // howTo | teams | menu | leave | kick
  const [kickTarget, setKickTarget] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [resume, setResume] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [screenKey, setScreenKey] = useState(0);
  const sim = useRef({ wait: 0, nextGuess: 0, tick: 0 });
  const alarm = useRef(null);
  const toastTimer = useRef(null);
  const game = gameRef.current;

  const toastFn = useCallback(t => {
    clearTimeout(toastTimer.current);
    setToastState({ ...t, id: Date.now() });
    toastTimer.current = setTimeout(() => setToastState(null), t.ms || 2600);
  }, []);

  const go = useCallback(next => {
    setPhase(prev => { setReverse(ORDER.indexOf(next) < ORDER.indexOf(prev)); return next; });
  }, []);

  const stopAlarm = useCallback(() => {
    if (alarm.current) { alarm.current.pause(); alarm.current = null; }
    setTurn(t => ({ ...t, alarm: false }));
  }, []);

  const ringAlarm = useCallback(() => {
    if (!tweaks.sound) return;
    const audio = new Audio(alarmSrc(ALARMS[Math.floor(Math.random() * ALARMS.length)]));
    audio.loop = true;
    audio.play().catch(() => {});
    alarm.current = audio;
    setTurn(t => ({ ...t, alarm: true }));
    // Like game.ts: ring for at most ten seconds.
    setTimeout(() => { if (alarm.current === audio) stopAlarm(); }, 10000);
  }, [tweaks.sound, stopAlarm]);

  const load = useCallback(name => {
    const scenario = (S.SCENARIOS[name] || S.SCENARIOS.home)();
    stopAlarm();
    gameRef.current = scenario.game || null;
    setMe(scenario.me || S.ME);
    setLive(scenario.live === "host" || scenario.live === "player" ? scenario.live : false);
    setTurn({ guesses: scenario.turnGuesses || [], alarm: false });
    setReveal(false);
    setSheet(null);
    setJoinCode("");
    sim.current = { wait: 0, nextGuess: 1500, tick: 0 };
    setScreenKey(k => k + 1);
    go(scenario.phase);
    refresh();
  }, [go, refresh, stopAlarm]);

  useEffect(() => { if (query.get("screen")) load(query.get("screen")); }, []);

  const random = useMemo(() => G.rng(Number(query.get("seed")) || (Date.now() & 0xffff)), []);
  const unusedWord = () => {
    const g = gameRef.current;
    const used = new Set(Object.values(g.state.words_per_player).flat().map(w => w.toLowerCase()));
    return S.WORDS.find(w => !used.has(w.toLowerCase())) || `word${used.size}`.replace(/\d/g, "x");
  };

  // ── Lobby simulation: friends join and add words; a remote host starts when ready ──
  useEffect(() => {
    if (phase !== "lobby" || !live) return;
    const id = setInterval(() => {
      const g = gameRef.current;
      if (!g) return;
      const t = ++sim.current.tick;
      const joiners = (live === "host" ? S.FRIENDS.slice(0, 3) : ["Pesho"]).filter(n => n !== me && !g.players.includes(n) && !g.kicked?.includes(n));
      if (joiners.length && t % 3 === 1) {
        G.joinGame(g, joiners[0]);
        toastFn({ text: `${joiners[0]} joined`, icon: "person_add", kind: "success", ms: 1600 });
        refresh();
        return;
      }
      const bots = g.players.filter(p => p !== me && g.state.words_per_player[p].length < g.wordLimit);
      if (bots.length) {
        G.addWord(g, bots[t % bots.length], unusedWord());
        refresh();
        return;
      }
      if (live === "player" && G.lobbyStatus(g).canStart) {
        sim.current.wait += 1;
        if (sim.current.wait === 3) {
          G.startGame(g, random);
          toastFn({ text: `${g.host} started the game`, icon: "play_arrow", kind: "info" });
          setLive(false); setReveal(true); go("game"); refresh();
        }
      }
    }, 900);
    return () => clearInterval(id);
  }, [phase, live, me, refresh, toastFn, go, random]);

  // ── Game loop: the explainer's phone owns the clock (update_timer_state every 500ms) ──
  const speed = Number(tweaks.speed) || 1;
  useEffect(() => {
    if (phase !== "game" || reveal) return;
    const TICK = 100;
    const id = setInterval(() => {
      const g = gameRef.current;
      if (!g || tweaks.connection !== "live") return;
      const s = g.state;
      const p = G.turnPhase(s);
      const mine = s.turn_player === me;
      const dt = TICK * speed;
      if (p === "live") {
        G.updateTimer(g, s.timer - dt);
        if (!mine) {
          if (!s.words_in_play.length) G.fetchWord(g, s.turn_player);
          sim.current.nextGuess -= dt;
          if (sim.current.nextGuess <= 0 && s.words_in_play.length) {
            const word = s.words_in_play[0];
            const r = G.guessWord(g, s.turn_player, word);
            sim.current.nextGuess = 2500 + random() * 5000;
            setTurn(t => ({ ...t, guesses: [...t.guesses, word] }));
            setBump(b => b + 1);
            if (r.roundOver) { sim.current.wait = 0; }
          }
        }
        if (s.timer <= 0 && G.turnPhase(s) !== "roundOver" && G.turnPhase(s) !== "gameOver") {
          G.updateTimer(g, 0, { turnActive: false });
          sim.current.wait = 0;
          if (mine) ringAlarm();
        }
        refresh();
        return;
      }
      if (mine) return;
      // Someone else's phone: wait a moment, then act like they would.
      sim.current.wait += dt;
      if (p === "ready" && sim.current.wait > 2500) {
        G.updateTimer(g, s.timer, { turnActive: true });
        G.fetchWord(g, s.turn_player);
        sim.current = { ...sim.current, wait: 0, nextGuess: 2000 + random() * 3000 };
        refresh();
      } else if (p === "timesUp" && sim.current.wait > 3500) {
        G.nextTurn(g, random);
        sim.current.wait = 0;
        setTurn({ guesses: [], alarm: false });
        if (g.state.turn_player === me) toastFn({ text: "Your turn to explain!", icon: "campaign", kind: "info" });
        refresh();
      } else if (p === "roundOver" && sim.current.wait > 4500) {
        const r = G.nextRound(g, random);
        sim.current.wait = 0;
        if (!r.keepsTurn) setTurn({ guesses: [], alarm: false });
        toastFn({ text: `Round ${g.state.round}: ${G.roundInfo(g.state).title}`, icon: "skip_next", kind: "info" });
        refresh();
      }
    }, TICK);
    return () => clearInterval(id);
  }, [phase, reveal, me, speed, tweaks.connection, refresh, ringAlarm, toastFn, random]);

  useEffect(() => () => stopAlarm(), [stopAlarm]);

  // ── Actions (each names the endpoint the app calls) ──
  const act = {
    toast: toastFn,
    howTo: () => setSheet("howTo"),
    teams: () => setSheet("teams"),
    menu: () => setSheet("menu"),
    toggleTheme: () => setTweak("theme", dark ? "light" : "dark"),
    home: () => {
      const g = gameRef.current;
      if (g && phase === "game") setResume({ id: g.id, detail: `Round ${g.state.round} · ${g.state.turn_player === me ? "your turn" : `${g.state.turn_player} is explaining`}`, game: g });
      else if (g && phase === "lobby" && g.host === me) setResume({ id: g.id, detail: `Lobby · ${g.players.length} players`, game: g });
      stopAlarm(); setSheet(null); go("home");
    },
    resume: () => {
      if (resume?.game) { gameRef.current = resume.game; go(resume.game.state.has_game_started ? "game" : "lobby"); refresh(); }
      else load("spectator");
    },
    goCreate: () => go("create"),
    goJoin: () => go("join"),
    // GET /create_game/<name>/<limit>
    create: ({ name, limit, turnSeconds, rounds }) => {
      const { game: g } = G.createGame({ id: 1000 + Math.floor(random() * 99000), host: name, wordLimit: limit, turnSeconds, rounds });
      gameRef.current = g; setMe(name); setSavedName(name); setLive("host"); setResume(null);
      sim.current = { wait: 0, nextGuess: 0, tick: 0 };
      setTurn({ guesses: [], alarm: false });
      go("lobby"); refresh();
    },
    // GET /join_game/<id>/<name>
    join: ({ code, name }) => {
      if (code !== 4821) return { ok: false, error: G.ERRORS.gameNotFound };
      const g = S.buildLobby({ host: S.HOST, others: ["Joro"], filled: [S.HOST], me: S.HOST });
      const r = G.joinGame(g, name);
      if (!r.ok) return r;
      gameRef.current = g; setMe(name); setSavedName(name); setLive("player"); setResume(null);
      sim.current = { wait: 0, nextGuess: 0, tick: 0 };
      setTurn({ guesses: [], alarm: false });
      go("lobby"); refresh();
      return r;
    },
    addWord: word => { const r = G.addWord(gameRef.current, me, word); refresh(); return r; },
    deleteWord: word => { G.deleteWord(gameRef.current, me, word); refresh(); },
    askKick: name => { setKickTarget(name); setSheet("kick"); },
    // GET /kick_player/<id>/<host>/<player>
    kick: () => {
      const g = gameRef.current;
      G.kickPlayer(g, me, kickTarget);
      g.kicked = [...(g.kicked || []), kickTarget];
      toastFn({ text: `${kickTarget} was removed`, icon: "person_remove", kind: "info" });
      setSheet(null); refresh();
    },
    askLeave: () => setSheet("leave"),
    // GET /leave_game/<id>/<name>
    leave: () => {
      const g = gameRef.current;
      G.leaveGame(g, me);
      setSheet(null); setResume(null); go("home");
      toastFn({ text: `You left game ${g.id}`, icon: "logout", kind: "info" });
    },
    // GET /start_game/<id>
    start: () => {
      const r = G.startGame(gameRef.current, random);
      if (!r.ok) { toastFn({ text: r.error, kind: "error" }); return; }
      setLive(false); setReveal(true); go("game"); refresh();
    },
    // GET /update_timer_state/... (turn_active=true) + GET /fetch_word/<id>/<name>
    startTurn: () => {
      const g = gameRef.current;
      G.updateTimer(g, g.state.timer, { turnActive: true });
      if (!g.state.words_in_play.length) G.fetchWord(g, me);
      refresh();
    },
    pauseTurn: () => { const g = gameRef.current; G.updateTimer(g, g.state.timer, { turnActive: false }); refresh(); },
    resumeTurn: () => { const g = gameRef.current; G.updateTimer(g, g.state.timer, { turnActive: true }); refresh(); },
    // GET /guess_word/<id>/<name>/<word>; draws the next word when none is left in play.
    gotIt: word => {
      const g = gameRef.current;
      const r = G.guessWord(g, me, word);
      if (!r.ok) return;
      setTurn(t => ({ ...t, guesses: [...t.guesses, word] }));
      setBump(b => b + 1);
      if (!r.roundOver && !g.state.words_in_play.length) G.fetchWord(g, me);
      sim.current.wait = 0;
      refresh();
    },
    drawWord: () => { G.fetchWord(gameRef.current, me); refresh(); },
    // GET /undo_guess_word/<id>/<name>
    undo: () => {
      const r = G.undoGuess(gameRef.current, me);
      if (r.ok) setTurn(t => ({ ...t, guesses: t.guesses.slice(0, -1) }));
      refresh();
    },
    stopAlarm,
    // GET /next_turn/<id>
    nextTurn: () => {
      stopAlarm();
      G.nextTurn(gameRef.current, random);
      sim.current.wait = 0;
      setTurn({ guesses: [], alarm: false });
      refresh();
    },
    // GET /next_round/<id>
    nextRound: () => {
      const r = G.nextRound(gameRef.current, random);
      if (!r.keepsTurn) setTurn({ guesses: [], alarm: false });
      sim.current.wait = 0;
      refresh();
    },
    showResults: () => { setResume(null); go("results"); },
    playAgain: () => { gameRef.current = null; go("create"); },
  };

  const screen = name => {
    switch (name) {
      case "home": return <HomeScreen act={act} dark={dark} resume={resume || (tweaks.resumeCard ? { id: 4821, detail: "Round 2 · Ani is explaining" } : null)} />;
      case "create": return <CreateScreen key={screenKey} act={act} savedName={savedName} />;
      case "join": return <JoinScreen key={screenKey} act={act} savedName={savedName} initialCode={joinCode} />;
      case "lobby": return game ? <LobbyScreen game={game} me={me} act={act} /> : null;
      case "game": return game ? <GameScreen game={game} me={me} turn={turn} act={act} bump={bump} /> : null;
      case "results": return game ? <ResultsScreen game={game} me={me} act={act} /> : null;
      default: return null;
    }
  };

  const android = tweaks.platform === "android";
  const compact = tweaks.phone === "compact";
  const statusTop = android ? 28 : 54;
  const safeBottom = android ? 0 : 30;
  const immersive = IMMERSIVE.has(phase) && !(phase === "game" && !game);

  return (
    <>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#160a1b", padding: "40px 20px" }}>
        <IOSDevice dark={dark || immersive || reveal} platform={tweaks.platform} width={compact ? 360 : 390} height={compact ? 740 : 844}>
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div id="phone-app-root" style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", isolation: "isolate", background: "var(--bg)", color: "var(--text)",
              "--status-top": `${statusTop}px`, "--safe-bottom": `${safeBottom}px` }}>
              <ScreenSlideSwitcher viewKey={`${phase}-${screenKey}`} reverse={reverse} style={{ height: "100%" }}>{screen(phase)}</ScreenSlideSwitcher>
              {reveal && game && <TeamReveal game={game} me={me} onDone={() => setReveal(false)} />}
              <ConnectionBanner status={["lobby", "game"].includes(phase) ? tweaks.connection : "live"} />
              <div id="phone-overlay-layer" style={{ position: "absolute", inset: 0, zIndex: 100, pointerEvents: "none" }} />
              <Toast toast={toast} />
              <HowToPlaySheet open={sheet === "howTo"} onClose={() => setSheet(null)} />
              <TeamsSheet open={sheet === "teams"} onClose={() => setSheet(null)} game={game} me={me} />
              <GameMenuSheet open={sheet === "menu"} onClose={() => setSheet(null)} act={act} game={game} />
              <ConfirmSheet open={sheet === "leave"} onClose={() => setSheet(null)} icon="logout" title="Leave this game?"
                subtitle="Your words leave the hat with you. You can join again with the code." confirm="Leave game" onConfirm={act.leave} />
              <ConfirmSheet open={sheet === "kick"} onClose={() => setSheet(null)} icon="person_remove" title={`Remove ${kickTarget}?`}
                subtitle={`${kickTarget}'s words are taken out of the hat too.`} confirm={`Remove ${kickTarget}`} onConfirm={act.kick} />
            </div>
            {android && <div aria-label="Android system navigation" style={{ height: 48, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-evenly",
              background: immersive ? "#14061A" : dark ? "#111" : "#fafafa", color: immersive || dark ? "#fff" : "#111" }}>
              <MI name="arrow_back" v="outlined" /><MI name="circle" v="outlined" /><MI name="crop_square" v="outlined" />
            </div>}
          </div>
        </IOSDevice>
      </div>

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme" value={tweaks.theme} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
          onChange={v => setTweak("theme", v)} />
        <TweakRadio label="Platform" value={tweaks.platform} options={["ios", "android"]} onChange={v => setTweak("platform", v)} />
        <TweakRadio label="Phone size" value={tweaks.phone} options={["regular", "compact"]} onChange={v => setTweak("phone", v)} />
        <TweakSection label="Jump to" />
        <TweakSelect label="Screen" value="" onChange={v => v && load(v)} options={[
          { value: "", label: "Choose…" },
          { value: "home", label: "Home" }, { value: "create", label: "Create game" }, { value: "join", label: "Join game" },
          { value: "lobby", label: "Lobby · host, friends joining" }, { value: "lobbyReady", label: "Lobby · host, ready to start" },
          { value: "lobbyOdd", label: "Lobby · host, odd players" }, { value: "lobbyPlayer", label: "Lobby · joined player" },
          { value: "explainer", label: "Game · your turn (ready)" }, { value: "explainerLive", label: "Game · explaining" },
          { value: "timesUp", label: "Game · time's up" }, { value: "roundOver", label: "Game · hat is empty" },
          { value: "guesser", label: "Game · you're guessing" }, { value: "spectator", label: "Game · other team's turn" },
          { value: "bigGame", label: "Game · 5 teams" }, { value: "customRounds", label: "Game · 45s, rounds 1 & 3" },
          { value: "results", label: "Results" }, { value: "resultsTie", label: "Results · tie" },
        ]} />
        <TweakButton label="Restart from Home" onClick={() => load("home")} secondary />
        <TweakSection label="Simulation" />
        <TweakRadio label="Clock speed" value={tweaks.speed} options={[{ value: "1", label: "1×" }, { value: "3", label: "3×" }, { value: "10", label: "10×" }]}
          onChange={v => setTweak("speed", v)} />
        <TweakToggle label="Time's-up alarm sound" value={tweaks.sound} onChange={v => setTweak("sound", v)} />
        <TweakRadio label="Event stream" value={tweaks.connection} options={[{ value: "live", label: "Connected" }, { value: "reconnecting", label: "Reconnecting" }]}
          onChange={v => setTweak("connection", v)} />
        <TweakToggle label="Home: unfinished game" value={tweaks.resumeCard} onChange={v => setTweak("resumeCard", v)} />
        <TweakButton label="Host removes me" secondary onClick={() => {
          const g = gameRef.current;
          if (phase !== "lobby" || !g || g.host === me) { toastFn({ text: "Open the joined-player lobby first", kind: "error" }); return; }
          G.kickPlayer(g, g.host, me); setResume(null); go("home");
          toastFn({ text: `${g.host} removed you from game ${g.id}`, icon: "person_remove", kind: "error", ms: 3500 });
        }} />
        <p style={{ fontSize: 11, color: "#8a8190", lineHeight: 1.5, margin: 0 }}>
          Other players are simulated with the real server rules. Join with code <b>4821</b>; any other code shows “game not found”, and the names Ani or Joro are taken.
        </p>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
