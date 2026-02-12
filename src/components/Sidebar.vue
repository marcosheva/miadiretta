<template>
  <div class="sidebar-container">
    <!-- Campionati preferiti -->
    <div class="section-favorites">
      <h3 class="section-title">
        <Star class="star-icon" :size="14" />
        Campionati preferiti
      </h3>
      <ul v-if="favoriteLeaguesWithFlags.length > 0" class="favorites-list">
        <li
          v-for="fav in favoriteLeaguesWithFlags"
          :key="fav.name"
          class="favorite-item"
          :class="{ active: activeFilter?.type === 'league' && activeFilter?.value === fav.name }"
          @click="selectLeague(fav.name)"
        >
          <img :src="getFlag(fav.cc)" class="favorite-flag" :alt="fav.cc" />
          <span class="favorite-name">{{ fav.name }}</span>
          <button
            class="unpin-btn"
            @click.stop="toggleFavorite(fav.name)"
            title="Rimuovi dai preferiti"
          >
            <Star :size="12" fill="currentColor" />
          </button>
        </li>
      </ul>
      <p v-else class="favorites-empty">
        Clicca la stella su un campionato per aggiungerlo qui
      </p>
    </div>

    <div class="sidebar-header">
      <span class="sidebar-title">Filtra per nazione</span>
      <button class="reset-btn" @click="resetFilter" title="Mostra tutti">
        Tutti
      </button>
    </div>

    <nav class="nav-nations">
      <div
        v-for="country in leagueGroups"
        :key="country._id"
        class="nation-block"
        :class="{ expanded: expandedCountries.includes(country._id) }"
      >
        <button
          class="nation-btn"
          @click="toggleCountry(country._id)"
        >
          <img :src="getFlag(country._id)" class="nation-flag" :alt="country._id" />
          <span class="nation-name">{{ getCountryName(country._id) }}</span>
          <span class="league-count">{{ country.leagues.length }}</span>
          <ChevronRight class="nation-chevron" />
        </button>
        <Transition name="expand">
          <ul v-show="expandedCountries.includes(country._id)" class="league-list">
            <li
              v-for="league in country.leagues"
              :key="league.name"
              class="league-item"
              :class="{ active: activeFilter?.type === 'league' && activeFilter?.value === league.name }"
              @click.stop="selectLeague(league.name)"
            >
              <img :src="getFlag(country._id)" class="league-flag" :alt="country._id" />
              <span class="league-name">{{ league.name }}</span>
              <span class="league-count-badge">{{ league.count }}</span>
              <button
                class="pin-btn"
                :class="{ active: isFavorite(league.name) }"
                @click.stop="toggleFavorite(league.name, country._id)"
                :title="isFavorite(league.name) ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'"
              >
                <Star :size="14" :fill="isFavorite(league.name) ? 'currentColor' : 'none'" />
              </button>
            </li>
          </ul>
        </Transition>
      </div>
    </nav>

    <div v-if="leagueGroups.length === 0 && !loading" class="empty-state">
      Nessun campionato disponibile
    </div>
    <div v-if="loading" class="loading-state">
      Caricamento…
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { ChevronRight, Star } from 'lucide-vue-next';
import API_URL from '../config/api';
import axios from 'axios';

const countryNames = {
  IT: 'Italia', ITALY: 'Italia',
  GB: 'Inghilterra', EN: 'Inghilterra', ENG: 'Inghilterra', ENGLAND: 'Inghilterra',
  SCO: 'Scozia', SC: 'Scozia', SCOTLAND: 'Scozia',
  ES: 'Spagna', SPAIN: 'Spagna',
  DE: 'Germania', GERMANY: 'Germania',
  FR: 'Francia', FRANCE: 'Francia',
  PT: 'Portogallo', PORTUGAL: 'Portogallo',
  NL: 'Olanda', NETHERLANDS: 'Olanda',
  BE: 'Belgio', BELGIUM: 'Belgio',
  TR: 'Turchia', TURKEY: 'Turchia',
  GR: 'Grecia', GREECE: 'Grecia',
  RU: 'Russia', RUSSIA: 'Russia',
  UA: 'Ucraina', UKRAINE: 'Ucraina',
  PL: 'Polonia', POLAND: 'Polonia',
  AT: 'Austria', AUSTRIA: 'Austria',
  CH: 'Svizzera', SWITZERLAND: 'Svizzera',
  BR: 'Brasile', BRAZIL: 'Brasile',
  AR: 'Argentina', ARGENTINA: 'Argentina',
  MX: 'Messico', MEXICO: 'Messico',
  US: 'USA', USA: 'USA', AMERICA: 'USA',
  DZ: 'Algeria', ALGERIA: 'Algeria',
  MA: 'Marocco', MOROCCO: 'Marocco',
  EG: 'Egitto', EGYPT: 'Egitto',
  ZA: 'Sudafrica', SOUTH: 'Sudafrica',
  INT: 'Internazionale', UEFA: 'UEFA', AFC: 'AFC',
  UN: 'Altri'
};

