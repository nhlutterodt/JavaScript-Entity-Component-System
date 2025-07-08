/**
 * GamepadAdapter
 * Handles gamepad input events, multiple gamepad support, button/axis handling, and connection events.
 * Integrates with ECS event system and provides vibration support if available.
 */
class GamepadAdapter {
    constructor(eventManager, options = {}) {
        this.eventManager = eventManager;
        this.options = {
            pollInterval: 16, // ~60fps
            deadzone: 0.1,
            triggerThreshold: 0.1,
            ...options
        };
        
        this.initialized = false;
        this.gamepads = new Map();
        this.previousStates = new Map();
        this.pollTimer = null;
        this.boundHandlers = {};
        
        // Standard gamepad button mapping
        this.buttonMap = {
            0: 'A',           // Cross on PS
            1: 'B',           // Circle on PS
            2: 'X',           // Square on PS
            3: 'Y',           // Triangle on PS
            4: 'LB',          // L1 on PS
            5: 'RB',          // R1 on PS
            6: 'LT',          // L2 on PS
            7: 'RT',          // R2 on PS
            8: 'Back',        // Share on PS
            9: 'Start',       // Options on PS
            10: 'LS',         // L3 on PS
            11: 'RS',         // R3 on PS
            12: 'DPadUp',
            13: 'DPadDown',
            14: 'DPadLeft',
            15: 'DPadRight',
            16: 'Home'        // PS button
        };
        
        // Axis mapping
        this.axisMap = {
            0: 'LeftStickX',
            1: 'LeftStickY',
            2: 'RightStickX',
            3: 'RightStickY'
        };
    }
    
    initialize() {
        if (this.initialized) return;
        
        // Check if gamepad API is available
        if (!this.isGamepadSupported()) {
            console.warn('Gamepad API not supported');
            return;
        }
        
        // Set up connection event listeners
        this.boundHandlers.connected = this.handleGamepadConnected.bind(this);
        this.boundHandlers.disconnected = this.handleGamepadDisconnected.bind(this);
        
        window.addEventListener('gamepadconnected', this.boundHandlers.connected);
        window.addEventListener('gamepaddisconnected', this.boundHandlers.disconnected);
        
        // Start polling for gamepad input
        this.startPolling();
        
        this.initialized = true;
    }
    
    cleanup() {
        if (!this.initialized) return;
        
        // Stop polling
        this.stopPolling();
        
        // Remove event listeners
        if (window && this.boundHandlers.connected) {
            window.removeEventListener('gamepadconnected', this.boundHandlers.connected);
            window.removeEventListener('gamepaddisconnected', this.boundHandlers.disconnected);
        }
        
        // Clear gamepad data
        this.gamepads.clear();
        this.previousStates.clear();
        this.boundHandlers = {};
        
        this.initialized = false;
    }
    
    isInitialized() {
        return this.initialized;
    }
    
    isGamepadSupported() {
        return typeof navigator !== 'undefined' && 
               typeof navigator.getGamepads === 'function';
    }
    
