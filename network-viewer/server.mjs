// ============================================================================
//  Viewer réseau/pairs Holochain — lecture seule via l'API admin.
//  Expose GET /api/network (JSON) et sert le dashboard statique.
// ============================================================================
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { AdminWebsocket, encodeHashToBase64 } from '@holochain/client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ADMIN_URL = process.env.HREA_ADMIN_URL || 'ws://127.0.0.1:4444'
const PORT = parseInt(process.env.PORT || '4001', 10)
const wsClientOptions = { origin: process.env.HREA_ORIGIN || 'http://localhost' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const b64 = (u8) => { try { return encodeHashToBase64(u8) } catch { return null } }

async function connectWithRetry() {
  const deadline = Date.now() + 180000
  let last
  while (Date.now() < deadline) {
    try { return await AdminWebsocket.connect({ url: new URL(ADMIN_URL), wsClientOptions }) }
    catch (e) { last = e; console.log(`[viewer] admin pas prêt, retry 3s (${e?.message || e})`); await sleep(3000) }
  }
  throw last
}

const admin = await connectWithRetry()
console.log('[viewer] connecté à l’admin', ADMIN_URL)

function parseAgentInfo(s) {
  // Les entrées agentInfo sont des chaînes ; souvent { agentInfo: "<json>", signature }.
  try {
    let o = JSON.parse(s)
    if (o && typeof o.agentInfo === 'string') { try { o = { ...o, info: JSON.parse(o.agentInfo) } } catch {} }
    return o
  } catch { return { raw: String(s).slice(0, 200) } }
}

function extractCells(appInfo) {
  const out = []
  const ci = appInfo.cell_info || {}
  for (const role of Object.keys(ci)) {
    for (const c of ci[role] || []) {
      const v = (c && (c.value || c.provisioned || c.cloned)) || {}
      const cell_id = v.cell_id
      if (!cell_id) continue
      out.push({
        role,
        kind: c.type || (c.provisioned ? 'provisioned' : c.cloned ? 'cloned' : '?'),
        cloneId: v.clone_id || null,
        name: v.name || null,
        dnaHash: b64(cell_id[0]),
        agentKey: b64(cell_id[1]),
      })
    }
  }
  return out
}

const app = express()
app.use((_req, res, next) => { res.header('Access-Control-Allow-Origin', '*'); next() })  // lisible par le portail

app.get('/api/network', async (_req, res) => {
  const errors = {}
  const result = { ok: true, at: new Date().toISOString(), apps: [], cells: [], selfAgents: [], agents: [], transport: null, metrics: null, errors }

  try {
    const apps = await admin.listApps({})
    result.apps = apps.map((a) => ({
      id: a.installed_app_id,
      status: a.status?.type || (typeof a.status === 'string' ? a.status : JSON.stringify(a.status)),
      cells: extractCells(a),
    }))
    for (const a of result.apps) for (const c of a.cells) if (c.agentKey) result.selfAgents.push(c.agentKey)
    result.selfAgents = [...new Set(result.selfAgents)]
  } catch (e) { errors.apps = e.message }

  try {
    const cells = await admin.listCellIds()
    result.cells = cells.map((c) => ({ dnaHash: b64(c[0]), agentKey: b64(c[1]) }))
  } catch (e) { errors.cells = e.message }

  try {
    const infos = await admin.agentInfo({ dna_hashes: null })
    result.agents = (infos || []).map(parseAgentInfo)
  } catch (e) { errors.agentInfo = e.message }

  try {
    result.transport = await admin.dumpNetworkStats()
  } catch (e) { errors.stats = e.message }

  try {
    result.metrics = await admin.dumpNetworkMetrics({ include_dht_summary: true })
  } catch (e) { errors.metrics = e.message }

  res.json(result)
})

app.use(express.static(path.join(__dirname, 'public')))
app.listen(PORT, '0.0.0.0', () => console.log(`[viewer] http://localhost:${PORT}/`))
