<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-content animate-slide-up">
          <header class="modal-header">
            <div class="match-info">
              <div class="team home">
                <img
                  v-if="hasTeamLogo(match.homeTeam)"
                  :src="teamLogoUrl(match.homeTeam)"
                  class="team-logo"
                  :alt="match.homeTeam.name"
                  @error="($e) => $e.target.src = (match.homeTeam?.logo || '')"
                />
                <span class="team-name">{{ match.homeTeam.name }}</span>
              </div>
              <div class="score-summary">
                <span class="score">{{ match.homeTeam.score }} - {{ match.awayTeam.score }}</span>
                <span class="match-status" :class="{ live: match.status === 'LIVE' }">
                  {{ match.status === 'LIVE' ? match.minute : 'FIN' }}
                </span>
              </div>
              <div class="team away">
                <span class="team-name">{{ match.awayTeam.name }}</span>
                <img
                  v-if="hasTeamLogo(match.awayTeam)"
                  :src="teamLogoUrl(match.awayTeam)"
                  class="team-logo"
                  :alt="match.awayTeam.name"
                  @error="($e) => $e.target.src = (match.awayTeam?.logo || '')"
                />
              </div>
            </div>
            <button class="close-btn" @click="$emit('close')"><X size="24" /></button>
          </header>

          <div class="modal-body">
            <div v-if="loading" class="loading-state">
              <div class="spinner"></div>
              <p>Caricamento dettagli...</p>
            </div>
            <template v-else>
              <!-- Quote: 1X2, Over/Under 2.5, Gol/NoGol -->
              <section class="odds-section">
                <h3 class="odds-title">Quote</h3>
                <div v-if="oddsLoading" class="odds-loading">Caricamento quote...</div>
                <div v-else class="odds-grid">
                  <div v-if="displayMain" class="odds-block">
                    <span class="odds-label">1X2</span>
                    <div class="odds-row three-cols">
                      <span class="odd-cell" title="Casa">1 <strong>{{ formatOdd(displayMain['1']) }}</strong></span>
                      <span class="odd-cell" title="Pareggio">X <strong>{{ formatOdd(displayMain['X']) }}</strong></span>
                      <span class="odd-cell" title="Trasferta">2 <strong>{{ formatOdd(displayMain['2']) }}</strong></span>
                    </div>
                  </div>
                  <div v-if="odds.overUnder25" class="odds-block">
                    <span class="odds-label">Over/Under 2.5</span>
                    <div class="odds-row two-cols">
                      <span class="odd-cell">Over <strong>{{ formatOdd(odds.overUnder25.over) }}</strong></span>
                      <span class="odd-cell">Under <strong>{{ formatOdd(odds.overUnder25.under) }}</strong></span>
                    </div>
                  </div>
                  <div v-if="odds.btts" class="odds-block">
                    <span class="odds-label">Gol / No Gol</span>
                    <div class="odds-row two-cols">
                      <span class="odd-cell">Gol <strong>{{ formatOdd(odds.btts.yes) }}</strong></span>
                      <span class="odd-cell">No Gol <strong>{{ formatOdd(odds.btts.no) }}</strong></span>
                    </div>
                  </div>
                </div>
                <p v-if="!oddsLoading && !hasOdds" class="odds-unavailable">Quote non disponibili per questa partita.</p>
              </section>

              <div v-if="!fullMatch.events || fullMatch.events.length === 0" class="empty-state">
                <p>Nessun evento disponibile per questa partita.</p>
              </div>
              <div v-else class="timeline">
              <!-- Timeline Groups -->
              <div v-for="(group, half) in groupedEvents" :key="half" class="half-group">
                <div class="half-header">
                  <span>{{ half }} TEMPO</span>
                  <span class="half-score" v-if="group.scoreAtEnd">{{ group.scoreAtEnd }}</span>
                </div>
                
                <div v-for="ev in group.items" :key="ev.time + ev.main_text" :class="['event-row', ev.side, ev.type]">
                  <div class="event-time">{{ ev.time }}'</div>
                  
                  <div class="event-content">
                    <div class="event-icon-box">
                      <component :is="getEventIcon(ev.type)" :size="18" :class="['event-icon', ev.type]" />
                    </div>
                    <div class="event-details">
                      <div class="main-text">{{ ev.main_text }}</div>
                      <div v-if="ev.score" class="event-score">{{ ev.score }}</div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { X, Trophy, Square, RefreshCw, Search, ShieldAlert } from 'lucide-vue-next';
import axios from 'axios';
import API_URL from '../config/api';
import { teamLogoUrl, hasTeamLogo } from '../utils/teamLogo';

const props = defineProps({
  show: Boolean,
  match: Object
});

const emit = defineEmits(['close']);

const fullMatch = ref({});
const loading = ref(true);
const odds = ref({ main: null, overUnder25: null, btts: null });
const oddsLoading = ref(false);

const fetchDetails = async () => {
  if (!props.match?.eventId) return;
  loading.value = true;
  try {
    const res = await axios.get(`${API_URL}/api/match/${props.match.eventId}`);
    fullMatch.value = res.data;
  } catch (e) {
    console.error('Error fetching match details:', e);
  } finally {
    loading.value = false;
  }
};

