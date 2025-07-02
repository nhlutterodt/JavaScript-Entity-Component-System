/**
 * @jest-environment jsdom
 */
import BindingMap from '../../src/input/BindingMap.js';

describe('BindingMap', () => {
  let bindingMap;

  beforeEach(() => {
    bindingMap = new BindingMap();
  });

  describe('Initialization', () => {
    test('should initialize with default context', () => {
      expect(bindingMap.activeContext).toBe('default');
      expect(bindingMap.bindings.has('default')).toBe(true);
      expect(bindingMap.bindings.get('default').size).toBe(0);
    });
  });

  describe('Binding Management', () => {
    test('should add simple binding', () => {
      bindingMap.addBinding('default', 'move_up', 'w');
      
      const contextMap = bindingMap.bindings.get('default');
      expect(contextMap.size).toBe(1);
      
      const bindingKey = 'keyboard:key:w';
      expect(contextMap.has(bindingKey)).toBe(true);
      
      const actions = contextMap.get(bindingKey);
      expect(actions).toHaveLength(1);
      expect(actions[0].actionName).toBe('move_up');
    });

    test('should add complex binding with modifiers', () => {
      const binding = {
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'c',
        modifiers: { ctrl: true }
      };
      
      bindingMap.addBinding('default', 'copy', binding);
      
      const contextMap = bindingMap.bindings.get('default');
      const bindingKey = 'keyboard:key:c:ctrl';
      
      expect(contextMap.has(bindingKey)).toBe(true);
    });

    test('should add multiple bindings for same action', () => {
      bindingMap.addBinding('default', 'move_up', 'w');
      bindingMap.addBinding('default', 'move_up', 'up');
      
      const contextMap = bindingMap.bindings.get('default');
      expect(contextMap.size).toBe(2);
      
      expect(contextMap.has('keyboard:key:w')).toBe(true);
      expect(contextMap.has('keyboard:key:up')).toBe(true);
    });

    test('should load bindings configuration', () => {
      const config = {
        default: {
          move_up: ['w', 'up'],
          move_down: ['s', 'down'],
          jump: 'space'
        },
        menu: {
          navigate_up: 'up',
          navigate_down: 'down',
          select: 'enter'
        }
      };
      
      bindingMap.loadBindings(config);
      
      expect(bindingMap.bindings.has('default')).toBe(true);
      expect(bindingMap.bindings.has('menu')).toBe(true);
      
      const defaultContext = bindingMap.bindings.get('default');
      expect(defaultContext.has('keyboard:key:w')).toBe(true);
      expect(defaultContext.has('keyboard:key:up')).toBe(true);
      expect(defaultContext.has('keyboard:key:space')).toBe(true);
    });

    test('should remove specific binding', () => {
      bindingMap.addBinding('default', 'move_up', 'w');
      bindingMap.addBinding('default', 'move_up', 'up');
      
      bindingMap.removeBinding('default', 'move_up', 'w');
      
      const contextMap = bindingMap.bindings.get('default');
      expect(contextMap.has('keyboard:key:w')).toBe(false);
      expect(contextMap.has('keyboard:key:up')).toBe(true);
    });

    test('should remove all bindings for action', () => {
      bindingMap.addBinding('default', 'move_up', 'w');
      bindingMap.addBinding('default', 'move_up', 'up');
      bindingMap.addBinding('default', 'jump', 'space');
      
      bindingMap.removeBinding('default', 'move_up');
      
      const contextMap = bindingMap.bindings.get('default');
      expect(contextMap.has('keyboard:key:w')).toBe(false);
      expect(contextMap.has('keyboard:key:up')).toBe(false);
      expect(contextMap.has('keyboard:key:space')).toBe(true);
    });
  });

  describe('Input Mapping', () => {
    beforeEach(() => {
      const config = {
        default: {
          move_up: ['w', 'up'],
          move_down: ['s', 'down'],
          jump: 'space',
          copy: 'ctrl+c'
        },
        menu: {
          navigate_up: 'up',
          navigate_down: 'down',
          select: 'enter'
        }
      };
      
      bindingMap.loadBindings(config);
    });

    test('should map simple key input to action', () => {
      const inputData = {
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'w',
        type: 'press',
        value: 1,
        timestamp: performance.now()
      };
      
      const actions = bindingMap.mapInputToActions(inputData);
      
      expect(actions).toHaveLength(1);
      expect(actions[0].name).toBe('move_up');
      expect(actions[0].type).toBe('press');
      expect(actions[0].value).toBe(1);
    });

    test('should map input with modifiers', () => {
      const inputData = {
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'c',
        type: 'press',
        value: 1,
        modifiers: { ctrl: true, shift: false, alt: false, meta: false },
        timestamp: performance.now()
      };
      
      const actions = bindingMap.mapInputToActions(inputData);
      
      expect(actions).toHaveLength(1);
      expect(actions[0].name).toBe('copy');
    });

    test('should not match when required modifiers are missing', () => {
      const inputData = {
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'c',
        type: 'press',
        value: 1,
        modifiers: { ctrl: false, shift: false, alt: false, meta: false },
        timestamp: performance.now()
      };
      
      const actions = bindingMap.mapInputToActions(inputData);
      
      expect(actions).toHaveLength(0);
    });

    test('should use specified context', () => {
      const inputData = {
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'up',
        type: 'press',
        value: 1,
        timestamp: performance.now()
      };
      
      // Should map to move_up in default context
      const defaultActions = bindingMap.mapInputToActions(inputData, 'default');
      expect(defaultActions).toHaveLength(1);
      expect(defaultActions[0].name).toBe('move_up');
      
      // Should map to navigate_up in menu context
      const menuActions = bindingMap.mapInputToActions(inputData, 'menu');
      expect(menuActions).toHaveLength(1);
      expect(menuActions[0].name).toBe('navigate_up');
    });

    test('should return empty array for unknown input', () => {
      const inputData = {
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'x', // Not bound to anything
        type: 'press',
        value: 1,
        timestamp: performance.now()
      };
      
      const actions = bindingMap.mapInputToActions(inputData);
      
      expect(actions).toHaveLength(0);
    });

    test('should return empty array for unknown context', () => {
      const inputData = {
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'w',
        type: 'press',
        value: 1,
        timestamp: performance.now()
      };
      
      const actions = bindingMap.mapInputToActions(inputData, 'unknown_context');
      
      expect(actions).toHaveLength(0);
    });
  });

  describe('Context Management', () => {
    test('should set active context', () => {
      bindingMap.setActiveContext('menu');
      
      expect(bindingMap.getActiveContext()).toBe('menu');
    });

    test('should clear cache when context changes', () => {
      // Populate cache
      const inputData = {
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'w',
        type: 'press',
        value: 1,
        timestamp: performance.now()
      };
      
      bindingMap.mapInputToActions(inputData);
      expect(bindingMap.bindingCache.size).toBeGreaterThan(0);
      
      // Change context should clear cache
      bindingMap.setActiveContext('menu');
      expect(bindingMap.bindingCache.size).toBe(0);
    });
  });

  describe('Binding String Parsing', () => {
    test('should parse simple key strings', () => {
      const binding = bindingMap.parseBindingString('w');
      
      expect(binding).toEqual({
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'w',
        modifiers: {},
        conditions: {},
        sensitivity: 1.0,
        deadzone: 0.1
      });
    });

    test('should parse key combinations with modifiers', () => {
      const binding = bindingMap.parseBindingString('ctrl+shift+c');
      
      expect(binding).toEqual({
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'c',
        modifiers: { ctrl: true, shift: true },
        conditions: {},
        sensitivity: 1.0,
        deadzone: 0.1
      });
    });

    test('should parse device-specific bindings', () => {
      const binding = bindingMap.parseBindingString('gamepad:button_a');
      
      expect(binding).toEqual({
        deviceType: 'gamepad',
        inputType: 'button',
        key: 'button_a',
        modifiers: {},
        conditions: {},
        sensitivity: 1.0,
        deadzone: 0.1
      });
    });

    test('should handle cmd as meta modifier', () => {
      const binding = bindingMap.parseBindingString('cmd+c');
      
      expect(binding.modifiers).toEqual({ meta: true });
    });
  });

  describe('Binding Conditions', () => {
    test('should check value conditions', () => {
      const actionConfig = {
        actionName: 'test_action',
        deviceType: 'gamepad',
        inputType: 'trigger',
        key: 'trigger_left',
        conditions: { minValue: 0.5 }
      };
      
      // Input below threshold should not match
      const lowInput = {
        deviceType: 'gamepad',
        inputType: 'trigger',
        key: 'trigger_left',
        value: 0.3
      };
      
      expect(bindingMap.matchesBinding(lowInput, actionConfig)).toBe(false);
      
      // Input above threshold should match
      const highInput = {
        deviceType: 'gamepad',
        inputType: 'trigger',
        key: 'trigger_left',
        value: 0.7
      };
      
      expect(bindingMap.matchesBinding(highInput, actionConfig)).toBe(true);
    });

    test('should check input type conditions', () => {
      const actionConfig = {
        actionName: 'test_action',
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'space',
        conditions: { inputType: 'press' }
      };
      
      const pressInput = {
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'space',
        type: 'press'
      };
      
      const releaseInput = {
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'space',
        type: 'release'
      };
      
      expect(bindingMap.matchesBinding(pressInput, actionConfig)).toBe(true);
      expect(bindingMap.matchesBinding(releaseInput, actionConfig)).toBe(false);
    });
  });

  describe('Action Creation', () => {
    test('should create action with sensitivity applied', () => {
      const inputData = {
        deviceType: 'gamepad',
        inputType: 'stick',
        key: 'left_stick_x',
        type: 'analog',
        value: 0.5,
        timestamp: performance.now()
      };
      
      const actionConfig = {
        actionName: 'move_horizontal',
        deviceType: 'gamepad',
        inputType: 'stick',
        key: 'left_stick_x',
        sensitivity: 2.0
      };
      
      const action = bindingMap.createActionFromBinding(inputData, actionConfig);
      
      expect(action.name).toBe('move_horizontal');
      expect(action.value).toBe(1.0); // 0.5 * 2.0
    });

    test('should apply deadzone to analog inputs', () => {
      const inputData = {
        deviceType: 'gamepad',
        inputType: 'stick',
        key: 'left_stick_x',
        type: 'analog',
        value: 0.05, // Below deadzone
        timestamp: performance.now()
      };
      
      const actionConfig = {
        actionName: 'move_horizontal',
        deviceType: 'gamepad',
        inputType: 'stick',
        key: 'left_stick_x',
        deadzone: 0.1
      };
      
      const action = bindingMap.createActionFromBinding(inputData, actionConfig);
      
      expect(action.value).toBe(0); // Should be zeroed due to deadzone
    });
  });

  describe('Caching', () => {
    beforeEach(() => {
      bindingMap.loadBindings({
        default: {
          move_up: 'w'
        }
      });
    });

    test('should cache mapping results', () => {
      const inputData = {
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'w',
        type: 'press',
        value: 1,
        timestamp: performance.now()
      };
      
      // First call should populate cache
      const actions1 = bindingMap.mapInputToActions(inputData);
      expect(bindingMap.bindingCache.size).toBe(1);
      
      // Second call should use cache
      const actions2 = bindingMap.mapInputToActions(inputData);
      expect(actions1).toEqual(actions2);
    });

    test('should clear cache when bindings change', () => {
      const inputData = {
        deviceType: 'keyboard',
        inputType: 'key',
        key: 'w',
        type: 'press',
        value: 1,
        timestamp: performance.now()
      };
      
      // Populate cache
      bindingMap.mapInputToActions(inputData);
      expect(bindingMap.bindingCache.size).toBeGreaterThan(0);
      
      // Adding binding should clear cache
      bindingMap.addBinding('default', 'test_action', 'x');
      expect(bindingMap.bindingCache.size).toBe(0);
    });
  });

  describe('Debug Mode', () => {
    test('should provide debug information', () => {
      bindingMap.loadBindings({
        default: { move_up: 'w' },
        menu: { select: 'enter' }
      });
      
      const debugInfo = bindingMap.getDebugInfo();
      
      expect(debugInfo).toEqual(
        expect.objectContaining({
          activeContext: 'default',
          contexts: expect.arrayContaining(['default', 'menu']),
          bindingCounts: expect.objectContaining({
            default: expect.any(Number),
            menu: expect.any(Number)
          }),
          cacheSize: expect.any(Number),
          cacheVersion: expect.any(Number)
        })
      );
    });

    test('should log debug messages when enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      bindingMap.setDebugMode(true);
      bindingMap.addBinding('default', 'test_action', 'x');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added binding')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Configuration Export/Import', () => {
    test('should export all bindings', () => {
      bindingMap.loadBindings({
        default: {
          move_up: ['w', 'up'],
          jump: 'space'
        },
        menu: {
          select: 'enter'
        }
      });
      
      const exported = bindingMap.getBindings();
      
      expect(exported).toEqual(
        expect.objectContaining({
          default: expect.objectContaining({
            move_up: expect.any(Array),
            jump: expect.any(Array)
          }),
          menu: expect.objectContaining({
            select: expect.any(Array)
          })
        })
      );
    });
  });
});
