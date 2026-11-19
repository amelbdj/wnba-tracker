// Génère le workflow n8n des contrôles quotidiens :
//
//   node scripts/buildN8nWorkflow.js
//
// -> ops/n8n/frontrow-monitor.workflow.json (à importer dans n8n, voir ops/n8n/README.md)
//
// La logique vit dans ops/n8n/checks.js (testée) ; ce script l'insère telle quelle
// dans les deux nœuds « Code », de sorte que le workflow ne peut pas dériver de
// ce que les tests vérifient. Un test s'assure que le fichier JSON est à jour.
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url);
const CHECKS_FILE = new URL("ops/n8n/checks.js", ROOT);
export const WORKFLOW_FILE = new URL("ops/n8n/frontrow-monitor.workflow.json", ROOT);

// Nom du nœud qui reçoit l'adresse du webhook Discord (à remplacer après import).
export const DISCORD_PLACEHOLDER = "COLLE_ICI_L_URL_DU_WEBHOOK_DISCORD";

// Le code de checks.js sans ses `export` : un nœud Code n'est pas un module.
const checksSource = () => readFileSync(CHECKS_FILE, "utf8").replace(/^export /gm, "");

// Nœud 1 : une ligne par contrôle, avec son adresse.
const listCode = () => `${checksSource()}
// ---- n8n : la liste des adresses à lire
return CHECKS.map((c) => ({ json: { id: c.id, url: c.url } }));
`;

// Nœud 3 : relit les réponses, décide du message et de l'état à retenir.
const analyseCode = () => `${checksSource()}
// ---- n8n : analyse des réponses (une par contrôle, dans l'ordre de la liste)
const staticData = $getWorkflowStaticData("global");
const received = $input.all();

function toResponse(item) {
  const j = (item && item.json) || {};
  if (j.error) return { error: typeof j.error === "string" ? j.error : j.error.message || "erreur" };
  // Avec le format « texte », n8n 2.x range le corps dans \`data\` (et dans \`body\` en format JSON).
  const raw = j.body !== undefined ? j.body : j.data;
  const body = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    // pas du JSON
  }
  return { status: j.statusCode, headers: j.headers || {}, body, json: parsed };
}

const results = CHECKS.map((check, i) => ({
  id: check.id,
  group: check.group,
  label: check.label,
  ...evaluate(check, received[i] ? toResponse(received[i]) : { error: "aucune réponse reçue" }),
}));

// Garde-fou : si n8n n'a pas rendu une réponse par adresse, on le dit au lieu de
// comparer des réponses au mauvais contrôle.
if (received.length !== CHECKS.length) {
  results.push({
    id: "monitor-incomplete",
    group: "FRONTROW",
    label: "Contrôle quotidien",
    ok: false,
    problems: ["réponses reçues : " + received.length + " au lieu de " + CHECKS.length],
    warnings: [],
  });
}

const { message, state } = plan(results, staticData.state, new Date());
staticData.state = state; // n8n ne le garde que pour les exécutions programmées, pas les essais manuels

return message ? [{ json: { message } }] : [];
`;

export function buildWorkflow() {
  return {
    name: "FRONTROW — contrôles quotidiens",
    nodes: [
      {
        parameters: { rule: { interval: [{ field: "days", daysInterval: 1, triggerAtHour: 8 }] } },
        id: "3f1c2a10-0001-4a00-9000-000000000001",
        name: "Chaque jour à 8 h",
        type: "n8n-nodes-base.scheduleTrigger",
        typeVersion: 1.2,
        position: [0, 0],
      },
      {
        parameters: {},
        id: "3f1c2a10-0002-4a00-9000-000000000002",
        name: "Lancer à la main",
        type: "n8n-nodes-base.manualTrigger",
        typeVersion: 1,
        position: [0, 200],
      },
      {
        parameters: { jsCode: listCode() },
        id: "3f1c2a10-0003-4a00-9000-000000000003",
        name: "Liste des contrôles",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [260, 100],
      },
      {
        parameters: {
          url: "={{ $json.url }}",
          options: {
            batching: { batch: { batchSize: 1, batchInterval: 700 } },
            response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
            timeout: 25000,
          },
        },
        id: "3f1c2a10-0004-4a00-9000-000000000004",
        name: "Lire les adresses",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [520, 100],
        onError: "continueRegularOutput",
      },
      {
        parameters: { jsCode: analyseCode() },
        id: "3f1c2a10-0005-4a00-9000-000000000005",
        name: "Analyser les réponses",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [780, 100],
      },
      {
        parameters: {
          method: "POST",
          url: DISCORD_PLACEHOLDER,
          sendBody: true,
          contentType: "json",
          specifyBody: "json",
          jsonBody: "={{ JSON.stringify({ content: $json.message }) }}",
        },
        id: "3f1c2a10-0006-4a00-9000-000000000006",
        name: "Envoyer sur Discord",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [1040, 100],
      },
    ],
    connections: {
      "Chaque jour à 8 h": { main: [[{ node: "Liste des contrôles", type: "main", index: 0 }]] },
      "Lancer à la main": { main: [[{ node: "Liste des contrôles", type: "main", index: 0 }]] },
      "Liste des contrôles": { main: [[{ node: "Lire les adresses", type: "main", index: 0 }]] },
      "Lire les adresses": { main: [[{ node: "Analyser les réponses", type: "main", index: 0 }]] },
      "Analyser les réponses": { main: [[{ node: "Envoyer sur Discord", type: "main", index: 0 }]] },
    },
    active: false,
    settings: { executionOrder: "v1", timezone: "Europe/Paris" },
    pinData: {},
  };
}

export const workflowJson = () => `${JSON.stringify(buildWorkflow(), null, 2)}\n`;

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(WORKFLOW_FILE, workflowJson());
  console.log(`Écrit : ${WORKFLOW_FILE.pathname}`);
}
