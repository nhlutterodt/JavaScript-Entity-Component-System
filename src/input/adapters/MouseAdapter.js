/**
 * Mouse Device Adapter
 * Handles mouse input and maps it to standardized input events
 */
class MouseAdapter {
  constructor() {
    this.inputManager = null;
    this.mouseState = {
      position: { x: 0, y: 0 },
      movement: { x: 0, y: 0 },
      buttons: new Map(),
      wheel: { x: 0, y: 0 }
    };
    
    this.eventListeners = [];
    this.lastPosition = { x: 0, y: 0 };
    this.isPointerLocked = false;
    this.isActive = false;
    this.debugMode = false;
    
    // Mouse button mapping
    this.buttonMap = new Map([
      [0, 'left'],
      [1, 'middle'],
      [2, 'right'],
      [3, 'back'],
      [4, 'forward']
    ]);
    
    // Sensitivity settings
    this.sensitivity = {
      movement: 1.0,
      wheel: 1.0
    };
    
    // Smoothing for movement
    this.movementHistory = [];
    this.maxHistorySize = 5;
    this.enableSmoothing = false;
  }

  /**
   * Set the input manager reference
   * @param {InputManager} inputManager - Reference to the input manager
   */
  setInputManager(inputManager) {
    this.inputManager = inputManager;
  }

  /**
   * Initialize the mouse adapter
   */
  initialize() {
    if (typeof window === 'undefined') {
      console.warn('[MouseAdapter] No window object available - running in non-browser environment');
      return;
    }

    this.setupEventListeners();
    this.isActive = true;
    
    if (this.debugMode) {
      console.log('[MouseAdapter] Initialized successfully');
    }
  }

  /**
   * Setup mouse event listeners
   */
  setupEventListeners() {
    const onMouseMove = (event) => this.handleMouseMove(event);
    const onMouseDown = (event) => this.handleMouseDown(event);
    const onMouseUp = (event) => this.handleMouseUp(event);
    const onWheel = (event) => this.handleWheel(event);
    const onContextMenu = (event) => this.handleContextMenu(event);
    const onPointerLockChange = () => this.handlePointerLockChange();
    
    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('mousedown', onMouseDown, { passive: false });
    window.addEventListener('mouseup', onMouseUp, { passive: false });
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('contextmenu', onContextMenu, { passive: false });
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('pointerlockerror', onPointerLockChange);
    
    this.eventListeners = [
      { element: window, event: 'mousemove', handler: onMouseMove },
      { element: window, event: 'mousedown', handler: onMouseDown },
      { element: window, event: 'mouseup', handler: onMouseUp },
      { element: window, event: 'wheel', handler: onWheel },
      { element: window, event: 'contextmenu', handler: onContextMenu },
      { element: document, event: 'pointerlockchange', handler: onPointerLockChange },
      { element: document, event: 'pointerlockerror', handler: onPointerLockChange }
    ];
  }

  /**
   * Handle mouse movement
   * @param {MouseEvent} event - The mouse event
   */
  handleMouseMove(event) {
    if (!this.isActive) return;
    
    let movementX, movementY;
    
    if (this.isPointerLocked) {
      // Use movement values when pointer is locked
      movementX = event.movementX || 0;
      movementY = event.movementY || 0;
    } else {
      // Calculate movement from position difference
      movementX = event.clientX - this.lastPosition.x;
      movementY = event.clientY - this.lastPosition.y;
      
      // Update position
      this.mouseState.position.x = event.clientX;
      this.mouseState.position.y = event.clientY;
    }
    
    // Apply sensitivity
    movementX *= this.sensitivity.movement;
    movementY *= this.sensitivity.movement;
    
    // Apply smoothing if enabled
    if (this.enableSmoothing) {
      const smoothedMovement = this.applySmoothingToMovement(movementX, movementY);
      movementX = smoothedMovement.x;
      movementY = smoothedMovement.y;
    }
    
    // Update state
    this.mouseState.movement.x = movementX;
    this.mouseState.movement.y = movementY;
    this.lastPosition.x = event.clientX;
    this.lastPosition.y = event.clientY;
    
    // Send movement data to input manager
    if (Math.abs(movementX) > 0 || Math.abs(movementY) > 0) {
      const inputData = {
        deviceType: 'mouse',
        inputType: 'movement',
        type: 'analog',
        movement: { x: movementX, y: movementY },
        position: { ...this.mouseState.position },
        value: Math.sqrt(movementX * movementX + movementY * movementY),
        timestamp: performance.now(),
        originalEvent: event
      };
      
      if (this.debugMode && (Math.abs(movementX) > 1 || Math.abs(movementY) > 1)) {
        console.log(`[MouseAdapter] Movement: ${movementX.toFixed(1)}, ${movementY.toFixed(1)}`);
      }
      
      if (this.inputManager) {
        this.inputManager.processRawInput('mouse', inputData);
      }
    }
  }

