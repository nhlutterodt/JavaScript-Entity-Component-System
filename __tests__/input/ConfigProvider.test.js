import ConfigProvider from '../../src/input/ConfigProvider.js';

describe('ConfigProvider', () => {
    let provider;

    beforeEach(() => {
        provider = new ConfigProvider();
        // Clear localStorage before each test
        if (typeof localStorage !== 'undefined') {
            localStorage.clear();
        }
    });

    afterEach(() => {
        // Clean up localStorage after each test
        if (typeof localStorage !== 'undefined') {
            localStorage.clear();
        }
    });

    describe('initialization', () => {
        test('should create provider with default config', () => {
            expect(provider).toBeInstanceOf(ConfigProvider);
            expect(provider.get('contexts')).toEqual(['default']);
            expect(provider.get('bindings')).toEqual({});
        });

        test('should create provider with custom config', () => {
            const customConfig = {
                contexts: ['game', 'menu'],
                bindings: {
                    'game': {
                        'move-forward': 'KeyW'
                    }
                }
            };
            
            const customProvider = new ConfigProvider(customConfig);
            expect(customProvider.get('contexts')).toEqual(['game', 'menu']);
            expect(customProvider.get('bindings.game.move-forward')).toBe('KeyW');
        });
    });

    describe('get operations', () => {
        beforeEach(() => {
            provider.set('test.nested.value', 'hello');
            provider.set('simple', 'world');
        });

        test('should get simple values', () => {
            expect(provider.get('simple')).toBe('world');
        });

        test('should get nested values', () => {
            expect(provider.get('test.nested.value')).toBe('hello');
        });

        test('should return undefined for non-existent keys', () => {
            expect(provider.get('non.existent')).toBeUndefined();
        });

        test('should return default value for non-existent keys', () => {
            expect(provider.get('non.existent', 'default')).toBe('default');
        });

        test('should handle empty string keys', () => {
            expect(provider.get('')).toBeUndefined();
        });

        test('should handle null/undefined keys', () => {
            expect(provider.get(null)).toBeUndefined();
            expect(provider.get(undefined)).toBeUndefined();
        });
    });

    describe('set operations', () => {
        test('should set simple values', () => {
            provider.set('test', 'value');
            expect(provider.get('test')).toBe('value');
        });

        test('should set nested values', () => {
            provider.set('deep.nested.value', 'test');
            expect(provider.get('deep.nested.value')).toBe('test');
        });

        test('should overwrite existing values', () => {
            provider.set('test', 'original');
            provider.set('test', 'updated');
            expect(provider.get('test')).toBe('updated');
        });

        test('should handle different data types', () => {
            provider.set('string', 'text');
            provider.set('number', 42);
            provider.set('boolean', true);
            provider.set('array', [1, 2, 3]);
            provider.set('object', { key: 'value' });
            
            expect(provider.get('string')).toBe('text');
            expect(provider.get('number')).toBe(42);
            expect(provider.get('boolean')).toBe(true);
            expect(provider.get('array')).toEqual([1, 2, 3]);
            expect(provider.get('object')).toEqual({ key: 'value' });
        });

        test('should handle null/undefined values', () => {
            provider.set('null', null);
            provider.set('undefined', undefined);
            
            expect(provider.get('null')).toBeNull();
            expect(provider.get('undefined')).toBeUndefined();
        });
    });

    describe('binding operations', () => {
        test('should set key binding', () => {
            provider.setBinding('move-forward', 'KeyW');
            expect(provider.getBinding('move-forward')).toBe('KeyW');
        });

        test('should set context-specific binding', () => {
            provider.setBinding('move-forward', 'KeyW', 'game');
            expect(provider.getBinding('move-forward', 'game')).toBe('KeyW');
        });

        test('should get binding from default context', () => {
            provider.setBinding('action', 'KeyE');
            expect(provider.getBinding('action')).toBe('KeyE');
            expect(provider.getBinding('action', 'default')).toBe('KeyE');
        });

        test('should handle multiple contexts', () => {
            provider.setBinding('action', 'KeyE', 'game');
            provider.setBinding('action', 'Space', 'menu');
            
            expect(provider.getBinding('action', 'game')).toBe('KeyE');
            expect(provider.getBinding('action', 'menu')).toBe('Space');
        });

        test('should return undefined for non-existent binding', () => {
            expect(provider.getBinding('non-existent')).toBeUndefined();
        });

        test('should handle complex binding values', () => {
            const complexBinding = {
                primary: 'KeyW',
                secondary: 'ArrowUp',
                modifiers: ['ControlLeft']
            };
            
            provider.setBinding('move-forward', complexBinding);
            expect(provider.getBinding('move-forward')).toEqual(complexBinding);
        });
    });

    describe('persistence', () => {
        // Skip localStorage tests if not available (Node.js environment)
        const runIfLocalStorage = (name, fn) => {
            if (typeof localStorage !== 'undefined') {
                test(name, fn);
            } else {
                test.skip(`${name} (localStorage not available)`, fn);
            }
        };

        runIfLocalStorage('should save config to localStorage', () => {
            provider.set('test', 'value');
            provider.save();
            
            const saved = JSON.parse(localStorage.getItem('inputConfig'));
            expect(saved.test).toBe('value');
        });

        runIfLocalStorage('should load config from localStorage', () => {
            const testConfig = {
                test: 'loaded',
                bindings: {
                    default: {
                        'action': 'KeyE'
                    }
                }
            };
            
            localStorage.setItem('inputConfig', JSON.stringify(testConfig));
            
            const newProvider = new ConfigProvider();
            newProvider.load();
            
            expect(newProvider.get('test')).toBe('loaded');
            expect(newProvider.getBinding('action')).toBe('KeyE');
        });

        runIfLocalStorage('should handle corrupted localStorage data', () => {
            localStorage.setItem('inputConfig', 'invalid json');
            
            const newProvider = new ConfigProvider();
            expect(() => newProvider.load()).not.toThrow();
            
            // Should fall back to default config
            expect(newProvider.get('contexts')).toEqual(['default']);
        });

        runIfLocalStorage('should handle missing localStorage data', () => {
            const newProvider = new ConfigProvider();
            expect(() => newProvider.load()).not.toThrow();
            
            // Should keep default config
            expect(newProvider.get('contexts')).toEqual(['default']);
        });

        test('should handle save/load when localStorage is unavailable', () => {
            // Mock localStorage as undefined
            const originalLocalStorage = global.localStorage;
            delete global.localStorage;
            
            const testProvider = new ConfigProvider();
            
            expect(() => testProvider.save()).not.toThrow();
            expect(() => testProvider.load()).not.toThrow();
            
            // Restore localStorage
            global.localStorage = originalLocalStorage;
        });
    });

    describe('context management', () => {
        test('should add new context', () => {
            provider.addContext('game');
            expect(provider.get('contexts')).toContain('game');
        });

        test('should not add duplicate context', () => {
            provider.addContext('game');
            provider.addContext('game');
            
            const contexts = provider.get('contexts');
            expect(contexts.filter(c => c === 'game')).toHaveLength(1);
        });

        test('should remove context', () => {
            provider.addContext('game');
            provider.addContext('menu');
            
            provider.removeContext('game');
            
            expect(provider.get('contexts')).not.toContain('game');
            expect(provider.get('contexts')).toContain('menu');
        });

        test('should not remove default context', () => {
            provider.removeContext('default');
            expect(provider.get('contexts')).toContain('default');
        });

        test('should clean up bindings when removing context', () => {
            provider.setBinding('action', 'KeyE', 'game');
            provider.removeContext('game');
            
            expect(provider.getBinding('action', 'game')).toBeUndefined();
        });
    });

    describe('config validation', () => {
        test('should validate key names', () => {
            expect(provider.isValidKey('KeyA')).toBe(true);
            expect(provider.isValidKey('Space')).toBe(true);
            expect(provider.isValidKey('ArrowUp')).toBe(true);
            expect(provider.isValidKey('F1')).toBe(true);
            expect(provider.isValidKey('')).toBe(false);
            expect(provider.isValidKey(null)).toBe(false);
            expect(provider.isValidKey(undefined)).toBe(false);
        });

        test('should validate action names', () => {
            expect(provider.isValidAction('move-forward')).toBe(true);
            expect(provider.isValidAction('jump')).toBe(true);
            expect(provider.isValidAction('use_item')).toBe(true);
            expect(provider.isValidAction('')).toBe(false);
            expect(provider.isValidAction(null)).toBe(false);
            expect(provider.isValidAction(undefined)).toBe(false);
        });

        test('should validate context names', () => {
            expect(provider.isValidContext('game')).toBe(true);
            expect(provider.isValidContext('menu')).toBe(true);
            expect(provider.isValidContext('default')).toBe(true);
            expect(provider.isValidContext('')).toBe(false);
            expect(provider.isValidContext(null)).toBe(false);
            expect(provider.isValidContext(undefined)).toBe(false);
        });
    });

    describe('batch operations', () => {
        test('should set multiple bindings at once', () => {
            const bindings = {
                'move-forward': 'KeyW',
                'move-backward': 'KeyS',
                'move-left': 'KeyA',
                'move-right': 'KeyD'
            };
            
            provider.setBindings(bindings, 'game');
            
            expect(provider.getBinding('move-forward', 'game')).toBe('KeyW');
            expect(provider.getBinding('move-backward', 'game')).toBe('KeyS');
            expect(provider.getBinding('move-left', 'game')).toBe('KeyA');
            expect(provider.getBinding('move-right', 'game')).toBe('KeyD');
        });

        test('should get all bindings for context', () => {
            provider.setBinding('action1', 'KeyE', 'game');
            provider.setBinding('action2', 'KeyF', 'game');
            
            const bindings = provider.getBindings('game');
            
            expect(bindings).toEqual({
                'action1': 'KeyE',
                'action2': 'KeyF'
            });
        });

        test('should clear all bindings for context', () => {
            provider.setBinding('action1', 'KeyE', 'game');
            provider.setBinding('action2', 'KeyF', 'game');
            
            provider.clearBindings('game');
            
            expect(provider.getBindings('game')).toEqual({});
        });
    });

    describe('config merging', () => {
        test('should merge config objects', () => {
            const existingConfig = {
                contexts: ['default'],
                bindings: {
                    default: {
                        'action1': 'KeyE'
                    }
                }
            };
            
            const newConfig = {
                contexts: ['game'],
                bindings: {
                    game: {
                        'action2': 'KeyF'
                    }
                },
                settings: {
                    repeat: true
                }
            };
            
            provider.merge(newConfig);
            
            expect(provider.get('contexts')).toEqual(['default', 'game']);
            expect(provider.getBinding('action1')).toBe('KeyE');
            expect(provider.getBinding('action2', 'game')).toBe('KeyF');
            expect(provider.get('settings.repeat')).toBe(true);
        });

        test('should handle empty merge', () => {
            const originalConfig = provider.get();
            provider.merge({});
            
            expect(provider.get()).toEqual(originalConfig);
        });

        test('should handle null merge', () => {
            const originalConfig = provider.get();
            provider.merge(null);
            
            expect(provider.get()).toEqual(originalConfig);
        });
    });

    describe('edge cases', () => {
        test('should handle very long key paths', () => {
            const longPath = 'a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z';
            provider.set(longPath, 'deep');
            
            expect(provider.get(longPath)).toBe('deep');
        });

        test('should handle special characters in keys', () => {
            provider.set('key-with-dashes', 'value1');
            provider.set('key_with_underscores', 'value2');
            provider.set('key.with.dots', 'value3');
            
            expect(provider.get('key-with-dashes')).toBe('value1');
            expect(provider.get('key_with_underscores')).toBe('value2');
            expect(provider.get('key.with.dots')).toBe('value3');
        });

        test('should handle circular references gracefully', () => {
            const obj = { name: 'test' };
            obj.self = obj;
            
            expect(() => provider.set('circular', obj)).not.toThrow();
        });

        test('should handle very large configs', () => {
            const largeConfig = {};
            for (let i = 0; i < 1000; i++) {
                largeConfig[`key${i}`] = `value${i}`;
            }
            
            expect(() => provider.merge(largeConfig)).not.toThrow();
            expect(provider.get('key500')).toBe('value500');
        });
    });
});
