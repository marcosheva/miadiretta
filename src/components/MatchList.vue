<template>
  <div class="match-list-container">
    <div v-for="group in groupedMatches" :key="group.name" class="league-group animate-fade-in">
      <div class="league-header">
        <button class="fav-btn" @click.stop="toggleFavorite(group.name)">
          <Star :size="16" :class="{ active: group.isFavorite }" :fill="group.isFavorite ? 'gold' : 'none'" stroke="currentColor" />
        </button>
        <button
          type="button"
          class="league-name-btn"
          title="Apri classifica"
          @click.stop="$emit('show-table', { name: group.name, leagueId: group.leagueId || null, country: group.country || null })"
        >
          {{ group.name }}
        </button>
      </div>
      <template v-for="dateGroup in group.matchesByDate" :key="dateGroup.dateKey">
        <div class="date-header">{{ dateGroup.dateLabel }}</div>
        <MatchRow
          v-for="match in dateGroup.matches"
          :key="match._id"
          :match="match"
          :highlight="!!goalHighlights[match._id]"
          :selectedOutcome="getSelectedOutcome(match)"
          @select="$emit('select-match', $event)"
          @add-to-slip="$emit('add-to-slip', $event)"
        />
      </template>
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
  teamSearch: { type: String, default: '' },
  hiddenLeagues: { type: Array, default: () => [] },
  slipSelections: { type: Array, default: () => [] }
});

function getSelectedOutcome(match) {
  if (!match?.eventId || !props.slipSelections?.length) return null;
  const s = props.slipSelections.find((x) => String(x.eventId) === String(match.eventId));
  return s?.outcome ?? null;
}

defineEmits(['select-match', 'show-table', 'add-to-slip']);

const matches = ref([]);
const loading = ref(true);
const favorites = ref(JSON.parse(localStorage.getItem('favoriteLeagues') || '[]'));

// Storico dei punteggi per rilevare nuovi gol
const lastScores = ref({});
// Stato \"stabile\" che usiamo per evitare che punteggi/minuti tornino indietro
const stableMatches = ref({});
// Match che hanno avuto un gol recente (per evidenziarli)
const goalHighlights = ref({});

// Audio per il gol (beep). Si abilita al primo click sulla pagina (politica browser).
let audioCtx = null;
const playGoalSound = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') return;

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
          const isHiddenLeague = (props.hiddenLeagues || []).includes(m.league);
          if (!isHiddenLeague) {
            newHighlights[m._id] = true;
            playGoalSound();
            if (showGoalNotification) showGoalNotification(m, prev);
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
      const d = new Date(props.selectedDate);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      params.date = `${y}-${m}-${day}`;
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
    fetchPrematchOddsInBackground();
  } catch (err) {
    console.error('Error fetching matches:', err);
    matches.value = []; // Set to empty array on error
  } finally {
    loading.value = false;
  }
};

// Quote in lista: non fare richieste in background (evita migliaia di request/CORB).
// Le quote si vedono aprendo il dettaglio partita; in lista mostriamo solo quelle già in /api/matches.
function fetchPrematchOddsInBackground() {
  // Disabilitato: troppe richieste. Le quote si caricano nel dettaglio partita.
}

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

  const hiddenSet = new Set(props.hiddenLeagues || []);

  const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const monthNames = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

  function getDateKey(d) {
    const x = new Date(d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }

  function formatDateLabel(dateKey) {
    const d = new Date(dateKey);
    const today = new Date();
    const todayKey = getDateKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = getDateKey(yesterday);
    if (dateKey === todayKey) return 'Oggi';
    if (dateKey === yesterdayKey) return 'Ieri';
    const day = dayNames[d.getDay()];
    const date = d.getDate();
    const month = monthNames[d.getMonth()];
    return `${day} ${date} ${month}`;
  }

  function groupMatchesByDate(matchList) {
    const sorted = [...matchList].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    const byDate = sorted.reduce((acc, m) => {
      const key = getDateKey(m.startTime);
      if (!acc[key]) acc[key] = [];
      acc[key].push(m);
      return acc;
    }, {});
    return Object.keys(byDate)
      .sort()
      .map((dateKey) => ({
        dateKey,
        dateLabel: formatDateLabel(dateKey),
        matches: byDate[dateKey]
      }));
  }

  return Object.keys(groups)
    .filter((name) => !hiddenSet.has(name))
    .map((name) => {
      const matchList = groups[name];
      return {
        name,
        matches: matchList,
        matchesByDate: groupMatchesByDate(matchList),
        leagueId: matchList[0]?.leagueId || null,
        country: matchList[0]?.country || null,
        isFavorite: favorites.value.includes(name)
      };
    })
    .sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });
});

onMounted(() => {
  fetchMatches();
  // Abilita AudioContext al primo click (richiesto dai browser)
  const enableAudio = () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    audioCtx.resume?.().catch(() => {});
    document.removeEventListener('click', enableAudio);
  };
  document.addEventListener('click', enableAudio, { once: true });
});
watch(() => [props.filter, props.activeFilter, props.selectedDate], fetchMatches, { deep: true });

// Refresh lista ogni 90s (riduce richieste; i live si aggiornano comunque al prossimo refresh)
setInterval(fetchMatches, 90 * 1000);
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

.league-name-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: left;
  transition: opacity 0.2s;
}

.league-name-btn:hover {
  opacity: 0.85;
  text-decoration: underline;
}

.date-header {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  padding: 10px 15px 6px;
  margin-top: 4px;
  border-bottom: 1px solid var(--border);
}

.date-header:first-of-type {
  margin-top: 0;
}

.loading, .no-results {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
}
</style>
