<template>
  <div class="app-container">
    <Header v-model:teamSearch="teamSearch" :darkMode="darkMode" @toggle-dark="toggleDarkMode" />
    <div class="main-layout">
      <Sidebar
          class="sidebar"
          :activeFilter="activeFilter"
          :hiddenLeagues="hiddenLeagues"
          @filter="handleFilter"
          @toggle-hidden="toggleLeagueHidden"
        />
      <main class="content">
        <div class="filters-container animate-fade-in">
          <div class="status-filters">
            <button 
              v-for="f in filterOptions" 
              :key="f"
              :class="['filter-btn', { active: currentFilter === f }]"
              @click="currentFilter = f"
            >
              {{ f }}
            </button>
          </div>

          <div class="date-navigator">
            <button class="nav-arrow" :disabled="!selectedDate" @click="prevDay"><ChevronLeft size="18" /></button>
            <div class="date-display" @click="selectToday">
              <Calendar size="16" class="cal-icon" />
              <span>{{ selectedDate ? formattedDate : 'Tutte le date' }}</span>
            </div>
            <button class="nav-arrow" :disabled="!selectedDate" @click="nextDay"><ChevronRight size="18" /></button>
            <button
              class="date-all-btn"
              :class="{ active: !selectedDate }"
              @click="showAllDates"
            >
              Tutti
            </button>
          </div>
        </div>
        <MatchList 
          :filter="currentFilter" 
          :activeFilter="activeFilter" 
          :selectedDate="selectedDate"
          :teamSearch="teamSearch"
          :hiddenLeagues="hiddenLeagues"
          :slipSelections="slipSelections"
          @select-match="selectedMatch = $event"
          @show-table="leagueForTable = $event"
          @add-to-slip="addToSlip"
        />
      </main>
      <aside class="right-panel">
        <GoalEventsPanel
          :goals="visibleRecentGoals"
          @click="selectedMatch = $event"
        />
      </aside>
    </div>

    <div class="cart-float">
      <Transition name="cart-slide">
        <div v-show="slipCartOpen" class="cart-panel" :class="{ enlarged: slipCartEnlarged }">
          <div class="cart-panel-actions">
            <button type="button" class="cart-panel-btn" :title="slipCartEnlarged ? 'Riduci' : 'Ingrandisci'" @click="slipCartEnlarged = !slipCartEnlarged">
              <Minimize2 v-if="slipCartEnlarged" size="18" />
              <Maximize2 v-else size="18" />
            </button>
            <button type="button" class="cart-panel-btn cart-panel-close" title="Chiudi" @click="slipCartOpen = false">
              <X size="20" />
            </button>
          </div>
          <SchedinaCart
            :selections="slipSelections"
            :totalOdds="slipTotalOdds"
            :enlarged="slipCartEnlarged"
            @remove="removeFromSlip"
            @clear="slipSelections = []"
          />
        </div>
      </Transition>
      <button
        type="button"
        class="cart-toggle"
        :class="{ open: slipCartOpen }"
        :title="slipCartOpen ? 'Chiudi schedina' : 'Apri schedina'"
        @click="slipCartOpen = !slipCartOpen"
      >
        <ShoppingCart size="22" />
        <span class="cart-toggle-label">Schedina</span>
        <span v-if="slipSelections.length > 0" class="cart-toggle-badge">{{ slipSelections.length }}</span>
      </button>
    </div>

    <MatchDetailModal 
      v-if="selectedMatch" 
      :show="!!selectedMatch" 
      :match="selectedMatch" 
      @close="selectedMatch = null"
    />

    <LeagueTableModal
      v-if="leagueForTable"
      :show="!!leagueForTable"
      :leagueName="leagueForTable?.name"
      :leagueId="leagueForTable?.leagueId"
      :country="leagueForTable?.country"
      @close="leagueForTable = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, provide } from 'vue';
import { ChevronLeft, ChevronRight, Calendar, X, ShoppingCart, Maximize2, Minimize2 } from 'lucide-vue-next';
import Header from './components/Header.vue';
import Sidebar from './components/Sidebar.vue';
import MatchList from './components/MatchList.vue';
import MatchDetailModal from './components/MatchDetailModal.vue';
import LeagueTableModal from './components/LeagueTableModal.vue';
import GoalEventsPanel from './components/GoalEventsPanel.vue';
import SchedinaCart from './components/SchedinaCart.vue';

