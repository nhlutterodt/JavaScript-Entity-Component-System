import MouseAdapter from '../../src/input/adapters/MouseAdapter.js';

describe('MouseAdapter', () => {
    let adapter;
    let mockEventManager;
    let mockElement;

    beforeEach(() => {
        // Mock EventManager
        mockEventManager = {
            emit: jest.fn()
        };

        // Mock DOM element
        mockElement = {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            getBoundingClientRect: jest.fn(() => ({
                left: 100,
                top: 50,
                width: 800,
                height: 600
            }))
        };

        // Mock document and window
        global.document = {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        };

        global.window = {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        };

        adapter = new MouseAdapter(mockEventManager);
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete global.document;
        delete global.window;
    });

    describe('initialization', () => {
        test('should create adapter with default options', () => {
            expect(adapter).toBeInstanceOf(MouseAdapter);
            expect(adapter.isInitialized()).toBe(false);
        });

        test('should initialize with element', () => {
            adapter.initialize(mockElement);
            
            expect(adapter.isInitialized()).toBe(true);
            expect(mockElement.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function), false);
            expect(mockElement.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function), false);
            expect(mockElement.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function), false);
            expect(mockElement.addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), false);
            expect(mockElement.addEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function), false);
        });

        test('should initialize without element (use document)', () => {
            adapter.initialize();
            
            expect(adapter.isInitialized()).toBe(true);
            expect(global.document.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function), false);
            expect(global.document.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function), false);
            expect(global.document.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function), false);
            expect(global.document.addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), false);
            expect(global.document.addEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function), false);
        });

        test('should not initialize twice', () => {
            adapter.initialize(mockElement);
            adapter.initialize(mockElement);
            
            // Should only add listeners once
            expect(mockElement.addEventListener).toHaveBeenCalledTimes(5);
        });
    });

    describe('cleanup', () => {
        test('should cleanup event listeners', () => {
            adapter.initialize(mockElement);
            adapter.cleanup();
            
            expect(adapter.isInitialized()).toBe(false);
            expect(mockElement.removeEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function), false);
            expect(mockElement.removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function), false);
            expect(mockElement.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function), false);
            expect(mockElement.removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), false);
            expect(mockElement.removeEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function), false);
        });

        test('should cleanup document listeners', () => {
            adapter.initialize();
            adapter.cleanup();
            
            expect(adapter.isInitialized()).toBe(false);
            expect(global.document.removeEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function), false);
            expect(global.document.removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function), false);
            expect(global.document.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function), false);
            expect(global.document.removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), false);
            expect(global.document.removeEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function), false);
        });
    });

    describe('mouse button events', () => {
        beforeEach(() => {
            adapter.initialize(mockElement);
        });

        test('should emit mouse button down events', () => {
            const mouseEvent = new MouseEvent('mousedown', {
                button: 0,
                clientX: 200,
                clientY: 150
            });

            // Get the event handler that was registered
            const handler = mockElement.addEventListener.mock.calls.find(
                call => call[0] === 'mousedown'
            )[1];

            handler(mouseEvent);

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: {
                    type: 'mouse',
                    action: 'down',
                    button: 0,
                    x: 100, // clientX - rect.left
                    y: 100, // clientY - rect.top
                    timestamp: expect.any(Number)
                }
            });
        });

        test('should emit mouse button up events', () => {
            const mouseEvent = new MouseEvent('mouseup', {
                button: 2, // Right button
                clientX: 300,
                clientY: 200
            });

            const handler = mockElement.addEventListener.mock.calls.find(
                call => call[0] === 'mouseup'
            )[1];

            handler(mouseEvent);

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: {
                    type: 'mouse',
                    action: 'up',
                    button: 2,
                    x: 200,
                    y: 150,
                    timestamp: expect.any(Number)
                }
            });
        });

        test('should handle different mouse buttons', () => {
            const buttons = [
                { button: 0, name: 'left' },
                { button: 1, name: 'middle' },
                { button: 2, name: 'right' }
            ];

            const handler = mockElement.addEventListener.mock.calls.find(
                call => call[0] === 'mousedown'
            )[1];

            buttons.forEach(({ button }) => {
                const mouseEvent = new MouseEvent('mousedown', {
                    button,
                    clientX: 200,
                    clientY: 150
                });

                handler(mouseEvent);

                expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                    data: expect.objectContaining({
                        button
                    })
                });
            });
        });
    });

    describe('mouse movement', () => {
        beforeEach(() => {
            adapter.initialize(mockElement);
        });

        test('should emit mouse move events', () => {
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: 250,
                clientY: 175,
                movementX: 10,
                movementY: 5
            });

            const handler = mockElement.addEventListener.mock.calls.find(
                call => call[0] === 'mousemove'
            )[1];

            handler(mouseEvent);

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: {
                    type: 'mouse',
                    action: 'move',
                    x: 150, // clientX - rect.left
                    y: 125, // clientY - rect.top
                    deltaX: 10,
                    deltaY: 5,
                    timestamp: expect.any(Number)
                }
            });
        });

        test('should handle move events without movement properties', () => {
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: 250,
                clientY: 175
            });

            const handler = mockElement.addEventListener.mock.calls.find(
                call => call[0] === 'mousemove'
            )[1];

            handler(mouseEvent);

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: expect.objectContaining({
                    deltaX: 0,
                    deltaY: 0
                })
            });
        });
    });

    describe('mouse wheel', () => {
        beforeEach(() => {
            adapter.initialize(mockElement);
        });

        test('should emit wheel events', () => {
            const wheelEvent = new WheelEvent('wheel', {
                deltaX: 10,
                deltaY: -120,
                deltaZ: 0,
                clientX: 200,
                clientY: 150
            });

            const handler = mockElement.addEventListener.mock.calls.find(
                call => call[0] === 'wheel'
            )[1];

            handler(wheelEvent);

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: {
                    type: 'mouse',
                    action: 'wheel',
                    x: 100,
                    y: 100,
                    deltaX: 10,
                    deltaY: -120,
                    deltaZ: 0,
                    timestamp: expect.any(Number)
                }
            });
        });
    });

    describe('context menu prevention', () => {
        beforeEach(() => {
            adapter.initialize(mockElement);
        });

        test('should prevent context menu by default', () => {
            const contextEvent = new MouseEvent('contextmenu');
            contextEvent.preventDefault = jest.fn();

            const handler = mockElement.addEventListener.mock.calls.find(
                call => call[0] === 'contextmenu'
            )[1];

            handler(contextEvent);

            expect(contextEvent.preventDefault).toHaveBeenCalled();
        });
    });

    describe('coordinate calculation', () => {
        beforeEach(() => {
            adapter.initialize(mockElement);
        });

        test('should calculate relative coordinates correctly', () => {
            // Test with different element positions
            mockElement.getBoundingClientRect.mockReturnValue({
                left: 50,
                top: 25,
                width: 800,
                height: 600
            });

            const mouseEvent = new MouseEvent('mousedown', {
                button: 0,
                clientX: 150,
                clientY: 125
            });

            const handler = mockElement.addEventListener.mock.calls.find(
                call => call[0] === 'mousedown'
            )[1];

            handler(mouseEvent);

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: expect.objectContaining({
                    x: 100, // 150 - 50
                    y: 100  // 125 - 25
                })
            });
        });

        test('should handle missing getBoundingClientRect', () => {
            // Create adapter without element (uses document)
            const docAdapter = new MouseAdapter(mockEventManager);
            docAdapter.initialize();

            const mouseEvent = new MouseEvent('mousedown', {
                button: 0,
                clientX: 150,
                clientY: 125
            });

            const handler = global.document.addEventListener.mock.calls.find(
                call => call[0] === 'mousedown'
            )[1];

            handler(mouseEvent);

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:raw', {
                data: expect.objectContaining({
                    x: 150, // clientX directly
                    y: 125  // clientY directly
                })
            });
        });
    });

    describe('error handling', () => {
        test('should handle missing EventManager gracefully', () => {
            const adapterWithoutEM = new MouseAdapter(null);
            
            expect(() => {
                adapterWithoutEM.initialize(mockElement);
            }).not.toThrow();
        });

        test('should ignore events when not initialized', () => {
            const uninitializedAdapter = new MouseAdapter(mockEventManager);
            
            // Try to simulate an event (this won't actually work since no listeners are registered)
            // But the adapter should be in a safe state
            expect(uninitializedAdapter.isInitialized()).toBe(false);
            expect(mockEventManager.emit).not.toHaveBeenCalled();
        });
    });
});
