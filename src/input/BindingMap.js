/**
 * BindingMap
 * Maps raw input events to high-level actions based on context.
 * Supports multi-key combinations, modifiers, context switching, and binding normalization.
 * Used by input systems for flexible action mapping.
 */
class BindingMap {
  constructor() {
    this.bindings = new Map(); // Map<context, Map<bindingKey, actionConfig>>
    this.activeContext = 'default';
    this.debugMode = false;
    
    // Binding cache for performance optimization
    this.bindingCache = new Map();
    this.cacheVersion = 0;
    
    // Initialize with default context
    this.bindings.set('default', new Map());
  }

  /**
   * Load bindings configuration
   * @param {Object} bindingsConfig - Bindings configuration object
   */
  loadBindings(bindingsConfig) {
    this.bindings.clear();
    this.clearCache();
    
    for (const [contextName, contextBindings] of Object.entries(bindingsConfig)) {
      const contextMap = new Map();
      
      for (const [actionName, bindings] of Object.entries(contextBindings)) {
        // bindings can be a single binding or array of bindings
        const bindingArray = Array.isArray(bindings) ? bindings : [bindings];
        
        for (const binding of bindingArray) {
          this.addBinding(contextName, actionName, binding, false);
        }
      }
    }
    
    if (this.debugMode) {
      console.log('[BindingMap] Loaded bindings for contexts:', Array.from(this.bindings.keys()));
    }
  }

  /**
   * Add a binding for an action in a specific context
   * @param {string} context - Context name
   * @param {string} actionName - Action name
   * @param {Object|string} binding - Binding configuration
   * @param {boolean} updateCache - Whether to update cache (default: true)
   */
  addBinding(context, actionName, binding, updateCache = true) {
    if (!this.bindings.has(context)) {
      this.bindings.set(context, new Map());
    }
    
    const contextMap = this.bindings.get(context);
    const bindingConfig = this.normalizeBinding(binding);
    const bindingKey = this.generateBindingKey(bindingConfig);
    
    if (!contextMap.has(bindingKey)) {
      contextMap.set(bindingKey, []);
    }
    
    const actionConfig = {
      actionName,
      ...bindingConfig
    };
    
    contextMap.get(bindingKey).push(actionConfig);
    
    if (updateCache) {
      this.clearCache();
    }
    
    if (this.debugMode) {
      console.log(`[BindingMap] Added binding: ${context}:${bindingKey} -> ${actionName}`);
    }
  }

  /**
   * Remove a binding
   * @param {string} context - Context name
   * @param {string} actionName - Action name
   * @param {Object|string} binding - Binding configuration (optional)
   */
  removeBinding(context, actionName, binding = null) {
    const contextMap = this.bindings.get(context);
    if (!contextMap) return;
    
    if (binding) {
      // Remove specific binding
      const bindingConfig = this.normalizeBinding(binding);
      const bindingKey = this.generateBindingKey(bindingConfig);
      const actions = contextMap.get(bindingKey);
      
      if (actions) {
        const index = actions.findIndex(action => action.actionName === actionName);
        if (index !== -1) {
          actions.splice(index, 1);
          if (actions.length === 0) {
            contextMap.delete(bindingKey);
          }
        }
      }
    } else {
      // Remove all bindings for this action
      for (const [bindingKey, actions] of contextMap) {
        const filteredActions = actions.filter(action => action.actionName !== actionName);
        if (filteredActions.length === 0) {
          contextMap.delete(bindingKey);
        } else {
          contextMap.set(bindingKey, filteredActions);
        }
      }
    }
    
    this.clearCache();
    
    if (this.debugMode) {
      console.log(`[BindingMap] Removed binding: ${context} -> ${actionName}`);
    }
  }

