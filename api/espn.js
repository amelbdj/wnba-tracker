import { handleEspnRequest } from "./_lib/espnProxy.js";

// GET /api/espn?kind=scoreboard&league=wnba&dates=20260921
//
// One point of passage, with a cache, between the app and ESPN's unofficial
// API. The request names a kind of data and a league; the URL that is fetched
// is built from the table in src/services/espnRoutes.js, never from anything
// the caller sends. See api/_lib/espnCache.js for how long each kind is kept,
// and api/_lib/espnProxy.js for the rest.
export default function handler(req, res) {
  return handleEspnRequest(req, res);
}
