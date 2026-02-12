<template>
  <div class="match-list-container">
    <div v-for="group in groupedMatches" :key="group.name" class="league-group animate-fade-in">
      <div class="league-header">
        <button class="fav-btn" @click.stop="toggleFavorite(group.name)">
          <Star :size="16" :class="{ active: group.isFavorite }" :fill="group.isFavorite ? 'gold' : 'none'" stroke="currentColor" />
        </button>
        <span class="league-name">{{ group.name }}</span>
      </div>
      <MatchRow 
        v-for="match in group.matches" 
        :key="match._id" 
        :match="match"
        :highlight="!!goalHighlights[match._id]"
        @select="$emit('select-match', $event)"
      />
    </div>

    <div v-if="!loading && groupedMatches.length === 0" class="no-results">
      Nessun risultato disponibile per questa categoria.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, inject } from 'vue';
import axios from 'axios';
import { Star } from 'lucide-vue-next';
import MatchRow from './MatchRow.vue';
import API_URL from '../config/api';

const showGoalNotification = inject('showGoalNotification', null);

const props = defineProps({
  filter: String,
  activeFilter: {
    type: Object,
    default: () => ({ type: 'all', value: null })
  },
  selectedDate: Date,
  teamSearch: { type: String, default: '' }
});

defineEmits(['select-match']);

const matches = ref([]);
const loading = ref(true);
const favorites = ref(JSON.parse(localStorage.getItem('favoriteLeagues') || '[]'));

// Storico dei punteggi per rilevare nuovi gol
const lastScores = ref({});
// Stato \"stabile\" che usiamo per evitare che punteggi/minuti tornino indietro
const stableMatches = ref({});
// Match che hanno avuto un gol recente (per evidenziarli)
const goalHighlights = ref({});

// Audio semplice per il gol (beep breve)
let audioCtx = null;
const playGoalSound = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    // in caso di errore (ad es. browser che blocca l'audio), ignora
  }
};

const toggleFavorite = (leagueName) => {
  if (favorites.value.includes(leagueName)) {
    favorites.value = favorites.value.filter(l => l !== leagueName);
  } else {
    favorites.value.push(leagueName);
  }
  localStorage.setItem('favoriteLeagues', JSON.stringify(favorites.value));
};

const detectGoals = (newMatches) => {
  const newLastScores = { ...lastScores.value };
  const newHighlights = { ...goalHighlights.value };

  newMatches.forEach((m) => {
    if (!m || !m._id || !m.homeTeam || !m.awayTeam) return;

    const prev = lastScores.value[m._id];
    const currentHome = Number(m.homeTeam.score ?? 0);
    const currentAway = Number(m.awayTeam.score ?? 0);

    // Se la partita è live e uno dei due punteggi è aumentato, evidenzia
    if (m.status === 'LIVE') {
      if (prev) {
        // C'è un punteggio precedente: controlla se è aumentato
        const homeIncreased = currentHome > prev.home;
        const awayIncreased = currentAway > prev.away;
        
        if (homeIncreased || awayIncreased) {
          newHighlights[m._id] = true;

          // Suono per il nuovo gol
          playGoalSound();

          // Mostra la notifica del gol in alto (mostrerà tutti gli ultimi 10)
          if (showGoalNotification) {
            // Passa anche i punteggi precedenti per determinare chi ha segnato
            showGoalNotification(m, prev);
          }
        }
      }
      
      // Salva sempre il punteggio corrente (anche se non c'è prev)
      newLastScores[m._id] = {
        home: currentHome,
        away: currentAway
      };
    } else {
      // Per partite non live, salva comunque il punteggio
      newLastScores[m._id] = {
        home: currentHome,
        away: currentAway
      };
    }
  });

  lastScores.value = newLastScores;
  goalHighlights.value = newHighlights;
};

