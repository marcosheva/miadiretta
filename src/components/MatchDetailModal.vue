<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-content animate-slide-up">
          <header class="modal-header">
            <div class="match-info">
              <div class="team home">
                <img v-if="match.homeTeam.logo" :src="match.homeTeam.logo" class="team-logo" />
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
                <img v-if="match.awayTeam.logo" :src="match.awayTeam.logo" class="team-logo" />
              </div>
            </div>
            <button class="close-btn" @click="$emit('close')"><X size="24" /></button>
          </header>

          <div class="modal-body">
            <div v-if="loading" class="loading-state">
              <div class="spinner"></div>
              <p>Caricamento dettagli...</p>
            </div>
            <div v-else-if="!fullMatch.events || fullMatch.events.length === 0" class="empty-state">
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
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { X, Trophy, Square, RefreshCw, Search, ShieldAlert } from 'lucide-vue-next';
import axios from 'axios';

const props = defineProps({
  show: Boolean,
  match: Object
});

const emit = defineEmits(['close']);

const fullMatch = ref({});
const loading = ref(true);

const fetchDetails = async () => {
  if (!props.match.eventId) return;
  loading.value = true;
  try {
    const res = await axios.get(`/api/match/${props.match.eventId}`);
    fullMatch.value = res.data;
  } catch (e) {
    console.error('Error fetching match details:', e);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (props.show) fetchDetails();
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
  color: white;
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
  color: white;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: rgba(0, 0, 0, 0.2);
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
  color: white;
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