    startPolling() {
        if (this.pollTimer) return;
        
        this.pollTimer = setInterval(() => {
            this.pollGamepads();
        }, this.options.pollInterval);
    }
    
    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }
    
    handleGamepadConnected(event) {
        const gamepad = event.gamepad;
        
        this.gamepads.set(gamepad.index, gamepad);
        this.previousStates.set(gamepad.index, this.createGamepadState(gamepad));
        
        this.emitEvent('gamepad:connected', {
            index: gamepad.index,
            id: gamepad.id,
            timestamp: performance.now()
        });
    }
    
    handleGamepadDisconnected(event) {
        const gamepad = event.gamepad;
        
        this.gamepads.delete(gamepad.index);
        this.previousStates.delete(gamepad.index);
        
        this.emitEvent('gamepad:disconnected', {
            index: gamepad.index,
            id: gamepad.id,
            timestamp: performance.now()
        });
    }
    
    pollGamepads() {
        if (!this.isGamepadSupported()) return;
        
        const gamepads = navigator.getGamepads();
        
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (!gamepad) continue;
            
            // Update our gamepad reference
            this.gamepads.set(i, gamepad);
            
            const previousState = this.previousStates.get(i);
            if (!previousState) {
                // New gamepad, initialize state
                this.previousStates.set(i, this.createGamepadState(gamepad));
                continue;
            }
            
            this.processGamepadInput(gamepad, previousState);
            
            // Update previous state
            this.previousStates.set(i, this.createGamepadState(gamepad));
        }
    }
    
    createGamepadState(gamepad) {
        return {
            buttons: gamepad.buttons.map(button => ({
                pressed: button.pressed,
                value: button.value
            })),
            axes: [...gamepad.axes]
        };
    }
    
    processGamepadInput(gamepad, previousState) {
        const timestamp = performance.now();
        
        // Process buttons
        for (let i = 0; i < gamepad.buttons.length; i++) {
            const button = gamepad.buttons[i];
            // Default to unpressed zero-value if previous state missing for this button index
            const previousButton = previousState.buttons[i] || { pressed: false, value: 0 };
            
            // Button press detection
            if (button.pressed && !previousButton.pressed) {
                this.emitEvent('gamepad:button', {
                    gamepadIndex: gamepad.index,
                    button: i,
                    buttonName: this.buttonMap[i] || `Button${i}`,
                    action: 'press',
                    value: button.value,
                    timestamp
                });
            }
            
            // Button release detection  
            if (!button.pressed && previousButton.pressed) {
                this.emitEvent('gamepad:button', {
                    gamepadIndex: gamepad.index,
                    button: i,
                    buttonName: this.buttonMap[i] || `Button${i}`,
                    action: 'release',
                    value: button.value,
                    timestamp
                });
            }
            
            // Analog button/trigger value change
            if (button.value !== previousButton.value && 
                Math.abs(button.value - previousButton.value) > this.options.triggerThreshold) {
                this.emitEvent('gamepad:trigger', {
                    gamepadIndex: gamepad.index,
                    button: i,
                    buttonName: this.buttonMap[i] || `Button${i}`,
                    value: button.value,
                    previousValue: previousButton.value,
                    timestamp
                });
            }
        }
        
        // Process axes (analog sticks)
        for (let i = 0; i < gamepad.axes.length; i++) {
            const axisValue = gamepad.axes[i];
            const previousAxisValue = previousState.axes[i];
            
            if (previousAxisValue === undefined) continue;
            
            // Apply deadzone
            const deadzonedValue = Math.abs(axisValue) > this.options.deadzone ? axisValue : 0;
            const previousDeadzonedValue = Math.abs(previousAxisValue) > this.options.deadzone ? previousAxisValue : 0;
            
            if (deadzonedValue !== previousDeadzonedValue) {
                this.emitEvent('gamepad:axis', {
                    gamepadIndex: gamepad.index,
                    axis: i,
                    axisName: this.axisMap[i] || `Axis${i}`,
                    value: deadzonedValue,
                    rawValue: axisValue,
                    previousValue: previousDeadzonedValue,
                    timestamp
                });
            }
        }
    }
    
    emitEvent(type, data) {
        if (this.eventManager && this.eventManager.emit) {
            this.eventManager.emit('input:raw', { data: { type: 'gamepad', ...data } });
        }
    }
    
    // Public API methods
    getGamepads() {
        return Array.from(this.gamepads.values());
    }
    
    getGamepad(index) {
        return this.gamepads.get(index);
    }
    
    isGamepadConnected(index) {
        return this.gamepads.has(index);
    }
    
    getConnectedGamepadCount() {
        return this.gamepads.size;
    }
    
    isButtonPressed(gamepadIndex, buttonIndex) {
        const gamepad = this.gamepads.get(gamepadIndex);
        if (!gamepad || !gamepad.buttons[buttonIndex]) return false;
        
        return gamepad.buttons[buttonIndex].pressed;
    }
    
    getButtonValue(gamepadIndex, buttonIndex) {
        const gamepad = this.gamepads.get(gamepadIndex);
        if (!gamepad || !gamepad.buttons[buttonIndex]) return 0;
        
        return gamepad.buttons[buttonIndex].value;
    }
    
    getAxisValue(gamepadIndex, axisIndex) {
        const gamepad = this.gamepads.get(gamepadIndex);
        if (!gamepad || gamepad.axes[axisIndex] === undefined) return 0;
        
        const rawValue = gamepad.axes[axisIndex];
        return Math.abs(rawValue) > this.options.deadzone ? rawValue : 0;
    }
    
    getStickPosition(gamepadIndex, stick = 'left') {
        const gamepad = this.gamepads.get(gamepadIndex);
        if (!gamepad) return { x: 0, y: 0 };
        
        const xAxis = stick === 'left' ? 0 : 2;
        const yAxis = stick === 'left' ? 1 : 3;
        
        return {
            x: this.getAxisValue(gamepadIndex, xAxis),
            y: this.getAxisValue(gamepadIndex, yAxis)
        };
    }
    
    // Vibration support (if available)
    vibrate(gamepadIndex, duration = 100, weakMagnitude = 0.5, strongMagnitude = 0.5) {
        const gamepad = this.gamepads.get(gamepadIndex);
        if (!gamepad || !gamepad.vibrationActuator) {
            return Promise.resolve();
        }
        
        return gamepad.vibrationActuator.playEffect('dual-rumble', {
            duration,
            weakMagnitude,
            strongMagnitude
        }).catch(error => {
            console.warn('Gamepad vibration failed:', error);
        });
    }
}

export default GamepadAdapter;
