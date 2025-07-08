/**
 * ComboTracker
 * Detects and manages complex input combos (sequences, patterns, timing) for input systems.
 * Supports registration, normalization, and matching of combo patterns.
 * Tracks active/completed combos, provides statistics, and debug info.
 */

/**
 * Combo Tracker System
 * Advanced combo detection and management system
 * Supports complex input sequences, timing windows, and pattern matching
 */
class ComboTracker {
  constructor(eventManager, options = {}) {
    this.eventManager = eventManager;
    this.defaultTimeout = (options.timeout != null) ? options.timeout : 500;
    this.maxSequenceLength = options.maxSequenceLength || Infinity;
    this.combos = new Map(); // Map<comboId, comboConfig>
    this.buffer = [];
    this.clearTimer = null;
    this.debugMode = false;
  }

  /**
   * Register a combo pattern
   * @param {string} comboId - Unique identifier for the combo
   * @param {Array|string} steps - Array of keys or step config, or string pattern
   * @param {Function} callback - Optional callback on combo
   */
  registerCombo(comboId, steps, callback) {
    let seq = [];
    if (Array.isArray(steps) && steps.length) {
      seq = steps.map(s => typeof s === 'string' ? s : s.key);
    }
    this.combos.set(comboId, { sequence: seq, callback });
   
    if (this.debugMode) {
      console.log(`[ComboTracker] Registered combo: ${comboId}`);
    }
  }

  /**
   * Unregister a combo pattern
   * @param {string} comboId - Combo identifier to remove
   */
  unregisterCombo(comboId) {
    return this.combos.delete(comboId);
  }

  /** Clear buffer and timers */
  cleanup() {
    this.buffer = [];
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
  }

  /**
   * Process an input key or event
   * @param {string|Object} input
   */
  processInput(input) {
    // Add input to buffer
    const key = (input && (typeof input === 'string' ? input : input.key)) || input;
    this.buffer.push(key);
    // enforce max length
    while (this.buffer.length > this.maxSequenceLength) this.buffer.shift();
    // clear previous timeout and schedule purge
    if (this.clearTimer) clearTimeout(this.clearTimer);
    this.clearTimer = setTimeout(() => { this.buffer = []; }, this.defaultTimeout);
    // check combos
    const now = Date.now();
    // Iterate in reverse insertion order to prefer newest registrations on overlap
    const entries = Array.from(this.combos.entries()).reverse();
    for (const [comboId, { sequence, callback }] of entries) {
      const len = sequence.length;
      if (len && this.buffer.length >= len) {
        const last = this.buffer.slice(-len);
        if (sequence.every((k,i) => k === last[i])) {
          const data = { name: comboId, sequence: [...last], timestamp: now };
          this.eventManager?.emit('input:combo', { data });
          if (typeof callback === 'function') {
            try { callback(data); } catch (_) {}
          }
          break;
        }
      }
    }
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  /**
   * Get debug information
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      registeredCombos: this.combos.size,
      buffer: [...this.buffer],
    };
  }
}

export default ComboTracker;