const getCountryName = (cc) => {
  if (!cc) return 'Altri';
  const code = cc.toString().toUpperCase();
  return countryNames[code] || code;
};

const STORAGE_KEY = 'favoriteLeagues';

const leagueGroups = ref([]);
const expandedCountries = ref([]);
const loading = ref(true);
const favorites = ref(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
const leagueToCountry = ref({});
const props = defineProps({
  activeFilter: { type: Object, default: () => ({ type: 'all', value: null }) },
});

const emit = defineEmits(['filter']);

const favoriteLeaguesWithFlags = computed(() => {
  return favorites.value
    .map((name) => ({ name, cc: leagueToCountry.value[name] || null }))
    .filter((f) => f.name);
});

const isFavorite = (leagueName) => favorites.value.includes(leagueName);

const toggleFavorite = (leagueName, cc = null) => {
  if (favorites.value.includes(leagueName)) {
    favorites.value = favorites.value.filter((l) => l !== leagueName);
  } else {
    favorites.value = [...favorites.value, leagueName];
    if (cc) leagueToCountry.value[leagueName] = cc;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites.value));
};

const fetchLeagues = async () => {
  loading.value = true;
  try {
    const res = await axios.get(`${API_URL}/api/leagues`);
    leagueGroups.value = Array.isArray(res.data) ? res.data : [];
    const map = {};
    leagueGroups.value.forEach((c) => {
      (c.leagues || []).forEach((l) => {
        map[l.name] = c._id;
      });
    });
    leagueToCountry.value = map;
    if (leagueGroups.value.length > 0 && expandedCountries.value.length === 0) {
      expandedCountries.value = [leagueGroups.value[0]._id];
    }
  } catch (err) {
    console.error('Error fetching leagues:', err);
    leagueGroups.value = [];
  } finally {
    loading.value = false;
  }
};

const toggleCountry = (country) => {
  if (expandedCountries.value.includes(country)) {
    expandedCountries.value = expandedCountries.value.filter((c) => c !== country);
  } else {
    expandedCountries.value = [...expandedCountries.value, country];
  }
};

const selectLeague = (leagueName) => {
  // Se clicchi di nuovo lo stesso campionato, deseleziona
  if (props.activeFilter?.type === 'league' && props.activeFilter?.value === leagueName) {
    emit('filter', { type: 'all', value: null });
    return;
  }
  emit('filter', { type: 'league', value: leagueName });
};

const resetFilter = () => {
  emit('filter', { type: 'all', value: null });
};

// Da codice/nome nazione (dal backend) a codice ISO a 2 lettere per flagcdn.com
const countryToIso2 = {
  IT: 'it', ITALY: 'it',
  GB: 'gb', EN: 'gb', ENG: 'gb', ENGLAND: 'gb', SCO: 'gb', SC: 'gb', SCOTLAND: 'gb', WAL: 'gb', WALES: 'gb',
  ES: 'es', SPAIN: 'es',
  DE: 'de', GERMANY: 'de',
  FR: 'fr', FRANCE: 'fr',
  PT: 'pt', PORTUGAL: 'pt',
  NL: 'nl', NETHERLANDS: 'nl',
  BE: 'be', BELGIUM: 'be',
  TR: 'tr', TURKEY: 'tr',
  GR: 'gr', GREECE: 'gr',
  RU: 'ru', RUSSIA: 'ru',
  UA: 'ua', UKRAINE: 'ua',
  PL: 'pl', POLAND: 'pl',
  AT: 'at', AUSTRIA: 'at',
  CH: 'ch', SWITZERLAND: 'ch',
  BR: 'br', BRAZIL: 'br',
  AR: 'ar', ARGENTINA: 'ar',
  MX: 'mx', MEXICO: 'mx',
  US: 'us', USA: 'us', AMERICA: 'us',
  DZ: 'dz', ALGERIA: 'dz',
  MA: 'ma', MOROCCO: 'ma',
  EG: 'eg', EGYPT: 'eg',
  ZA: 'za', SOUTH: 'za',
  SA: 'sa', SAUDI: 'sa',
  JP: 'jp', JAPAN: 'jp',
  KR: 'kr', KOREA: 'kr',
  CN: 'cn', CHINA: 'cn',
  IN: 'in', INDIA: 'in',
  AU: 'au', AUSTRALIA: 'au',
  HU: 'hu', HUNGARY: 'hu',
  RO: 'ro', ROMANIA: 'ro',
  CZ: 'cz', CZECH: 'cz',
  SE: 'se', SWEDEN: 'se',
  NO: 'no', NORWAY: 'no',
  DK: 'dk', DENMARK: 'dk',
  IE: 'ie', IRELAND: 'ie',
  INT: 'un', UEFA: 'eu', AFC: 'un', UN: 'un'
};

