import { Window } from "npm:happy-dom@21.0.4";

const root = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const html = await Deno.readTextFile(`${root}/index.html`);
const sources = await Promise.all([
  "data/catalog.js", "data/extended-catalog.js", "data/flowcharts.js",
  "data/extended-flowcharts.js", "data/challenges.js", "assets/app.js"
].map(path => Deno.readTextFile(`${root}/${path}`)));
const css = await Deno.readTextFile(`${root}/assets/styles.css`);
const assert = (condition: unknown, message: string): asserts condition => { if (!condition) throw new Error(message); };

async function boot(hash = "", stored?: string) {
  const window = new Window({ url: `http://127.0.0.1:4173/${hash}` });
  window.document.write(html);
  window.prompt = () => "Test session"; window.confirm = () => true;
  (window as any).__copied = "";
  Object.defineProperty(window.navigator, "clipboard", { value: { writeText: async (text: string) => { (window as any).__copied = text; } }, configurable: true });
  if (!window.CSS.escape) window.CSS.escape = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.HTMLElement.prototype.scrollTo = function () {};
  if (stored) window.localStorage.setItem("osintTT.investigation.v2", stored);
  for (const source of sources) window.eval(source);
  await window.happyDOM.whenAsyncComplete();
  return window;
}
const fireHash = (window: Window) => window.dispatchEvent(new window.HashChangeEvent("hashchange"));

const w = await boot();
assert(!(w.document.querySelector("#galleryView") as HTMLElement).hidden, "Homepage is not the Challenge Gallery");
assert(w.document.querySelectorAll(".challenge-card").length >= 20, "Challenge gallery coverage is too small");
assert(w.document.querySelector('[data-challenge="unknown-first"]'), "Beginner entry is missing");
assert(w.document.querySelector('[data-challenge="crypto-master"]'), "Crypto category is missing");
assert(w.document.querySelector('[data-challenge="network-forensics"]'), "Forensics category is missing");

const geo = w.document.querySelector('[data-challenge="image-geolocation"]') as HTMLElement;
geo.click(); fireHash(w); await w.happyDOM.whenAsyncComplete();
assert(w.location.hash.includes("view=flow") && w.location.hash.includes("03-GEO-01-COUNTRY-REGION"), "Gallery card did not open its flow");
assert(!(w.document.querySelector("#flowView") as HTMLElement).hidden, "Immersive flow view is hidden");
assert(!(w.document.querySelector("#flowImage") as HTMLImageElement).closest("a"), "Flow image links away from the site");

w.location.hash = "#view=flow&flow=02-IMAGE-02-EXIF-GPS"; fireHash(w); await w.happyDOM.whenAsyncComplete();
const gpsChip = w.document.querySelector('[data-tool="exiftool"][data-task="gps"]') as HTMLElement;
assert(gpsChip, "Contextual ExifTool GPS node missing"); gpsChip.click(); fireHash(w); await w.happyDOM.whenAsyncComplete();
assert((w.document.querySelector('[data-recipe="gps"]') as HTMLDetailsElement).open, "GPS recipe did not open");

const input = w.document.querySelector("#pathInput") as HTMLInputElement;
input.value = "/home/kali/Downloads/O'Brien photo.jpg"; input.dispatchEvent(new w.Event("input", { bubbles: true }));
const gpsCommand = [...w.document.querySelectorAll('[data-recipe="gps"] code')].map(node => node.textContent).join("\n");
assert(gpsCommand.includes("'/home/kali/Downloads/O'\"'\"'Brien photo.jpg'"), "POSIX quoting is unsafe");
(w.document.querySelector('[data-recipe="gps"] [data-copy]') as HTMLElement).click(); await w.happyDOM.whenAsyncComplete();
assert((w as any).__copied.includes("O'\"'\"'Brien"), "Copy command failed");

