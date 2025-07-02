/**
 * @jest-environment jsdom
 */
import InputManager from '../../src/input/InputManager.js';
import KeyboardAdapter from '../../src/input/adapters/KeyboardAdapter.js';
import EventManager from '../../src/core/EventManager.js';

// Mock the dynamic imports
jest.mock('../../src/input/BindingMap.js', () => {
  return {
    default: class MockBindingMap {
      constructor() {
        this.bindings = new Map();
        this.activeContext = 'default';
      }
      
      loadBindings(bindings) {
        this.bindings = bindings;
      }
      
      setActiveContext(context) {
        this.activeContext = context;
      }
      
      getBindings() {
        return {};
      }
      
      mapInputToActions(inputData, context) {
        // Simple mock mapping for testing
        if (inputData.key === 'w') {
          return [{ name: 'move_up', type: 'press', value: 1 }];
        }
        return [];
      }
      
      setDebugMode() {}
    }
  };
});

jest.mock('../../src/input/KeyBuffer.js', () => {
  return {
    default: class MockKeyBuffer {
      constructor(size) {
        this.size = size;
        this.inputs = [];
      }
      
      addInput(input) {
        this.inputs.push(input);
      }
      
      update() {}
      setDebugMode() {}
    }
  };
});

jest.mock('../../src/input/ComboTracker.js', () => {
  return {
    default: class MockComboTracker {
      constructor(timeout) {
        this.timeout = timeout;
      }
      
      checkForCombo() {
        return null;
      }
      
      update() {}
      setDebugMode() {}
    }
  };
});

jest.mock('../../src/input/ConfigProvider.js', () => {
  return {
    default: class MockConfigProvider {
      async loadConfig() {
        return {
          bindings: {},
          settings: {}
        };
      }
      
      async saveConfig() {}
    }
  };
});

