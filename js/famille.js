// ── FAMILLE PAGE JS ──

// Password — change this to your actual family password
const FAMILLE_PASSWORD = 'bouvet2024';

function checkPassword() {
  const input = document.getElementById('famillePassword');
  const gate = document.getElementById('passwordGate');
  const content = document.getElementById('privateContent');

  if (input.value === FAMILLE_PASSWORD || input.value === 'montgenèvre' || input.value === 'Montgenèvre') {
    gate.style.display = 'none';
    content.classList.add('unlocked');
    sessionStorage.setItem('famille_auth', '1');
    // Trigger calendar rendering now that elements are visible
    document.querySelectorAll('.calendar-wrap').forEach(el => {
      const apt = el.dataset.calendar;
      if (window.calendars && window.calendars[apt]) {
        window.calendars[apt].render();
      }
    });
    refreshTable();
  } else {
    const errors = document.querySelectorAll('#pwError');
    errors.forEach(e => e.style.display = 'block');
    input.value = '';
    input.focus();
  }
}

// Auto-unlock if already authenticated this session
if (sessionStorage.getItem('famille_auth') === '1') {
  document.addEventListener('DOMContentLoaded', () => {
    const gate = document.getElementById('passwordGate');
    const content = document.getElementById('privateContent');
    if (gate) gate.style.display = 'none';
    if (content) content.classList.add('unlocked');
  });
}

// Enter key for password
document.getElementById('famillePassword')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') checkPassword();
});

// ── RESERVATION TABLE ──
function refreshTable() {
  const tbody = document.getElementById('reservationTableBody');
  if (!tbody) return;

  const apts = ['famille', 'rdc', '2eme'];
  const aptLabels = { famille: '1er étage – Famille', rdc: 'RDC', '2eme': '2e étage' };
  let allResas = [];

  apts.forEach(apt => {
    const raw = localStorage.getItem('reservations_' + apt) || '[]';
    const resas = JSON.parse(raw);
    resas.forEach(r => allResas.push({ ...r, apt }));
  });

  if (allResas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--gris);font-style:italic;">Aucune réservation enregistrée.</td></tr>';
    return;
  }

  // Sort by start date
  allResas.sort((a, b) => a.start.localeCompare(b.start));

  tbody.innerHTML = allResas.map((r, i) => `
    <tr>
      <td>${aptLabels[r.apt] || r.apt}</td>
      <td>${formatDate(r.start)}</td>
      <td>${formatDate(r.end)}</td>
      <td>${r.tenant || '—'}</td>
      <td>${r.type === 'family' ? '<span class="badge-family">Famille</span>' : '<span class="badge-rdc">Location</span>'}</td>
      <td><button onclick="deleteReservation('${r.apt}', ${i})" style="background:none;border:none;cursor:pointer;color:#8B2E2E;font-size:0.8rem;" title="Supprimer">✕</button></td>
    </tr>
  `).join('');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function deleteReservation(apt, globalIndex) {
  if (!confirm('Supprimer cette réservation ?')) return;
  const apts = ['famille', 'rdc', '2eme'];
  let allResasWithApt = [];
  apts.forEach(a => {
    const raw = JSON.parse(localStorage.getItem('reservations_' + a) || '[]');
    raw.forEach(r => allResasWithApt.push({ ...r, apt: a }));
  });
  allResasWithApt.sort((a, b) => a.start.localeCompare(b.start));
  const target = allResasWithApt[globalIndex];
  if (!target) return;

  const aptKey = target.apt;
  const raw = JSON.parse(localStorage.getItem('reservations_' + aptKey) || '[]');
  const updated = raw.filter(r => !(r.start === target.start && r.end === target.end && r.tenant === target.tenant));
  localStorage.setItem('reservations_' + aptKey, JSON.stringify(updated));
  if (window.calendars && window.calendars[aptKey]) window.calendars[aptKey].render();
  refreshTable();
  showToast('Réservation supprimée.', '');
}

// ── ADMIN FORM ──
const adminForm = document.getElementById('adminResaForm');
if (adminForm) {
  adminForm.addEventListener('submit', e => {
    e.preventDefault();
    const apt = adminForm.querySelector('[name="apt"]').value;
    const start = adminForm.querySelector('[name="start"]').value;
    const end = adminForm.querySelector('[name="end"]').value;
    const tenant = adminForm.querySelector('[name="tenant"]').value;
    const type = adminForm.querySelector('[name="type"]').value;
    const notes = adminForm.querySelector('[name="notes"]')?.value || '';

    if (!start || !end) { showToast('Veuillez saisir les dates.', 'error'); return; }
    if (start > end) { showToast('La date de départ doit être après l\'arrivée.', 'error'); return; }

    const existing = JSON.parse(localStorage.getItem('reservations_' + apt) || '[]');
    existing.push({ start, end, tenant, type, notes });
    localStorage.setItem('reservations_' + apt, JSON.stringify(existing));

    if (window.calendars && window.calendars[apt]) window.calendars[apt].render();
    refreshTable();
    showToast('Réservation ajoutée avec succès !', 'success');
    adminForm.reset();
  });
}

// ── EXPORT CSV ──
function exportReservations() {
  const apts = ['famille', 'rdc', '2eme'];
  const aptLabels = { famille: '1er étage – Famille', rdc: 'RDC', '2eme': '2e étage' };
  let rows = [['Appartement', 'Arrivée', 'Départ', 'Locataire', 'Type', 'Notes']];

  apts.forEach(apt => {
    const raw = JSON.parse(localStorage.getItem('reservations_' + apt) || '[]');
    raw.forEach(r => rows.push([aptLabels[apt], r.start, r.end, r.tenant || '', r.type, r.notes || '']));
  });

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reservations-maison-bouvet-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── REFRESH on tab switch ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'planning') setTimeout(refreshTable, 100);
  });
});
