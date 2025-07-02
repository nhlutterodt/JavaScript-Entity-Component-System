import KeyBuffer from '../../src/input/KeyBuffer.js';

describe('KeyBuffer', () => {
    let buffer;

    beforeEach(() => {
        buffer = new KeyBuffer();
    });

    describe('initialization', () => {
        test('should create buffer with default size', () => {
            expect(buffer).toBeInstanceOf(KeyBuffer);
            expect(buffer.size()).toBe(0);
        });

        test('should create buffer with custom size', () => {
            const customBuffer = new KeyBuffer(5);
            expect(customBuffer).toBeInstanceOf(KeyBuffer);
            expect(customBuffer.size()).toBe(0);
        });
    });

    describe('basic operations', () => {
        test('should add keys to buffer', () => {
            buffer.add('KeyA');
            expect(buffer.size()).toBe(1);

            buffer.add('KeyB');
            expect(buffer.size()).toBe(2);
        });

        test('should check if key is pressed', () => {
            buffer.add('KeyA');
            expect(buffer.isPressed('KeyA')).toBe(true);
            expect(buffer.isPressed('KeyB')).toBe(false);
        });

        test('should remove keys from buffer', () => {
            buffer.add('KeyA');
            buffer.add('KeyB');
            
            expect(buffer.remove('KeyA')).toBe(true);
            expect(buffer.size()).toBe(1);
            expect(buffer.isPressed('KeyA')).toBe(false);
            expect(buffer.isPressed('KeyB')).toBe(true);
        });

        test('should return false when removing non-existent key', () => {
            expect(buffer.remove('KeyA')).toBe(false);
        });

        test('should clear all keys', () => {
            buffer.add('KeyA');
            buffer.add('KeyB');
            buffer.add('KeyC');
            
            buffer.clear();
            
            expect(buffer.size()).toBe(0);
            expect(buffer.isPressed('KeyA')).toBe(false);
            expect(buffer.isPressed('KeyB')).toBe(false);
            expect(buffer.isPressed('KeyC')).toBe(false);
        });
    });

    describe('buffer limits', () => {
        test('should respect maximum buffer size', () => {
            const limitedBuffer = new KeyBuffer(2);
            
            limitedBuffer.add('KeyA');
            limitedBuffer.add('KeyB');
            limitedBuffer.add('KeyC'); // Should remove oldest (KeyA)
            
            expect(limitedBuffer.size()).toBe(2);
            expect(limitedBuffer.isPressed('KeyA')).toBe(false);
            expect(limitedBuffer.isPressed('KeyB')).toBe(true);
            expect(limitedBuffer.isPressed('KeyC')).toBe(true);
        });

        test('should maintain order when buffer is full', () => {
            const limitedBuffer = new KeyBuffer(3);
            
            limitedBuffer.add('KeyA');
            limitedBuffer.add('KeyB');
            limitedBuffer.add('KeyC');
            limitedBuffer.add('KeyD'); // Should remove KeyA
            limitedBuffer.add('KeyE'); // Should remove KeyB
            
            expect(limitedBuffer.size()).toBe(3);
            expect(limitedBuffer.isPressed('KeyA')).toBe(false);
            expect(limitedBuffer.isPressed('KeyB')).toBe(false);
            expect(limitedBuffer.isPressed('KeyC')).toBe(true);
            expect(limitedBuffer.isPressed('KeyD')).toBe(true);
            expect(limitedBuffer.isPressed('KeyE')).toBe(true);
        });
    });

    describe('key combinations', () => {
        test('should handle multiple keys pressed simultaneously', () => {
            buffer.add('KeyA');
            buffer.add('KeyB');
            buffer.add('KeyC');
            
            expect(buffer.isPressed('KeyA')).toBe(true);
            expect(buffer.isPressed('KeyB')).toBe(true);
            expect(buffer.isPressed('KeyC')).toBe(true);
            expect(buffer.size()).toBe(3);
        });

        test('should check if multiple keys are pressed', () => {
            buffer.add('KeyA');
            buffer.add('KeyB');
            
            expect(buffer.arePressed(['KeyA', 'KeyB'])).toBe(true);
            expect(buffer.arePressed(['KeyA', 'KeyC'])).toBe(false);
            expect(buffer.arePressed(['KeyA'])).toBe(true);
            expect(buffer.arePressed([])).toBe(true); // Empty array should return true
        });

        test('should check if any keys are pressed', () => {
            buffer.add('KeyA');
            
            expect(buffer.isAnyPressed(['KeyA', 'KeyB'])).toBe(true);
            expect(buffer.isAnyPressed(['KeyB', 'KeyC'])).toBe(false);
            expect(buffer.isAnyPressed(['KeyA'])).toBe(true);
            expect(buffer.isAnyPressed([])).toBe(false); // Empty array should return false
        });
    });

    describe('duplicate key handling', () => {
        test('should not add duplicate keys', () => {
            buffer.add('KeyA');
            buffer.add('KeyA'); // Duplicate
            
            expect(buffer.size()).toBe(1);
            expect(buffer.isPressed('KeyA')).toBe(true);
        });

        test('should handle duplicate removal', () => {
            buffer.add('KeyA');
            
            expect(buffer.remove('KeyA')).toBe(true);
            expect(buffer.remove('KeyA')).toBe(false); // Already removed
        });
    });

    describe('edge cases', () => {
        test('should handle null/undefined keys', () => {
            expect(() => {
                buffer.add(null);
                buffer.add(undefined);
                buffer.add('');
            }).not.toThrow();
            
            expect(buffer.size()).toBe(3); // Should still add them
            expect(buffer.isPressed(null)).toBe(true);
            expect(buffer.isPressed(undefined)).toBe(true);
            expect(buffer.isPressed('')).toBe(true);
        });

        test('should handle special characters', () => {
            const specialKeys = ['Space', 'Enter', 'Escape', 'Tab', 'Shift'];
            
            specialKeys.forEach(key => {
                buffer.add(key);
            });
            
            expect(buffer.size()).toBe(specialKeys.length);
            
            specialKeys.forEach(key => {
                expect(buffer.isPressed(key)).toBe(true);
            });
        });

        test('should handle very long key names', () => {
            const longKey = 'A'.repeat(1000);
            
            buffer.add(longKey);
            
            expect(buffer.isPressed(longKey)).toBe(true);
            expect(buffer.size()).toBe(1);
        });
    });

    describe('buffer state', () => {
        test('should get all pressed keys', () => {
            buffer.add('KeyA');
            buffer.add('KeyB');
            buffer.add('KeyC');
            
            const pressedKeys = buffer.getPressed();
            
            expect(pressedKeys).toContain('KeyA');
            expect(pressedKeys).toContain('KeyB');
            expect(pressedKeys).toContain('KeyC');
            expect(pressedKeys.length).toBe(3);
        });

        test('should return empty array when no keys pressed', () => {
            const pressedKeys = buffer.getPressed();
            
            expect(pressedKeys).toEqual([]);
            expect(pressedKeys.length).toBe(0);
        });

        test('should return copy of pressed keys (not reference)', () => {
            buffer.add('KeyA');
            
            const pressedKeys = buffer.getPressed();
            pressedKeys.push('KeyB'); // Modify returned array
            
            expect(buffer.isPressed('KeyB')).toBe(false);
            expect(buffer.size()).toBe(1);
        });
    });

    describe('performance', () => {
        test('should handle many key operations efficiently', () => {
            const keys = [];
            for (let i = 0; i < 100; i++) {
                keys.push(`Key${i}`);
            }
            
            // Add all keys
            keys.forEach(key => buffer.add(key));
            
            // Check all keys
            keys.forEach(key => {
                expect(buffer.isPressed(key)).toBe(true);
            });
            
            // Remove all keys
            keys.forEach(key => {
                expect(buffer.remove(key)).toBe(true);
            });
            
            expect(buffer.size()).toBe(0);
        });

        test('should handle rapid add/remove cycles', () => {
            for (let i = 0; i < 100; i++) {
                buffer.add('KeyA');
                buffer.remove('KeyA');
            }
            
            expect(buffer.size()).toBe(0);
            expect(buffer.isPressed('KeyA')).toBe(false);
        });
    });

    describe('buffer with zero size', () => {
        test('should handle zero-sized buffer', () => {
            const zeroBuffer = new KeyBuffer(0);
            
            zeroBuffer.add('KeyA');
            
            expect(zeroBuffer.size()).toBe(0);
            expect(zeroBuffer.isPressed('KeyA')).toBe(false);
        });
    });

    describe('buffer with negative size', () => {
        test('should handle negative buffer size as unlimited', () => {
            const negativeBuffer = new KeyBuffer(-1);
            
            // Add many keys
            for (let i = 0; i < 100; i++) {
                negativeBuffer.add(`Key${i}`);
            }
            
            expect(negativeBuffer.size()).toBe(100);
        });
    });

    describe('modifier key combinations', () => {
        test('should handle modifier keys correctly', () => {
            buffer.add('ControlLeft');
            buffer.add('KeyA');
            
            expect(buffer.arePressed(['ControlLeft', 'KeyA'])).toBe(true);
            expect(buffer.isPressed('ControlLeft')).toBe(true);
            expect(buffer.isPressed('KeyA')).toBe(true);
        });

        test('should distinguish between left and right modifiers', () => {
            buffer.add('ControlLeft');
            buffer.add('ControlRight');
            
            expect(buffer.isPressed('ControlLeft')).toBe(true);
            expect(buffer.isPressed('ControlRight')).toBe(true);
            expect(buffer.isPressed('Control')).toBe(false); // Generic control
            expect(buffer.size()).toBe(2);
        });
    });
});
