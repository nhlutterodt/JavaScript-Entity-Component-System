/**
 * KeyBuffer
 * Circular buffer for recent input events, used for combo detection and input analysis.
 * Tracks pressed keys, supports pattern/sequence matching, and provides buffer statistics.
 * Used by input systems to analyze recent input history.
 */

/**
 * Key Buffer System
 * Maintains a circular buffer of recent input events for combo detection
 * and input analysis
 */
class KeyBuffer {
  constructor(size = -1) {
    // Validate buffer size - negative values should be treated as unlimited
    this.bufferSize = size < 0 ? -1 : size; // -1 = unlimited, 0 = no storage
    this.buffer = new Array(size < 0 ? 0 : size);
    this.writeIndex = 0;
    this.count = 0;
    this.debugMode = false;
    
    // Set to track currently pressed keys (for the simple API)
    this.pressedKeys = new Set();
    // Array to track insertion order for FIFO behavior
    this.keyOrder = [];
    
    // Initialize buffer with null values
    if (size > 0) {
      this.buffer.fill(null);
    }
  }

  /**
   * Add an input event to the buffer
   * @param {Object} inputData - Raw input data
   */
  addInput(inputData) {
    const bufferedInput = {
      ...inputData,
      bufferTimestamp: performance.now(),
      bufferIndex: this.writeIndex
    };
    
    this.buffer[this.writeIndex] = bufferedInput;
    this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    
    if (this.count < this.bufferSize) {
      this.count++;
    }
    
    if (this.debugMode) {
      console.log(`[KeyBuffer] Added input: ${inputData.key || inputData.input} (${inputData.type})`);
    }
  }

  /**
   * Get the most recent input events
   * @param {number} count - Number of recent events to get (default: all)
   * @param {string} eventType - Filter by event type (optional)
   * @returns {Array<Object>} Array of recent input events
   */
  getRecentInputs(count = this.count, eventType = null) {
    const results = [];
    const maxCount = Math.min(count, this.count);
    
    for (let i = 0; i < maxCount; i++) {
      const index = (this.writeIndex - 1 - i + this.bufferSize) % this.bufferSize;
      const input = this.buffer[index];
      
      if (input && (!eventType || input.type === eventType)) {
        results.push(input);
      }
    }
    
    return results;
  }

  /**
   * Get input events within a time window
   * @param {number} timeWindow - Time window in milliseconds
   * @param {string} eventType - Filter by event type (optional)
   * @returns {Array<Object>} Array of input events within time window
   */
  getInputsInTimeWindow(timeWindow, eventType = null) {
    const results = [];
    const currentTime = performance.now();
    const cutoffTime = currentTime - timeWindow;
    
    for (let i = 0; i < this.count; i++) {
      const index = (this.writeIndex - 1 - i + this.bufferSize) % this.bufferSize;
      const input = this.buffer[index];
      
      if (!input) continue;
      
      // Stop if we've gone past the time window
      if (input.bufferTimestamp < cutoffTime) {
        break;
      }
      
      if (!eventType || input.type === eventType) {
        results.push(input);
      }
    }
    
    return results.reverse(); // Return in chronological order
  }

  /**
   * Search for a sequence of inputs (combo pattern)
   * @param {Array<Object>} pattern - Array of input patterns to match
   * @param {number} timeWindow - Maximum time window for the sequence (ms)
   * @param {boolean} exactMatch - Whether to require exact matching (default: false)
   * @returns {Object|null} Match information or null if not found
   */
  findSequencePattern(pattern, timeWindow = 1000, exactMatch = false) {
    if (pattern.length === 0 || this.count === 0) {
      return null;
    }
    
    const recentInputs = this.getInputsInTimeWindow(timeWindow);
    
    if (recentInputs.length < pattern.length) {
      return null;
    }
    
    // Search for the pattern in recent inputs
    for (let startIndex = 0; startIndex <= recentInputs.length - pattern.length; startIndex++) {
      const match = this.matchSequenceAtIndex(recentInputs, pattern, startIndex, exactMatch);
      
      if (match) {
        return {
          matched: true,
          startIndex,
          endIndex: startIndex + pattern.length - 1,
          matchedInputs: recentInputs.slice(startIndex, startIndex + pattern.length),
          timeTaken: recentInputs[startIndex + pattern.length - 1].bufferTimestamp - recentInputs[startIndex].bufferTimestamp,
          pattern
        };
      }
    }
    
    return null;
  }

