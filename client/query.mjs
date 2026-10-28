// ============================================================================
//  Client CLI hREA — preuve fonctionnelle.
//  Se connecte au conducteur Holochain, autorise la signature des zome calls,
//  construit le schema GraphQL hREA, cree puis relit une ResourceSpecification.
// ============================================================================
import { AdminWebsocket, AppWebsocket } from '@holochain/client'
import * as vf from '@valueflows/vf-graphql-holochain'
import { graphql } from 'graphql'

const ADMIN_URL = process.env.HREA_ADMIN_URL || 'ws://127.0.0.1:4444'
const APP_URL   = process.env.HREA_APP_URL   || 'ws://127.0.0.1:4445'
const APP_ID    = process.env.HREA_APP_ID    || 'hrea'
const ROLE      = process.env.HREA_ROLE      || 'hrea'

// Holochain 0.6 exige la PRESENCE d'un header Origin a l'upgrade WebSocket
// (meme si allowed_origins vaut '*'). Le client 'ws' de Node n'en envoie pas
// par defaut -> on le fournit explicitement.
const ORIGIN = process.env.HREA_ORIGIN || 'http://localhost'
const wsClientOptions = { origin: ORIGIN }

// L'adaptateur peut exporter en nomme ou en default selon le bundling.
const createHolochainSchema =
  vf.createHolochainSchema || (vf.default && vf.default.createHolochainSchema)

const log = (label, obj) =>
  console.log(`\n=== ${label} ===\n` + JSON.stringify(obj, null, 2))

function extractCellId(appInfo, role) {
  const entries = appInfo.cell_info[role] || []
  for (const c of entries) {
    // client >=0.18 : { type: 'provisioned', value: { cell_id } }
    if (c?.type === 'provisioned' && c.value?.cell_id) return c.value.cell_id
    // client plus ancien : { provisioned: { cell_id } }
    if (c?.provisioned?.cell_id) return c.provisioned.cell_id
  }
  throw new Error(`Aucune cellule 'provisioned' pour le role ${role}`)
}

async function run(schema, label, source, variableValues) {
  const res = await graphql({ schema, source, variableValues })
  log(label, res)
  if (res.errors && res.errors.length) {
    console.error(`[!] Erreurs GraphQL sur "${label}"`)
  }
  return res
}

async function main() {
  console.log(`[client] admin=${ADMIN_URL}  app=${APP_URL}  appId=${APP_ID}  role=${ROLE}`)

  const admin = await AdminWebsocket.connect({ url: new URL(ADMIN_URL), wsClientOptions })
  const apps = await admin.listApps({})
  const appInfo = apps.find((a) => a.installed_app_id === APP_ID) || apps[0]
  if (!appInfo) throw new Error('Aucune app installee sur le conducteur')
  console.log(`[client] app trouvee: ${appInfo.installed_app_id}`)

  const cellId = extractCellId(appInfo, ROLE)

  // Autoriser la signature des zome calls pour cette cellule.
  await admin.authorizeSigningCredentials(cellId)
  console.log('[client] credentials de signature autorises')

  // Jeton d'authentification pour ouvrir le WebSocket app.
  const issued = await admin.issueAppAuthenticationToken({ installed_app_id: APP_ID })
  const token = issued.token
  const appWs = await AppWebsocket.connect({ url: new URL(APP_URL), token, wsClientOptions })
  console.log('[client] WebSocket app connecte')

  const schema = createHolochainSchema({ appWebSocket: appWs, roleName: ROLE })
  console.log('[client] schema GraphQL hREA construit')

  // 1) Ecriture : creer une ResourceSpecification.
  const name = 'Demo hREA ' + new Date().toISOString()
  await run(
    schema,
    'MUTATION createResourceSpecification',
    `mutation ($n: String!) {
       createResourceSpecification(resourceSpecification: { name: $n }) {
         resourceSpecification { id revisionId name }
       }
     }`,
    { n: name },
  )

  // 2) Lecture : relister les ResourceSpecifications.
  await run(
    schema,
    'QUERY resourceSpecifications',
    `{
       resourceSpecifications(last: 10) {
         edges { node { id name } }
       }
     }`,
  )

  await appWs.client.close()
  await admin.client.close()
  console.log('\n[client] termine.')
}

main().catch((e) => {
  console.error('\n[client] ECHEC:', e?.message || e)
  console.error(e?.stack || '')
  process.exit(1)
})