const fetchOdds = async () => {
  if (!props.match?.eventId) return;
  oddsLoading.value = true;
  odds.value = { main: null, overUnder25: null, btts: null };
  try {
    const res = await axios.get(`${API_URL}/api/match/${props.match.eventId}/odds`);
    odds.value = res.data;
  } catch (e) {
    console.error('Error fetching odds:', e);
  } finally {
    oddsLoading.value = false;
  }
};

const hasOdds = computed(() => {
  const o = odds.value;
  const fromMatch = fullMatch.value?.odds;
  const mainFromMatch = fromMatch && (fromMatch.home != null || fromMatch.draw != null || fromMatch.away != null);
  return !!(o?.main || o?.overUnder25 || o?.btts || mainFromMatch);
});

// 1X2: da endpoint quote o da fullMatch.odds (salvato dal backend da event/view)
const displayMain = computed(() => {
  if (odds.value?.main && (odds.value.main['1'] != null || odds.value.main['X'] != null || odds.value.main['2'] != null)) {
    return odds.value.main;
  }
  const o = fullMatch.value?.odds;
  if (o && (o.home != null || o.draw != null || o.away != null)) {
    return { 1: o.home, X: o.draw, 2: o.away };
  }
  return null;
});

const formatOdd = (val) => {
  if (val == null || val === '') return '–';
  if (typeof val === 'object') {
    const raw = val.OD ?? val.odd ?? val.odds ?? val.value;
    if (raw == null) return '–';
    val = raw;
  }
  const n = Number(val);
  return Number.isNaN(n) ? String(val) : n.toFixed(2);
};

onMounted(() => {
  if (props.show) {
    fetchDetails();
    fetchOdds();
  }
});

watch(() => props.show, (visible) => {
  if (visible && props.match?.eventId) {
    fetchDetails();
    fetchOdds();
  }
});

const getEventIcon = (type) => {
  switch (type) {
    case 'goal': return Trophy;
    case 'card': return Square;
    case 'sub': return RefreshCw;
    case 'var': return ShieldAlert;
    default: return Search;
  }
};

const groupedEvents = computed(() => {
  const groups = {
    '1': { items: [], scoreAtEnd: null },
    '2': { items: [], scoreAtEnd: null }
  };

  if (!fullMatch.value.events) return groups;

  fullMatch.value.events.forEach(ev => {
    const minute = parseInt(ev.time);
    if (minute <= 45) {
      groups['1'].items.push(ev);
    } else {
      groups['2'].items.push(ev);
    }
  });

  return groups;
});

</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  background: var(--bg-card);
  width: 100%;
  max-width: 650px;
  max-height: 90vh;
  border-radius: 20px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.modal-header {
  padding: 30px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.05), transparent);
  border-bottom: 1px solid var(--border);
  position: relative;
}

.match-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30px;
}

.team {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.team-logo {
  width: 60px;
  height: 60px;
  object-fit: contain;
}

.team-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
  text-align: center;
}

.score-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.score {
  font-size: 2.5rem;
  font-weight: 800;
  font-family: 'Outfit', sans-serif;
  color: var(--primary);
  letter-spacing: -2px;
}

.match-status {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
}

.match-status.live {
  color: var(--live);
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--text-main);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: rgba(0, 0, 0, 0.2);
}

.odds-section {
  margin-bottom: 24px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 12px;
  border: 1px solid var(--border);
}

.odds-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 14px 0;
}

.odds-loading,
.odds-unavailable {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin: 0;
}

.odds-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.odds-block {
  flex: 1;
  min-width: 140px;
  padding: 10px 14px;
  background: var(--bg-card);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.odds-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.odds-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.odds-row.three-cols { justify-content: space-between; }
.odds-row.two-cols { justify-content: space-between; }

.odd-cell {
  font-size: 0.85rem;
  color: var(--text-main);
}

.odd-cell strong {
  color: var(--primary);
  font-weight: 700;
  margin-left: 4px;
}

.half-group {
  margin-bottom: 25px;
}

.half-header {
  background: rgba(255, 255, 255, 0.05);
  padding: 10px 20px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--text-muted);
  letter-spacing: 1px;
  margin-bottom: 15px;
}

.event-row {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  transition: all 0.2s;
}

/* HIGHIGHT GOALS */
.event-row.goal {
  background: rgba(231, 76, 60, 0.15);
  border: 1px solid rgba(231, 76, 60, 0.3);
  box-shadow: 0 4px 12px rgba(231, 76, 60, 0.1);
}

.event-row.goal .event-time {
  color: var(--live);
  font-weight: 800;
}

.event-row.goal .main-text {
  color: var(--text-main);
  font-weight: 700;
}

.event-row.home {
  flex-direction: row;
}

.event-row.away {
  flex-direction: row-reverse;
}

.event-time {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  min-width: 35px;
}

.event-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.event-row.away .event-content {
  flex-direction: row-reverse;
}

.event-icon-box {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.event-icon.goal { color: var(--live); }
.event-icon.card { color: #f1c40f; }
.event-icon.sub { color: var(--primary); }
.event-icon.var { color: #e67e22; }

.event-details {
  display: flex;
  flex-direction: column;
}

.event-row.away .event-details {
  align-items: flex-end;
}

.main-text {
  font-size: 0.9rem;
  color: var(--text-main);
  font-weight: 500;
}

.event-score {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--primary);
  margin-top: 2px;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px;
  color: var(--text-muted);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Transitions */
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from, .modal-leave-to {
  opacity: 0;
}

.animate-slide-up {
  animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
  from { transform: translateY(50px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>