  /**
   * Check if a sequence matches at a specific index
   * @param {Array<Object>} inputs - Input array to search in
   * @param {Array<Object>} pattern - Pattern to match
   * @param {number} startIndex - Starting index
   * @param {boolean} exactMatch - Whether to require exact matching
   * @returns {boolean} Whether the pattern matches
   */
  matchSequenceAtIndex(inputs, pattern, startIndex, exactMatch) {
    for (let i = 0; i < pattern.length; i++) {
      const input = inputs[startIndex + i];
      const patternItem = pattern[i];
      
      if (!this.matchInputPattern(input, patternItem, exactMatch)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if an input matches a pattern
   * @param {Object} input - Input to check
   * @param {Object} pattern - Pattern to match against
   * @param {boolean} exactMatch - Whether to require exact matching
   * @returns {boolean} Whether the input matches the pattern
   */
  matchInputPattern(input, pattern, exactMatch) {
    // Check basic properties
    if (pattern.key && input.key !== pattern.key) {
      return false;
    }
    
    if (pattern.type && input.type !== pattern.type) {
      return false;
    }
    
    if (pattern.deviceType && input.deviceType !== pattern.deviceType) {
      return false;
    }
    
    // Check modifiers if specified
    if (pattern.modifiers && exactMatch) {
      const inputModifiers = input.modifiers || {};
      const patternModifiers = pattern.modifiers || {};
      
      // Exact match requires all modifiers to match exactly
      for (const [modifier, required] of Object.entries(patternModifiers)) {
        if (Boolean(inputModifiers[modifier]) !== Boolean(required)) {
          return false;
        }
      }
    } else if (pattern.modifiers) {
      // Partial match only requires specified modifiers to be present
      const inputModifiers = input.modifiers || {};
      const patternModifiers = pattern.modifiers || {};
      
      for (const [modifier, required] of Object.entries(patternModifiers)) {
        if (required && !inputModifiers[modifier]) {
          return false;
        }
      }
    }
    
    // Check value constraints
    if (pattern.minValue !== undefined && (input.value || 0) < pattern.minValue) {
      return false;
    }
    
    if (pattern.maxValue !== undefined && (input.value || 0) > pattern.maxValue) {
      return false;
    }
    
    return true;
  }

  /**
   * Check for common input patterns
   * @param {string} patternType - Type of pattern to check
   * @param {Object} options - Pattern-specific options
   * @returns {Object|null} Pattern match result
   */
  checkCommonPattern(patternType, options = {}) {
    const timeWindow = options.timeWindow || 1000;
    
    switch (patternType) {
      case 'double_tap':
        return this.checkDoubleTap(options.key, timeWindow);
        
      case 'hold_and_press':
        return this.checkHoldAndPress(options.holdKey, options.pressKey, timeWindow);
        
      case 'rapid_fire':
        return this.checkRapidFire(options.key, options.minCount || 3, timeWindow);
        
      case 'directional_sequence':
        return this.checkDirectionalSequence(options.directions, timeWindow);
        
      default:
        console.warn(`[KeyBuffer] Unknown pattern type: ${patternType}`);
        return null;
    }
  }

  /**
   * Check for double tap pattern
   * @param {string} key - Key to check for double tap
   * @param {number} timeWindow - Time window for double tap
   * @returns {Object|null} Double tap match result
   */
  checkDoubleTap(key, timeWindow) {
    const pattern = [
      { key, type: 'press' },
      { key, type: 'release' },
      { key, type: 'press' }
    ];
    
    return this.findSequencePattern(pattern, timeWindow);
  }

  /**
   * Check for hold and press pattern (e.g., hold shift and press A)
   * @param {string} holdKey - Key that should be held
   * @param {string} pressKey - Key that should be pressed while holding
   * @param {number} timeWindow - Time window to check
   * @returns {Object|null} Pattern match result
   */
  checkHoldAndPress(holdKey, pressKey, timeWindow) {
    const recentInputs = this.getInputsInTimeWindow(timeWindow);
    
    // Look for hold key press followed by press key press, with hold key still held
    let holdKeyPressed = false;
    let foundPattern = false;
    
    for (const input of recentInputs) {
      if (input.key === holdKey && input.type === 'press') {
        holdKeyPressed = true;
      } else if (input.key === holdKey && input.type === 'release') {
        holdKeyPressed = false;
      } else if (input.key === pressKey && input.type === 'press' && holdKeyPressed) {
        foundPattern = true;
        break;
      }
    }
    
    return foundPattern ? { matched: true, pattern: 'hold_and_press', holdKey, pressKey } : null;
  }

  /**
   * Check for rapid fire pattern (multiple quick presses of same key)
   * @param {string} key - Key to check
   * @param {number} minCount - Minimum number of presses
   * @param {number} timeWindow - Time window to check
   * @returns {Object|null} Pattern match result
   */
  checkRapidFire(key, minCount, timeWindow) {
    const pressInputs = this.getInputsInTimeWindow(timeWindow, 'press').filter(input => input.key === key);
    
    if (pressInputs.length >= minCount) {
      return {
        matched: true,
        pattern: 'rapid_fire',
        key,
        count: pressInputs.length,
        timeWindow: pressInputs[pressInputs.length - 1].bufferTimestamp - pressInputs[0].bufferTimestamp
      };
    }
    
    return null;
  }

  /**
   * Check for directional sequence (e.g., up, up, down, down, left, right, left, right)
   * @param {Array<string>} directions - Array of direction keys
   * @param {number} timeWindow - Time window to check
   * @returns {Object|null} Pattern match result
   */
  checkDirectionalSequence(directions, timeWindow) {
    const pattern = directions.map(direction => ({ key: direction, type: 'press' }));
    return this.findSequencePattern(pattern, timeWindow);
  }

  /**
   * Get statistics about the buffer
   * @returns {Object} Buffer statistics
   */
  getStats() {
    const deviceCounts = {};
    const typeCounts = {};
    const keyCounts = {};
    
    for (let i = 0; i < this.count; i++) {
      const index = (this.writeIndex - 1 - i + this.bufferSize) % this.bufferSize;
      const input = this.buffer[index];
      
      if (input) {
        deviceCounts[input.deviceType] = (deviceCounts[input.deviceType] || 0) + 1;
        typeCounts[input.type] = (typeCounts[input.type] || 0) + 1;
        keyCounts[input.key] = (keyCounts[input.key] || 0) + 1;
      }
    }
    
    return {
      bufferSize: this.bufferSize,
      currentCount: this.count,
      utilizationPercent: Math.round((this.count / this.bufferSize) * 100),
      deviceCounts,
      typeCounts,
      keyCounts
    };
  }

  /**
   * Clear the buffer
   */
  clear() {
    this.buffer.fill(null);
    this.writeIndex = 0;
    this.count = 0;
    
    if (this.debugMode) {
      console.log('[KeyBuffer] Buffer cleared');
    }
  }

  /**
   * Update the buffer (called each frame)
   * @param {number} deltaTime - Time elapsed since last frame
   */
  update(deltaTime) {
    // Could be used for time-based cleanup or analysis
    // Currently no per-frame processing needed
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
      ...this.getStats(),
      recentInputs: this.getRecentInputs(5).map(input => ({
        key: input.key,
        type: input.type,
        device: input.deviceType,
        timestamp: input.bufferTimestamp
      }))
    };
  }

  /**
   * Get number of pressed keys
   */
  size() {
    return this.pressedKeys.size;
  }

  /**
   * Add a key press to the buffer and pressed set
   * @param {*} key
   */
  add(key) {
    // No storage when bufferSize is zero
    if (this.bufferSize === 0) return;
    this.pressedKeys.add(key);
    this.keyOrder.push(key);
    // Enforce buffer size limit
    if (this.bufferSize > 0 && this.pressedKeys.size > this.bufferSize) {
      const oldest = this.keyOrder.shift();
      this.pressedKeys.delete(oldest);
    }
  }

  /**
   * Check if a key is currently pressed
   */
  isPressed(key) {
    return this.pressedKeys.has(key);
  }

  /**
   * Remove a key from the pressed set
   * @returns {boolean}
   */
  remove(key) {
    if (this.pressedKeys.has(key)) {
      this.pressedKeys.delete(key);
      this.keyOrder = this.keyOrder.filter(k => k !== key);
      return true;
    }
    return false;
  }

  /**
   * Clear all pressed keys
   */
  clear() {
    this.pressedKeys.clear();
    this.keyOrder = [];
  }

  /**
   * Check if all keys in an array are pressed
   */
  arePressed(keys) {
    if (!Array.isArray(keys)) return false;
    return keys.every(k => this.pressedKeys.has(k));
  }

  /**
   * Check if any key in an array is pressed
   */
  isAnyPressed(keys) {
    if (!Array.isArray(keys) || keys.length === 0) return false;
    return keys.some(k => this.pressedKeys.has(k));
  }

  /**
   * Get list of all pressed keys
   */
  getPressed() {
    return Array.from(this.pressedKeys);
  }
}

export default KeyBuffer;
