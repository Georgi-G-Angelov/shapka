// Renders App Store assets from the design prototype.
//
//   python3 design/tools/serve.py        # in another terminal
//   node design/tools/store_capture.mjs  # writes design/store/*.png
//
// 1. Captures phone screens from Shapka.html at 3x into design/project/store/screens.
// 2. Composes design/project/store/store.html into screenshots (1320x2868, 6.9" iPhone),
//    the product page header (3840x1646) and the search image (3840x2560).
// 3. Renders the screenshots again for the 6.3" iPhone (1206x2622) into design/store/iphone-6.3.
// 4. Google Play (design/store/google-play): phone screenshots (1080x1920) from the prototype's
//    Android mode, the feature graphic (1024x500) and the 512x512 icon.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.SHAPKA_DESIGN_URL || "http://127.0.0.1:8840";
const DESIGN = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(DESIGN, "store");
const SCREENS = join(DESIGN, "project", "store", "screens");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Phone screens: deep link, optional steps, extra wait before capture.
const PHONES = {
  explainer: { screen: "explainerLive", wait: 1200 },
  guesser: { screen: "guesser", wait: 1500 },
  lobby: { screen: "lobbyReady", wait: 800 },
  reveal: { screen: "lobbyReady", seed: 10, click: "Start game · 2 teams", wait: 1200 },
  roundOver: { screen: "roundOver", wait: 900 },
  results: { screen: "results", wait: 2200 },
  create: { screen: "create", click: "Advanced settings", wait: 700 },
  home: { screen: "home", wait: 900 },
};

// Android screens for Google Play (Shapka.html?platform=android), into screens-android.
const ANDROID_PHONES = ["explainer", "guesser", "lobby", "reveal", "roundOver", "results"];
const SCREENS_ANDROID = join(DESIGN, "project", "store", "screens-android");
const PLAY = join(OUT, "google-play");
const PLAY_ASSETS = {
  "phone-1-explain": [1080, 1920],
  "phone-2-guess": [1080, 1920],
  "phone-3-fill-the-hat": [1080, 1920],
  "phone-4-teams": [1080, 1920],
  "phone-5-rounds": [1080, 1920],
  "phone-6-winners": [1080, 1920],
  "feature-graphic": [1024, 500],
};
const ICON = join(DESIGN, "..", "app", "assets", "launcher_icon", "app_icon.png");

// Composed assets: store.html?asset=<name>, at their App Store pixel sizes.
const ASSETS = {
  "screenshot-1-explain": [1320, 2868],
  "screenshot-2-guess": [1320, 2868],
  "screenshot-3-fill-the-hat": [1320, 2868],
  "screenshot-4-teams": [1320, 2868],
  "screenshot-5-rounds": [1320, 2868],
  "screenshot-6-winners": [1320, 2868],
  "product-page-header": [3840, 1646],
  "search-results": [3840, 2560],
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function browser() {
  const port = 9600 + Math.floor(Math.random() * 300);
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, "--hide-scrollbars",
    "--force-color-profile=srgb", `--user-data-dir=${mkdtempSync(join(tmpdir(), "store-"))}`, "about:blank"], { stdio: "ignore" });
  let targets;
  for (let i = 0; i < 50 && !targets?.length; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); }
  }
  const ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener("message", e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Runtime.enable");
  await send("Page.enable");
  const evaluate = async expression => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  // Browser.close lets Chrome exit cleanly; a killed Chrome leaves a copy of itself
  // in $TMPDIR/../X/com.google.Chrome.code_sign_clone on every run.
  const close = async () => {
    const exited = new Promise(r => (proc.exitCode !== null ? r() : proc.once("exit", r)));
    await Promise.race([send("Browser.close"), sleep(3000)]);
    ws.close();
    await Promise.race([exited, sleep(5000)]);
    if (proc.exitCode === null) proc.kill();
  };
  return { send, evaluate, errors, close };
}

async function shoot(b, file, clip) {
  const shot = await b.send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  writeFileSync(file, Buffer.from(shot.result.data, "base64"));
}

mkdirSync(OUT, { recursive: true });
mkdirSync(SCREENS, { recursive: true });
const b = await browser();

// 1. Phone screens at 3x (iOS for the App Store, Android for Google Play).
async function captureScreens(names, platform, dir) {
  mkdirSync(dir, { recursive: true });
  await b.send("Emulation.setDeviceMetricsOverride", { width: 1000, height: 1000, deviceScaleFactor: 3, mobile: false });
  for (const name of names) {
    const p = PHONES[name];
    await b.send("Page.navigate", { url: `${BASE}/Shapka.html?screen=${p.screen}&theme=light&platform=${platform}${p.seed ? `&seed=${p.seed}` : ""}` });
    await sleep(3500);
    if (p.click) {
      await b.evaluate(`[...document.querySelectorAll('[aria-label]')].find(e => e.getAttribute('aria-label') === ${JSON.stringify(p.click)} && !e.closest('[inert]'))?.click()`);
    }
    await sleep(p.wait);
    // The screen area of the device frame (status bar included), without the frame's corners.
    const rect = await b.evaluate(`(() => { const r = document.getElementById('phone-app-root').closest('#root div[style*="border-radius"]').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
    await shoot(b, join(dir, `${name}.png`), rect);
    console.log(`screen ${platform}/${name}`);
  }
}
await captureScreens(Object.keys(PHONES), "ios", SCREENS);
await captureScreens(ANDROID_PHONES, "android", SCREENS_ANDROID);

async function compose(asset, width, height, file) {
  await b.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await b.send("Page.navigate", { url: `${BASE}/store/store.html?asset=${asset}` });
  await b.evaluate("document.fonts.ready.then(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))))");
  await sleep(400);
  await shoot(b, file);
}

// 2. Composed assets at 1x.
for (const [name, [width, height]] of Object.entries(ASSETS)) {
  await compose(name, width, height, join(OUT, `${name}.png`));
  console.log(`asset ${name} ${width}x${height}`);
}

// 3. 6.3" screenshots: same layout at the 1206x2622 aspect ratio (1320 wide), scaled down exactly.
mkdirSync(join(OUT, "iphone-6.3"), { recursive: true });
for (const name of Object.keys(ASSETS).filter(n => n.startsWith("screenshot-"))) {
  const file = join(OUT, "iphone-6.3", `${name}.png`);
  await compose(name, 1320, 2870, file);
  execFileSync("sips", ["-z", "2622", "1206", file], { stdio: "ignore" });
  console.log(`asset iphone-6.3/${name} 1206x2622`);
}

// 4. Google Play.
mkdirSync(PLAY, { recursive: true });
for (const [name, [width, height]] of Object.entries(PLAY_ASSETS)) {
  await compose(`play-${name}`, width, height, join(PLAY, `${name}.png`));
  console.log(`asset google-play/${name} ${width}x${height}`);
}
execFileSync("sips", ["-z", "512", "512", ICON, "--out", join(PLAY, "icon-512.png")], { stdio: "ignore" });
console.log("asset google-play/icon-512 512x512");

if (b.errors.length) console.error(b.errors.join("\n"));
await b.close();
process.exit(b.errors.length ? 1 : 0);
