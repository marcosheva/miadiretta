<template>
  <div
    class="match-row animate-fade-in"
    :class="{ 'goal-highlight': highlight }"
    :style="{ gridTemplateColumns: match.odds ? '100px minmax(0, 1fr) 180px' : '100px minmax(0, 1fr)' }"
    @click="$emit('select', match)"
  >
    <div class="match-time-status">
      <span v-if="highlight" class="goal-badge">⚽</span>
      <div :class="['match-status', { live: match.status === 'LIVE' }]">
        <span v-if="match.status === 'LIVE'" class="live-minute">{{ match.minute }}</span>
        <span v-else-if="match.status === 'FINISHED'" class="finished-status">FIN</span>
        <span v-else class="scheduled-time">{{ formatTime(match.startTime) }}</span>
      </div>
    </div>

    <div class="match-main">
      <div class="team home">
        <span class="team-name" :class="{ winner: isWinner(match.homeTeam.score, match.awayTeam.score) }">
          {{ match.homeTeam.name }}
        </span>
      </div>
      
      <div class="score-container" v-if="match.status !== 'SCHEDULED'">
        <span class="score" :class="{ live: match.status === 'LIVE' }">{{ match.homeTeam.score }}</span>
        <span class="score-divider">-</span>
        <span class="score" :class="{ live: match.status === 'LIVE' }">{{ match.awayTeam.score }}</span>
      </div>
      <div class="score-container placeholder" v-else>
        <span class="vs-text">vs</span>
      </div>

      <div class="team away">
        <span class="team-name" :class="{ winner: isWinner(match.awayTeam.score, match.homeTeam.score) }">
          {{ match.awayTeam.name }}
        </span>
      </div>
    </div>
    
    <div class="match-odds" v-if="match.odds">
      <div class="odd-box">
        <span class="odd-label">1</span>
        <span class="odd-val">{{ match.odds.home || '-' }}</span>
      </div>
      <div class="odd-box" v-if="match.odds.draw">
        <span class="odd-label">X</span>
        <span class="odd-val">{{ match.odds.draw || '-' }}</span>
      </div>
      <div class="odd-box">
        <span class="odd-label">2</span>
        <span class="odd-val">{{ match.odds.away || '-' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  match: Object,
  // true quando c'è stato un gol recente su questo match
  highlight: {
    type: Boolean,
    default: false
  }
});

defineEmits(['select']);

const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return time;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Ieri ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return `Dom ${time}`;

  return `${date.getDate()}/${date.getMonth() + 1} ${time}`;
};

const isWinner = (s1, s2) => s1 > s2;
</script>

<style scoped>
.match-row {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr) 180px;
  align-items: center;
  background: var(--bg-card);
  padding: 10px 15px;
  border-bottom: 1px solid var(--border);
  transition: all 0.2s ease;
  cursor: pointer;
  width: 100%;
  min-width: 0;
}

/* Evidenziazione partita in cui si segna */
.goal-highlight {
  background: linear-gradient(
    135deg,
    rgba(0, 135, 78, 0.18) 0%,
    rgba(241, 196, 15, 0.08) 50%,
    rgba(0, 135, 78, 0.12) 100%
  );
  border-left: 3px solid var(--primary);
  border-right: 1px solid var(--border);
  border-top: 1px solid rgba(0, 135, 78, 0.4);
  border-bottom: 1px solid rgba(0, 135, 78, 0.3);
  box-shadow:
    0 0 20px rgba(0, 135, 78, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  animation: goalHighlightPulse 2s ease-in-out infinite;
}

.goal-highlight .score-container {
  background: rgba(0, 135, 78, 0.25);
  border-color: var(--primary);
  box-shadow: 0 0 12px rgba(0, 135, 78, 0.3);
}

.goal-highlight .score {
  color: var(--accent);
  text-shadow: 0 0 12px rgba(241, 196, 15, 0.4);
}

.goal-badge {
  font-size: 1rem;
  margin-right: 6px;
  filter: drop-shadow(0 0 6px rgba(241, 196, 15, 0.6));
  animation: goalBadgeBounce 0.5s ease-out;
}

@keyframes goalHighlightPulse {
  0%, 100% {
    box-shadow: 0 0 20px rgba(0, 135, 78, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  50% {
    box-shadow: 0 0 28px rgba(0, 135, 78, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
}

@keyframes goalBadgeBounce {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

.match-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.match-time-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: 'Outfit', sans-serif;
}

.match-status {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
}

.match-status.live .live-minute {
  color: var(--live);
  font-weight: 700;
}

.finished-status {
  color: var(--accent);
  font-size: 0.7rem;
}

.match-main {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 0 20px;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.team {
  flex: 1 1 0%;
  min-width: 0;
  overflow: hidden;
}

.team.home { text-align: right; }
.team.away { text-align: left; }

.team-name {
  display: block;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.team-name.winner {
  font-weight: 700;
  color: white;
}

.score-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 80px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.score {
  font-family: 'Outfit', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--primary);
}

.score.live {
  color: var(--live);
  text-shadow: 0 0 10px rgba(231, 76, 60, 0.3);
}

.score-divider {
  color: var(--text-muted);
  font-weight: 300;
}

.vs-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
}

.match-odds {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.odd-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--bg-dark);
  border: 1px solid var(--border);
  border-radius: 6px;
  min-width: 55px;
  padding: 4px;
  transition: border-color 0.2s;
}

.match-row:hover .odd-box {
  border-color: #444;
}

.odd-label {
  font-size: 0.6rem;
  color: var(--text-muted);
  font-weight: 600;
}

.odd-val {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent);
}

@media (max-width: 800px) {
  .match-row {
    grid-template-columns: 60px 1fr;
    grid-template-rows: auto auto;
    gap: 10px;
  }
  
  .match-odds {
    grid-column: 1 / -1;
    justify-content: center;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }
}

@media (max-width: 500px) {
  .match-main {
    flex-direction: column;
    gap: 5px;
  }
  .team.home { text-align: center; }
  .team.away { text-align: center; }
}
</style>