const currentFilter = ref('TUTTI');
const activeFilter = ref({ type: 'all', value: null });
const filterOptions = ['TUTTI', 'LIVE', 'CONCLUSI', 'PROGRAMMATE'];
const selectedDate = ref(new Date()); // null = tutte le date
const teamSearch = ref('');
const selectedMatch = ref(null);
const leagueForTable = ref(null);

const slipCartOpen = ref(false);
const slipCartEnlarged = ref(false);
const slipSelections = ref([]);
const slipTotalOdds = computed(() => {
  const list = slipSelections.value;
  if (!list.length) return 0;
  return list.reduce((acc, s) => acc * s.odd, 1);
});

function addToSlip({ match, outcome, odd }) {
  const id = `${match.eventId}-${outcome}`;
  const homeName = match.homeTeam?.name || 'Casa';
  const awayName = match.awayTeam?.name || 'Trasferta';
  const outcomeLabel = outcome;
  const newItem = { id, eventId: match.eventId, homeName, awayName, outcome, outcomeLabel, odd };
  const idx = slipSelections.value.findIndex((s) => s.eventId === match.eventId);
  if (idx >= 0) {
    slipSelections.value = slipSelections.value.slice(0, idx).concat([newItem], slipSelections.value.slice(idx + 1));
  } else {
    slipSelections.value = [...slipSelections.value, newItem];
  }
  slipCartOpen.value = true;
}

function removeFromSlip(id) {
  slipSelections.value = slipSelections.value.filter((s) => s.id !== id);
}

const DARK_MODE_KEY = 'darkMode';
const darkMode = ref(localStorage.getItem(DARK_MODE_KEY) !== 'false');
const toggleDarkMode = () => {
  darkMode.value = !darkMode.value;
  localStorage.setItem(DARK_MODE_KEY, String(darkMode.value));
  document.documentElement.setAttribute('data-theme', darkMode.value ? 'dark' : 'light');
};
// Applica tema al caricamento
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', darkMode.value ? 'dark' : 'light');
}

const HIDDEN_LEAGUES_KEY = 'hiddenLeagues';
const hiddenLeagues = ref(JSON.parse(localStorage.getItem(HIDDEN_LEAGUES_KEY) || '[]'));

const toggleLeagueHidden = (leagueName) => {
  const set = new Set(hiddenLeagues.value);
  if (set.has(leagueName)) set.delete(leagueName);
  else set.add(leagueName);
  hiddenLeagues.value = [...set];
  localStorage.setItem(HIDDEN_LEAGUES_KEY, JSON.stringify(hiddenLeagues.value));
};
// Storico degli ultimi 10 gol segnati (con timestamp)
const recentGoals = ref([]);

// Storico dei punteggi precedenti per determinare quale squadra ha segnato
const previousScores = ref({});

// Fornisci una funzione per mostrare la notifica del gol ai componenti figli
const showGoalNotification = (match, prevScores = null) => {
  if (!match) return;
  if (hiddenLeagues.value.includes(match.league)) return;

  const prev = prevScores || previousScores.value[match._id];
  const currentHome = Number(match.homeTeam?.score ?? 0);
  const currentAway = Number(match.awayTeam?.score ?? 0);
  const prevHome = prev ? Number(prev.home ?? 0) : 0;
  const prevAway = prev ? Number(prev.away ?? 0) : 0;

  // Determina quale squadra ha segnato
  let scoringTeam = null;
  if (currentHome > prevHome) scoringTeam = 'home';
  else if (currentAway > prevAway) scoringTeam = 'away';

  // Evita duplicati: stesso match con stesso punteggio = stesso gol (già in lista)
  const alreadyShown = recentGoals.value.some(
    (g) =>
      g._id === match._id &&
      Number(g.homeTeam?.score ?? 0) === currentHome &&
      Number(g.awayTeam?.score ?? 0) === currentAway
  );
  if (alreadyShown) return;

  const goalWithTime = {
    ...match,
    goalTimestamp: Date.now(),
    goalId: `${match._id}_${currentHome}_${currentAway}_${Date.now()}`,
    scoringTeam: scoringTeam
  };

  previousScores.value[match._id] = {
    home: currentHome,
    away: currentAway
  };

  // Ultimi gol in cima: nuovo in testa, poi gli altri, max 10
  recentGoals.value = [goalWithTime, ...recentGoals.value].slice(0, 10);
};