const applyStabilization = (data) => {
  return data.map((m) => {
    if (!m || !m._id || !m.homeTeam || !m.awayTeam) return m;

    const prev = stableMatches.value[m._id];
    if (!prev) return m;

    const newHome = Number(m.homeTeam.score ?? 0);
    const newAway = Number(m.awayTeam.score ?? 0);
    const prevHome = Number(prev.homeTeam?.score ?? 0);
    const prevAway = Number(prev.awayTeam?.score ?? 0);

    // punteggi mai in diminuzione
    const homeScore = Math.max(prevHome, newHome);
    const awayScore = Math.max(prevAway, newAway);

    // minuto mai in diminuzione (se è una stringa tipo 45')
    const parseMinute = (val) => {
      if (!val) return 0;
      const str = String(val).replace("'", '');
      const num = parseInt(str, 10);
      return Number.isNaN(num) ? 0 : num;
    };

    const prevMin = parseMinute(prev.minute);
    const newMin = parseMinute(m.minute);
    const minute = newMin >= prevMin ? m.minute : prev.minute;

    return {
      ...m,
      minute,
      homeTeam: {
        ...m.homeTeam,
        score: homeScore
      },
      awayTeam: {
        ...m.awayTeam,
        score: awayScore
      }
    };
  });
};

const fetchMatches = async () => {
  loading.value = true;
  try {
    const params = {};
    if (props.activeFilter.type === 'league') params.league = props.activeFilter.value;
    if (props.activeFilter.type === 'country') params.country = props.activeFilter.value;
    
    if (props.selectedDate) {
      params.date = props.selectedDate.toISOString().split('T')[0];
    }
    
    const response = await axios.get(`${API_URL}/api/matches`, { params });
    const raw = Array.isArray(response.data) ? response.data : [];

    // IMPORTANTE: rileva i gol PRIMA della stabilizzazione, usando i dati raw
    detectGoals(raw);

    // Poi applica smoothing per evitare "salti indietro" nella visualizzazione
    const data = applyStabilization(raw);

    // aggiorna lo stato stabile
    const newStable = {};
    data.forEach((m) => {
      if (m && m._id) newStable[m._id] = m;
    });
    stableMatches.value = newStable;

    matches.value = data;
  } catch (err) {
    console.error('Error fetching matches:', err);
    matches.value = []; // Set to empty array on error
  } finally {
    loading.value = false;
  }
};

const groupedMatches = computed(() => {
  let filtered = matches.value;
  if (props.filter === 'LIVE') filtered = filtered.filter(m => m.status === 'LIVE');
  if (props.filter === 'CONCLUSI') filtered = filtered.filter(m => m.status === 'FINISHED');
  if (props.filter === 'PROGRAMMATE') filtered = filtered.filter(m => m.status === 'SCHEDULED');

  // Filtro per nome squadra
  const q = (props.teamSearch || '').trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(m =>
      (m.homeTeam?.name || '').toLowerCase().includes(q) ||
      (m.awayTeam?.name || '').toLowerCase().includes(q)
    );
  }

  // Group by league
  const groups = filtered.reduce((acc, m) => {
    if (!acc[m.league]) acc[m.league] = [];
    acc[m.league].push(m);
    return acc;
  }, {});

  // Convert to array and sort
  return Object.keys(groups).map(name => ({
    name,
    matches: groups[name],
    isFavorite: favorites.value.includes(name)
  })).sort((a, b) => {
    // 1. Favorites first
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    
    // 2. Alphabetical
    return a.name.localeCompare(b.name);
  });
});

onMounted(fetchMatches);
watch(() => [props.filter, props.activeFilter, props.selectedDate], fetchMatches, { deep: true });

// Refresh live matches every 30 seconds
setInterval(fetchMatches, 30000);
</script>

<style scoped>
.match-list-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.league-group {
  display: flex;
  flex-direction: column;
}

.league-header {
  background: var(--bg-card);
  padding: 8px 15px;
  border-radius: 8px 8px 0 0;
  border: 1px solid var(--border);
  border-bottom: none;
  display: flex;
  align-items: center;
  gap: 10px;
}

.fav-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: var(--text-muted);
  transition: transform 0.2s;
  display: flex;
  align-items: center;
}

.fav-btn:hover {
  transform: scale(1.1);
  color: gold;
}

.fav-btn .active {
  color: gold;
}

.league-name {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.loading, .no-results {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
}
</style>
