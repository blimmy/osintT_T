const root = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
(globalThis as any).window = globalThis;
for (const path of ["data/catalog.js","data/extended-catalog.js","data/flowcharts.js","data/extended-flowcharts.js","data/challenges.js"]) {
  eval(await Deno.readTextFile(`${root}/${path}`));
}
const tools = (globalThis as any).OSINT_TOOL_DATA.tools as any[];
const flows = (globalThis as any).OSINT_FLOW_DATA.flows as any[];
const challenges = (globalThis as any).OSINT_CHALLENGES as any[];
const assert = (condition: unknown, message: string): asserts condition => { if (!condition) throw new Error(message); };
const unique = (items: string[], label: string) => assert(new Set(items).size === items.length, `Duplicate ${label}`);
unique(tools.map(x => x.id), "tool id"); unique(flows.map(x => x.id), "flow id"); unique(challenges.map(x => x.id), "challenge id");
const toolMap = new Map(tools.map(x => [x.id,x])); const flowIds = new Set(flows.map(x => x.id));
for (const flow of flows) {
  await Deno.stat(`${root}/${flow.svg}`); await Deno.stat(`${root}/${flow.png}`);
  for (const link of flow.tools) assert(toolMap.get(link.tool)?.recipes.some((r:any)=>r.id===link.task), `Broken flow tool link ${flow.id} → ${link.tool}.${link.task}`);
}
for (const challenge of challenges) { assert(flowIds.has(challenge.flow), `Broken challenge flow ${challenge.id}`); await Deno.stat(`${root}/${challenge.cover}`); }
for (const tool of tools) {
  unique(tool.recipes.map((r:any)=>r.id), `${tool.id} recipe id`);
  assert(/^https:\/\//.test(tool.homepage), `Non-HTTPS official docs ${tool.id}`);
  for (const recipe of tool.recipes) {
    assert(recipe.commands.length && recipe.expected && recipe.interpretation && recipe.checklist.length, `Incomplete recipe ${tool.id}.${recipe.id}`);
    for (const flow of recipe.relatedFlows) assert(flowIds.has(flow), `Broken related flow ${tool.id}.${recipe.id} → ${flow}`);
    for (const action of [recipe.decision.yes,recipe.decision.no,recipe.decision.uncertain].filter(Boolean)) {
      if (action.flow) assert(flowIds.has(action.flow), `Broken decision flow ${tool.id}.${recipe.id} → ${action.flow}`);
      if (action.tool) assert(toolMap.get(action.tool)?.recipes.some((r:any)=>r.id===(action.task||toolMap.get(action.tool).recipes[0].id)), `Broken decision tool ${tool.id}.${recipe.id}`);
      if (action.task && !action.tool) assert(tool.recipes.some((r:any)=>r.id===action.task), `Broken same-tool task ${tool.id}.${recipe.id} → ${action.task}`);
    }
  }
}
const html = await Deno.readTextFile(`${root}/index.html`);
assert(!/<script[^>]+src=["']https?:/i.test(html) && !/<link[^>]+href=["']https?:/i.test(html), "Remote core dependency found");
assert(!/google-analytics|gtag\(|segment\.com|mixpanel/i.test(html + await Deno.readTextFile(`${root}/assets/app.js`)), "Telemetry found");
console.log(`PASS integrity: ${challenges.length} challenges, ${flows.length} flows, ${tools.length} tools, ${tools.reduce((n,t)=>n+t.recipes.length,0)} recipes`);
