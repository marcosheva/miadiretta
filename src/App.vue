<template>
  <div class="app-container">
    <Header />
    <div class="main-layout">
      <Sidebar class="sidebar" @filter="handleFilter" />
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
            <button class="nav-arrow" @click="prevDay"><ChevronLeft size="18" /></button>
            <div class="date-display">
              <Calendar size="16" class="cal-icon" />
              <span>{{ formattedDate }}</span>
            </div>
            <button class="nav-arrow" @click="nextDay"><ChevronRight size="18" /></button>
          </div>
          
          <div v-if="activeFilter.value" class="active-league-tag">
            {{ activeFilter.type === 'country' ? 'Naz: ' : '' }}{{ activeFilter.value }}
            <button class="clear-league" @click="clearFilter">×</button>
          </div>
        </div>
        <MatchList 
          :filter="currentFilter" 
          :activeFilter="activeFilter" 
          :selectedDate="selectedDate"
          @select-match="selectedMatch = $event"
        />
      </main>
      <aside class="right-panel">
        <GoalEventsPanel
          :goals="recentGoals"
          @click="selectedMatch = $event"
        />
      </aside>
    </div>

    <MatchDetailModal 
      v-if="selectedMatch" 
      :show="!!selectedMatch" 
      :match="selectedMatch" 
      @close="selectedMatch = null"
    />

  </div>
</template>

<script setup>
import { ref, computed, provide } from 'vue';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-vue-next';
import Header from './components/Header.vue';
import Sidebar from './components/Sidebar.vue';
import MatchList from './components/MatchList.vue';
import MatchDetailModal from './components/MatchDetailModal.vue';
import GoalEventsPanel from './components/GoalEventsPanel.vue';

const currentFilter = ref('TUTTI');
const activeFilter = ref({ type: 'all', value: null });
const filterOptions = ['TUTTI', 'LIVE', 'CONCLUSI', 'PROGRAMMATE'];
const selectedDate = ref(new Date());
const selectedMatch = ref(null);
// Storico degli ultimi 10 gol segnati (con timestamp)
const recentGoals = ref([]);
const showGoalsPanel = ref(false);

// Storico dei punteggi precedenti per determinare quale squadra ha segnato
const previousScores = ref({});

// Fornisci una funzione per mostrare la notifica del gol ai componenti figli
const showGoalNotification = (match, prevScores = null) => {
  if (!match) return;
  
  const prev = prevScores || previousScores.value[match._id];
  const currentHome = Number(match.homeTeam?.score ?? 0);
  const currentAway = Number(match.awayTeam?.score ?? 0);
  const prevHome = prev ? Number(prev.home ?? 0) : 0;
  const prevAway = prev ? Number(prev.away ?? 0) : 0;
  
  // Determina quale squadra ha segnato
  let scoringTeam = null;
  if (currentHome > prevHome) scoringTeam = 'home';
  else if (currentAway > prevAway) scoringTeam = 'away';
  
  // Aggiungi il nuovo gol allo storico con timestamp e info su chi ha segnato
  const goalWithTime = {
    ...match,
    goalTimestamp: Date.now(),
    goalId: `${match._id}_${Date.now()}`,
    scoringTeam: scoringTeam
  };
  
  // Aggiorna lo storico dei punteggi
  previousScores.value[match._id] = {
    home: currentHome,
    away: currentAway
  };
  
  // Aggiungi in cima e mantieni solo gli ultimi 10
  recentGoals.value = [goalWithTime, ...recentGoals.value].slice(0, 10);
};

provide('showGoalNotification', showGoalNotification);

const handleFilter = (filter) => {
  activeFilter.value = filter;
};

const clearFilter = () => {
  activeFilter.value = { type: 'all', value: null };
};

const formattedDate = computed(() => {
  const d = selectedDate.value;
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const days = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];
  const dayName = days[d.getDay()];
  return `${day}/${month} ${dayName}`;
});

const prevDay = () => {
  const d = new Date(selectedDate.value);
  d.setDate(d.getDate() - 1);
  selectedDate.value = d;
};

const nextDay = () => {
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
  grid-template-columns: 240px 1fr 380px;
  gap: 20px;
  padding: 20px;
  max-width: 1600px;
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
  background: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 2px;
  color: #333;
}

.nav-arrow {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 5px 8px;
  color: #888;
  display: flex;
  align-items: center;
  border-radius: 6px;
  transition: background 0.2s;
}

.nav-arrow:hover {
  background: #eee;
  color: #333;
}

.date-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 15px;
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
  border-left: 1px solid #eee;
  border-right: 1px solid #eee;
}

.cal-icon {
  color: #333;
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

.ads-box {
  padding: 20px;
  text-align: center;
}

.bet-promo {
  margin-top: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--glass);
  padding: 10px;
  border-radius: 8px;
  font-size: 0.9rem;
}

.odds-val {
  color: var(--accent);
  font-weight: 700;
}

.active-league-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 135, 78, 0.1);
  color: var(--primary);
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
  border: 1px solid var(--primary);
  margin-left: auto;
}

.clear-league {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 1.1rem;
  cursor: pointer;
  line-height: 1;
  padding: 0 2px;
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
</style>
