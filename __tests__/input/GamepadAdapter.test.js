import GamepadAdapter from '../../src/input/adapters/GamepadAdapter.js';

describe('GamepadAdapter', () => {
    let adapter;
    let mockEventManager;
    let mockGamepad;
    let mockNavigator;

    beforeEach(() => {
        // Mock EventManager
        mockEventManager = {
            emit: jest.fn()
        };

        // Mock gamepad object
        mockGamepad = {
            index: 0,
            id: 'Mock Gamepad (Vendor: 1234 Product: 5678)',
            connected: true,
            buttons: [
                { pressed: false, value: 0 }, // A
                { pressed: false, value: 0 }, // B
                { pressed: false, value: 0 }, // X
                { pressed: false, value: 0 }, // Y
            ],
            axes: [0, 0, 0, 0] // Left stick X/Y, Right stick X/Y
        };

        // Mock navigator.getGamepads
        mockNavigator = {
            getGamepads: jest.fn(() => [mockGamepad, null, null, null])
        };

        // Mock global objects
        global.navigator = mockNavigator;
        global.window = {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        };
        global.performance = {
            now: jest.fn(() => 1000)
        };

        // Mock setInterval/clearInterval
        jest.useFakeTimers();

        adapter = new GamepadAdapter(mockEventManager);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
        delete global.navigator;
        delete global.window;
        delete global.performance;
    });

    describe('initialization', () => {
        test('should create adapter with default options', () => {
            expect(adapter).toBeInstanceOf(GamepadAdapter);
            expect(adapter.isInitialized()).toBe(false);
        });

        test('should create adapter with custom options', () => {
            const customAdapter = new GamepadAdapter(mockEventManager, {
                pollInterval: 32,
                deadzone: 0.2,
                triggerThreshold: 0.2
            });
            
            expect(customAdapter.options.pollInterval).toBe(32);
            expect(customAdapter.options.deadzone).toBe(0.2);
            expect(customAdapter.options.triggerThreshold).toBe(0.2);
        });

        test('should initialize when gamepad API is supported', () => {
            adapter.initialize();
            
            expect(adapter.isInitialized()).toBe(true);
            expect(global.window.addEventListener).toHaveBeenCalledWith('gamepadconnected', expect.any(Function));
            expect(global.window.addEventListener).toHaveBeenCalledWith('gamepaddisconnected', expect.any(Function));
        });

        test('should not initialize when gamepad API is not supported', () => {
            delete global.navigator.getGamepads;
            
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
            
            adapter.initialize();
            
            expect(adapter.isInitialized()).toBe(false);
            expect(consoleWarn).toHaveBeenCalledWith('Gamepad API not supported');
            
            consoleWarn.mockRestore();
        });

        test('should not initialize twice', () => {
            adapter.initialize();
            adapter.initialize();
            
            expect(global.window.addEventListener).toHaveBeenCalledTimes(2); // Should only be called once per event
        });
    });

    describe('cleanup', () => {
        beforeEach(() => {
            adapter.initialize();
        });

        test('should cleanup event listeners and polling', () => {
            adapter.cleanup();
            
            expect(adapter.isInitialized()).toBe(false);
            expect(global.window.removeEventListener).toHaveBeenCalledWith('gamepadconnected', expect.any(Function));
            expect(global.window.removeEventListener).toHaveBeenCalledWith('gamepaddisconnected', expect.any(Function));
        });

        test('should clear internal state', () => {
            adapter.handleGamepadConnected({ gamepad: mockGamepad });
            
            expect(adapter.isGamepadConnected(0)).toBe(true);
            
            adapter.cleanup();
            
            expect(adapter.isGamepadConnected(0)).toBe(false);
        });
    });

    describe('gamepad connection/disconnection', () => {
        beforeEach(() => {
            adapter.initialize();
        });

        test('should handle gamepad connection', () => {
            const connectEvent = { gamepad: mockGamepad };
            adapter.handleGamepadConnected(connectEvent);
            
            expect(adapter.isGamepadConnected(0)).toBe(true);
            expect(adapter.getGamepad(0)).toBe(mockGamepad);
            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: {
                    type: 'gamepad',
                    index: 0,
                    id: mockGamepad.id,
                    timestamp: expect.any(Number)
                }
            });
        });

        test('should handle gamepad disconnection', () => {
            // First connect
            adapter.handleGamepadConnected({ gamepad: mockGamepad });
            expect(adapter.isGamepadConnected(0)).toBe(true);
            
            // Then disconnect
            const disconnectEvent = { gamepad: mockGamepad };
            adapter.handleGamepadDisconnected(disconnectEvent);
            
            expect(adapter.isGamepadConnected(0)).toBe(false);
            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: {
                    type: 'gamepad',
                    index: 0,
                    id: mockGamepad.id,
                    timestamp: expect.any(Number)
                }
            });
        });
    });

    describe('button input processing', () => {
        beforeEach(() => {
            adapter.initialize();
            adapter.handleGamepadConnected({ gamepad: mockGamepad });
        });

        test('should detect button press', () => {
            // Simulate button press
            const updatedGamepad = {
                ...mockGamepad,
                buttons: [
                    { pressed: true, value: 1 }, // A button pressed
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 }
                ]
            };
            
            mockNavigator.getGamepads.mockReturnValue([updatedGamepad, null, null, null]);
            
            // Trigger polling
            jest.advanceTimersByTime(16);
            
            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: {
                    type: 'gamepad',
                    gamepadIndex: 0,
                    button: 0,
                    buttonName: 'A',
                    action: 'press',
                    value: 1,
                    timestamp: expect.any(Number)
                }
            });
        });

        test('should detect button release', () => {
            // First set up a pressed button state
            const pressedGamepad = {
                ...mockGamepad,
                buttons: [
                    { pressed: true, value: 1 },
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 }
                ]
            };
            
            adapter.previousStates.set(0, adapter.createGamepadState(pressedGamepad));
            
            // Now simulate button release
            const releasedGamepad = {
                ...mockGamepad,
                buttons: [
                    { pressed: false, value: 0 }, // A button released
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 }
                ]
            };
            
            mockNavigator.getGamepads.mockReturnValue([releasedGamepad, null, null, null]);
            
            // Trigger polling
            jest.advanceTimersByTime(16);
            
            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: {
                    type: 'gamepad',
                    gamepadIndex: 0,
                    button: 0,
                    buttonName: 'A',
                    action: 'release',
                    value: 0,
                    timestamp: expect.any(Number)
                }
            });
        });

        test('should handle analog trigger input', () => {
            // Set up previous state with no trigger pressure
            adapter.previousStates.set(0, adapter.createGamepadState(mockGamepad));
            
            // Simulate analog trigger press
            const triggerGamepad = {
                ...mockGamepad,
                buttons: [
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 },
                    { pressed: true, value: 0.7 }, // LT (index 6) with analog value
                    { pressed: false, value: 0 }
                ]
            };
            
            mockNavigator.getGamepads.mockReturnValue([triggerGamepad, null, null, null]);
            
            // Trigger polling
            jest.advanceTimersByTime(16);
            
            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: {
                    type: 'gamepad',
                    gamepadIndex: 0,
                    button: 6,
                    buttonName: 'LT',
                    value: 0.7,
                    previousValue: 0,
                    timestamp: expect.any(Number)
                }
            });
        });
    });

    describe('analog stick input processing', () => {
        beforeEach(() => {
            adapter.initialize();
            adapter.handleGamepadConnected({ gamepad: mockGamepad });
        });

        test('should detect analog stick movement', () => {
            // Set up previous state
            adapter.previousStates.set(0, adapter.createGamepadState(mockGamepad));
            
            // Simulate left stick movement
            const stickGamepad = {
                ...mockGamepad,
                axes: [0.5, -0.3, 0, 0] // Left stick X=0.5, Y=-0.3
            };
            
            mockNavigator.getGamepads.mockReturnValue([stickGamepad, null, null, null]);
            
            // Trigger polling
            jest.advanceTimersByTime(16);
            
            // Should emit events for both X and Y axis changes
            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: {
                    type: 'gamepad',
                    gamepadIndex: 0,
                    axis: 0,
                    axisName: 'LeftStickX',
                    value: 0.5,
                    rawValue: 0.5,
                    previousValue: 0,
                    timestamp: expect.any(Number)
                }
            });
            
            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: {
                    type: 'gamepad',
                    gamepadIndex: 0,
                    axis: 1,
                    axisName: 'LeftStickY',
                    value: -0.3,
                    rawValue: -0.3,
                    previousValue: 0,
                    timestamp: expect.any(Number)
                }
            });
        });

        test('should apply deadzone to analog stick input', () => {
            // Set up previous state
            adapter.previousStates.set(0, adapter.createGamepadState(mockGamepad));
            
            // Simulate small stick movement within deadzone
            const deadzonedGamepad = {
                ...mockGamepad,
                axes: [0.05, -0.08, 0, 0] // Values within default deadzone of 0.1
            };
            
            mockNavigator.getGamepads.mockReturnValue([deadzonedGamepad, null, null, null]);
            
            // Trigger polling
            jest.advanceTimersByTime(16);
            
            // Should not emit events due to deadzone
            expect(mockEventManager.emit).not.toHaveBeenCalledWith('input:raw', expect.objectContaining({
                data: expect.objectContaining({
                    axis: expect.any(Number)
                })
            }));
        });

        test('should handle movement outside deadzone', () => {
            // Set up previous state
            adapter.previousStates.set(0, adapter.createGamepadState(mockGamepad));
            
            // Simulate stick movement outside deadzone
            const activeGamepad = {
                ...mockGamepad,
                axes: [0.2, -0.15, 0, 0] // Values outside default deadzone of 0.1
            };
            
            mockNavigator.getGamepads.mockReturnValue([activeGamepad, null, null, null]);
            
            // Trigger polling
            jest.advanceTimersByTime(16);
            
            // Should emit events for movements outside deadzone
            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: {
                    type: 'gamepad',
                    gamepadIndex: 0,
                    axis: 0,
                    axisName: 'LeftStickX',
                    value: 0.2,
                    rawValue: 0.2,
                    previousValue: 0,
                    timestamp: expect.any(Number)
                }
            });
        });
    });

    describe('public API methods', () => {
        beforeEach(() => {
            adapter.initialize();
            adapter.handleGamepadConnected({ gamepad: mockGamepad });
        });

        test('should get connected gamepads', () => {
            const gamepads = adapter.getGamepads();
            expect(gamepads).toHaveLength(1);
            expect(gamepads[0]).toBe(mockGamepad);
        });

        test('should get specific gamepad', () => {
            expect(adapter.getGamepad(0)).toBe(mockGamepad);
            expect(adapter.getGamepad(1)).toBeUndefined();
        });

        test('should check gamepad connection status', () => {
            expect(adapter.isGamepadConnected(0)).toBe(true);
            expect(adapter.isGamepadConnected(1)).toBe(false);
        });

        test('should get connected gamepad count', () => {
            expect(adapter.getConnectedGamepadCount()).toBe(1);
        });

        test('should check button press status', () => {
            // Update gamepad with pressed button
            const pressedGamepad = {
                ...mockGamepad,
                buttons: [
                    { pressed: true, value: 1 },
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 }
                ]
            };
            
            adapter.gamepads.set(0, pressedGamepad);
            
            expect(adapter.isButtonPressed(0, 0)).toBe(true);
            expect(adapter.isButtonPressed(0, 1)).toBe(false);
            expect(adapter.isButtonPressed(1, 0)).toBe(false); // Non-existent gamepad
        });

        test('should get button value', () => {
            const analogGamepad = {
                ...mockGamepad,
                buttons: [
                    { pressed: true, value: 0.7 },
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 },
                    { pressed: false, value: 0 }
                ]
            };
            
            adapter.gamepads.set(0, analogGamepad);
            
            expect(adapter.getButtonValue(0, 0)).toBe(0.7);
            expect(adapter.getButtonValue(0, 1)).toBe(0);
            expect(adapter.getButtonValue(1, 0)).toBe(0); // Non-existent gamepad
        });

        test('should get axis value with deadzone', () => {
            const axisGamepad = {
                ...mockGamepad,
                axes: [0.5, -0.05, 0.2, 0] // Second value within deadzone
            };
            
            adapter.gamepads.set(0, axisGamepad);
            
            expect(adapter.getAxisValue(0, 0)).toBe(0.5);
            expect(adapter.getAxisValue(0, 1)).toBe(0); // Within deadzone
            expect(adapter.getAxisValue(0, 2)).toBe(0.2);
        });

        test('should get stick position', () => {
            const stickGamepad = {
                ...mockGamepad,
                axes: [0.3, -0.4, 0.6, 0.8] // Left stick: 0.3, -0.4; Right stick: 0.6, 0.8
            };
            
            adapter.gamepads.set(0, stickGamepad);
            
            const leftStick = adapter.getStickPosition(0, 'left');
            expect(leftStick).toEqual({ x: 0.3, y: -0.4 });
            
            const rightStick = adapter.getStickPosition(0, 'right');
            expect(rightStick).toEqual({ x: 0.6, y: 0.8 });
        });
    });

    describe('vibration support', () => {
        beforeEach(() => {
            adapter.initialize();
        });

        test('should handle vibration when supported', async () => {
            const mockVibrationActuator = {
                playEffect: jest.fn().mockResolvedValue()
            };
            
            const vibrationGamepad = {
                ...mockGamepad,
                vibrationActuator: mockVibrationActuator
            };
            
            adapter.gamepads.set(0, vibrationGamepad);
            
            await adapter.vibrate(0, 200, 0.3, 0.7);
            
            expect(mockVibrationActuator.playEffect).toHaveBeenCalledWith('dual-rumble', {
                duration: 200,
                weakMagnitude: 0.3,
                strongMagnitude: 0.7
            });
        });

        test('should handle vibration when not supported', async () => {
            adapter.gamepads.set(0, mockGamepad); // No vibrationActuator
            
            const result = await adapter.vibrate(0);
            
            expect(result).toBeUndefined();
        });

        test('should handle vibration errors gracefully', async () => {
            const mockVibrationActuator = {
                playEffect: jest.fn().mockRejectedValue(new Error('Vibration failed'))
            };
            
            const vibrationGamepad = {
                ...mockGamepad,
                vibrationActuator: mockVibrationActuator
            };
            
            adapter.gamepads.set(0, vibrationGamepad);
            
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
            
            await adapter.vibrate(0);
            
            expect(consoleWarn).toHaveBeenCalledWith('Gamepad vibration failed:', expect.any(Error));
            
            consoleWarn.mockRestore();
        });
    });

    describe('polling', () => {
        beforeEach(() => {
            adapter.initialize();
        });

        test('should start and stop polling', () => {
            expect(adapter.pollTimer).toBeTruthy();
            
            adapter.stopPolling();
            expect(adapter.pollTimer).toBeNull();
            
            adapter.startPolling();
            expect(adapter.pollTimer).toBeTruthy();
        });

        test('should not start polling twice', () => {
            const firstTimer = adapter.pollTimer;
            adapter.startPolling();
            
            expect(adapter.pollTimer).toBe(firstTimer);
        });

        test('should handle polling when gamepad API is unavailable', () => {
            delete global.navigator.getGamepads;
            
            expect(() => {
                jest.advanceTimersByTime(16);
            }).not.toThrow();
        });
    });

    describe('error handling', () => {
        test('should handle missing EventManager gracefully', () => {
            const adapterWithoutEM = new GamepadAdapter(null);
            
            expect(() => {
                adapterWithoutEM.initialize();
                adapterWithoutEM.handleGamepadConnected({ gamepad: mockGamepad });
            }).not.toThrow();
        });

        test('should handle cleanup when not initialized', () => {
            const uninitializedAdapter = new GamepadAdapter(mockEventManager);
            
            expect(() => {
                uninitializedAdapter.cleanup();
            }).not.toThrow();
        });

        test('should handle missing window object', () => {
            delete global.window;
            
            expect(() => {
                adapter.initialize();
                adapter.cleanup();
            }).not.toThrow();
        });
    });
});