const visibleRecentGoals = computed(() => {
  const hidden = new Set(hiddenLeagues.value);
  return recentGoals.value.filter((g) => !hidden.has(g.league));
});

provide('showGoalNotification', showGoalNotification);

const handleFilter = (filter) => {
  activeFilter.value = filter;
};

const clearFilter = () => {
  activeFilter.value = { type: 'all', value: null };
};

const formattedDate = computed(() => {
  const d = selectedDate.value;
  if (!d) return 'Tutte le date';
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const days = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];
  const dayName = days[d.getDay()];
  return `${day}/${month} ${dayName}`;
});

const showAllDates = () => {
  selectedDate.value = null;
};

const selectToday = () => {
  if (!selectedDate.value) selectedDate.value = new Date();
};

const prevDay = () => {
  if (!selectedDate.value) return;
  const d = new Date(selectedDate.value);
  d.setDate(d.getDate() - 1);
  selectedDate.value = d;
};

const nextDay = () => {
  if (!selectedDate.value) return;
  const d = new Date(selectedDate.value);
  d.setDate(d.getDate() + 1);
  selectedDate.value = d;
};
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-layout {
  display: grid;
  grid-template-columns: 320px 1fr 380px;
  gap: 20px;
  padding: 20px;
  max-width: 1680px;
  margin: 0 auto;
  width: 100%;
}

.sidebar {
  position: sticky;
  top: 90px;
  height: calc(100vh - 120px);
}

.content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.filters-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  padding: 8px 15px;
  border-radius: 12px;
  border: 1px solid var(--border);
  gap: 15px;
}

.status-filters {
  display: flex;
  gap: 8px;
}

.date-navigator {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 2px;
  color: var(--text-main);
}

.nav-arrow {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 5px 8px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  border-radius: 6px;
  transition: background 0.2s;
}

.nav-arrow:hover:not(:disabled) {
  background: var(--glass);
  color: var(--text-main);
}

.nav-arrow:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.date-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 15px;
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  cursor: pointer;
}

.date-all-btn {
  margin-left: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.date-all-btn:hover {
  background: var(--glass);
  color: var(--text-main);
}

.date-all-btn.active {
  background: var(--accent);
  color: #fff;
}

.date-all-btn.active:hover {
  background: var(--accent);
  color: #fff;
  opacity: 0.95;
}

.cal-icon {
  color: var(--text-main);
}

.filter-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 6px 14px;
  font-weight: 700;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.3s ease;
  font-size: 0.85rem;
  text-transform: uppercase;
}

.filter-btn:hover {
  color: var(--text-main);
  background: var(--glass);
}

.filter-btn.active {
  background: var(--live);
  color: white;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: sticky;
  top: 90px;
  height: calc(100vh - 120px);
  overflow: hidden;
}

@media (max-width: 1100px) {
  .main-layout {
    grid-template-columns: 240px 1fr;
  }
  .right-panel {
    display: none;
  }
}

@media (max-width: 850px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
  .sidebar {
    display: none;
  }
}

/* Carrello schedina in basso a destra */
.cart-float {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 900;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.cart-panel {
  position: relative;
  width: 340px;
  max-width: calc(100vw - 40px);
  max-height: 70vh;
  overflow: hidden;
  border-radius: 14px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border);
  transition: max-height 0.25s ease;
}

.cart-panel.enlarged {
  max-height: 88vh;
}

.cart-panel-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: flex;
  gap: 6px;
}

.cart-panel-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: var(--bg-dark);
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.cart-panel-btn:hover {
  background: var(--glass);
  color: var(--text-main);
}

.cart-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border: none;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-main);
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  transition: background 0.2s, border-color 0.2s;
}

.cart-toggle:hover {
  background: var(--glass);
  border-color: var(--accent);
}

.cart-toggle.open {
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.06);
}

.cart-toggle-label {
  font-family: 'Outfit', sans-serif;
}

.cart-toggle-badge {
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: var(--accent);
  color: #fff;
  font-size: 0.8rem;
}

.cart-slide-enter-active,
.cart-slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.cart-slide-enter-from,
.cart-slide-leave-to {
  transform: translateY(10px);
  opacity: 0;
}
</style>
