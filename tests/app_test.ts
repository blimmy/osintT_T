import {
  Window, HTMLElement, HTMLImageElement, HTMLDetailsElement,
  HTMLInputElement, HTMLAnchorElement
} from "npm:happy-dom@21.0.4";

const root = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const html = await Deno.readTextFile(`${root}/index.html`);
const sources = await Promise.all([
  "data/catalog.js", "data/extended-catalog.js", "data/flowcharts.js",
  "data/extended-flowcharts.js", "data/challenges.js", "assets/app.js"
].map(path => Deno.readTextFile(`${root}/${path}`)));
const css = await Deno.readTextFile(`${root}/assets/styles.css`);
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message); };

async function boot(hash = "") {
  const window = new Window({ url: `http://127.0.0.1:4173/${hash}` });
  window.document.write(html);
  (window as any).__copied = "";
  Object.defineProperty(window.navigator, "clipboard", { value: { writeText: async (text: string) => { (window as any).__copied = text; } }, configurable: true });
  if (!window.CSS.escape) window.CSS.escape = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.HTMLElement.prototype.scrollTo = function () {};
  for (const source of sources) window.eval(source);
  await window.happyDOM.whenAsyncComplete();
  return window;
}
const fireHash = (window: Window) => window.dispatchEvent(new window.HashChangeEvent("hashchange"));
const setHash = async (window: Window, hash: string) => {
  window.location.hash = hash;
  fireHash(window);
  await window.happyDOM.whenAsyncComplete();
};

const w = await boot();
assert(!(w.document.querySelector("#galleryView") as HTMLElement).hidden, "Homepage is not the Challenge Gallery");
assert(w.document.querySelectorAll(".challenge-card").length >= 20, "Challenge gallery coverage is too small");
assert(w.document.querySelector('[data-challenge="unknown-first"]'), "Beginner entry is missing");
assert(w.document.querySelector('[data-challenge="crypto-master"]'), "Crypto category is missing");
assert(w.document.querySelector('[data-challenge="network-forensics"]'), "Forensics category is missing");
assert(!w.document.body.textContent?.includes("เห็นโจทย์แบบไหน"), "Removed gallery hero title is still present");
assert(!w.document.body.textContent?.includes("เปิด Master Router"), "Removed router hero buttons are still present");

const geo = w.document.querySelector('[data-challenge="image-geolocation"]') as HTMLElement;
geo.click(); fireHash(w); await w.happyDOM.whenAsyncComplete();
assert(w.location.hash.includes("view=flow") && w.location.hash.includes("03-GEO-01-COUNTRY-REGION"), "Gallery card did not open its flow");
assert(!(w.document.querySelector("#flowView") as HTMLElement).hidden, "Immersive flow view is hidden");
assert(!(w.document.querySelector("#flowImage") as HTMLImageElement).closest("a"), "Flow image links away from the site");

await setHash(w, "#view=flow&flow=02-IMAGE-02-EXIF-GPS");
const gpsChip = w.document.querySelector('[data-tool="exiftool"][data-task="gps"]') as HTMLElement;
assert(gpsChip, "Contextual ExifTool GPS shortcut missing");
gpsChip.click(); fireHash(w); await w.happyDOM.whenAsyncComplete();
assert(w.location.hash.includes("view=tools") && !w.location.hash.includes("flow="), "Flow shortcut did not open standalone Tools");
assert((w.document.querySelector('[data-recipe="gps"]') as HTMLDetailsElement).open, "GPS task deep link did not open");
assert(!w.document.querySelector("#toolPanel"), "Legacy tool drawer still exists");

await setHash(w, "#view=tools");
const toolSearch = w.document.querySelector("#toolSearch") as HTMLInputElement;
toolSearch.value = "date taken";
toolSearch.dispatchEvent(new w.Event("input", { bubbles: true }));
assert(w.document.querySelector('[data-directory-tool="exiftool"][data-directory-task="timestamp"]'), "Task search failed for date taken");
(w.document.querySelector('[data-directory-tool="exiftool"][data-directory-task="timestamp"]') as HTMLElement).click();
fireHash(w); await w.happyDOM.whenAsyncComplete();
const timestampTask = w.document.querySelector('[data-recipe="timestamp"]') as HTMLDetailsElement;
assert(timestampTask?.open, "ExifTool timestamp task did not open");
const labels = [...timestampTask.querySelectorAll(".section-label")].map(node => node.textContent?.trim());
assert(JSON.stringify(labels) === JSON.stringify(["What am I trying to find?", "Question keywords", "Exact command"]), "Task has sections outside the required three");
for (const text of ["Expected output", "Interpretation", "Checklist", "Reset current", "Related flowcharts", "Next Pivot", "UNCERTAIN"]) {
  assert(!timestampTask.textContent?.includes(text), `Removed Tool Library section remains: ${text}`);
}
const copies = timestampTask.querySelectorAll<HTMLElement>("[data-copy]");
assert(copies.length >= 2, "Timestamp task does not expose separate Copy buttons");
copies[0].click(); await w.happyDOM.whenAsyncComplete();
assert((w as any).__copied.includes("exiftool") && (w as any).__copied.includes("'photo.jpg'"), "First exact command copy failed");
copies[1].click(); await w.happyDOM.whenAsyncComplete();
assert((w as any).__copied.includes("DateTimeOriginal"), "Second exact command copy failed");
toolSearch.value = "";
toolSearch.dispatchEvent(new w.Event("input", { bubbles: true }));
assert(w.document.querySelectorAll("#toolDetail .recipe").length >= 10, "ExifTool command reference is missing expected task coverage");

