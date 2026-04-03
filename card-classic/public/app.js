(() => {
  // ── State ──────────────────────────────────────────────────
  let sortCol   = 'nom';
  let sortOrder = 'asc';
  let editingId = null;

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

  // ── Render liste ───────────────────────────────────────────
  async function loadListe() {
    const contacts = await api('GET', `/api/contacts?sort=${sortCol}&order=${sortOrder}`);

    // Update sort icons
    theadThs.forEach(th => {
      const icon = th.querySelector('.sort-icon');
      if (th.dataset.col === sortCol) {
        icon.textContent = sortOrder === 'asc' ? '▲' : '▼';
      } else {
        icon.textContent = '';
      }
    });

    tbody.innerHTML = '';
    if (contacts.length === 0) {
      emptyMsg.classList.remove('hidden');
      return;
    }
    emptyMsg.classList.add('hidden');

    contacts.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(c.nom)}</td>
        <td>${esc(c.prenom)}</td>
        <td>${esc(c.email)}</td>
        <td>${esc(c.telephone)}</td>
        <td class="actions">
          <button class="btn btn-green btn-sm btn-modifier" data-id="${c.id}">Modifier</button>
          <button class="btn btn-red  btn-sm btn-supprimer" data-id="${c.id}">Supprimer</button>
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

  function showFiche(contact = null) {
    editingId = contact ? contact.id : null;
    ficheTitre.textContent = contact ? 'Modifier le contact' : 'Nouveau contact';
    fNom.value    = contact ? contact.nom       : '';
    fPrenom.value = contact ? contact.prenom    : '';
    fEmail.value  = contact ? contact.email     : '';
    fTel.value    = contact ? contact.telephone : '';
    formError.classList.add('hidden');
    viewListe.classList.add('hidden');
    viewFiche.classList.remove('hidden');
    fNom.focus();
  }

  // ── Events — liste ─────────────────────────────────────────
  document.getElementById('btn-ajouter').addEventListener('click', () => showFiche());

  theadThs.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol   = col;
        sortOrder = 'asc';
      }
      loadListe();
    });
  });

  tbody.addEventListener('click', async e => {
    const id = e.target.dataset.id;
    if (!id) return;

    if (e.target.classList.contains('btn-modifier')) {
      const contacts = await api('GET', `/api/contacts?sort=${sortCol}&order=${sortOrder}`);
      const contact  = contacts.find(c => String(c.id) === id);
      if (contact) showFiche(contact);
    }

    if (e.target.classList.contains('btn-supprimer')) {
      if (!confirm('Supprimer ce contact ?')) return;
      await api('DELETE', `/api/contacts/${id}`);
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
      if (editingId) {
        await api('PUT', `/api/contacts/${editingId}`, body);
      } else {
        await api('POST', '/api/contacts', body);
      }
      showListe();
    } catch (err) {
      formError.textContent = err.message;
      formError.classList.remove('hidden');
    }
  });

  // ── Util ───────────────────────────────────────────────────
  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Export RDF/OWL ──────────────────────────────────────────
  document.getElementById('btn-export-rdf').addEventListener('click', () => {
    window.location.href = '/api/contacts/export/rdf';
  });

  // ── Init ───────────────────────────────────────────────────
  loadListe();
})();
