<template>
  <Transition name="slide-down">
    <div
      v-if="visible && match"
      class="goal-notification"
      :style="notificationStyle"
      @click="handleClick"
    >
      <div class="goal-badge">⚽ GOL!</div>
      <div class="match-info">
        <div class="teams">
          <span class="team-name">{{ match.homeTeam.name }}</span>
          <span class="score">{{ match.homeTeam.score }} - {{ match.awayTeam.score }}</span>
          <span class="team-name">{{ match.awayTeam.name }}</span>
        </div>
      <div class="match-meta">
        <span class="league">{{ match.league }}</span>
        <span v-if="match.minute" class="minute">{{ match.minute }}</span>
        <span v-if="match.goalTimestamp" class="time-ago">{{ getTimeAgo(match.goalTimestamp) }}</span>
      </div>
      </div>
      <button class="close-btn" @click.stop="close">×</button>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, computed } from 'vue';

const props = defineProps({
  match: {
    type: Object,
    default: null
  },
  // indice per impilare più notifiche (0 = in alto)
  offset: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['close', 'click']);

const visible = ref(false);
const notificationStyle = computed(() => {
  const baseTop = 20;
  const step = 70; // distanza verticale tra notifiche (ridotta per farne stare di più)
  return {
    top: `${baseTop + props.offset * step}px`,
    zIndex: 10000 - props.offset // le più recenti sopra
  };
});

watch(() => props.match, (newMatch) => {
  if (newMatch) {
    visible.value = true;
    // Auto-close dopo 12 secondi (più tempo per vedere tutte le notifiche)
    setTimeout(() => {
      visible.value = false;
      setTimeout(() => emit('close'), 300); // Aspetta la fine dell'animazione
    }, 12000);
  }
}, { immediate: true });

const close = () => {
  visible.value = false;
  setTimeout(() => emit('close'), 300);
};

const handleClick = () => {
  emit('click', props.match);
};
</script>

<style scoped>
.goal-notification {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  background: linear-gradient(135deg, rgba(231, 76, 60, 0.95) 0%, rgba(192, 57, 43, 0.95) 100%);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  padding: 12px 16px;
  min-width: 300px;
  max-width: 480px;
  box-shadow: 0 8px 32px rgba(231, 76, 60, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 12px;
  animation: pulse 2s ease-in-out infinite;
  font-size: 0.9rem;
}

.goal-notification:hover {
  transform: translateX(-50%) scale(1.02);
  box-shadow: 0 12px 40px rgba(231, 76, 60, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2);
}

.goal-badge {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
  font-weight: 900;
  font-size: 1.1rem;
  color: white;
  white-space: nowrap;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  animation: bounce 0.6s ease-in-out;
}

.match-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.teams {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  color: white;
  font-size: 0.95rem;
}

.team-name {
  flex: 1;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.score {
  font-size: 1.2rem;
  font-weight: 900;
  color: #ffd700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  min-width: 60px;
  text-align: center;
}

.match-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.9);
}

.league {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.minute {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 700;
  color: #ffd700;
}

.time-ago {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
}

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 1.5rem;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.slide-down-enter-active {
  transition: all 0.3s ease-out;
}

.slide-down-leave-active {
  transition: all 0.3s ease-in;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-100%);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-100%);
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 8px 32px rgba(231, 76, 60, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
  }
  50% {
    box-shadow: 0 8px 32px rgba(231, 76, 60, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.2);
  }
}

@keyframes bounce {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

@media (max-width: 600px) {
  .goal-notification {
    left: 10px;
    right: 10px;
    transform: none;
    min-width: auto;
  }

  .goal-notification:hover {
    transform: scale(1.02);
  }

  .slide-down-enter-from {
    transform: translateY(-100%);
  }

  .slide-down-leave-to {
    transform: translateY(-100%);
  }

  .teams {
    font-size: 0.85rem;
  }

  .score {
    font-size: 1rem;
  }
}
</style>
