import BindingMap from './BindingMap.js';
import KeyBuffer from './KeyBuffer.js';
import ComboTracker from './ComboTracker.js';
import ConfigProvider from './ConfigProvider.js';

/**
 * Input Management System for ECS
 * Central orchestrator for all input devices and action mapping
 * Provides high-level action-based input interface
 */
class InputManager {
  constructor(eventManager = null, debugManager = null) {
    this.eventManager = eventManager;
    this.debugManager = debugManager;
    
    // Core components
    this.deviceAdapters = new Map();
    this.bindingMap = null;
    this.keyBuffer = null;
    this.comboTracker = null;
    this.configProvider = null;
    
    // Context management
    this.contextStack = [];
    this.currentContext = null;
    
    // State tracking
    this.actionStates = new Map();
    this.frameData = {
      timestamp: 0,
      deltaTime: 0,
      frameNumber: 0
    };
    
    // Configuration
    this.config = {
      enableDebugOverlay: false,
      bufferSize: 32,
      comboTimeout: 500,
      analogDeadzone: 0.1,
      analogSensitivity: 1.0
    };
    
    this.isInitialized = false;
    this.isPaused = false;
    
    this.debugMode = false;
  }

  /**
   * Centralized error handler
   * @param {Error} error
   * @param {string} context
   */
  handleError(error, context) {
    console.error(`[InputManager] Error in ${context}:`, error);
    this.emit('input:error', { error, context });
    if (this.debugManager && this.debugManager.log) {
      this.debugManager.log('error', `Error in ${context}`, error);
    }
  }

  /**
   * Initialize the input system with required components
   * @param {Object} options - Initialization options
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      throw new Error('InputManager already initialized');
    }

    try {
      // Apply configuration
      this.config = { ...this.config, ...options };
      
      // Initialize core components with safe default import handling
      const BindingMapClass = BindingMap.default || BindingMap;
      const KeyBufferClass = KeyBuffer.default || KeyBuffer;
      const ComboTrackerClass = ComboTracker.default || ComboTracker;
      const ConfigProviderClass = ConfigProvider.default || ConfigProvider;
      
      this.bindingMap = new BindingMapClass();
      this.keyBuffer = new KeyBufferClass(this.config.bufferSize);
      this.comboTracker = new ComboTrackerClass(this.config.comboTimeout);
      this.configProvider = new ConfigProviderClass();
      
      // Load default configuration
      await this.loadConfig();
      
      // Initialize default context
      this.pushContext('default');
      
      this.isInitialized = true;
      
      if (this.debugMode) {
        console.log('[InputManager] Initialized successfully');
      }
      
      this.emit('input:initialized');

    } catch (error) {
      this.handleError(error, 'initialize');
      throw error;
    }
  }

  /**
   * Register a device adapter
   * @param {string} deviceType - Type identifier for the device
   * @param {Object} adapter - Device adapter instance
   */
  registerAdapter(deviceType, adapter) {
    if (this.deviceAdapters.has(deviceType)) {
      console.warn(`[InputManager] Overwriting existing adapter for '${deviceType}'`);
    }
    
    this.deviceAdapters.set(deviceType, adapter);
    adapter.setInputManager(this);
    
    if (this.debugMode) {
      console.log(`[InputManager] Registered adapter for '${deviceType}'`);
    }
    
    this.emit('input:adapter_registered', { deviceType, adapter });
  }

  /**
   * Update the input system - should be called every frame
   * @param {number} deltaTime - Time elapsed since last frame
   */
  update(deltaTime) {
    if (!this.isInitialized || this.isPaused) {
      return;
    }
    
    // Update frame data
    this.frameData.timestamp = performance.now();
    this.frameData.deltaTime = deltaTime;
    this.frameData.frameNumber++;
    
    // Update all device adapters
    for (const [deviceType, adapter] of this.deviceAdapters) {
      try {
        adapter.update(deltaTime);
      } catch (error) {
        this.handleError(error, `updateAdapter:${deviceType}`);
      }
    }
    
    // Update core components
    this.keyBuffer?.update(deltaTime);
    this.comboTracker?.update(deltaTime);
    
    // Process queued input events
    this.processInputQueue();
    
    // Update action states and emit events
    this.updateActionStates();
  }

  /**
   * Check if an action is currently active
   * @param {string} actionName - Name of the action to check
   * @returns {boolean} True if action is active
   */
  isActionPressed(actionName) {
    const state = this.actionStates.get(actionName);
    return state ? state.isPressed : false;
  }

