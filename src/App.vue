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
        <div class="premium-card ads-box">
          <p>Scommesse Consigliate</p>
          <div class="bet-promo">
            <span>Inter vs Milan</span>
            <span class="odds-val">1.85</span>
          </div>
        </div>
      </aside>
    </div>

    <MatchDetailModal 
      v-if="selectedMatch" 
      :show="!!selectedMatch" 
      :match="selectedMatch" 
      @close="selectedMatch = null"
    />

    <GoalNotification
      v-for="(notif, idx) in goalNotifications"
      :key="notif._id || idx"
      :match="notif"
      :offset="idx"
      @close="removeNotification(notif)"
      @click="selectedMatch = $event"
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
import GoalNotification from './components/GoalNotification.vue';

const currentFilter = ref('TUTTI');
const activeFilter = ref({ type: 'all', value: null });
const filterOptions = ['TUTTI', 'LIVE', 'CONCLUSI', 'PROGRAMMATE'];
const selectedDate = ref(new Date());
const selectedMatch = ref(null);
const goalNotifications = ref([]);

// Fornisci una funzione per mostrare la notifica del gol ai componenti figli
const showGoalNotification = (match) => {
  if (!match) return;
  // Evita duplicati della stessa partita consecutivi
  goalNotifications.value = [
    match,
    ...goalNotifications.value.filter(m => m._id !== match._id)
  ].slice(0, 3); // massimo 3 notifiche impilate
};

const removeNotification = (match) => {
  goalNotifications.value = goalNotifications.value.filter(m => m !== match);
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
  grid-template-columns: 240px 1fr 280px;
  gap: 20px;
  padding: 20px;
  max-width: 1400px;
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