const check = w.document.querySelector('[data-recipe="gps"] [data-check]') as HTMLInputElement;
check.click(); const stored = w.localStorage.getItem("osintTT.investigation.v2")!;
assert(stored.includes("exiftool.gps.0"), "Checklist did not persist");
assert(!stored.includes("O'Brien") && !stored.includes("/home/kali"), "Filename leaked to localStorage");
(w.document.querySelector('[data-recipe="gps"] .decision-btn.no') as HTMLElement).click(); fireHash(w); await w.happyDOM.whenAsyncComplete();
assert(w.location.hash.includes("02-IMAGE-03-OCR"), "No-GPS branch did not open OCR flow");

for (const [flow, tool, task] of [
  ["02-IMAGE-02-EXIF-GPS", "exiftool", "timestamp"],
  ["04-TEXT-01-IDENTIFY", "python", "base64"],
  ["06-WEB-01-URL-DOMAIN-FIRST", "dig", "records"],
  ["14-FORENSICS-03-NETWORK", "tshark", "triage"],
  ["13-CRYPTO-05-RSA", "sympy", "number-theory"]
]) {
  w.location.hash = `#view=flow&flow=${flow}&tool=${tool}&task=${task}`; fireHash(w); await w.happyDOM.whenAsyncComplete();
  assert((w.document.querySelector(`[data-recipe="${task}"]`) as HTMLDetailsElement)?.open, `Deep link failed: ${tool}.${task}`);
}

const search = w.document.querySelector("#globalSearch") as HTMLInputElement;
for (const query of ["exact coordinates", "HTTP POST", "decode base64", "RSA", "deleted file", "EVTX", "domain owner"]) {
  search.value = query; search.dispatchEvent(new w.Event("input", { bubbles: true }));
  assert(w.document.querySelectorAll(".search-result").length > 0, `Search failed: ${query}`);
}

w.location.hash = "#view=flow&flow=14-FORENSICS-03-NETWORK"; fireHash(w); await w.happyDOM.whenAsyncComplete();
(w.document.querySelector("#expandFlow") as HTMLElement).click();
assert(!(w.document.querySelector("#lightbox") as HTMLElement).hidden, "In-site enlarged viewer did not open");
(w.document.querySelector("#lightZoomIn") as HTMLElement).click();
assert((w.document.querySelector("#lightboxImage") as HTMLElement).style.width !== "", "Lightbox zoom failed");
(w.document.querySelector("#closeLightbox") as HTMLElement).click();
assert((w.document.querySelector("#lightbox") as HTMLElement).hidden, "Lightbox did not close");

const exactCheatsheet = "https://docs.google.com/document/d/1hOVwwnS4tmyR0zHeR4cTShBcFx2EQA-lS-fnt1hjmiI/edit?usp=sharing";
const cheatLinks = [...w.document.querySelectorAll<HTMLAnchorElement>(`a[href="${exactCheatsheet}"]`)];
assert(cheatLinks.length >= 3, "Cheatsheet is not globally available");
for (const link of cheatLinks) assert(link.target === "_blank" && /noopener/.test(link.rel) && /noreferrer/.test(link.rel), "Cheatsheet external-link security attributes missing");

const w2 = await boot("#view=flow&flow=02-IMAGE-02-EXIF-GPS&tool=exiftool&task=gps", stored);
assert((w2.document.querySelector('[data-recipe="gps"] [data-check]') as HTMLInputElement).checked, "Checklist progress lost after refresh");
assert(!/<script[^>]+src=["']https?:/i.test(html) && !/<link[^>]+href=["']https?:/i.test(html), "Core UI depends on remote scripts/styles");
assert(css.includes("touch-action:none") && css.includes(".challenge-grid") && css.includes(".tool-panel.open"), "Pan/mobile/gallery styles missing");

w2.close(); w.close();
console.log("PASS gallery, immersive viewer, contextual tools, safe copy, checklists, search, deep links, cheatsheet, and local assets");
