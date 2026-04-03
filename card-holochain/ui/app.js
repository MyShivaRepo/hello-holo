(() => {
  // ── State ──────────────────────────────────────────────────
  let sortCol   = 'nom';
  let sortOrder = 'asc';
  let editingHash = null;

  // ── DOM refs ───────────────────────────────────────────────
  const viewListe  = document.getElementById('view-liste');
  const viewFiche  = document.getElementById('view-fiche');
  const tbody      = document.getElementById('tbody');
  const emptyMsg   = document.getElementById('empty-msg');
  const ficheTitre = document.getElementById('fiche-titre');
  const formError  = document.getElementById('form-error');
  const form       = document.getElementById('form-contact');
  const fNom       = document.getElementById('f-nom');
  const fPrenom    = document.getElementById('f-prenom');
  const fEmail     = document.getElementById('f-email');
  const fTel       = document.getElementById('f-telephone');
  const theadThs   = document.querySelectorAll('th[data-col]');

  // ── API helpers ────────────────────────────────────────────
  async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
  }

  // ── Tri ────────────────────────────────────────────────────
  function sortContacts(contacts) {
    return [...contacts].sort((a, b) => {
      const va = (a.contact[sortCol] || '').toLowerCase();
      const vb = (b.contact[sortCol] || '').toLowerCase();
      return sortOrder === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }

  // ── Render liste ───────────────────────────────────────────
  async function loadListe() {
    const raw = await api('GET', '/api/contacts');
    const contacts = sortContacts(raw);

    theadThs.forEach(th => {
      const icon = th.querySelector('.sort-icon');
      icon.textContent = th.dataset.col === sortCol ? (sortOrder === 'asc' ? '▲' : '▼') : '';
    });

    tbody.innerHTML = '';
    if (contacts.length === 0) {
      emptyMsg.classList.remove('hidden');
      return;
    }
    emptyMsg.classList.add('hidden');

    contacts.forEach(({ action_hash, contact: c }) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(c.nom)}</td>
        <td>${esc(c.prenom)}</td>
        <td>${esc(c.email)}</td>
        <td>${esc(c.telephone)}</td>
        <td class="actions">
          <button class="btn btn-green btn-sm btn-modifier" data-hash="${esc(action_hash)}">Modifier</button>
          <button class="btn btn-red  btn-sm btn-supprimer" data-hash="${esc(action_hash)}">Supprimer</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  // ── Show / hide views ──────────────────────────────────────
  function showListe() {
    viewFiche.classList.add('hidden');
    viewListe.classList.remove('hidden');
    loadListe();
  }

  function showFiche(entry = null) {
    editingHash = entry ? entry.action_hash : null;
    ficheTitre.textContent = entry ? 'Modifier le contact' : 'Nouveau contact';
    const c = entry ? entry.contact : {};
    fNom.value    = c.nom       || '';
    fPrenom.value = c.prenom    || '';
    fEmail.value  = c.email     || '';
    fTel.value    = c.telephone || '';
    formError.classList.add('hidden');
    viewListe.classList.add('hidden');
    viewFiche.classList.remove('hidden');
    fNom.focus();
  }

  // ── Events — liste ─────────────────────────────────────────
  document.getElementById('btn-ajouter').addEventListener('click', () => showFiche());

  theadThs.forEach(th => {
    th.addEventListener('click', () => {
      if (sortCol === th.dataset.col) {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol   = th.dataset.col;
        sortOrder = 'asc';
      }
      loadListe();
    });
  });

  tbody.addEventListener('click', async e => {
    const hash = e.target.dataset.hash;
    if (!hash) return;

    if (e.target.classList.contains('btn-modifier')) {
      const all = await api('GET', '/api/contacts');
      const entry = all.find(c => c.action_hash === hash);
      if (entry) showFiche(entry);
    }

    if (e.target.classList.contains('btn-supprimer')) {
      if (!confirm('Supprimer ce contact ?')) return;
      await api('DELETE', `/api/contacts/${encodeURIComponent(hash)}`);
      loadListe();
    }
  });

  // ── Events — fiche ─────────────────────────────────────────
  document.getElementById('btn-annuler').addEventListener('click', showListe);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const body = {
      nom:       fNom.value.trim(),
      prenom:    fPrenom.value.trim(),
      email:     fEmail.value.trim(),
      telephone: fTel.value.trim(),
    };
    try {
      if (editingHash) {
        await api('PUT', `/api/contacts/${encodeURIComponent(editingHash)}`, body);
      } else {
        await api('POST', '/api/contacts', body);
      }
      showListe();
    } catch (err) {
      formError.textContent = err.message;
      formError.classList.remove('hidden');
    }
  });

  // ── Export RDF/OWL ──────────────────────────────────────────
  document.getElementById('btn-export-rdf').addEventListener('click', () => {
    window.location.href = '/api/contacts/export/rdf';
  });

  // ── Util ───────────────────────────────────────────────────
  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Init ───────────────────────────────────────────────────
  loadListe();
})();
