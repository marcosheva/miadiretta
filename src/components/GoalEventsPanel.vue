<template>
  <div class="goals-panel">
    <div class="panel-header">
      <div class="header-left">
        <span class="pin-icon">📌</span>
        <span class="panel-title">Latest events</span>
      </div>
      <div class="header-center">
        <span class="filter-badge">goals+cards</span>
      </div>
      <div class="header-right">
        <span class="count-badge">{{ goals.length }}</span>
      </div>
    </div>
    
    <div class="events-list">
      <div
        v-if="goals.length === 0"
        class="no-goals"
      >
        Nessun gol recente
      </div>
      <div
        v-for="(goal, idx) in goals"
        :key="goal.goalId || idx"
        class="event-row"
        @click="handleClick(goal)"
      >
        <div class="league-badge" :style="{ backgroundColor: getLeagueColor(goal.league) }">
          {{ getLeagueAbbr(goal.league, goal.country) }}
        </div>
        
        <div class="event-time">{{ goal.minute || 'LIVE' }}</div>
        
        <div class="match-info">
          <span class="team-name" :class="{ 'scored': isScoringTeam(goal, 'home') }">
            {{ goal.homeTeam.name }}
          </span>
          <span class="score">{{ goal.homeTeam.score }} - {{ goal.awayTeam.score }}</span>
          <span class="team-name" :class="{ 'scored': isScoringTeam(goal, 'away') }">
            {{ goal.awayTeam.name }}
          </span>
        </div>
        
        <div class="event-icon">⚽</div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  goals: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['click']);

const handleClick = (goal) => {
  emit('click', goal);
};

const getLeagueAbbr = (league, country) => {
  if (!league && !country) return 'INT';
  const name = (league || country || '').toUpperCase();
  
  // Mappe comuni
  if (name.includes('PREMIER')) return 'ENG';
  if (name.includes('SERIE A') || name.includes('SERIA')) return 'ITA';
  if (name.includes('LA LIGA')) return 'ESP';
  if (name.includes('BUNDESLIGA')) return 'GER';
  if (name.includes('LIGUE')) return 'FRA';
  if (name.includes('UEFA')) return 'UEFA';
  
  // Prendi le prime 3 lettere del paese o lega
  if (country) return country.substring(0, 3).toUpperCase();
  return name.substring(0, 3);
};

const getLeagueColor = (league) => {
  if (!league) return '#4a90e2';
  const name = league.toUpperCase();
  
  if (name.includes('PREMIER')) return '#3d195b';
  if (name.includes('SERIE') || name.includes('SERIA')) return '#0068a8';
  if (name.includes('LA LIGA')) return '#ff6900';
  if (name.includes('BUNDESLIGA')) return '#d20000';
  if (name.includes('UEFA')) return '#0073e6';
  
  // Colore di default basato su hash
  const colors = ['#4a90e2', '#e74c3c', '#27ae60', '#f39c12', '#9b59b6', '#1abc9c'];
  let hash = 0;
  for (let i = 0; i < league.length; i++) {
    hash = league.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const isScoringTeam = (goal, side) => {
  if (!goal) return false;
  
  // Usa l'informazione salvata su quale squadra ha segnato
  if (goal.scoringTeam === side) return true;
  
  // Fallback: evidenzia la squadra che ha segnato in questo gol specifico
  return false;
};
</script>

<style scoped>
.goals-panel {
  width: 100%;
  height: 100%;
  max-height: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.panel-header {
  background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
  font-weight: 700;
  font-size: 0.9rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pin-icon {
  font-size: 1rem;
}

.panel-title {
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.filter-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.count-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  min-width: 30px;
  text-align: center;
}

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 1.2rem;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.events-list {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-dark);
  min-height: 0;
}

.no-goals {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.event-row {
  display: grid;
  grid-template-columns: 45px 45px 1fr 30px;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.2s;
}

.event-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.event-row:last-child {
  border-bottom: none;
}

.league-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  color: white;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.event-time {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  text-align: center;
  font-family: 'Outfit', sans-serif;
}

.match-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  overflow: hidden;
  flex: 1;
  min-width: 0;
}

.team-name {
  flex: 1;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.team-name.scored {
  color: var(--live);
  font-weight: 700;
}

.score {
  font-weight: 700;
  color: var(--primary);
  font-family: 'Outfit', sans-serif;
  min-width: 45px;
  text-align: center;
  flex-shrink: 0;
  font-size: 0.85rem;
}

.event-icon {
  font-size: 1.2rem;
  text-align: center;
}

</style>
