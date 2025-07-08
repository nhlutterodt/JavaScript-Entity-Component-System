/**
 * KeyboardAdapter
 * Handles keyboard input events, key normalization, modifier detection, and state tracking.
 * Integrates with InputManager for ECS, supports debug info, and resource cleanup.
 */
class KeyboardAdapter {
  constructor() {
    this.inputManager = null;
    this.keyStates = new Map();
    this.eventListeners = [];
    
    // Key code mapping for cross-browser compatibility
    this.keyCodeMap = new Map([
      // Letters
      ['KeyA', 'a'], ['KeyB', 'b'], ['KeyC', 'c'], ['KeyD', 'd'], ['KeyE', 'e'],
      ['KeyF', 'f'], ['KeyG', 'g'], ['KeyH', 'h'], ['KeyI', 'i'], ['KeyJ', 'j'],
      ['KeyK', 'k'], ['KeyL', 'l'], ['KeyM', 'm'], ['KeyN', 'n'], ['KeyO', 'o'],
      ['KeyP', 'p'], ['KeyQ', 'q'], ['KeyR', 'r'], ['KeyS', 's'], ['KeyT', 't'],
      ['KeyU', 'u'], ['KeyV', 'v'], ['KeyW', 'w'], ['KeyX', 'x'], ['KeyY', 'y'],
      ['KeyZ', 'z'],
      
      // Numbers
      ['Digit0', '0'], ['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'], ['Digit4', '4'],
      ['Digit5', '5'], ['Digit6', '6'], ['Digit7', '7'], ['Digit8', '8'], ['Digit9', '9'],
      
      // Function keys
      ['F1', 'f1'], ['F2', 'f2'], ['F3', 'f3'], ['F4', 'f4'], ['F5', 'f5'],
      ['F6', 'f6'], ['F7', 'f7'], ['F8', 'f8'], ['F9', 'f9'], ['F10', 'f10'],
      ['F11', 'f11'], ['F12', 'f12'],
      
      // Arrow keys
      ['ArrowUp', 'up'], ['ArrowDown', 'down'], ['ArrowLeft', 'left'], ['ArrowRight', 'right'],
      
      // Special keys
      ['Space', 'space'], ['Enter', 'enter'], ['Escape', 'escape'], ['Tab', 'tab'],
      ['Backspace', 'backspace'], ['Delete', 'delete'], ['Insert', 'insert'],
      ['Home', 'home'], ['End', 'end'], ['PageUp', 'pageup'], ['PageDown', 'pagedown'],
      
      // Modifiers
      ['ShiftLeft', 'shift'], ['ShiftRight', 'shift'],
      ['ControlLeft', 'ctrl'], ['ControlRight', 'ctrl'],
      ['AltLeft', 'alt'], ['AltRight', 'alt'],
      ['MetaLeft', 'meta'], ['MetaRight', 'meta'],
      
      // Numpad
      ['Numpad0', 'numpad0'], ['Numpad1', 'numpad1'], ['Numpad2', 'numpad2'],
      ['Numpad3', 'numpad3'], ['Numpad4', 'numpad4'], ['Numpad5', 'numpad5'],
      ['Numpad6', 'numpad6'], ['Numpad7', 'numpad7'], ['Numpad8', 'numpad8'],
      ['Numpad9', 'numpad9'], ['NumpadEnter', 'numpadenter'],
      
      // Punctuation
      ['Comma', 'comma'], ['Period', 'period'], ['Semicolon', 'semicolon'],
      ['Quote', 'quote'], ['BracketLeft', 'bracketleft'], ['BracketRight', 'bracketright'],
      ['Backslash', 'backslash'], ['Slash', 'slash'], ['Equal', 'equal'], ['Minus', 'minus']
    ]);
    
    this.isActive = false;
    this.debugMode = false;
  }

  /**
   * Set the input manager reference
   * @param {InputManager} inputManager - The input manager instance
   */
  setInputManager(inputManager) {
    this.inputManager = inputManager;
  }

  /**
   * Initialize the keyboard adapter
   */
  initialize() {
    if (typeof window === 'undefined') {
      console.warn('[KeyboardAdapter] No window object available - running in non-browser environment');
      return;
    }

    this.setupEventListeners();
    this.isActive = true;
    
    if (this.debugMode) {
      console.log('[KeyboardAdapter] Initialized successfully');
    }
  }

