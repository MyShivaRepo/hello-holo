const express = require('express');
const db = require('./db');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ALLOWED_SORT_COLUMNS = ['nom', 'prenom', 'email', 'telephone'];

// GET /api/contacts?sort=nom&order=asc
app.get('/api/contacts', (req, res) => {
  const col = ALLOWED_SORT_COLUMNS.includes(req.query.sort) ? req.query.sort : 'nom';
  const order = req.query.order === 'desc' ? 'DESC' : 'ASC';
  const contacts = db.prepare(`SELECT * FROM contacts ORDER BY ${col} ${order}`).all();
  res.json(contacts);
});

// POST /api/contacts
app.post('/api/contacts', (req, res) => {
  const { nom, prenom, email, telephone } = req.body;
  if (!nom || !prenom) {
    return res.status(400).json({ error: 'Nom et Prénom sont obligatoires.' });
  }
  const result = db.prepare(
    'INSERT INTO contacts (nom, prenom, email, telephone) VALUES (?, ?, ?, ?)'
  ).run(nom.trim(), prenom.trim(), (email || '').trim(), (telephone || '').trim());
  const created = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// PUT /api/contacts/:id
app.put('/api/contacts/:id', (req, res) => {
  const { nom, prenom, email, telephone } = req.body;
  if (!nom || !prenom) {
    return res.status(400).json({ error: 'Nom et Prénom sont obligatoires.' });
  }
  const result = db.prepare(
    'UPDATE contacts SET nom=?, prenom=?, email=?, telephone=? WHERE id=?'
  ).run(nom.trim(), prenom.trim(), (email || '').trim(), (telephone || '').trim(), req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Contact introuvable.' });
  const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// GET /api/contacts/export/rdf
app.get('/api/contacts/export/rdf', (req, res) => {
  const contacts = db.prepare('SELECT * FROM contacts ORDER BY nom ASC').all();

  let rdf = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
  xmlns:owl="http://www.w3.org/2002/07/owl#"
  xmlns:vcard="http://www.w3.org/2006/vcard/ns#">

  <owl:Ontology rdf:about="http://card-classic/ontology/contacts">
    <rdfs:label>Card Classic — Base de contacts</rdfs:label>
  </owl:Ontology>

  <owl:Class rdf:about="http://card-classic/ontology/Contact">
    <rdfs:subClassOf rdf:resource="http://www.w3.org/2006/vcard/ns#Individual"/>
  </owl:Class>
`;

  for (const c of contacts) {
    const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    rdf += `
  <vcard:Individual rdf:about="http://card-classic/contacts/${c.id}">
    <rdf:type rdf:resource="http://card-classic/ontology/Contact"/>
    <vcard:family-name>${esc(c.nom)}</vcard:family-name>
    <vcard:given-name>${esc(c.prenom)}</vcard:given-name>`;
    if (c.email) rdf += `\n    <vcard:hasEmail rdf:resource="mailto:${esc(c.email)}"/>`;
    if (c.telephone) rdf += `\n    <vcard:hasTelephone rdf:resource="tel:${esc(c.telephone)}"/>`;
    rdf += `
  </vcard:Individual>
`;
  }

  rdf += `</rdf:RDF>\n`;

  res.setHeader('Content-Type', 'application/rdf+xml');
  res.setHeader('Content-Disposition', 'attachment; filename="contacts.rdf"');
  res.send(rdf);
});

// DELETE /api/contacts/:id
app.delete('/api/contacts/:id', (req, res) => {
  const result = db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Contact introuvable.' });
  res.status(204).end();
});

app.listen(PORT, () => console.log(`card-classic running on http://localhost:${PORT}`));
