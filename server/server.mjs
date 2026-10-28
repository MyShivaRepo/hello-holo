// ============================================================================
//  Serveur HTTP GraphQL pour hREA.
//  Se connecte au conducteur Holochain (admin + app), construit le schema
//  GraphQL hREA et l'expose en HTTP avec l'explorateur GraphiQL.
// ============================================================================
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { graphqlHTTP } from 'express-graphql'
import { AdminWebsocket, AppWebsocket } from '@holochain/client'
import * as vf from '@valueflows/vf-graphql-holochain'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ADMIN_URL = process.env.HREA_ADMIN_URL || 'ws://127.0.0.1:4444'
const APP_URL   = process.env.HREA_APP_URL   || 'ws://127.0.0.1:4445'
const APP_ID    = process.env.HREA_APP_ID    || 'hrea'
const ROLE      = process.env.HREA_ROLE      || 'hrea'
const PORT      = parseInt(process.env.PORT || '4000', 10)

// Holochain 0.6 exige la presence d'un header Origin a l'upgrade WebSocket.
const ORIGIN = process.env.HREA_ORIGIN || 'http://localhost'
const wsClientOptions = { origin: ORIGIN }

const createHolochainSchema =
  vf.createHolochainSchema || (vf.default && vf.default.createHolochainSchema)

function extractCellId(appInfo, role) {
  const entries = appInfo.cell_info[role] || []
  for (const c of entries) {
    if (c?.type === 'provisioned' && c.value?.cell_id) return c.value.cell_id
    if (c?.provisioned?.cell_id) return c.provisioned.cell_id
  }
  throw new Error(`Aucune cellule 'provisioned' pour le role ${role}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function connectWithRetry() {
  const deadline = Date.now() + 180000 // 3 min : laisse le temps au conducteur
  let lastErr
  while (Date.now() < deadline) {
    try {
      const admin = await AdminWebsocket.connect({ url: new URL(ADMIN_URL), wsClientOptions })
      const apps = await admin.listApps({})
      const appInfo = apps.find((a) => a.installed_app_id === APP_ID) || apps[0]
      if (!appInfo) throw new Error("app hREA pas encore installee")
      const cellId = extractCellId(appInfo, ROLE)
      await admin.authorizeSigningCredentials(cellId)
      const { token } = await admin.issueAppAuthenticationToken({ installed_app_id: APP_ID })
      const appWs = await AppWebsocket.connect({ url: new URL(APP_URL), token, wsClientOptions })
      console.log(`[graphql] connecte au conducteur (app=${APP_ID}, role=${ROLE})`)
      return { admin, appWs }
    } catch (e) {
      lastErr = e
      console.log(`[graphql] conducteur pas pret, nouvel essai dans 3s... (${e?.message || e})`)
      await sleep(3000)
    }
  }
  throw lastErr
}

const { appWs } = await connectWithRetry()
const schema = createHolochainSchema({ appWebSocket: appWs, roleName: ROLE })

const app = express()
app.use('/graphql', graphqlHTTP({ schema, graphiql: true }))
app.use(express.static(path.join(__dirname, 'public')))  // IHM a la racine (index.html)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[graphql] IHM hREA sur http://localhost:${PORT}/  |  API+GraphiQL sur /graphql`)
})