  /**
   * Check if an action was just pressed this frame
   * @param {string} actionName - Name of the action to check
   * @returns {boolean} True if action was just pressed
   */
  isActionJustPressed(actionName) {
    const state = this.actionStates.get(actionName);
    return state ? state.justPressed : false;
  }

  /**
   * Check if an action was just released this frame
   * @param {string} actionName - Name of the action to check
   * @returns {boolean} True if action was just released
   */
  isActionJustReleased(actionName) {
    const state = this.actionStates.get(actionName);
    return state ? state.justReleased : false;
  }

  /**
   * Get the analog value of an action (0-1 for triggers, -1 to 1 for sticks)
   * @param {string} actionName - Name of the action to check
   * @returns {number} Analog value
   */
  getActionValue(actionName) {
    const state = this.actionStates.get(actionName);
    return state ? state.value : 0;
  }

  /**
   * Push a new input context onto the stack
   * @param {string} contextName - Name of the context to push
   */
  pushContext(contextName) {
    if (this.currentContext) {
      this.contextStack.push(this.currentContext);
    }
    
    this.currentContext = contextName;
    this.bindingMap?.setActiveContext(contextName);
    
    if (this.debugMode) {
      console.log(`[InputManager] Pushed context '${contextName}', stack depth: ${this.contextStack.length + 1}`);
    }
    
    this.emit('input:context_changed', { context: contextName, stack: [...this.contextStack] });
  }

  /**
   * Pop the current context from the stack
   */
  popContext() {
    if (this.contextStack.length === 0) {
      console.warn('[InputManager] Cannot pop context - stack is empty');
      return;
    }
    
    const previousContext = this.currentContext;
    this.currentContext = this.contextStack.pop();
    this.bindingMap?.setActiveContext(this.currentContext);
    
    if (this.debugMode) {
      console.log(`[InputManager] Popped context '${previousContext}', now in '${this.currentContext}'`);
    }
    
    this.emit('input:context_changed', { context: this.currentContext, stack: [...this.contextStack] });
  }

