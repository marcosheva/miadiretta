<template>
  <div class="schedina-cart" :class="{ enlarged }">
    <div class="cart-header">
      <span class="cart-title">La tua schedina</span>
      <span v-if="selections.length > 0" class="cart-count">{{ selections.length }}</span>
    </div>

    <div v-if="selections.length === 0" class="cart-empty">
      <p>Clicca su una quota (1, X, 2) accanto a una partita per aggiungerla alla schedina.</p>
    </div>

    <ul v-else class="cart-list">
      <li
        v-for="item in selections"
        :key="item.id"
        class="cart-item"
      >
        <div class="item-match">
          <span class="item-teams">{{ item.homeName }} - {{ item.awayName }}</span>
          <span class="item-pick">{{ item.outcomeLabel }} @ {{ formatOdd(item.odd) }}</span>
        </div>
        <button
          type="button"
          class="item-remove"
          title="Rimuovi"
          @click="$emit('remove', item.id)"
        >
          <X :size="14" />
        </button>
      </li>
    </ul>

    <div v-if="selections.length > 0" class="cart-footer">
      <div class="cart-total">
        <span class="total-label">Totale quote</span>
        <span class="total-val">{{ formatOdd(totalOdds) }}</span>
      </div>
      <div class="cart-stake">
        <label class="stake-label" for="stake-input">Importo da giocare (€)</label>
        <input
          id="stake-input"
          v-model.number="stake"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          class="stake-input"
        />
      </div>
      <div v-if="stake > 0 && totalOdds > 0" class="cart-payout">
        <span class="payout-label">Vincita potenziale</span>
        <span class="payout-val">{{ formatMoney(potentialWin) }}</span>
      </div>
      <div class="cart-actions">
        <button type="button" class="btn-action btn-cancella" @click="$emit('cancel'); $emit('clear')">
          Cancella
        </button>
        <button type="button" class="btn-action btn-prenota" @click="$emit('prenota')">
          Prenota
        </button>
        <button type="button" class="btn-action btn-gioca" @click="$emit('gioca')">
          Gioca
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { X } from 'lucide-vue-next';

const props = defineProps({
  selections: { type: Array, default: () => [] },
  totalOdds: { type: Number, default: 0 },
  enlarged: { type: Boolean, default: false }
});

defineEmits(['remove', 'clear', 'cancel', 'prenota', 'gioca']);

const stake = ref(0);

const potentialWin = computed(() => {
  const s = Number(stake.value);
  if (s <= 0 || !props.totalOdds) return 0;
  return s * props.totalOdds;
});

function formatOdd(val) {
  if (val == null || Number.isNaN(val)) return '–';
  return Number(val).toFixed(2);
}

function formatMoney(val) {
  if (val == null || Number.isNaN(val)) return '–';
  return `€ ${Number(val).toFixed(2)}`;
}
</script>

<style scoped>
.schedina-cart {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 320px;
  transition: max-height 0.25s ease;
}

.schedina-cart.enlarged {
  max-height: 75vh;
}

.cart-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-dark);
}

.cart-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-main);
}

.cart-count {
  background: var(--accent);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
}

.cart-empty {
  padding: 20px 14px;
  color: var(--text-muted);
  font-size: 0.85rem;
  line-height: 1.4;
}

.cart-list {
  list-style: none;
  margin: 0;
  padding: 8px 0;
  overflow-y: auto;
  flex: 1;
}

.cart-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}

.cart-item:last-child {
  border-bottom: none;
}

.cart-item:hover {
  background: var(--glass);
}

.item-match {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-teams {
  font-size: 0.8rem;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-pick {
  font-size: 0.75rem;
  color: var(--accent);
  font-weight: 700;
}

.item-remove {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.item-remove:hover {
  background: rgba(220, 53, 69, 0.2);
  color: #dc3545;
}

.cart-footer {
  padding: 12px 14px;
  border-top: 1px solid var(--border);
  background: var(--bg-dark);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cart-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.total-label {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.total-val {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--accent);
}

.cart-stake {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stake-label {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.stake-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-main);
  font-size: 1rem;
  font-weight: 600;
}

.stake-input:focus {
  outline: none;
  border-color: var(--accent);
}

.stake-input::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.cart-payout {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-top: 1px dashed var(--border);
}

.payout-label {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.payout-val {
  font-size: 1.15rem;
  font-weight: 800;
  color: #22c55e;
}

.cart-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.btn-action {
  flex: 1;
  padding: 10px 8px;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.2s, transform 0.1s;
}

.btn-action:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.btn-action:active {
  transform: translateY(0);
}

.btn-cancella {
  background: #dc3545;
  color: #fff;
}

.btn-prenota {
  background: #fd7e14;
  color: #fff;
}

.btn-gioca {
  background: #22c55e;
  color: #fff;
}
</style>
