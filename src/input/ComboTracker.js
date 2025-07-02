/**
 * Combo Tracker System
 * Advanced combo detection and management system
 * Supports complex input sequences, timing windows, and pattern matching
 */
class ComboTracker {
  constructor(defaultTimeout = 500) {
    this.defaultTimeout = defaultTimeout;
    this.combos = new Map(); // Map<comboId, comboConfig>
    this.activeSequences = new Map(); // Map<sequenceId, sequenceState>
    this.debugMode = false;
    
    // Sequence tracking
    this.nextSequenceId = 1;
    this.completedCombos = [];
    this.comboHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Register a combo pattern
   * @param {string} comboId - Unique identifier for the combo
   * @param {Object} comboConfig - Combo configuration
   */
  registerCombo(comboId, comboConfig) {
    const normalizedCombo = this.normalizeComboConfig(comboConfig);
    this.combos.set(comboId, { id: comboId, ...normalizedCombo });
    
    if (this.debugMode) {
      console.log(`[ComboTracker] Registered combo: ${comboId}`, normalizedCombo);
    }
  }

  /**
   * Unregister a combo pattern
   * @param {string} comboId - Combo identifier to remove
   */
  unregisterCombo(comboId) {
    this.combos.delete(comboId);
    
    // Remove any active sequences for this combo
    for (const [sequenceId, sequence] of this.activeSequences) {
      if (sequence.comboId === comboId) {
        this.activeSequences.delete(sequenceId);
      }
    }
    
    if (this.debugMode) {
      console.log(`[ComboTracker] Unregistered combo: ${comboId}`);
    }
  }

  /**
   * Check for combo matches against input
   * @param {Object} inputData - Raw input data
   * @returns {Object|null} Matched combo information or null
   */
  checkForCombo(inputData) {
    // Update active sequences
    this.updateActiveSequences(inputData);
    
    // Start new sequences for relevant combos
    this.startNewSequences(inputData);
    
    // Check for completed combos
    const completedCombo = this.checkCompletedCombos();
    
    if (completedCombo) {
      this.recordComboCompletion(completedCombo);
      return completedCombo;
    }
    
    return null;
  }

  /**
   * Update active combo sequences with new input
   * @param {Object} inputData - Raw input data
   */
  updateActiveSequences(inputData) {
    const currentTime = performance.now();
    const sequencesToRemove = [];
    
    for (const [sequenceId, sequence] of this.activeSequences) {
      // Check if sequence has timed out
      if (currentTime - sequence.lastInputTime > sequence.timeout) {
        sequencesToRemove.push(sequenceId);
        continue;
      }
      
      // Check if input matches next expected step
      const nextStep = sequence.steps[sequence.currentStep];
      if (this.matchesComboStep(inputData, nextStep)) {
        sequence.currentStep++;
        sequence.lastInputTime = currentTime;
        sequence.inputs.push(inputData);
        
        if (this.debugMode) {
          console.log(`[ComboTracker] Sequence ${sequenceId} advanced to step ${sequence.currentStep}`);
        }
        
        // Mark as completed if all steps matched
        if (sequence.currentStep >= sequence.steps.length) {
          sequence.completed = true;
          sequence.completionTime = currentTime;
        }
      } else if (!nextStep.optional) {
        // If step is not optional and doesn't match, sequence fails
        sequencesToRemove.push(sequenceId);
      }
    }
    
    // Remove timed out or failed sequences
    for (const sequenceId of sequencesToRemove) {
      this.activeSequences.delete(sequenceId);
    }
  }

  /**
   * Start new combo sequences if input matches first step
   * @param {Object} inputData - Raw input data
   */
  startNewSequences(inputData) {
    for (const [comboId, combo] of this.combos) {
      // Skip if we already have an active sequence for this combo
      const hasActiveSequence = Array.from(this.activeSequences.values())
        .some(seq => seq.comboId === comboId && !seq.completed);
      
      if (hasActiveSequence && !combo.allowMultiple) {
        continue;
      }
      
      // Check if input matches first step
      const firstStep = combo.steps[0];
      if (this.matchesComboStep(inputData, firstStep)) {
        const sequenceId = this.nextSequenceId++;
        const sequence = {
          id: sequenceId,
          comboId,
          steps: combo.steps,
          currentStep: 1, // Already matched first step
          inputs: [inputData],
          startTime: performance.now(),
          lastInputTime: performance.now(),
          timeout: combo.timeout || this.defaultTimeout,
          completed: false,
          completionTime: null
        };
        
        this.activeSequences.set(sequenceId, sequence);
        
        if (this.debugMode) {
          console.log(`[ComboTracker] Started new sequence ${sequenceId} for combo ${comboId}`);
        }
        
        // Check if this was a single-step combo
        if (combo.steps.length === 1) {
          sequence.completed = true;
          sequence.completionTime = sequence.lastInputTime;
        }
      }
    }
  }

  /**
   * Check for completed combo sequences
   * @returns {Object|null} Completed combo information
   */
  checkCompletedCombos() {
    for (const [sequenceId, sequence] of this.activeSequences) {
      if (sequence.completed) {
        const combo = this.combos.get(sequence.comboId);
        const result = {
          comboId: sequence.comboId,
          name: combo.name || sequence.comboId,
          sequence: sequence,
          inputs: [...sequence.inputs],
          startTime: sequence.startTime,
          completionTime: sequence.completionTime,
          totalTime: sequence.completionTime - sequence.startTime,
          data: combo.data || {}
        };
        
        // Remove completed sequence
        this.activeSequences.delete(sequenceId);
        
        if (this.debugMode) {
          console.log(`[ComboTracker] Combo completed: ${sequence.comboId}`);
        }
        
        return result;
      }
    }
    
    return null;
  }

  /**
   * Check if input matches a combo step
   * @param {Object} inputData - Raw input data
   * @param {Object} step - Combo step configuration
   * @returns {boolean} Whether input matches step
   */
  matchesComboStep(inputData, step) {
    // Check basic properties
    if (step.key && inputData.key !== step.key) {
      return false;
    }
    
    if (step.type && inputData.type !== step.type) {
      return false;
    }
    
    if (step.deviceType && inputData.deviceType !== step.deviceType) {
      return false;
    }
    
    // Check modifiers
    if (step.modifiers) {
      const inputModifiers = inputData.modifiers || {};
      
      for (const [modifier, required] of Object.entries(step.modifiers)) {
        if (required && !inputModifiers[modifier]) {
          return false;
        }
        if (!required && inputModifiers[modifier]) {
          return false;
        }
      }
    }
    
    // Check value constraints
    if (step.minValue !== undefined && (inputData.value || 0) < step.minValue) {
      return false;
    }
    
    if (step.maxValue !== undefined && (inputData.value || 0) > step.maxValue) {
      return false;
    }
    
    // Check timing constraints
    if (step.minInterval !== undefined || step.maxInterval !== undefined) {
      // This would require tracking previous input timing
      // Implementation depends on specific requirements
    }
    
    return true;
  }

  /**
   * Normalize combo configuration
   * @param {Object} config - Raw combo configuration
   * @returns {Object} Normalized combo configuration
   */
  normalizeComboConfig(config) {
    const normalized = {
      name: config.name || '',
      steps: [],
      timeout: config.timeout || this.defaultTimeout,
      allowMultiple: config.allowMultiple || false,
      data: config.data || {}
    };
    
    // Normalize steps
    if (Array.isArray(config.steps)) {
      normalized.steps = config.steps.map(step => this.normalizeComboStep(step));
    } else if (config.pattern) {
      // Convert pattern string to steps
      normalized.steps = this.parseComboPattern(config.pattern);
    } else {
      throw new Error('Combo configuration must have either steps array or pattern string');
    }
    
    return normalized;
  }

  /**
   * Normalize a combo step
   * @param {Object|string} step - Raw step configuration
   * @returns {Object} Normalized step configuration
   */
  normalizeComboStep(step) {
    if (typeof step === 'string') {
      return this.parseStepString(step);
    }
    
    return {
      key: step.key || step.input,
      type: step.type || 'press',
      deviceType: step.deviceType || 'keyboard',
      modifiers: step.modifiers || {},
      optional: step.optional || false,
      minValue: step.minValue,
      maxValue: step.maxValue,
      minInterval: step.minInterval,
      maxInterval: step.maxInterval
    };
  }

  /**
   * Parse combo pattern string (e.g., "up up down down left right left right")
   * @param {string} pattern - Pattern string
   * @returns {Array<Object>} Array of step configurations
   */
  parseComboPattern(pattern) {
    const parts = pattern.split(/\s+/);
    return parts.map(part => this.parseStepString(part));
  }

  /**
   * Parse step string (e.g., "ctrl+a", "gamepad:button_a")
   * @param {string} stepString - Step string
   * @returns {Object} Step configuration
   */
  parseStepString(stepString) {
    const parts = stepString.split(':');
    let deviceType = 'keyboard';
    let inputPart = stepString;
    
    if (parts.length === 2) {
      deviceType = parts[0];
      inputPart = parts[1];
    }
    
    const keys = inputPart.split('+');
    const modifiers = {};
    let mainKey = '';
    
    for (const key of keys) {
      const normalizedKey = key.trim().toLowerCase();
      
      if (['ctrl', 'control', 'shift', 'alt', 'meta', 'cmd'].includes(normalizedKey)) {
        modifiers[normalizedKey === 'cmd' ? 'meta' : normalizedKey] = true;
      } else {
        mainKey = normalizedKey;
      }
    }
    
    return {
      key: mainKey,
      type: 'press',
      deviceType,
      modifiers,
      optional: false
    };
  }

  /**
   * Record combo completion for statistics
   * @param {Object} combo - Completed combo information
   */
  recordComboCompletion(combo) {
    this.completedCombos.push(combo);
    
    // Add to history with timestamp
    this.comboHistory.push({
      comboId: combo.comboId,
      name: combo.name,
      timestamp: combo.completionTime,
      totalTime: combo.totalTime
    });
    
    // Trim history if it gets too large
    if (this.comboHistory.length > this.maxHistorySize) {
      this.comboHistory.shift();
    }
  }

  /**
   * Get recently completed combos
   * @param {number} count - Number of recent combos to get
   * @returns {Array<Object>} Array of recent combo completions
   */
  getRecentCombos(count = 10) {
    return this.comboHistory.slice(-count);
  }

  /**
   * Get combo statistics
   * @returns {Object} Combo statistics
   */
  getStats() {
    const comboStats = {};
    
    for (const entry of this.comboHistory) {
      if (!comboStats[entry.comboId]) {
        comboStats[entry.comboId] = {
          name: entry.name,
          count: 0,
          totalTime: 0,
          averageTime: 0,
          fastestTime: Infinity,
          slowestTime: 0
        };
      }
      
      const stats = comboStats[entry.comboId];
      stats.count++;
      stats.totalTime += entry.totalTime;
      stats.averageTime = stats.totalTime / stats.count;
      stats.fastestTime = Math.min(stats.fastestTime, entry.totalTime);
      stats.slowestTime = Math.max(stats.slowestTime, entry.totalTime);
    }
    
    return {
      registeredCombos: this.combos.size,
      activeSequences: this.activeSequences.size,
      totalCompletions: this.comboHistory.length,
      comboStats
    };
  }

  /**
   * Update the combo tracker (called each frame)
   * @param {number} deltaTime - Time elapsed since last frame
   */
  update(deltaTime) {
    // Clean up timed out sequences
    const currentTime = performance.now();
    const sequencesToRemove = [];
    
    for (const [sequenceId, sequence] of this.activeSequences) {
      if (currentTime - sequence.lastInputTime > sequence.timeout) {
        sequencesToRemove.push(sequenceId);
      }
    }
    
    for (const sequenceId of sequencesToRemove) {
      this.activeSequences.delete(sequenceId);
    }
  }

  /**
   * Clear all active sequences
   */
  clearActiveSequences() {
    this.activeSequences.clear();
    
    if (this.debugMode) {
      console.log('[ComboTracker] Cleared all active sequences');
    }
  }

  /**
   * Clear combo history
   */
  clearHistory() {
    this.comboHistory.length = 0;
    this.completedCombos.length = 0;
    
    if (this.debugMode) {
      console.log('[ComboTracker] Cleared combo history');
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
    const activeSequenceInfo = Array.from(this.activeSequences.values()).map(seq => ({
      id: seq.id,
      comboId: seq.comboId,
      currentStep: seq.currentStep,
      totalSteps: seq.steps.length,
      timeActive: performance.now() - seq.startTime,
      completed: seq.completed
    }));
    
    return {
      ...this.getStats(),
      activeSequenceInfo,
      recentCombos: this.getRecentCombos(5)
    };
  }
}

export default ComboTracker;
