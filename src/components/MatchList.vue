<template>
  <div class="match-list-container">
    <div v-if="loading" class="loading">Caricamento risultati...</div>
    
    <div v-else v-for="group in groupedMatches" :key="group.name" class="league-group animate-fade-in">
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
        @select="$emit('select-match', $event)"
      />
    </div>

    <div v-if="!loading && groupedMatches.length === 0" class="no-results">
      Nessun risultato disponibile per questa categoria.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import axios from 'axios';
import { Star } from 'lucide-vue-next';
import MatchRow from './MatchRow.vue';

const props = defineProps({
  filter: String,
  activeFilter: {
    type: Object,
    default: () => ({ type: 'all', value: null })
  },
  selectedDate: Date
});

defineEmits(['select-match']);

const matches = ref([]);
const loading = ref(true);
const favorites = ref(JSON.parse(localStorage.getItem('favoriteLeagues') || '[]'));

const toggleFavorite = (leagueName) => {
  if (favorites.value.includes(leagueName)) {
    favorites.value = favorites.value.filter(l => l !== leagueName);
  } else {
    favorites.value.push(leagueName);
  }
  localStorage.setItem('favoriteLeagues', JSON.stringify(favorites.value));
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
    
    const response = await axios.get('/api/matches', { params });
    // Remove console.log in production
    // console.log('Matches loaded:', response.data.length); 
    matches.value = response.data;
  } catch (err) {
    console.error('Error fetching matches:', err);
  } finally {
    loading.value = false;
  }
};

const groupedMatches = computed(() => {
  let filtered = matches.value;
  if (props.filter === 'LIVE') filtered = filtered.filter(m => m.status === 'LIVE');
  if (props.filter === 'CONCLUSI') filtered = filtered.filter(m => m.status === 'FINISHED');
  if (props.filter === 'PROGRAMMATE') filtered = filtered.filter(m => m.status === 'SCHEDULED');

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
