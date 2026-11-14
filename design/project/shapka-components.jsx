// Shapka — shared components.
// Each one is written to map onto a single Flutter widget (named in the comment)
// so the app can be built straight from this file and lib/theme.dart.
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// Colour with alpha, from a CSS variable or hex: alpha("var(--primary)", 0.7)
const alpha = (c, a) => `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;

// Material icon — Icons.x / Icons.x_outlined / Icons.x_rounded
const MI = ({ name, size = 24, color = "currentColor", v = "round", style = {} }) => (
  <span aria-hidden="true" className={v === "outlined" ? "mi-outlined" : v === "filled" ? "mi" : "mi-round"}
        style={{ fontSize: size, width: size, height: size, color, ...style }}>{name}</span>
);

// Team colours, by team index (max 20 players → 10 teams). Readable on light and dark.
const TEAM_COLORS = ["#8E24AA", "#E65100", "#00897B", "#1E88E5", "#D81B60", "#7CB342", "#5E35B1", "#F4A100", "#00ACC1", "#6D4C41"];
const teamColor = index => TEAM_COLORS[index % TEAM_COLORS.length];
// Before teams exist, players get a stable colour from their name.
const nameColor = name => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return TEAM_COLORS[h % TEAM_COLORS.length];
};
const initials = (name, letters = 2) => [...name.trim()].slice(0, letters).join("").toUpperCase();
const possessive = name => (name.toLowerCase().endsWith("s") ? `${name}'` : `${name}'s`);
const formatClock = ms => {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setReduced(query.matches);
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  return reduced;
};

// PressableScale — shrinks slightly while pressed; keyboard accessible.
const Pressable = ({ children, onClick, scale = 0.97, style = {}, label, disabled = false, role = "button", checked, expanded }) => {
  const [down, setDown] = useState(false);
  const active = Boolean(onClick) && !disabled;
  return (
    <div role={onClick || checked !== undefined ? role : undefined} aria-label={label} aria-disabled={disabled || undefined} tabIndex={active ? 0 : undefined}
         aria-checked={checked} aria-expanded={expanded}
         onClick={active ? onClick : undefined}
         onKeyDown={active ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
         onPointerDown={() => active && setDown(true)} onPointerUp={() => setDown(false)} onPointerLeave={() => setDown(false)}
         style={{ cursor: active ? "pointer" : "default", transform: `scale(${down ? scale : 1})`,
                  transition: "transform 120ms ease-out", WebkitTapHighlightColor: "transparent", ...style }}>
      {children}
    </div>
  );
};

// ── Brand ─────────────────────────────────────────────────────────────────
const Wordmark = ({ size = 44, color = "var(--primary)", style = {} }) => (
  <div style={{ fontFamily: "'Metal Mania', cursive", fontSize: size, color, lineHeight: 1, letterSpacing: size * 0.02, ...style }}>shapka</div>
);

// The web client's hat illustration (static/shapka-logo-big.png).
const HatLogo = ({ size = 120, bob = false, style = {} }) => (
  <img src="assets/shapka-logo.png" alt="" draggable="false" style={{
    width: size, height: size, objectFit: "contain", display: "block",
    filter: "drop-shadow(0 12px 18px rgba(74,21,89,.28))",
    animation: bob ? "hatBob 3.2s ease-in-out infinite" : undefined, ...style,
  }} />
);

// ── Buttons ───────────────────────────────────────────────────────────────
// ElevatedButton with the web client's purple gradient. 56px tall, radius 16.
const TONES = {
  primary: { bg: "linear-gradient(180deg, var(--primary), var(--primary-deep))", fg: "var(--on-primary)", glow: alpha("var(--primary)", 0.55) },
  success: { bg: "linear-gradient(180deg, #19A34E, #0E7A37)", fg: "#fff", glow: "rgba(25,163,78,.5)" },
  danger:  { bg: "var(--danger)", fg: "#fff", glow: alpha("var(--danger)", 0.5) },
  light:   { bg: "#FFFFFF", fg: "#4A1559", glow: "rgba(255,255,255,.45)" },
  ghost:   { bg: "var(--surface-alt)", fg: "var(--text)", glow: "transparent" },
};

const Button = ({ label, icon, onClick, disabled = false, tone = "primary", glow = false, height = 56, style = {}, busy = false }) => {
  const t = TONES[tone];
  return (
    <Pressable onClick={onClick} disabled={disabled || busy} label={label} style={{ width: "100%", borderRadius: 16, ...style }}>
      <div style={{
        height, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        background: disabled ? "var(--surface-alt)" : t.bg, color: disabled ? "var(--text3)" : t.fg,
        fontSize: 17, fontWeight: 700, letterSpacing: 0.2,
        boxShadow: disabled || tone === "ghost" ? "none" : `0 6px 16px -8px ${t.glow}`,
        "--g-color": t.glow, animation: glow && !disabled ? "ctaGlow 1900ms ease-in-out infinite" : undefined,
        transition: "background 200ms, color 200ms",
      }}>
        {busy ? <Spinner size={20} color="currentColor" /> : icon && <MI name={icon} size={22} />}
        <span>{label}</span>
      </div>
    </Pressable>
  );
};

const TextButton = ({ label, icon, onClick, color = "var(--primary)", size = 15, style = {} }) => (
  <Pressable onClick={onClick} label={label} style={{ display: "inline-flex", alignItems: "center", gap: 6, color,
    fontSize: size, fontWeight: 700, padding: "10px 12px", borderRadius: 12, ...style }}>
    {icon && <MI name={icon} size={size + 4} />}<span>{label}</span>
  </Pressable>
);

// IconButton — 44×44 tap target.
const IconButton = ({ icon, onClick, label, color = "var(--text2)", bg = "transparent", size = 24, style = {} }) => (
  <Pressable onClick={onClick} label={label} style={{ width: 44, height: 44, borderRadius: 22, background: bg,
    display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0, ...style }}>
    <MI name={icon} size={size} />
  </Pressable>
);

const Spinner = ({ size = 28, color = "var(--primary)", stroke = 3 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", border: `${stroke}px solid ${alpha(color, 0.2)}`,
                borderTopColor: color, animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
);

// ── Inputs ────────────────────────────────────────────────────────────────
// TextField: filled, radius 14, inline error under the field (never a toast).
const TextField = ({ label, value, onChange, placeholder, error, hint, inputMode, autoFocus, onSubmit, trailing,
                     big = false, center = false, maxLength, autoCapitalize = "words", enterKeyHint, id, nested = false }) => {
  const [focus, setFocus] = useState(false);
  const border = error ? "var(--danger)" : focus ? "var(--primary)" : "transparent";
  return (
    <label htmlFor={id} style={{ display: "block" }}>
      {label && <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)", margin: "0 4px 8px" }}>{label}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: nested ? "var(--surface-alt)" : "var(--surface)", borderRadius: 14,
        border: `2px solid ${border}`, padding: "0 6px 0 16px", height: big ? 72 : 56, transition: "border-color 150ms",
        boxShadow: focus ? `0 0 0 4px ${alpha("var(--primary)", 0.12)}` : nested ? "none" : "0 1px 0 var(--border)",
        animation: error ? "shake 320ms ease-in-out" : undefined }} key={error || "ok"}>
        <input id={id} className={big ? "big-input" : undefined} value={value} placeholder={placeholder} inputMode={inputMode} autoFocus={autoFocus} maxLength={maxLength}
          autoCapitalize={autoCapitalize} autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint={enterKeyHint}
          aria-invalid={Boolean(error)} aria-label={label || placeholder}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && onSubmit) onSubmit(); }}
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--text)",
            fontSize: big ? 34 : 18, fontWeight: big ? 800 : 600, letterSpacing: big ? 8 : 0, textAlign: center ? "center" : "left" }} />
        {trailing}
      </div>
      {(error || hint) && <div role={error ? "alert" : undefined} style={{ display: "flex", gap: 6, alignItems: "flex-start",
        fontSize: 13, fontWeight: 600, color: error ? "var(--danger)" : "var(--text3)", margin: "8px 4px 0", lineHeight: 1.35 }}>
        {error && <MI name="error_outline" size={16} />}<span>{error || hint}</span>
      </div>}
    </label>
  );
};

// Words-per-player stepper (server range 4–7).
const Stepper = ({ value, min, max, onChange, label }) => (
  <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", borderRadius: 14, height: 56, padding: "0 6px", boxShadow: "0 1px 0 var(--border)" }}>
    <IconButton icon="remove" label={`Fewer ${label}`} onClick={value > min ? () => onChange(value - 1) : undefined}
      color={value > min ? "var(--primary)" : "var(--border)"} />
    <div className="tabular" style={{ flex: 1, textAlign: "center", fontSize: 22, fontWeight: 800 }} aria-live="polite">{value}</div>
    <IconButton icon="add" label={`More ${label}`} onClick={value < max ? () => onChange(value + 1) : undefined}
      color={value < max ? "var(--primary)" : "var(--border)"} />
  </div>
);

// ── People ────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 40, color, ring = false, dim = false, letters, style = {} }) => {
  const c = color || nameColor(name);
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
      background: alpha(c, 0.16), color: c, fontWeight: 800, fontSize: size * 0.38, letterSpacing: 0.3,
      boxShadow: ring ? `0 0 0 2.5px var(--surface), 0 0 0 5px ${c}` : undefined, opacity: dim ? 0.45 : 1, ...style }}>
      {initials(name, letters ?? (size < 32 ? 1 : 2))}
    </div>
  );
};

// Two overlapping avatars for a team. onDark: white discs for the game stage.
const Pair = ({ names, color, size = 30, onDark = false }) => (
  <div style={{ display: "flex", flexShrink: 0 }}>
    {names.map((n, i) => <Avatar key={n} name={n} color={color} size={size} letters={1}
      style={{ marginLeft: i ? -size * 0.3 : 0, boxShadow: `0 0 0 2px ${onDark ? alpha(color, 0.9) : "var(--surface)"}`,
        background: onDark ? "#fff" : `color-mix(in srgb, ${color} 16%, var(--surface))` }} />)}
  </div>
);

// ── Layout ────────────────────────────────────────────────────────────────
// AppBar: back/close leading, centred title, optional trailing.
const TopBar = ({ title, onBack, backIcon = "arrow_back_ios_new", trailing, color = "var(--text)", children }) => (
  <div style={{ paddingTop: "var(--status-top)", flexShrink: 0 }}>
    <div style={{ height: 52, display: "flex", alignItems: "center", padding: "0 6px", gap: 4 }}>
      <div style={{ width: 88, display: "flex" }}>
        {onBack && <IconButton icon={backIcon} label="Back" onClick={onBack} color={color} size={backIcon === "close" ? 26 : 20} />}
      </div>
      <div style={{ flex: 1, textAlign: "center", fontSize: 17, fontWeight: 700, color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
      <div style={{ width: 88, display: "flex", justifyContent: "flex-end" }}>{trailing}</div>
    </div>
    {children}
  </div>
);

const SectionLabel = ({ children, trailing, style = {} }) => (
  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 4px 10px", ...style }}>
    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.1, color: "var(--text3)", textTransform: "uppercase" }}>{children}</div>
    {trailing}
  </div>
);

const Card = ({ children, style = {}, pad = 16 }) => (
  <div style={{ background: "var(--surface)", borderRadius: 20, padding: pad, boxShadow: "var(--card-shadow)", flexShrink: 0, ...style }}>{children}</div>
);

// Bottom-anchored action area that sits above the home indicator / nav bar.
const BottomBar = ({ children, style = {} }) => (
  <div style={{ flexShrink: 0, padding: "12px 20px calc(var(--safe-bottom) + 12px)", display: "flex", flexDirection: "column", gap: 10,
    background: "linear-gradient(180deg, transparent, var(--bg) 30%)", ...style }}>{children}</div>
);

// ── Feedback ──────────────────────────────────────────────────────────────
// showModalBottomSheet — portals into #phone-overlay-layer so it covers the device.
const Sheet = ({ open, onClose, children, label }) => {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = setTimeout(() => setShown(true), 20);
      return () => clearTimeout(id);
    }
    setShown(false);
    const id = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(id);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const esc = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  const host = document.getElementById("phone-overlay-layer");
  if (!mounted || !host) return null;
  return ReactDOM.createPortal(
    <div role="dialog" aria-modal="true" aria-label={label} style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,6,26,.55)", opacity: shown ? 1 : 0, transition: "opacity 250ms" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "88%", overflowY: "auto", background: "var(--bg)",
        borderRadius: "24px 24px 0 0", padding: "10px 20px calc(var(--safe-bottom) + 16px)", color: "var(--text)",
        transform: shown ? "translateY(0)" : "translateY(100%)", transition: "transform 260ms cubic-bezier(0.2, 0, 0, 1)" }}>
        <div style={{ width: 40, height: 5, borderRadius: 99, background: "var(--border)", margin: "0 auto 14px" }} />
        {children}
      </div>
    </div>, host);
};

const SheetTitle = ({ icon, title, subtitle, color = "var(--primary)" }) => (
  <div style={{ textAlign: "center", marginBottom: 18 }}>
    {icon && <div style={{ width: 56, height: 56, borderRadius: 18, margin: "0 auto 12px", background: alpha(color, 0.14), color,
      display: "flex", alignItems: "center", justifyContent: "center" }}><MI name={icon} size={30} /></div>}
    <div style={{ fontSize: 21, fontWeight: 800 }}>{title}</div>
    {subtitle && <div style={{ fontSize: 15, color: "var(--text2)", marginTop: 6, lineHeight: 1.4 }}>{subtitle}</div>}
  </div>
);

// Top toast — replaces the web client's sliding #message box. Errors use red,
// game events (player joined, round started) use the surface colour.
const Toast = ({ toast }) => {
  const host = document.getElementById("phone-overlay-layer");
  if (!host) return null;
  const colors = { error: "var(--danger)", success: "var(--success)", info: "var(--primary)" };
  return ReactDOM.createPortal(
    <div aria-live="assertive" style={{ position: "absolute", left: 16, right: 16, top: "calc(var(--status-top) + 6px)", display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
      {toast && <div key={toast.id} role="status" style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: "100%",
        background: "var(--surface)", color: "var(--text)", borderRadius: 16, padding: "12px 16px", fontSize: 15, fontWeight: 600, lineHeight: 1.3,
        boxShadow: "0 12px 30px -10px rgba(20,6,26,.45)", borderLeft: `4px solid ${colors[toast.kind] || colors.info}`, animation: "popIn 320ms ease-out" }}>
        <MI name={toast.icon || (toast.kind === "error" ? "error_outline" : "info_outline")} size={22} color={colors[toast.kind] || colors.info} />
        <span>{toast.text}</span>
      </div>}
    </div>, host);
};

// SSE status. Shown only while reconnecting: the app re-subscribes with
// backoff (1→64s, like general_utils.ts) and refetches game state on reconnect.
const ConnectionBanner = ({ status }) => status === "live" ? null : (
  <div role="status" style={{ position: "absolute", top: "calc(var(--status-top) + 4px)", left: "50%", transform: "translateX(-50%)", zIndex: 20,
    display: "flex", alignItems: "center", gap: 8, background: "#2A0F33", color: "#fff", borderRadius: 99, padding: "7px 14px",
    fontSize: 13, fontWeight: 700, boxShadow: "0 8px 20px -8px rgba(0,0,0,.5)", animation: "fadeUp 240ms ease-out", whiteSpace: "nowrap" }}>
    <Spinner size={14} color="#fff" stroke={2} /> Reconnecting…
  </div>
);

// ── Timer ring ────────────────────────────────────────────────────────────
// CustomPainter ring: full = 60s. Last 10s turns red and pulses each second.
const TimerRing = ({ ms, total = 60000, size = 200, paused = false, onDark = false, children }) => {
  const stroke = Math.max(8, size * 0.07);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, ms / total));
  const urgent = ms > 0 && ms <= 10000;
  const color = ms <= 0 ? "var(--text3)" : urgent ? "#FF4D6A" : onDark ? "#fff" : "var(--primary)";
  const second = Math.ceil(ms / 1000);
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={onDark ? "rgba(255,255,255,.14)" : "var(--surface-alt)"} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: "stroke 300ms" }} />
      </svg>
      <div role="timer" aria-label={`${second} seconds left`} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div key={urgent && !paused ? second : "steady"} className="tabular" style={{ fontSize: size * 0.26, fontWeight: 800, letterSpacing: -1,
          color: urgent ? "#FF4D6A" : onDark ? "#fff" : "var(--text)", animation: urgent && !paused ? "urgent 1s ease-out" : undefined, lineHeight: 1 }}>
          {formatClock(ms)}
        </div>
        {children}
      </div>
    </div>
  );
};

// ── Motion helpers ────────────────────────────────────────────────────────
// Keeps the outgoing screen mounted until its slide completes (from Scroll).
const ScreenSlideSwitcher = ({ viewKey, reverse = false, children, duration = 340, soft = true, style = {} }) => {
  const reduced = useReducedMotion();
  const current = useRef({ key: viewKey, child: children });
  const timer = useRef(null);
  const frame = useRef(null);
  const [slide, setSlide] = useState(null);
  const [renderedKey, setRenderedKey] = useState(viewKey);
  if (renderedKey !== viewKey) {
    setRenderedKey(viewKey);
    setSlide(reduced || duration === 0 ? null : { previous: current.current, direction: reverse ? -1 : 1, active: false });
  }
  React.useLayoutEffect(() => { current.current = { key: viewKey, child: children }; });
  React.useLayoutEffect(() => {
    clearTimeout(timer.current);
    cancelAnimationFrame(frame.current);
    if (reduced || duration === 0) { setSlide(null); return; }
    if (!slide) return;
    frame.current = requestAnimationFrame(() => { frame.current = requestAnimationFrame(() => {
      setSlide(value => value && { ...value, active: true });
      timer.current = setTimeout(() => setSlide(null), duration);
    }); });
    return () => { clearTimeout(timer.current); cancelAnimationFrame(frame.current); };
  }, [viewKey, reduced, duration]);
  const layer = {
    position: "absolute", inset: 0, display: "flex", flexDirection: "column", minHeight: 0,
    transition: slide?.active ? `transform ${duration}ms cubic-bezier(0.22,0.75,0.2,1), opacity ${duration}ms ease` : "none",
  };
  const d = soft ? 36 : 100;
  const unit = soft ? "px" : "%";
  return <div style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden", ...style }}>
    {slide && <div key={slide.previous.key} aria-hidden="true" inert="" style={{ ...layer, pointerEvents: "none",
      transform: `translateX(${slide.active ? -slide.direction * d : 0}${unit})`, opacity: soft && slide.active ? 0 : 1 }}>{slide.previous.child}</div>}
    <div key={viewKey} inert={slide ? "" : undefined} style={{ ...layer,
      transform: `translateX(${slide && !slide.active ? slide.direction * d : 0}${unit})`, opacity: soft && slide && !slide.active ? 0 : 1 }}>{children}</div>
  </div>;
};

const Confetti = ({ count = 70 }) => {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: (i * 37) % 100, delay: (i % 12) * 0.12, dur: 2.4 + (i % 7) * 0.25, size: 6 + (i % 4) * 2,
    color: [...TEAM_COLORS.slice(0, 5), "#E2A915"][i % 6], round: i % 3 === 0,
  })), [count]);
  return <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 3 }}>
    {pieces.map((p, i) => <div key={i} style={{ position: "absolute", top: -20, left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 1.6,
      borderRadius: p.round ? "50%" : 2, background: p.color, animation: `confettiFall ${p.dur}s ${p.delay}s ease-in forwards` }} />)}
  </div>;
};

Object.assign(window, {
  alpha, MI, TEAM_COLORS, teamColor, nameColor, initials, possessive, formatClock, useReducedMotion,
  Pressable, Wordmark, HatLogo, Button, TextButton, IconButton, Spinner, TextField, Stepper, Avatar, Pair,
  TopBar, SectionLabel, Card, BottomBar, Sheet, SheetTitle, Toast, ConnectionBanner, TimerRing, ScreenSlideSwitcher, Confetti,
});