  /**
   * Handle mouse button press
   * @param {MouseEvent} event - The mouse event
   */
  handleMouseDown(event) {
    if (!this.isActive) return;
    
    const buttonName = this.buttonMap.get(event.button);
    if (!buttonName) return;
    
    // Update button state
    this.mouseState.buttons.set(buttonName, {
      isPressed: true,
      timestamp: performance.now()
    });
    
    const inputData = {
      deviceType: 'mouse',
      inputType: 'button',
      button: buttonName,
      type: 'press',
      value: 1,
      position: { ...this.mouseState.position },
      timestamp: performance.now(),
      originalEvent: event
    };
    
    if (this.debugMode) {
      console.log(`[MouseAdapter] Button pressed: ${buttonName}`);
    }
    
    if (this.inputManager) {
      this.inputManager.processRawInput('mouse', inputData);
    }
    
    // Prevent default for right-click in games
    if (event.button === 2) {
      event.preventDefault();
    }
  }

  /**
   * Handle mouse button release
   * @param {MouseEvent} event - The mouse event
   */
  handleMouseUp(event) {
    if (!this.isActive) return;
    
    const buttonName = this.buttonMap.get(event.button);
    if (!buttonName) return;
    
    // Update button state
    const buttonState = this.mouseState.buttons.get(buttonName);
    if (buttonState) {
      buttonState.isPressed = false;
    }
    
    const inputData = {
      deviceType: 'mouse',
      inputType: 'button',
      button: buttonName,
      type: 'release',
      value: 0,
      position: { ...this.mouseState.position },
      timestamp: performance.now(),
      originalEvent: event
    };
    
    if (this.debugMode) {
      console.log(`[MouseAdapter] Button released: ${buttonName}`);
    }
    
    if (this.inputManager) {
      this.inputManager.processRawInput('mouse', inputData);
    }
  }

  /**
   * Handle mouse wheel events
   * @param {WheelEvent} event - The wheel event
   */
  handleWheel(event) {
    if (!this.isActive) return;
    
    const deltaX = event.deltaX * this.sensitivity.wheel;
    const deltaY = event.deltaY * this.sensitivity.wheel;
    
    // Update wheel state
    this.mouseState.wheel.x = deltaX;
    this.mouseState.wheel.y = deltaY;
    
    // Send wheel data for both axes if they have values
    if (Math.abs(deltaY) > 0) {
      const inputData = {
        deviceType: 'mouse',
        inputType: 'wheel',
        axis: 'y',
        type: 'analog',
        value: -deltaY, // Negative for natural scrolling
        timestamp: performance.now(),
        originalEvent: event
      };
      
      if (this.inputManager) {
        this.inputManager.processRawInput('mouse', inputData);
      }
    }
    
    if (Math.abs(deltaX) > 0) {
      const inputData = {
        deviceType: 'mouse',
        inputType: 'wheel',
        axis: 'x',
        type: 'analog',
        value: deltaX,
        timestamp: performance.now(),
        originalEvent: event
      };
      
      if (this.inputManager) {
        this.inputManager.processRawInput('mouse', inputData);
      }
    }
    
    if (this.debugMode && (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0)) {
      console.log(`[MouseAdapter] Wheel: ${deltaX.toFixed(1)}, ${deltaY.toFixed(1)}`);
    }
    
    event.preventDefault();
  }

  /**
   * Handle context menu (usually right-click)
   * @param {Event} event - The context menu event
   */
  handleContextMenu(event) {
    // Prevent context menu in game contexts
    if (this.isActive) {
      event.preventDefault();
    }
  }

  /**
   * Handle pointer lock changes
   */
  handlePointerLockChange() {
    this.isPointerLocked = document.pointerLockElement !== null;
    
    if (this.debugMode) {
      console.log(`[MouseAdapter] Pointer lock ${this.isPointerLocked ? 'enabled' : 'disabled'}`);
    }
    
    if (this.inputManager) {
      const inputData = {
        deviceType: 'mouse',
        inputType: 'pointer_lock',
        type: this.isPointerLocked ? 'enabled' : 'disabled',
        value: this.isPointerLocked ? 1 : 0,
        timestamp: performance.now()
      };
      
      this.inputManager.processRawInput('mouse', inputData);
    }
  }