await setHash(w, "#view=tools");
toolSearch.value = "latitude";
toolSearch.dispatchEvent(new w.Event("input", { bubbles: true }));
assert(w.document.querySelector('[data-directory-tool="exiftool"][data-directory-task="gps"]'), "Task search failed for latitude");

await setHash(w, "#view=tools&category=Cryptography");
assert(w.document.querySelector('[data-tool-category="Cryptography"]')?.classList.contains("active"), "Cryptography category did not activate");
toolSearch.value = "RSA";
toolSearch.dispatchEvent(new w.Event("input", { bubbles: true }));
assert(w.document.querySelectorAll(".task-result").length > 0, "Cryptography RSA search returned no command tasks");

await setHash(w, "#view=tools&category=Digital+Forensics");
toolSearch.value = "HTTP POST";
toolSearch.dispatchEvent(new w.Event("input", { bubbles: true }));
assert(w.document.querySelector('[data-directory-tool="tshark"]'), "Digital Forensics HTTP POST search did not find tshark");

await setHash(w, "#view=tools");
for (const query of ["GPS", "latitude", "date taken", "HTTP POST", "RSA", "base64", "deleted files", "process list", "PDF metadata", "extract frames"]) {
  toolSearch.value = query;
  toolSearch.dispatchEvent(new w.Event("input", { bubbles: true }));
  assert(w.document.querySelectorAll(".task-result").length > 0, `Standalone task search failed: ${query}`);
}
toolSearch.value = "";
await setHash(w, "#view=tools&tool=hash&task=sha256");
const platformLabels = [...w.document.querySelectorAll('[data-recipe="sha256"] .command-label')].map(node => node.textContent);
assert(platformLabels.includes("macOS") && platformLabels.includes("Kali / Ubuntu"), "Platform-specific commands are not labeled");
(w.document.querySelector('[data-recipe="sha256"] [data-copy]') as HTMLElement).click();
await w.happyDOM.whenAsyncComplete();
assert((w as any).__copied === "shasum -a 256 'photo.jpg'", "Labeled command did not copy the exact command text");

const globalSearch = w.document.querySelector("#globalSearch") as HTMLInputElement;
for (const query of ["exact coordinates", "HTTP POST", "decode base64", "RSA", "deleted file", "EVTX", "domain owner"]) {
  globalSearch.value = query;
  globalSearch.dispatchEvent(new w.Event("input", { bubbles: true }));
  assert(w.document.querySelectorAll(".search-result").length > 0, `Global search failed: ${query}`);
}

await setHash(w, "#view=flow&flow=14-FORENSICS-03-NETWORK");
(w.document.querySelector("#expandFlow") as HTMLElement).click();
assert(!(w.document.querySelector("#lightbox") as HTMLElement).hidden, "In-site enlarged viewer did not open");
(w.document.querySelector("#lightZoomIn") as HTMLElement).click();
assert((w.document.querySelector("#lightboxImage") as HTMLElement).style.width !== "", "Lightbox zoom failed");
(w.document.querySelector("#closeLightbox") as HTMLElement).click();
assert((w.document.querySelector("#lightbox") as HTMLElement).hidden, "Lightbox did not close");

const exactCheatsheet = "https://docs.google.com/document/d/1hOVwwnS4tmyR0zHeR4cTShBcFx2EQA-lS-fnt1hjmiI/edit?usp=sharing";
const cheatLinks = [...w.document.querySelectorAll<HTMLAnchorElement>(`a[href="${exactCheatsheet}"]`)];
assert(cheatLinks.length >= 4, "Cheatsheet is not available from all main contexts");
for (const link of cheatLinks) {
  assert(link.target === "_blank" && /noopener/.test(link.rel) && /noreferrer/.test(link.rel), "Cheatsheet security attributes missing");
  assert(link.title.includes("My Personal Command & Reference Cheatsheet"), "Cheatsheet tooltip is missing");
}
assert(w.document.body.textContent?.includes("My Personal Command & Reference Cheatsheet"), "Visible Cheatsheet subtitle is missing");

assert(!/<script[^>]+src=["']https?:/i.test(html) && !/<link[^>]+href=["']https?:/i.test(html), "Core UI depends on remote scripts/styles");
assert(css.includes("touch-action: none") && css.includes(".challenge-grid") && css.includes(".tool-detail"), "Pan/mobile/gallery/tool styles missing");
await setHash(w, "#view=gallery");
assert(!(w.document.querySelector("#galleryView") as HTMLElement).hidden && (w.document.querySelector("#toolsView") as HTMLElement).hidden, "Return to Challenge Gallery failed");
w.close();
console.log("PASS gallery, standalone command reference, direct task search, copy, flow viewer, deep links, categories, and cheatsheet");
