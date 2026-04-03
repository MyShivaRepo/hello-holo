import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { AdminWebsocket, AppWebsocket } from '@holochain/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_URL = process.env.CONDUCTOR_ADMIN_URL || 'ws://localhost:4444';

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'ui')));

let appClient;
let cellId;

// Connexion au Conductor Holochain avec retry
async function initHolochain(retries = 40, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[${i + 1}/${retries}] Connexion au Conductor : ${ADMIN_URL}`);
      const adminWs = await AdminWebsocket.connect({ url: new URL(ADMIN_URL), timeout: 10000, wsClientOptions: { origin: 'card-holochain' } });

      // Trouver le hApp installé
      const apps = await adminWs.listApps({});
      const ourApp = apps.find(a => a.installed_app_id.startsWith('card-holochain'));
      if (!ourApp) throw new Error('hApp card-holochain non trouvé. Lancez install_happ d\'abord.');

      const installedAppId = ourApp.installed_app_id;
      console.log(`hApp trouvé : ${installedAppId}`);

      // Récupérer le cell_id
      const contactsCell = ourApp.cell_info?.contacts?.[0]?.value;
      if (!contactsCell) throw new Error('cell contacts non trouvée');
      cellId = [contactsCell.cell_id.dna_hash, contactsCell.cell_id.agent_pub_key];

      // Attacher une interface applicative
      const { port: appPort } = await adminWs.attachAppInterface({
        port: 0,
        allowed_origins: '*',
        installed_app_id: null,
      });

      // Autoriser la signing key pour l'app
      const credentials = await adminWs.issueAppAuthenticationToken({
        installed_app_id: installedAppId,
        expiry_seconds: 0,
        single_use: false,
      });

      adminWs.client.close();

      // Connexion à l'interface applicative
      appClient = await AppWebsocket.connect({
        url: new URL(`ws://localhost:${appPort}`),
        token: credentials.token,
        timeout: 10000,
        wsClientOptions: { origin: 'card-holochain' },
      });

      console.log('Connecté au Conductor Holochain.');
      return;
    } catch (err) {
      console.error(`Tentative ${i + 1} échouée : ${err.message}`);
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Impossible de se connecter au Conductor après plusieurs tentatives.');
}

async function callZome(fnName, payload = null) {
  return appClient.callZome({
    cell_id: cellId,
    zome_name: 'contacts',
    fn_name: fnName,
    payload,
  });
}

// ── API REST ────────────────────────────────────────────────────────

// GET /api/contacts
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await callZome('get_all_contacts');
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts
app.post('/api/contacts', async (req, res) => {
  const { nom, prenom, email, telephone } = req.body;
  if (!nom || !prenom) return res.status(400).json({ error: 'Nom et Prénom sont obligatoires.' });
  try {
    const result = await callZome('create_contact', { nom, prenom, email: email || '', telephone: telephone || '' });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/contacts/:id
app.put('/api/contacts/:id', async (req, res) => {
  const { nom, prenom, email, telephone } = req.body;
  if (!nom || !prenom) return res.status(400).json({ error: 'Nom et Prénom sont obligatoires.' });
  try {
    const result = await callZome('update_contact', {
      original_action_hash: req.params.id,
      updated_contact: { nom, prenom, email: email || '', telephone: telephone || '' },
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id
app.delete('/api/contacts/:id', async (req, res) => {
  try {
    await callZome('delete_contact', req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/export/rdf
app.get('/api/contacts/export/rdf', async (req, res) => {
  try {
    const contacts = await callZome('get_all_contacts');

    const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let rdf = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
  xmlns:owl="http://www.w3.org/2002/07/owl#"
  xmlns:vcard="http://www.w3.org/2006/vcard/ns#">

  <owl:Ontology rdf:about="http://card-holochain/ontology/contacts">
    <rdfs:label>Card Holochain — Base de contacts</rdfs:label>
  </owl:Ontology>

  <owl:Class rdf:about="http://card-holochain/ontology/Contact">
    <rdfs:subClassOf rdf:resource="http://www.w3.org/2006/vcard/ns#Individual"/>
  </owl:Class>
`;

    for (const { action_hash, contact: c } of contacts) {
      const id = encodeURIComponent(action_hash);
      rdf += `
  <vcard:Individual rdf:about="http://card-holochain/contacts/${id}">
    <rdf:type rdf:resource="http://card-holochain/ontology/Contact"/>
    <vcard:family-name>${esc(c.nom)}</vcard:family-name>
    <vcard:given-name>${esc(c.prenom)}</vcard:given-name>`;
      if (c.email) rdf += `\n    <vcard:hasEmail rdf:resource="mailto:${esc(c.email)}"/>`;
      if (c.telephone) rdf += `\n    <vcard:hasTelephone rdf:resource="tel:${esc(c.telephone)}"/>`;
      rdf += `\n  </vcard:Individual>\n`;
    }

    rdf += `</rdf:RDF>\n`;

    res.setHeader('Content-Type', 'application/rdf+xml');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.rdf"');
    res.send(rdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Démarrage ───────────────────────────────────────────────────────
initHolochain()
  .then(() => {
    app.listen(PORT, () => console.log(`card-holochain bridge sur http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Erreur fatale :', err.message);
    process.exit(1);
  });