const normalizeCountryCode = (cc) => {
  if (!cc) return 'un';
  const code = cc.toString().toUpperCase().trim();
  if (countryToIso2[code]) return countryToIso2[code];
  if (code.length === 2) return code.toLowerCase();
  return 'un';
};

const getFlag = (cc) => {
  const code = normalizeCountryCode(cc);
  return `https://flagcdn.com/w40/${code}.png`;
};

onMounted(fetchLeagues);
</script>

<style scoped>
.sidebar-container {
  padding: 16px;
  overflow-y: auto;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text-main);
}

/* Campionati preferiti */
.section-favorites {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.star-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.favorites-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.favorite-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--glass);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.favorite-item:hover {
  background: rgba(0, 135, 78, 0.12);
  border-color: var(--border);
}

.favorite-item.active {
  background: rgba(0, 135, 78, 0.18);
  border-color: var(--primary);
  color: var(--primary);
}

.favorite-flag {
  width: 24px;
  height: 17px;
  object-fit: cover;
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.favorite-name {
  flex: 1;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unpin-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.unpin-btn:hover {
  background: rgba(241, 196, 15, 0.2);
  transform: scale(1.1);
}

.favorites-empty {
  font-size: 0.8rem;
  color: var(--text-muted);
  padding: 12px 0;
  margin: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.sidebar-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.reset-btn {
  background: var(--glass);
  border: 1px solid var(--border);
  color: var(--primary);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: rgba(0, 135, 78, 0.15);
  border-color: var(--primary);
}

.nav-nations {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nation-block {
  border-radius: 10px;
  overflow: hidden;
  background: var(--glass);
  border: 1px solid transparent;
  transition: all 0.2s;
}

.nation-block:hover {
  background: rgba(255, 255, 255, 0.06);
}

.nation-block.expanded {
  border-color: var(--border);
  background: rgba(0, 135, 78, 0.06);
}

.nation-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: none;
  border: none;
  color: var(--text-main);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s;
}

.nation-btn:hover {
  background: rgba(255, 255, 255, 0.03);
}

.nation-flag {
  width: 28px;
  height: 20px;
  object-fit: cover;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.nation-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.league-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--bg-dark);
  padding: 2px 8px;
  border-radius: 10px;
  min-width: 24px;
  text-align: center;
}

.nation-chevron {
  width: 18px;
  height: 18px;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform 0.25s ease;
}

.nation-block.expanded .nation-chevron {
  transform: rotate(90deg);
  color: var(--primary);
}

.league-list {
  list-style: none;
  padding: 0 0 8px 0;
  margin: 0;
  border-top: 1px solid var(--border);
}

.league-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 12px;
  font-size: 0.82rem;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 6px;
  margin: 2px 8px 0;
  min-height: 36px;
}

.pin-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.pin-btn:hover {
  color: var(--accent);
}

.pin-btn.active {
  color: var(--accent);
}

.league-item:hover {
  background: rgba(0, 135, 78, 0.12);
  color: var(--text-main);
}

.league-item.active {
  background: rgba(0, 135, 78, 0.18);
  color: var(--primary);
  font-weight: 600;
}

.league-flag {
  width: 20px;
  height: 14px;
  object-fit: cover;
  border-radius: 2px;
  flex-shrink: 0;
  opacity: 0.9;
}

.league-name {
  flex: 1;
  min-width: 0;
  line-height: 1.3;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.league-count-badge {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--primary);
  background: rgba(0, 135, 78, 0.2);
  padding: 2px 6px;
  border-radius: 6px;
}

.expand-enter-active,
.expand-leave-active {
  transition: opacity 0.2s ease;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
}

.empty-state,
.loading-state {
  text-align: center;
  padding: 24px 16px;
  font-size: 0.85rem;
  color: var(--text-muted);
}
</style>