  /**
   * Setup DOM event listeners
   */
  setupEventListeners() {
    const onKeyDown = (event) => this.handleKeyDown(event);
    const onKeyUp = (event) => this.handleKeyUp(event);
    const onBlur = () => this.handleWindowBlur();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    this.eventListeners = [
      { element: window, event: 'keydown', handler: onKeyDown },
      { element: window, event: 'keyup', handler: onKeyUp },
      { element: window, event: 'blur', handler: onBlur }
    ];
  }

  /**
   * Handle keydown events
   * @param {KeyboardEvent} event - The keyboard event
   */
  handleKeyDown(event) {
    if (!this.isActive) return;
    
    const normalizedKey = this.normalizeKey(event);
    if (!normalizedKey) return;
    
    // Check if key is already pressed (ignore repeat events by default)
    const currentState = this.keyStates.get(normalizedKey);
    if (currentState && currentState.isPressed) {
      // Handle key repeat if needed
      this.processKeyRepeat(normalizedKey, event);
      return;
    }
    
    // Update key state
    this.keyStates.set(normalizedKey, {
      isPressed: true,
      timestamp: performance.now(),
      originalEvent: event
    });
    
    const inputData = {
      deviceType: 'keyboard',
      inputType: 'key',
      key: normalizedKey,
      type: 'press',
      value: 1,
      timestamp: performance.now(),
      modifiers: this.getModifierState(event),
      originalEvent: event
    };
    
    if (this.debugMode) {
      console.log('[KeyboardAdapter] Key pressed:', normalizedKey);
    }
    
    // Send to input manager
    if (this.inputManager) {
      this.inputManager.processRawInput('keyboard', inputData);
    }
    
    // Prevent default behavior for game keys (configurable)
    if (this.shouldPreventDefault(normalizedKey)) {
      event.preventDefault();
    }
  }

  /**
   * Handle keyup events
   * @param {KeyboardEvent} event - The keyboard event
   */
  handleKeyUp(event) {
    if (!this.isActive) return;
    
    const normalizedKey = this.normalizeKey(event);
    if (!normalizedKey) return;
    
    // Update key state
    const currentState = this.keyStates.get(normalizedKey);
    if (currentState) {
      currentState.isPressed = false;
    }
    
    const inputData = {
      deviceType: 'keyboard',
      inputType: 'key',
      key: normalizedKey,
      type: 'release',
      value: 0,
      timestamp: performance.now(),
      modifiers: this.getModifierState(event),
      originalEvent: event
    };
    
    if (this.debugMode) {
      console.log('[KeyboardAdapter] Key released:', normalizedKey);
    }
    
    // Send to input manager
    if (this.inputManager) {
      this.inputManager.processRawInput('keyboard', inputData);
    }
  }

  /**
   * Handle window blur (release all keys)
   */
  handleWindowBlur() {
    if (!this.isActive) return;
    
    const timestamp = performance.now();
    
    for (const [key, state] of this.keyStates) {
      if (state.isPressed) {
        state.isPressed = false;
        
        const inputData = {
          deviceType: 'keyboard',
          inputType: 'key',
          key: key,
          type: 'release',
          value: 0,
          timestamp: timestamp,
          modifiers: { shift: false, ctrl: false, alt: false, meta: false }
        };
        
        if (this.inputManager) {
          this.inputManager.processRawInput('keyboard', inputData);
        }
      }
    }
    
    if (this.debugMode) {
      console.log('[KeyboardAdapter] Window blur - released all keys');
    }
  }

  /**
   * Handle key repeat events
   * @param {string} key - The normalized key name
   * @param {KeyboardEvent} event - The keyboard event
   */
  processKeyRepeat(key, event) {
    // Only process repeats for certain keys (like movement)
    const repeatableKeys = ['up', 'down', 'left', 'right', 'w', 'a', 's', 'd'];
    
    if (repeatableKeys.includes(key)) {
      const inputData = {
        deviceType: 'keyboard',
        inputType: 'key',
        key: key,
        type: 'repeat',
        value: 1,
        timestamp: performance.now(),
        modifiers: this.getModifierState(event),
        originalEvent: event
      };
      
      if (this.inputManager) {
        this.inputManager.processRawInput('keyboard', inputData);
      }
    }
  }

