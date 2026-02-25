<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-content table-modal">
          <header class="modal-header">
            <h2 class="modal-title">{{ leagueName }}</h2>
            <button class="close-btn" @click="$emit('close')" aria-label="Chiudi"><X size="24" /></button>
          </header>
          <div class="modal-body">
            <div v-if="loading" class="loading-state">
              <div class="spinner"></div>
              <p>Caricamento classifica...</p>
            </div>
            <div v-else-if="error" class="error-state">
              <p>{{ error }}</p>
            </div>
            <div v-else-if="tableRows.length === 0" class="empty-state">
              <p>Classifica non disponibile per questo campionato.</p>
            </div>
            <div v-else class="table-section">
              <div class="tabs">
                <button
                  v-for="tab in tabs"
                  :key="tab.id"
                  type="button"
                  class="tab-btn"
                  :class="{ active: activeTab === tab.id }"
                  @click="activeTab = tab.id"
                >
                  {{ tab.label }}
                </button>
              </div>
              <div class="table-wrap">
                <table class="standings-table">
                  <thead>
                    <tr>
                      <th class="col-pos">#</th>
                      <th class="col-team">Squadra</th>
                      <th class="col-num">G</th>
                      <th class="col-num">V</th>
                      <th class="col-num">N</th>
                      <th class="col-num">P</th>
                      <th class="col-num">GF</th>
                      <th class="col-num">GS</th>
                      <th class="col-num">DR</th>
                      <th class="col-pts">PT</th>
                      <th class="col-note">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, i) in currentRows" :key="i" :class="{ 'row-highlight': row.position <= 4 || row.position === row.relegation_from }">
                      <td class="col-pos">{{ row.position }}</td>
                      <td class="col-team">
                        <img v-if="row.teamLogo" :src="row.teamLogo" class="team-logo" :alt="row.teamName" />
                        <span class="team-name">{{ row.teamName }}</span>
                      </td>
                      <td class="col-num">{{ row.played ?? '-' }}</td>
                      <td class="col-num">{{ row.won ?? '-' }}</td>
                      <td class="col-num">{{ row.drawn ?? '-' }}</td>
                      <td class="col-num">{{ row.lost ?? '-' }}</td>
                      <td class="col-num">{{ row.goalsFor ?? '-' }}</td>
                      <td class="col-num">{{ row.goalsAgainst ?? '-' }}</td>
                      <td class="col-dr" :class="{ positive: row.goalDiff > 0, negative: row.goalDiff < 0 }">{{ row.goalDiff != null ? (row.goalDiff >= 0 ? '+' + row.goalDiff : row.goalDiff) : '-' }}</td>
                      <td class="col-pts"><strong>{{ row.points ?? '-' }}</strong></td>
                      <td class="col-note">{{ row.note || '–' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { X } from 'lucide-vue-next';
import axios from 'axios';
import API_URL from '../config/api';

const props = defineProps({
  show: Boolean,
  leagueName: { type: String, default: '' },
  leagueId: { type: [String, Number], default: '' },
  country: { type: String, default: '' }
});

const emit = defineEmits(['close']);

const loading = ref(false);
const error = ref('');
const tableRows = ref([]);
const rawData = ref(null);
const activeTab = ref('overall');

const tabs = [
  { id: 'overall', label: 'Generale' },
  { id: 'home', label: 'Casa' },
  { id: 'away', label: 'Trasferta' }
];

function getRowsFromRaw(type) {
  const res0 = rawData.value?.results?.[0];
  if (!res0) return [];
  const section = type === 'home' ? res0.home : type === 'away' ? res0.away : res0.overall;
  const rows = section?.tables?.[0]?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.map((r, i) => normalizeRow(r, i)).filter(Boolean);
}

const currentRows = computed(() => {
  if (activeTab.value === 'home') return getRowsFromRaw('home');
  if (activeTab.value === 'away') return getRowsFromRaw('away');
  return tableRows.value;
});

function getTeamName(entry) {
  if (!entry) return '';
  const t = entry.team;
  if (typeof t === 'string') return t.trim();
  if (t && typeof t === 'object') {
    const n = t.name ?? t.name_short ?? t.title ?? t.short_name ?? t.title_short ?? '';
    if (n) return String(n);
  }
  return entry.team_name ?? entry.name ?? entry.team ?? entry.title ?? entry.teamName ?? entry.text ?? entry.label ?? '';
}

function normalizeRow(entry, index) {
  if (!entry || typeof entry !== 'object') return null;
  const o = entry.overall ?? entry.total ?? entry.stats ?? entry;
  const pos = entry.position ?? entry.pos ?? entry.rank ?? entry.place ?? entry.nr ?? o?.position ?? o?.rank ?? index + 1;
  const name = getTeamName(entry);
  const pts = entry.points ?? entry.pts ?? entry.pt ?? entry.total ?? entry.score ?? o?.points ?? o?.pts ?? o?.total ?? null;
  const played = entry.played ?? entry.p ?? entry.m ?? entry.matches ?? entry.games ?? o?.played ?? o?.p ?? o?.m ?? null;
  const won = entry.won ?? entry.win ?? entry.w ?? entry.wins ?? o?.won ?? o?.win ?? o?.w ?? null;
  const drawn = entry.drawn ?? entry.draw ?? entry.d ?? entry.draws ?? entry.tied ?? o?.drawn ?? o?.draw ?? o?.d ?? null;
  const lost = entry.lost ?? entry.loss ?? entry.l ?? entry.losses ?? o?.lost ?? o?.loss ?? o?.l ?? null;
  const gf = entry.goals_for ?? entry.gf ?? entry.goals ?? entry.goalsfor ?? entry.scored ?? entry.for ?? o?.goals_for ?? o?.gf ?? o?.goalsfor ?? null;
  const ga = entry.goals_against ?? entry.ga ?? entry.conceded ?? entry.goalsagainst ?? entry.missed ?? entry.against ?? o?.goals_against ?? o?.ga ?? o?.goalsagainst ?? null;
  const goalsForNum = gf != null ? (typeof gf === 'string' ? parseInt(gf, 10) : gf) : null;
  const goalsAgainstNum = ga != null ? (typeof ga === 'string' ? parseInt(ga, 10) : ga) : null;
  const goalDiff = goalsForNum != null && goalsAgainstNum != null ? goalsForNum - goalsAgainstNum : null;
  const teamId = entry.team?.image_id;
  const teamLogo = teamId ? `https://assets.b365api.com/images/team/m/${teamId}.png` : '';
  const note = entry.promotion?.shortname ?? entry.promotion?.name ?? entry.relegation?.shortname ?? '';

  return {
    position: typeof pos === 'string' ? parseInt(pos, 10) || pos : pos,
    teamName: String(name || '').trim() || `Squadra ${pos}`,
    teamLogo,
    note: note || null,
    points: pts != null ? (typeof pts === 'string' ? parseInt(pts, 10) : pts) : null,
    played: played != null ? (typeof played === 'string' ? parseInt(played, 10) : played) : (() => {
      const w = won != null ? (typeof won === 'string' ? parseInt(won, 10) : won) : 0;
      const d = drawn != null ? (typeof drawn === 'string' ? parseInt(drawn, 10) : drawn) : 0;
      const l = lost != null ? (typeof lost === 'string' ? parseInt(lost, 10) : lost) : 0;
      return w + d + l || null;
    })(),
    won: won != null ? (typeof won === 'string' ? parseInt(won, 10) : won) : null,
    drawn: drawn != null ? (typeof drawn === 'string' ? parseInt(drawn, 10) : drawn) : null,
    lost: lost != null ? (typeof lost === 'string' ? parseInt(lost, 10) : lost) : null,
    goalsFor: goalsForNum,
    goalsAgainst: goalsAgainstNum,
    goalDiff,
    relegation_from: entry.relegation_rank ?? entry.relegation ?? null
  };
}

function extractTableRows(data) {
  if (!data || typeof data !== 'object') return [];
  const asArray = (arr) => (Array.isArray(arr) ? arr : []);
  // BetsAPI: results[0].overall.tables[0].rows
  const res0 = data.results?.[0];
  if (res0?.overall?.tables?.length) {
    const rows = res0.overall.tables[0].rows;
    if (Array.isArray(rows) && rows.length) return rows;
  }
  const fromObject = (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    const vals = Object.values(obj);
    if (vals.length === 0) return [];
    if (Array.isArray(vals[0])) return vals.flat();
    return vals.filter((v) => v && typeof v === 'object');
  };
  if (Array.isArray(data)) return data;
  let rows = asArray(data.results);
  if (rows.length) return rows;
  rows = asArray(data.results?.table) || asArray(data.results?.standings) || asArray(data.results?.total);
  if (rows.length) return rows;
  if (data.results && typeof data.results === 'object') {
    const vals = Object.entries(data.results)
      .map(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? { ...v, _order: parseInt(k, 10) || 0 } : null))
      .filter(Boolean);
    if (vals.length) return vals.sort((a, b) => (a._order || 0) - (b._order || 0));
    const first = data.results.total ?? data.results.standings ?? data.results.table ?? Object.values(data.results)[0];
    if (Array.isArray(first)) return first;
    if (first && typeof first === 'object') return fromObject(first);
  }
  rows = asArray(data.table) || asArray(data.standings);
  if (rows.length) return rows;
  if (data.table && typeof data.table === 'object') {
    const t = data.table;
    rows = asArray(t.overall) || asArray(t.total);
    if (rows.length) return rows;
    return fromObject(t);
  }
  return [];
}

const fetchTable = async () => {
  if (!props.leagueId || !props.show) return;
  loading.value = true;
  error.value = '';
  tableRows.value = [];
  try {
    const id = props.leagueId != null ? String(props.leagueId) : '';
    const params = new URLSearchParams();
    if (props.leagueName) params.set('leagueName', props.leagueName);
    if (props.country) params.set('country', props.country);
    const qs = params.toString();
    const url = qs ? `${API_URL}/api/league/${id}/table?${qs}` : `${API_URL}/api/league/${id}/table`;
    const res = await axios.get(url);
    const data = res.data;
    rawData.value = data;
    const rows = extractTableRows(data);
    tableRows.value = rows.map((r, i) => normalizeRow(r, i)).filter(Boolean);
    activeTab.value = 'overall';
  } catch (e) {
    const msg = e.response?.data?.message || e.response?.data?.error || e.message || 'Impossibile caricare la classifica.';
    error.value = msg;
  } finally {
    loading.value = false;
  }
};

watch(
  () => [props.show, props.leagueId],
  ([show, id]) => {
    const validId = id != null && id !== '' && String(id) !== 'null';
    if (show && validId) fetchTable();
    else if (show && !validId) {
      loading.value = false;
      error.value = '';
      tableRows.value = [];
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content.table-modal {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  max-width: 720px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-title {
  font-family: 'Outfit', sans-serif;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--text-main);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px;
}

.table-section {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.tabs {
  display: flex;
  gap: 0;
  padding: 0 0 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}

.tab-btn {
  background: none;
  border: none;
  padding: 10px 20px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  transition: color 0.2s, background 0.2s;
}

.tab-btn:hover {
  color: var(--text-main);
  background: var(--glass);
}

.tab-btn.active {
  color: var(--primary);
  background: var(--glass);
  border-bottom: 2px solid var(--primary);
  margin-bottom: -1px;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
}

.error-state p {
  color: var(--live);
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 16px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.table-wrap {
  overflow-x: auto;
}

.standings-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.standings-table th,
.standings-table td {
  padding: 10px 8px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  color: var(--text-main);
}

.standings-table th {
  font-weight: 700;
  color: var(--text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.standings-table tbody tr:hover {
  background: var(--glass);
}

.standings-table .row-highlight {
  background: rgba(0, 135, 78, 0.08);
}

.col-pos {
  width: 32px;
  text-align: center;
  font-weight: 600;
  color: var(--text-muted);
}

.col-team {
  min-width: 160px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 10px;
}

.col-team .team-logo {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
}

.col-team .team-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-dr {
  width: 40px;
  text-align: center;
  font-weight: 600;
}

.col-dr.positive {
  color: var(--primary);
}

.col-dr.negative {
  color: var(--live);
}

.col-note {
  width: 56px;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}

.col-num {
  width: 36px;
  text-align: center;
  color: var(--text-muted);
}

.col-pts {
  width: 44px;
  text-align: center;
  font-weight: 700;
  color: var(--accent);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.25s ease;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95) translateY(-10px);
}
</style>