  /**
   * Load input configuration
   * @param {Object} config - Configuration object (optional)
   */
  async loadConfig(config = null) {
    const maxRetries = 3;
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const inputConfig = config || await this.configProvider?.loadConfig();
        if (inputConfig) {
          this.bindingMap?.loadBindings(inputConfig.bindings || {});
          this.config = { ...this.config, ...inputConfig.settings };
          if (this.debugMode) console.log('[InputManager] Configuration loaded successfully');
          this.emit('input:config_loaded', { config: inputConfig });
        }
        return;
      } catch (error) {
        attempt++;
        this.handleError(error, 'loadConfig');
        if (attempt < maxRetries) {
          if (this.debugMode) console.log(`[InputManager] Retrying loadConfig (attempt ${attempt + 1})`);
        } else {
          if (this.debugMode) console.warn('[InputManager] loadConfig failed after retries, applying defaults');
          this.bindingMap?.loadBindings({});
          return;
        }
      }
    }
  }

  /**
   * Save current input configuration
   */
  async saveConfig() {
    try {
      const config = {
        bindings: this.bindingMap?.getBindings() || {},
        settings: this.config
      };
      await this.configProvider?.saveConfig(config);
      if (this.debugMode) console.log('[InputManager] Configuration saved successfully');
      this.emit('input:config_saved', { config });
    } catch (error) {
      this.handleError(error, 'saveConfig');
    }
  }

  /**
   * Enable or disable the input system
   * @param {boolean} paused - Whether to pause input processing
   */
  setPaused(paused) {
    this.isPaused = paused;
    
    if (this.debugMode) {
      console.log(`[InputManager] Input processing ${paused ? 'paused' : 'resumed'}`);
    }
    
    this.emit('input:pause_changed', { paused });
  }

  /**
   * Process raw input from device adapters
   * @param {string} deviceType - Type of device that generated the input
   * @param {Object} inputData - Raw input data
   */
  processRawInput(deviceType, inputData) {
    try {
      if (typeof deviceType !== 'string' || typeof inputData !== 'object') {
        throw new Error('Invalid raw input parameters');
      }
      if (!this.isInitialized || this.isPaused) return;

      // Add to key buffer for combo detection
      this.keyBuffer?.addInput(inputData);

      // Check for combo matches
      const combo = this.comboTracker?.checkForCombo(inputData);
      if (combo) {
        this.processComboInput(combo);
        return;
      }

      // Map raw input to actions via binding map
      const actions = this.bindingMap?.mapInputToActions(inputData, this.currentContext);

      if (actions && actions.length > 0) {
        for (const action of actions) {
          this.processActionInput(action);
        }
      }
    } catch (error) {
      this.handleError(error, 'processRawInput');
    }
  }

  /**
   * Process combo input
   * @param {Object} combo - Detected combo data
   */
  processComboInput(combo) {
    try {
      if (!combo || typeof combo !== 'object') throw new Error('Invalid combo data');
      if (this.debugMode) console.log('[InputManager] Combo detected:', combo);
      this.emit('input:combo', combo);
    } catch (error) {
      this.handleError(error, 'processComboInput');
    }
  }

  /**
   * Process action input
   * @param {Object} action - Action data
   */
  processActionInput(action) {
    try {
      const { name, type, value, timestamp } = action;
      if (typeof name !== 'string' || !['press','release','analog'].includes(type)) {
        throw new Error('Invalid action data');
      }

      // Update action state
      let state = this.actionStates.get(name);
      if (!state) {
        state = {
          isPressed: false,
          justPressed: false,
          justReleased: false,
          value: 0,
          timestamp: 0
        };
        this.actionStates.set(name, state);
      }
      
      const wasPressed = state.isPressed;
      
      // Update state based on input type
      switch (type) {
        case 'press':
          state.isPressed = true;
          state.justPressed = !wasPressed;
          state.justReleased = false;
          state.value = value || 1;
          break;
          
        case 'release':
          state.isPressed = false;
          state.justPressed = false;
          state.justReleased = wasPressed;
          state.value = 0;
          break;
          
        case 'analog':
          state.value = value || 0;
          state.isPressed = Math.abs(state.value) > this.config.analogDeadzone;
          state.justPressed = state.isPressed && !wasPressed;
          state.justReleased = !state.isPressed && wasPressed;
          break;
      }
      
      state.timestamp = timestamp || this.frameData.timestamp;
    } catch (error) {
      this.handleError(error, 'processActionInput');
    }
  }

  /**
   * Process the input queue
   */
  processInputQueue() {
    // This would handle any queued input events
    // Implementation depends on specific queuing strategy
  }

  /**
   * Update action states and emit events
   */
  updateActionStates() {
    for (const [actionName, state] of this.actionStates) {
      // Emit action events
      if (state.justPressed) {
        this.emit('input:action_pressed', { action: actionName, value: state.value });
      }
      
      if (state.justReleased) {
        this.emit('input:action_released', { action: actionName });
      }
      
      if (state.isPressed) {
        this.emit('input:action_held', { action: actionName, value: state.value });
      }
      
      // Reset frame-specific flags
      state.justPressed = false;
      state.justReleased = false;
    }
  }

  /**
   * Emit an event through the event manager
   * @param {string} eventType - Type of event
   * @param {Object} data - Event data
   */
  emit(eventType, data = {}) {
    if (this.eventManager) {
      this.eventManager.emit(eventType, data);
    }
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    
    // Propagate debug mode to components
    for (const adapter of this.deviceAdapters.values()) {
      if (adapter.setDebugMode) {
        adapter.setDebugMode(enabled);
      }
    }
    
    this.bindingMap?.setDebugMode?.(enabled);
    this.keyBuffer?.setDebugMode?.(enabled);
    this.comboTracker?.setDebugMode?.(enabled);
  }

  /**
   * Get debug information about the input system
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      initialized: this.isInitialized,
      paused: this.isPaused,
      currentContext: this.currentContext,
      contextStack: [...this.contextStack],
      activeAdapters: Array.from(this.deviceAdapters.keys()),
      actionStates: Object.fromEntries(this.actionStates),
      frameData: { ...this.frameData },
      config: { ...this.config }
    };
  }

  /**
   * Cleanup resources
   */
  dispose() {
    // Cleanup device adapters
    for (const adapter of this.deviceAdapters.values()) {
      if (adapter.dispose) {
        adapter.dispose();
      }
    }
    
    this.deviceAdapters.clear();
    this.actionStates.clear();
    this.contextStack.length = 0;
    
    this.isInitialized = false;
    
    this.emit('input:disposed');
  }
}

export default InputManager;