describe('InputManager', () => {
  let inputManager;
  let eventManager;

  beforeEach(() => {
    eventManager = new EventManager();
    inputManager = new InputManager(eventManager);
  });

  afterEach(() => {
    if (inputManager.isInitialized) {
      inputManager.dispose();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      expect(inputManager.isInitialized).toBe(false);
      
      await inputManager.initialize();
      
      expect(inputManager.isInitialized).toBe(true);
      expect(inputManager.currentContext).toBe('default');
      expect(inputManager.contextStack).toEqual([]);
    });

    test('should throw error if already initialized', async () => {
      await inputManager.initialize();
      
      await expect(inputManager.initialize()).rejects.toThrow('InputManager already initialized');
    });

    test('should emit initialized event', async () => {
      const initCallback = jest.fn();
      eventManager.on('input:initialized', initCallback);
      
      await inputManager.initialize();
      
      expect(initCallback).toHaveBeenCalled();
    });
  });

  describe('Device Adapter Management', () => {
    test('should register device adapter', async () => {
      await inputManager.initialize();
      const adapter = new KeyboardAdapter();
      
      inputManager.registerAdapter('keyboard', adapter);
      
      expect(inputManager.deviceAdapters.has('keyboard')).toBe(true);
      expect(inputManager.deviceAdapters.get('keyboard')).toBe(adapter);
    });

    test('should warn when overwriting existing adapter', async () => {
      await inputManager.initialize();
      const adapter1 = new KeyboardAdapter();
      const adapter2 = new KeyboardAdapter();
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      inputManager.registerAdapter('keyboard', adapter1);
      inputManager.registerAdapter('keyboard', adapter2);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Overwriting existing adapter')
      );
      
      consoleSpy.mockRestore();
    });

    test('should emit adapter registered event', async () => {
      await inputManager.initialize();
      const adapter = new KeyboardAdapter();
      const callback = jest.fn();
      
      eventManager.on('input:adapter_registered', callback);
      inputManager.registerAdapter('keyboard', adapter);
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deviceType: 'keyboard',
            adapter: adapter
          })
        })
      );
    });
  });

  describe('Context Management', () => {
    beforeEach(async () => {
      await inputManager.initialize();
    });

    test('should start with default context', () => {
      expect(inputManager.currentContext).toBe('default');
      expect(inputManager.contextStack).toEqual([]);
    });

    test('should push new context', () => {
      const callback = jest.fn();
      eventManager.on('input:context_changed', callback);
      
      inputManager.pushContext('menu');
      
      expect(inputManager.currentContext).toBe('menu');
      expect(inputManager.contextStack).toEqual(['default']);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            context: 'menu',
            stack: ['default']
          })
        })
      );
    });

    test('should pop context', () => {
      inputManager.pushContext('menu');
      inputManager.pushContext('submenu');
      
      const callback = jest.fn();
      eventManager.on('input:context_changed', callback);
      
      inputManager.popContext();
      
      expect(inputManager.currentContext).toBe('menu');
      expect(inputManager.contextStack).toEqual(['default']);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            context: 'menu',
            stack: ['default']
          })
        })
      );
    });

    test('should warn when popping empty stack', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      inputManager.popContext();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot pop context - stack is empty')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Action State Management', () => {
    beforeEach(async () => {
      await inputManager.initialize();
    });

    test('should process action input correctly', () => {
      const action = {
        name: 'jump',
        type: 'press',
        value: 1,
        timestamp: performance.now()
      };
      
      inputManager.processActionInput(action);
      
      expect(inputManager.isActionPressed('jump')).toBe(true);
      expect(inputManager.isActionJustPressed('jump')).toBe(true);
      expect(inputManager.getActionValue('jump')).toBe(1);
    });

    test('should handle action release', () => {
      // First press the action
      inputManager.processActionInput({
        name: 'jump',
        type: 'press',
        value: 1,
        timestamp: performance.now()
      });
      
      // Update to reset just pressed flag
      inputManager.updateActionStates();
      
      // Then release it
      inputManager.processActionInput({
        name: 'jump',
        type: 'release',
        value: 0,
        timestamp: performance.now()
      });
      
      expect(inputManager.isActionPressed('jump')).toBe(false);
      expect(inputManager.isActionJustReleased('jump')).toBe(true);
      expect(inputManager.getActionValue('jump')).toBe(0);
    });

    test('should handle analog input', () => {
      const action = {
        name: 'move_horizontal',
        type: 'analog',
        value: 0.7,
        timestamp: performance.now()
      };
      
      inputManager.processActionInput(action);
      
      expect(inputManager.isActionPressed('move_horizontal')).toBe(true); // Above deadzone
      expect(inputManager.getActionValue('move_horizontal')).toBe(0.7);
    });

    test('should respect analog deadzone', () => {
      inputManager.config.analogDeadzone = 0.2;
      
      const action = {
        name: 'move_horizontal',
        type: 'analog',
        value: 0.1, // Below deadzone
        timestamp: performance.now()
      };
      
      inputManager.processActionInput(action);
      
      expect(inputManager.isActionPressed('move_horizontal')).toBe(false);
      expect(inputManager.getActionValue('move_horizontal')).toBe(0.1);
    });
  });

  describe('Raw Input Processing', () => {
    beforeEach(async () => {
      await inputManager.initialize();
    });

    test('should process raw keyboard input', () => {
      const inputData = {
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'w',
        type: 'press',
        value: 1,
        timestamp: performance.now()
      };
      
      const actionSpy = jest.fn();
      eventManager.on('input:action_pressed', actionSpy);
      
      inputManager.processRawInput('keyboard', inputData);
      inputManager.updateActionStates();
      
      expect(actionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'move_up',
            value: 1
          })
        })
      );
    });

    test('should ignore input when paused', () => {
      inputManager.setPaused(true);
      
      const inputData = {
        deviceType: 'keyboard',
        key: 'w',
        type: 'press'
      };
      
      inputManager.processRawInput('keyboard', inputData);
      
      expect(inputManager.isActionPressed('move_up')).toBe(false);
    });

    test('should ignore input when not initialized', () => {
      // Create a fresh uninitialized input manager
      const uninitializedManager = new InputManager(eventManager);
      
      const inputData = {
        deviceType: 'keyboard',
        key: 'w',
        type: 'press'
      };
      
      uninitializedManager.processRawInput('keyboard', inputData);
      
      expect(uninitializedManager.isActionPressed('move_up')).toBe(false);
    });
  });

  describe('Update Loop', () => {
    beforeEach(async () => {
      await inputManager.initialize();
    });

    test('should update frame data', () => {
      const deltaTime = 16.67; // ~60fps
      const initialFrameNumber = inputManager.frameData.frameNumber;
      
      inputManager.update(deltaTime);
      
      expect(inputManager.frameData.deltaTime).toBe(deltaTime);
      expect(inputManager.frameData.frameNumber).toBe(initialFrameNumber + 1);
      expect(inputManager.frameData.timestamp).toBeGreaterThan(0);
    });

    test('should update device adapters', () => {
      const adapter = new KeyboardAdapter();
      const updateSpy = jest.spyOn(adapter, 'update').mockImplementation();
      
      inputManager.registerAdapter('keyboard', adapter);
      inputManager.update(16.67);
      
      expect(updateSpy).toHaveBeenCalledWith(16.67);
      
      updateSpy.mockRestore();
    });

    test('should handle adapter update errors', () => {
      const adapter = new KeyboardAdapter();
      jest.spyOn(adapter, 'update').mockImplementation(() => {
        throw new Error('Adapter error');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      inputManager.registerAdapter('keyboard', adapter);
      inputManager.update(16.67);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error updating keyboard adapter'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    test('should not update when paused', () => {
      const adapter = new KeyboardAdapter();
      const updateSpy = jest.spyOn(adapter, 'update').mockImplementation();
      
      inputManager.registerAdapter('keyboard', adapter);
      inputManager.setPaused(true);
      inputManager.update(16.67);
      
      expect(updateSpy).not.toHaveBeenCalled();
      
      updateSpy.mockRestore();
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await inputManager.initialize();
    });

    test('should load configuration', async () => {
      const config = {
        bindings: { test: 'binding' },
        settings: { testSetting: true }
      };
      
      const callback = jest.fn();
      eventManager.on('input:config_loaded', callback);
      
      await inputManager.loadConfig(config);
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ 
          data: expect.objectContaining({ config })
        })
      );
    });

    test('should save configuration', async () => {
      const callback = jest.fn();
      eventManager.on('input:config_saved', callback);
      
      await inputManager.saveConfig();
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Debug Mode', () => {
    beforeEach(async () => {
      await inputManager.initialize();
    });

    test('should enable debug mode', () => {
      const adapter = new KeyboardAdapter();
      const debugSpy = jest.spyOn(adapter, 'setDebugMode').mockImplementation();
      
      inputManager.registerAdapter('keyboard', adapter);
      inputManager.setDebugMode(true);
      
      expect(inputManager.debugMode).toBe(true);
      expect(debugSpy).toHaveBeenCalledWith(true);
      
      debugSpy.mockRestore();
    });

    test('should provide debug information', () => {
      const debugInfo = inputManager.getDebugInfo();
      
      expect(debugInfo).toEqual(
        expect.objectContaining({
          initialized: true,
          paused: false,
          currentContext: 'default',
          contextStack: [],
          activeAdapters: [],
          actionStates: {},
          frameData: expect.any(Object),
          config: expect.any(Object)
        })
      );
    });
  });

  describe('Cleanup', () => {
    test('should dispose properly', async () => {
      await inputManager.initialize();
      
      const adapter = new KeyboardAdapter();
      const disposeSpy = jest.spyOn(adapter, 'dispose').mockImplementation();
      
      inputManager.registerAdapter('keyboard', adapter);
      
      const callback = jest.fn();
      eventManager.on('input:disposed', callback);
      
      inputManager.dispose();
      
      expect(disposeSpy).toHaveBeenCalled();
      expect(inputManager.isInitialized).toBe(false);
      expect(inputManager.deviceAdapters.size).toBe(0);
      expect(inputManager.actionStates.size).toBe(0);
      expect(callback).toHaveBeenCalled();
      
      disposeSpy.mockRestore();
    });
  });
});
