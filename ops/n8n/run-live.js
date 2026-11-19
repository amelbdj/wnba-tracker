// Lance les contrôles de ops/n8n/checks.js pour de vrai, depuis ce poste :
//
//   node ops/n8n/run-live.js
//
// Même logique que le workflow n8n, sans n8n : sert à vérifier les chemins de
// champs quand ESPN ou NCAA changent, et à préparer une correction.
import { CHECKS, plan, runChecks } from "./checks.js";

async function fetchOne(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000), headers: { accept: "application/json, text/html" } });
  const body = await res.text();
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    // pas du JSON
  }
  return { status: res.status, headers: Object.fromEntries(res.headers), body, json };
}

const results = await runChecks(fetchOne);

const width = Math.max(...CHECKS.map((c) => c.label.length));
for (const r of results) {
  const mark = !r.ok ? "ÉCHEC " : r.warnings.length ? "ATTENTION" : "OK    ";
  const detail = [...r.problems, ...r.warnings].join(" ; ");
  console.log(`${mark} ${r.label.padEnd(width)}  ${String(r.ms).padStart(5)} ms  ${detail}`);
}

const { message } = plan(results, {}, new Date());
console.log("\n--- message qui serait envoyé sur Discord ---");
console.log(message ?? "(aucun message)");
process.exit(results.every((r) => r.ok) ? 0 : 1);
