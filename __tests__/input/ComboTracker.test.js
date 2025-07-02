import ComboTracker from '../../src/input/ComboTracker.js';

describe('ComboTracker', () => {
    let tracker;
    let mockEventManager;

    beforeEach(() => {
        mockEventManager = {
            emit: jest.fn()
        };
        tracker = new ComboTracker(mockEventManager);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        test('should create tracker with default options', () => {
            expect(tracker).toBeInstanceOf(ComboTracker);
        });

        test('should create tracker with custom options', () => {
            const customTracker = new ComboTracker(mockEventManager, {
                timeout: 2000,
                maxSequenceLength: 10
            });
            expect(customTracker).toBeInstanceOf(ComboTracker);
        });
    });

    describe('combo registration', () => {
        test('should register simple combo', () => {
            const combo = ['KeyA', 'KeyB'];
            tracker.registerCombo('test-combo', combo);

            // Should not throw and should store the combo
            expect(() => tracker.registerCombo('test-combo', combo)).not.toThrow();
        });

        test('should register complex combo with timing', () => {
            const combo = [
                { key: 'KeyA', maxDelay: 500 },
                { key: 'KeyB', maxDelay: 300 }
            ];
            tracker.registerCombo('complex-combo', combo);

            expect(() => tracker.registerCombo('complex-combo', combo)).not.toThrow();
        });

        test('should register combo with callback', () => {
            const combo = ['KeyA', 'KeyB'];
            const callback = jest.fn();
            
            tracker.registerCombo('callback-combo', combo, callback);
            expect(() => tracker.registerCombo('callback-combo', combo, callback)).not.toThrow();
        });

        test('should handle invalid combo registration', () => {
            expect(() => tracker.registerCombo('', ['KeyA'])).not.toThrow();
            expect(() => tracker.registerCombo('test', [])).not.toThrow();
            expect(() => tracker.registerCombo('test', null)).not.toThrow();
        });
    });

    describe('combo unregistration', () => {
        test('should unregister existing combo', () => {
            const combo = ['KeyA', 'KeyB'];
            tracker.registerCombo('test-combo', combo);
            
            const result = tracker.unregisterCombo('test-combo');
            expect(result).toBe(true);
        });

        test('should return false for non-existent combo', () => {
            const result = tracker.unregisterCombo('non-existent');
            expect(result).toBe(false);
        });
    });

    describe('input processing', () => {
        beforeEach(() => {
            // Register some test combos
            tracker.registerCombo('simple', ['KeyA', 'KeyB']);
            tracker.registerCombo('triple', ['KeyX', 'KeyY', 'KeyZ']);
        });

        test('should detect simple two-key combo', () => {
            tracker.processInput('KeyA');
            tracker.processInput('KeyB');

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:combo', {
                data: {
                    name: 'simple',
                    sequence: ['KeyA', 'KeyB'],
                    timestamp: expect.any(Number)
                }
            });
        });

        test('should detect three-key combo', () => {
            tracker.processInput('KeyX');
            tracker.processInput('KeyY');
            tracker.processInput('KeyZ');

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:combo', {
                data: {
                    name: 'triple',
                    sequence: ['KeyX', 'KeyY', 'KeyZ'],
                    timestamp: expect.any(Number)
                }
            });
        });

        test('should not trigger combo with wrong sequence', () => {
            tracker.processInput('KeyA');
            tracker.processInput('KeyX'); // Wrong key

            expect(mockEventManager.emit).not.toHaveBeenCalledWith('input:combo', expect.anything());
        });

        test('should reset on wrong input', () => {
            tracker.processInput('KeyA');
            tracker.processInput('KeyX'); // Wrong key
            tracker.processInput('KeyA');
            tracker.processInput('KeyB'); // Should still work

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:combo', {
                data: {
                    name: 'simple',
                    sequence: ['KeyA', 'KeyB'],
                    timestamp: expect.any(Number)
                }
            });
        });

        test('should handle partial matches', () => {
            tracker.processInput('KeyA'); // Partial match for 'simple'
            
            // Should not emit combo yet
            expect(mockEventManager.emit).not.toHaveBeenCalledWith('input:combo', expect.anything());
        });

        test('should handle overlapping combos', () => {
            // Register overlapping combos
            tracker.registerCombo('ab', ['KeyA', 'KeyB']);
            tracker.registerCombo('abc', ['KeyA', 'KeyB', 'KeyC']);

            tracker.processInput('KeyA');
            tracker.processInput('KeyB');

            // Should emit the first matching combo
            expect(mockEventManager.emit).toHaveBeenCalledWith('input:combo', {
                data: {
                    name: 'ab',
                    sequence: ['KeyA', 'KeyB'],
                    timestamp: expect.any(Number)
                }
            });
        });
    });

    describe('timing and timeout', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            tracker = new ComboTracker(mockEventManager, { timeout: 1000 });
            tracker.registerCombo('timed', ['KeyA', 'KeyB']);
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should timeout combo sequence', () => {
            tracker.processInput('KeyA');
            
            // Fast forward past timeout
            jest.advanceTimersByTime(1100);
            
            tracker.processInput('KeyB');

            // Should not emit combo due to timeout
            expect(mockEventManager.emit).not.toHaveBeenCalledWith('input:combo', expect.anything());
        });

        test('should complete combo within timeout', () => {
            tracker.processInput('KeyA');
            
            // Fast forward but not past timeout
            jest.advanceTimersByTime(500);
            
            tracker.processInput('KeyB');

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:combo', {
                data: {
                    name: 'timed',
                    sequence: ['KeyA', 'KeyB'],
                    timestamp: expect.any(Number)
                }
            });
        });

        test('should reset timeout on new input', () => {
            tracker.processInput('KeyA');
            
            // Fast forward partway
            jest.advanceTimersByTime(500);
            
            // Process another valid input (should reset timeout)
            tracker.processInput('KeyA'); // Start over
            
            // Fast forward another 800ms (total would be 1300, but timeout was reset)
            jest.advanceTimersByTime(800);
            
            tracker.processInput('KeyB');

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:combo', {
                data: {
                    name: 'timed',
                    sequence: ['KeyA', 'KeyB'],
                    timestamp: expect.any(Number)
                }
            });
        });
    });

    describe('callback execution', () => {
        test('should execute callback when combo is triggered', () => {
            const callback = jest.fn();
            tracker.registerCombo('callback-test', ['KeyA', 'KeyB'], callback);

            tracker.processInput('KeyA');
            tracker.processInput('KeyB');

            expect(callback).toHaveBeenCalledWith({
                name: 'callback-test',
                sequence: ['KeyA', 'KeyB'],
                timestamp: expect.any(Number)
            });
        });

        test('should execute callback and emit event', () => {
            const callback = jest.fn();
            tracker.registerCombo('both-test', ['KeyA', 'KeyB'], callback);

            tracker.processInput('KeyA');
            tracker.processInput('KeyB');

            expect(callback).toHaveBeenCalled();
            expect(mockEventManager.emit).toHaveBeenCalledWith('input:combo', {
                data: {
                    name: 'both-test',
                    sequence: ['KeyA', 'KeyB'],
                    timestamp: expect.any(Number)
                }
            });
        });

        test('should handle callback errors gracefully', () => {
            const errorCallback = jest.fn(() => {
                throw new Error('Callback error');
            });
            
            tracker.registerCombo('error-test', ['KeyA', 'KeyB'], errorCallback);

            expect(() => {
                tracker.processInput('KeyA');
                tracker.processInput('KeyB');
            }).not.toThrow();

            // Should still emit event even if callback throws
            expect(mockEventManager.emit).toHaveBeenCalledWith('input:combo', expect.anything());
        });
    });

    describe('sequence length limits', () => {
        test('should respect max sequence length', () => {
            const shortTracker = new ComboTracker(mockEventManager, { maxSequenceLength: 2 });
            
            // Register a combo longer than the limit
            shortTracker.registerCombo('long', ['KeyA', 'KeyB', 'KeyC', 'KeyD']);

            // Input the full sequence
            shortTracker.processInput('KeyA');
            shortTracker.processInput('KeyB');
            shortTracker.processInput('KeyC');
            shortTracker.processInput('KeyD');

            // Should not trigger due to length limit
            expect(mockEventManager.emit).not.toHaveBeenCalledWith('input:combo', expect.anything());
        });

        test('should clear old inputs when sequence gets too long', () => {
            const shortTracker = new ComboTracker(mockEventManager, { maxSequenceLength: 3 });
            shortTracker.registerCombo('short', ['KeyB', 'KeyC']);

            // Input more than the limit
            shortTracker.processInput('KeyA'); // This should be dropped
            shortTracker.processInput('KeyB');
            shortTracker.processInput('KeyC');

            // Should still trigger the combo
            expect(mockEventManager.emit).toHaveBeenCalledWith('input:combo', {
                data: {
                    name: 'short',
                    sequence: ['KeyB', 'KeyC'],
                    timestamp: expect.any(Number)
                }
            });
        });
    });

    describe('edge cases', () => {
        test('should handle null/undefined inputs', () => {
            tracker.registerCombo('test', ['KeyA', 'KeyB']);

            expect(() => {
                tracker.processInput(null);
                tracker.processInput(undefined);
                tracker.processInput('');
            }).not.toThrow();

            expect(mockEventManager.emit).not.toHaveBeenCalledWith('input:combo', expect.anything());
        });

        test('should handle missing EventManager', () => {
            const trackerWithoutEM = new ComboTracker(null);
            trackerWithoutEM.registerCombo('test', ['KeyA', 'KeyB']);

            expect(() => {
                trackerWithoutEM.processInput('KeyA');
                trackerWithoutEM.processInput('KeyB');
            }).not.toThrow();
        });

        test('should clear sequence on cleanup', () => {
            tracker.registerCombo('test', ['KeyA', 'KeyB']);
            tracker.processInput('KeyA'); // Partial sequence

            // Simulate cleanup or reset
            tracker.processInput('KeyX'); // Wrong input should clear
            tracker.processInput('KeyA');
            tracker.processInput('KeyB');

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:combo', {
                data: {
                    name: 'test',
                    sequence: ['KeyA', 'KeyB'],
                    timestamp: expect.any(Number)
                }
            });
        });
    });

    describe('multiple combo detection', () => {
        test('should detect multiple different combos', () => {
            tracker.registerCombo('combo1', ['KeyA', 'KeyB']);
            tracker.registerCombo('combo2', ['KeyX', 'KeyY']);

            // Trigger first combo
            tracker.processInput('KeyA');
            tracker.processInput('KeyB');

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:combo', {
                data: {
                    name: 'combo1',
                    sequence: ['KeyA', 'KeyB'],
                    timestamp: expect.any(Number)
                }
            });

            // Reset mock and trigger second combo
            mockEventManager.emit.mockClear();

            tracker.processInput('KeyX');
            tracker.processInput('KeyY');

            expect(mockEventManager.emit).toHaveBeenCalledWith('input:combo', {
                data: {
                    name: 'combo2',
                    sequence: ['KeyX', 'KeyY'],
                    timestamp: expect.any(Number)
                }
            });
        });
    });
});