  /**
   * Map input to actions based on current context
   * @param {Object} inputData - Raw input data
   * @param {string} context - Context to check (optional, uses active context)
   * @returns {Array<Object>} Array of matched actions
   */
  mapInputToActions(inputData, context = null) {
    const targetContext = context || this.activeContext;
    const cacheKey = this.generateCacheKey(inputData, targetContext);
    
    // Check cache first
    if (this.bindingCache.has(cacheKey)) {
      return this.bindingCache.get(cacheKey);
    }
    
    const actions = [];
    const contextMap = this.bindings.get(targetContext);
    
    if (!contextMap) {
      this.bindingCache.set(cacheKey, actions);
      return actions;
    }
    
    // Generate potential binding keys for this input
    const inputKeys = this.generateInputKeys(inputData);
    
    for (const inputKey of inputKeys) {
      const bindingActions = contextMap.get(inputKey);
      if (bindingActions) {
        for (const actionConfig of bindingActions) {
          if (this.matchesBinding(inputData, actionConfig)) {
            const action = this.createActionFromBinding(inputData, actionConfig);
            actions.push(action);
          }
        }
      }
    }
    
    // Cache the result
    this.bindingCache.set(cacheKey, actions);
    
    if (this.debugMode && actions.length > 0) {
      console.log(`[BindingMap] Mapped input to actions:`, actions.map(a => a.name));
    }
    
    return actions;
  }

  /**
   * Set the active context
   * @param {string} context - Context name
   */
  setActiveContext(context) {
    if (this.activeContext !== context) {
      this.activeContext = context;
      this.clearCache(); // Context change invalidates cache
      
      if (this.debugMode) {
        console.log(`[BindingMap] Active context changed to: ${context}`);
      }
    }
  }

  /**
   * Get the active context
   * @returns {string} Active context name
   */
  getActiveContext() {
    return this.activeContext;
  }

  /**
   * Get all bindings
   * @returns {Object} All bindings organized by context
   */
  getBindings() {
    const result = {};
    
    for (const [context, contextMap] of this.bindings) {
      result[context] = {};
      
      for (const [bindingKey, actions] of contextMap) {
        for (const action of actions) {
          if (!result[context][action.actionName]) {
            result[context][action.actionName] = [];
          }
          
          const { actionName, ...bindingConfig } = action;
          result[context][action.actionName].push(bindingConfig);
        }
      }
    }
    
    return result;
  }

  /**
   * Normalize binding configuration
   * @param {Object|string} binding - Binding configuration
   * @returns {Object} Normalized binding configuration
   */
  normalizeBinding(binding) {
    if (typeof binding === 'string') {
      return this.parseBindingString(binding);
    }
    
    return {
      deviceType: binding.deviceType || 'keyboard',
      inputType: binding.inputType || 'key',
      key: binding.key || binding.input,
      modifiers: binding.modifiers || {},
      conditions: binding.conditions || {},
      sensitivity: binding.sensitivity || 1.0,
      deadzone: binding.deadzone || 0.1
    };
  }

