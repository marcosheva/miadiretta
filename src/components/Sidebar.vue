<template>
  <div class="sidebar-container premium-card">
    <div class="section">
      <h3 class="section-title">I MIEI CAMPIONATI</h3>
      <ul class="flat-list">
        <li v-for="l in pinnedLeagues" :key="l.name" @click="selectLeague(l.name)">
          <img v-if="l.cc" :src="getFlag(l.cc)" class="flag" />
          <Globe v-else class="globe-icon" />
          <span class="league-name">{{ l.name }}</span>
          <Pin class="pin-icon" :class="{ active: l.pinned }" />
        </li>
      </ul>
    </div>

    <div class="section divider">
      <div class="section-header">
        <h3 class="section-title">LE MIE NAZIONI</h3>
        <button class="reset-btn" @click="resetFilter">Reset</button>
      </div>
      <div class="country-group" v-for="country in leagueGroups" :key="country._id">
        <div class="country-header" @click="toggleCountry(country._id)">
          <div class="country-info">
            <img :src="getFlag(country._id)" class="flag" />
            <span>{{ country._id }}</span>
          </div>
          <ChevronRight :class="{ rotate: expandedCountries.includes(country._id) }" class="chevron" />
        </div>
        <ul class="league-list" v-if="expandedCountries.includes(country._id)">
          <li v-for="league in country.leagues" :key="league.name" @click.stop="selectLeague(league.name)">
            <span>{{ league.name }}</span>
            <span class="count">{{ league.count }}</span>
          </li>
        </ul>
      </div>
    </div>
    
    <div class="section divider">
      <h3 class="section-title">SPORT</h3>
      <ul class="sport-list">
        <li v-for="s in sports" :key="s.name" :class="{ active: s.name === 'Calcio' }">
          <component :is="s.icon" class="sport-icon" />
          <span>{{ s.name }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Circle, Activity, Target, ChevronRight, Pin, Globe } from 'lucide-vue-next';
import axios from 'axios';

const leagueGroups = ref([]);
const expandedCountries = ref([]); 
const emit = defineEmits(['filter']);

const pinnedLeagues = [
  { name: 'Italy Serie A', cc: 'IT', pinned: true },
  { name: 'Italy Serie B', cc: 'IT', pinned: true },
  { name: 'Italy Coppa Italia', cc: 'IT', pinned: true },
  { name: 'England Premier League', cc: 'GB', pinned: true },
  { name: 'Spain La Liga', cc: 'ES', pinned: true },
  { name: 'Germany Bundesliga', cc: 'DE', pinned: true },
  { name: 'Champions League', cc: null, pinned: true },
  { name: 'Europa League', cc: null, pinned: true },
  { name: 'Conference League', cc: null, pinned: true },
];

const fetchLeagues = async () => {
  try {
    const res = await axios.get('http://localhost:3000/api/leagues');
    leagueGroups.value = res.data;
  } catch (err) {
    console.error('Error fetching leagues:', err);
  }
};

const toggleCountry = (country) => {
  if (expandedCountries.value.includes(country)) {
    expandedCountries.value = expandedCountries.value.filter(c => c !== country);
  } else {
    expandedCountries.value.push(country);
  }
};

const selectLeague = (leagueName) => {
  emit('filter', { type: 'league', value: leagueName });
};

const resetFilter = () => {
  emit('filter', { type: 'all', value: null });
};

const getFlag = (cc) => {
  if (!cc || cc === 'UN') return 'https://flagcdn.com/w20/un.png';
  return `https://flagcdn.com/w20/${cc.toLowerCase()}.png`;
};

const sports = [
  { name: 'Calcio', icon: Activity },
  { name: 'Tennis', icon: Target },
  { name: 'Basket', icon: Circle },
];

onMounted(fetchLeagues);
</script>

<style scoped>
.sidebar-container {
  padding: 12px;
  overflow-y: auto;
  background: white; /* Match the bright look of the image */
  color: #333;
}

.section {
  margin-bottom: 20px;
}

.section.divider {
  border-top: 1px solid #efefef;
  padding-top: 15px;
}

.section-title {
  font-size: 0.75rem;
  color: #888;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 12px;
  padding-left: 8px;
}

.flat-list, .league-list, .sport-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.flat-list li, .country-header, .league-list li, .sport-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
  color: #444;
}

.flat-list li:hover, .country-header:hover, .league-list li:hover {
  background: #f5f5f5;
}

.league-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.globe-icon {
  width: 18px;
  height: 18px;
  color: #3b5998; /* Blue globe like the image */
}

.pin-icon {
  width: 14px;
  height: 14px;
  color: #ccc;
  transition: color 0.2s;
}

.pin-icon.active {
  color: #2196F3; /* Bright blue pin which is active */
  fill: #2196F3;
}

.country-group {
  margin-bottom: 2px;
}

.country-header {
  font-weight: 600;
  color: #333;
}

.chevron {
  width: 14px;
  height: 14px;
  color: #aaa;
  transition: transform 0.2s;
}

.chevron.rotate {
  transform: rotate(90deg);
}

.league-list {
  margin-left: 30px;
  border-left: 1px solid #eee;
}

.league-list li {
  justify-content: space-between;
  padding: 5px 12px;
  font-size: 0.8rem;
  color: #555;
}

.count {
  font-size: 0.7rem;
  background: #eee;
  padding: 1px 6px;
  border-radius: 10px;
  color: #888;
}

.flag {
  width: 20px;
  height: 14px;
  object-fit: cover;
  border-radius: 2px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.sport-list li.active {
  background: #e7f3ef;
  color: #00874e;
  font-weight: 600;
}
</style>