  /**
   * Apply smoothing to mouse movement
   * @param {number} x - Raw X movement
   * @param {number} y - Raw Y movement
   * @returns {Object} Smoothed movement values
   */
  applySmoothingToMovement(x, y) {
    // Add current movement to history
    this.movementHistory.push({ x, y, timestamp: performance.now() });
    
    // Keep history size manageable
    if (this.movementHistory.length > this.maxHistorySize) {
      this.movementHistory.shift();
    }
    
    // Calculate weighted average
    let totalX = 0, totalY = 0, totalWeight = 0;
    const currentTime = performance.now();
    
    for (let i = 0; i < this.movementHistory.length; i++) {
      const entry = this.movementHistory[i];
      const age = currentTime - entry.timestamp;
      const weight = Math.max(0, 1 - (age / 100)); // Weight decreases with age
      
      totalX += entry.x * weight;
      totalY += entry.y * weight;
      totalWeight += weight;
    }
    
    return {
      x: totalWeight > 0 ? totalX / totalWeight : x,
      y: totalWeight > 0 ? totalY / totalWeight : y
    };
  }

  /**
   * Request pointer lock
   * @param {HTMLElement} element - Element to lock pointer to (default: document.body)
   */
  requestPointerLock(element = null) {
    const target = element || document.body;
    
    if (target.requestPointerLock) {
      target.requestPointerLock();
    } else {
      console.warn('[MouseAdapter] Pointer lock not supported');
    }
  }

  /**
   * Exit pointer lock
   */
  exitPointerLock() {
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  /**
   * Check if a mouse button is currently pressed
   * @param {string} buttonName - Name of the button to check
   * @returns {boolean} Whether the button is pressed
   */
  isButtonPressed(buttonName) {
    const buttonState = this.mouseState.buttons.get(buttonName);
    return buttonState ? buttonState.isPressed : false;
  }

  /**
   * Get current mouse position
   * @returns {Object} Current mouse position
   */
  getPosition() {
    return { ...this.mouseState.position };
  }

  /**
   * Get current mouse movement
   * @returns {Object} Current mouse movement
   */
  getMovement() {
    return { ...this.mouseState.movement };
  }

  /**
   * Set mouse sensitivity
   * @param {number} movementSensitivity - Movement sensitivity multiplier
   * @param {number} wheelSensitivity - Wheel sensitivity multiplier
   */
  setSensitivity(movementSensitivity = 1.0, wheelSensitivity = 1.0) {
    this.sensitivity.movement = movementSensitivity;
    this.sensitivity.wheel = wheelSensitivity;
    
    if (this.debugMode) {
      console.log(`[MouseAdapter] Sensitivity set to movement: ${movementSensitivity}, wheel: ${wheelSensitivity}`);
    }
  }

  /**
   * Enable or disable movement smoothing
   * @param {boolean} enabled - Whether to enable smoothing
   */
  setSmoothing(enabled) {
    this.enableSmoothing = enabled;
    
    if (!enabled) {
      this.movementHistory.length = 0;
    }
    
    if (this.debugMode) {
      console.log(`[MouseAdapter] Movement smoothing ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Update the adapter (called each frame)
   * @param {number} deltaTime - Time elapsed since last frame
   */
  update(deltaTime) {
    // Reset movement values each frame
    this.mouseState.movement.x = 0;
    this.mouseState.movement.y = 0;
    this.mouseState.wheel.x = 0;
    this.mouseState.wheel.y = 0;
    
    // Clean old movement history
    if (this.enableSmoothing) {
      const currentTime = performance.now();
      this.movementHistory = this.movementHistory.filter(entry => 
        currentTime - entry.timestamp < 200
      );
    }
  }

  /**
   * Enable or disable the adapter
   * @param {boolean} active - Whether the adapter should be active
   */
  setActive(active) {
    this.isActive = active;
    
    if (!active) {
      // Reset all button states when deactivated
      for (const [buttonName, buttonState] of this.mouseState.buttons) {
        if (buttonState.isPressed) {
          buttonState.isPressed = false;
          
          const inputData = {
            deviceType: 'mouse',
            inputType: 'button',
            button: buttonName,
            type: 'release',
            value: 0,
            timestamp: performance.now()
          };
          
          if (this.inputManager) {
            this.inputManager.processRawInput('mouse', inputData);
          }
        }
      }
    }
    
    if (this.debugMode) {
      console.log(`[MouseAdapter] ${active ? 'Activated' : 'Deactivated'}`);
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
    const buttonStates = {};
    for (const [buttonName, buttonState] of this.mouseState.buttons) {
      buttonStates[buttonName] = buttonState.isPressed;
    }
    
    return {
      isActive: this.isActive,
      isPointerLocked: this.isPointerLocked,
      position: { ...this.mouseState.position },
      movement: { ...this.mouseState.movement },
      buttonStates,
      sensitivity: { ...this.sensitivity },
      smoothingEnabled: this.enableSmoothing,
      movementHistorySize: this.movementHistory.length
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
    
    this.eventListeners.length = 0;
    this.mouseState.buttons.clear();
    this.movementHistory.length = 0;
    this.isActive = false;
    
    // Exit pointer lock if active
    if (this.isPointerLocked) {
      this.exitPointerLock();
    }
    
    if (this.debugMode) {
      console.log('[MouseAdapter] Disposed');
    }
  }
}

export default MouseAdapter;