  /**
   * Parse binding string (e.g., "ctrl+shift+a", "gamepad:button_a")
   * @param {string} bindingString - String representation of binding
   * @returns {Object} Parsed binding configuration
   */
  parseBindingString(bindingString) {
    const parts = bindingString.split(':');
    let deviceType = 'keyboard';
    let inputPart = bindingString;
    
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
      deviceType,
      inputType: deviceType === 'keyboard' ? 'key' : 'button',
      key: mainKey,
      modifiers,
      conditions: {},
      sensitivity: 1.0,
      deadzone: 0.1
    };
  }

  /**
   * Generate a unique key for a binding configuration
   * @param {Object} bindingConfig - Binding configuration
   * @returns {string} Unique binding key
   */
  generateBindingKey(bindingConfig) {
    const parts = [
      bindingConfig.deviceType,
      bindingConfig.inputType,
      bindingConfig.key
    ];
    
    // Add modifiers if present
    const modifiers = bindingConfig.modifiers || {};
    const modifierKeys = Object.keys(modifiers).filter(key => modifiers[key]).sort();
    if (modifierKeys.length > 0) {
      parts.push(modifierKeys.join('+'));
    }
    
    return parts.join(':');
  }

  /**
   * Generate potential input keys for matching
   * @param {Object} inputData - Raw input data
   * @returns {Array<string>} Array of potential binding keys
   */
  generateInputKeys(inputData) {
    const keys = [];
    const base = `${inputData.deviceType}:${inputData.inputType}:${inputData.key}`;
    
    keys.push(base);
    
    // Add variant with modifiers
    if (inputData.modifiers) {
      const modifiers = inputData.modifiers;
      const modifierKeys = Object.keys(modifiers).filter(key => modifiers[key]).sort();
      
      if (modifierKeys.length > 0) {
        keys.push(`${base}:${modifierKeys.join('+')}`);
      }
    }
    
    return keys;
  }

  /**
   * Check if input matches a binding configuration
   * @param {Object} inputData - Raw input data
   * @param {Object} actionConfig - Action configuration
   * @returns {boolean} Whether input matches binding
   */
  matchesBinding(inputData, actionConfig) {
    // Check device type
    if (inputData.deviceType !== actionConfig.deviceType) {
      return false;
    }
    
    // Check input type
    if (inputData.inputType !== actionConfig.inputType) {
      return false;
    }
    
    // Check key/button
    if (inputData.key !== actionConfig.key) {
      return false;
    }
    
    // Check modifiers
    const inputModifiers = inputData.modifiers || {};
    const requiredModifiers = actionConfig.modifiers || {};
    
    for (const [modifier, required] of Object.entries(requiredModifiers)) {
      if (required && !inputModifiers[modifier]) {
        return false;
      }
    }
    
    // Check conditions (custom matching logic)
    if (actionConfig.conditions) {
      if (!this.checkConditions(inputData, actionConfig.conditions)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check custom conditions for binding
   * @param {Object} inputData - Raw input data
   * @param {Object} conditions - Conditions to check
   * @returns {boolean} Whether conditions are met
   */
  checkConditions(inputData, conditions) {
    // Check value threshold for analog inputs
    if (conditions.minValue !== undefined) {
      if (Math.abs(inputData.value || 0) < conditions.minValue) {
        return false;
      }
    }
    
    if (conditions.maxValue !== undefined) {
      if (Math.abs(inputData.value || 0) > conditions.maxValue) {
        return false;
      }
    }
    
    // Check input type (press, release, hold)
    if (conditions.inputType && inputData.type !== conditions.inputType) {
      return false;
    }
    
    return true;
  }

  /**
   * Create action object from binding match
   * @param {Object} inputData - Raw input data
   * @param {Object} actionConfig - Action configuration
   * @returns {Object} Action object
   */
  createActionFromBinding(inputData, actionConfig) {
    let value = inputData.value || 0;
    
    // Apply sensitivity
    if (actionConfig.sensitivity !== undefined && actionConfig.sensitivity !== 1.0) {
      value *= actionConfig.sensitivity;
    }
    
    // Apply deadzone for analog inputs
    if (actionConfig.deadzone !== undefined && Math.abs(value) < actionConfig.deadzone) {
      value = 0;
    }
    
    return {
      name: actionConfig.actionName,
      type: inputData.type,
      value: value,
      timestamp: inputData.timestamp,
      deviceType: inputData.deviceType,
      originalInput: inputData
    };
  }

  /**
   * Generate cache key for input/context combination
   * @param {Object} inputData - Raw input data
   * @param {string} context - Context name
   * @returns {string} Cache key
   */
  generateCacheKey(inputData, context) {
    const inputKey = this.generateInputKeys(inputData)[0]; // Use primary key
    return `${context}:${inputKey}:${inputData.type}:${this.cacheVersion}`;
  }

  /**
   * Clear the binding cache
   */
  clearCache() {
    this.bindingCache.clear();
    this.cacheVersion++;
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
    const bindingCounts = {};
    for (const [context, contextMap] of this.bindings) {
      bindingCounts[context] = contextMap.size;
    }
    
    return {
      activeContext: this.activeContext,
      contexts: Array.from(this.bindings.keys()),
      bindingCounts,
      cacheSize: this.bindingCache.size,
      cacheVersion: this.cacheVersion
    };
  }
}

export default BindingMap;