  /**
   * Normalize keyboard input to consistent key names
   * @param {KeyboardEvent} event - The keyboard event
   * @returns {string|null} Normalized key name or null if not mappable
   */
  normalizeKey(event) {
    // Try to get normalized key from code first (more reliable)
    if (event.code && this.keyCodeMap.has(event.code)) {
      return this.keyCodeMap.get(event.code);
    }
    
    // Fallback to key property (less reliable but covers more cases)
    if (event.key) {
      const key = event.key.toLowerCase();
      
      // Handle special cases
      if (key === ' ') return 'space';
      if (key === 'arrowup') return 'up';
      if (key === 'arrowdown') return 'down';
      if (key === 'arrowleft') return 'left';
      if (key === 'arrowright') return 'right';
      
      // Return normalized key if it's a single character or known key
      if (key.length === 1 || ['enter', 'escape', 'tab', 'backspace', 'delete'].includes(key)) {
        return key;
      }
    }
    
    return null;
  }

  /**
   * Get modifier state from event
   * @param {KeyboardEvent} event - The keyboard event
   * @returns {Object} Modifier state object
   */
  getModifierState(event) {
    return {
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey,
      meta: event.metaKey
    };
  }

  /**
   * Check if a key is currently pressed
   * @param {string} key - The key to check
   * @returns {boolean} True if the key is pressed
   */
  isKeyPressed(key) {
    const state = this.keyStates.get(key);
    return state ? state.isPressed : false;
  }

  /**
   * Get all currently pressed keys
   * @returns {Array<string>} Array of pressed key names
   */
  getPressedKeys() {
    const pressedKeys = [];
    for (const [key, state] of this.keyStates) {
      if (state.isPressed) {
        pressedKeys.push(key);
      }
    }
    return pressedKeys;
  }

  /**
   * Update the adapter (called each frame)
   * @param {number} deltaTime - Time since last frame in milliseconds
   */
  update(deltaTime) {
    // Keyboard adapter doesn't need frame-based updates
    // Key states are updated via events
  }

  /**
   * Set the active state of the adapter
   * @param {boolean} active - Whether the adapter should be active
   */
  setActive(active) {
    if (!active && this.isActive) {
      // Release all keys when deactivating
      this.releaseAllKeys();
    }
    
    this.isActive = active;
    
    if (this.debugMode) {
      console.log(`[KeyboardAdapter] ${active ? 'Activated' : 'Deactivated'}`);
    }
  }

  /**
   * Release all currently pressed keys
   */
  releaseAllKeys() {
    const timestamp = performance.now();
    
    for (const [key, state] of this.keyStates) {
      if (state.isPressed) {
        state.isPressed = false;
        
        const inputData = {
          deviceType: 'keyboard',
          inputType: 'key',
          key: key,
          type: 'release',
          value: 0,
          timestamp: timestamp,
          modifiers: { shift: false, ctrl: false, alt: false, meta: false }
        };
        
        if (this.inputManager) {
          this.inputManager.processRawInput('keyboard', inputData);
        }
      }
    }
    
    if (this.debugMode) {
      console.log('[KeyboardAdapter] Released all keys');
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
    // Create a serializable version of keyStates without Event objects
    const serializableKeyStates = {};
    for (const [key, state] of this.keyStates) {
      serializableKeyStates[key] = {
        isPressed: state.isPressed,
        timestamp: state.timestamp
        // Exclude originalEvent as it's not serializable
      };
    }
    
    return {
      isActive: this.isActive,
      keyStates: serializableKeyStates,
      pressedKeys: this.getPressedKeys(),
      eventListeners: this.eventListeners.length,
      debugMode: this.debugMode
    };
  }

  /**
   * Dispose of the adapter and cleanup resources
   */
  dispose() {
    // Remove event listeners
    for (const { element, event, handler } of this.eventListeners) {
      element.removeEventListener(event, handler);
    }
    
    this.eventListeners = [];
    this.keyStates.clear();
    this.isActive = false;
    
    if (this.debugMode) {
      console.log('[KeyboardAdapter] Disposed');
    }
  }

  /**
   * Check if default behavior should be prevented for a key
   * @param {string} key - The normalized key name
   * @returns {boolean} True if default should be prevented
   */
  shouldPreventDefault(key) {
    // Prevent default for common game keys
    const gameKeys = ['w', 'a', 's', 'd', 'space', 'up', 'down', 'left', 'right'];
    return gameKeys.includes(key);
  }
}

export default KeyboardAdapter;
