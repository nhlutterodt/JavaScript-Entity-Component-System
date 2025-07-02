/**
 * Input System Module Exports
 * Centralized exports for the entire input system
 */

// Core input manager
export { default as InputManager } from './InputManager.js';

// Input processing components
export { default as BindingMap } from './BindingMap.js';
export { default as KeyBuffer } from './KeyBuffer.js';
export { default as ComboTracker } from './ComboTracker.js';
export { default as ConfigProvider } from './ConfigProvider.js';

// Device adapters
export { default as KeyboardAdapter } from './adapters/KeyboardAdapter.js';
export { default as MouseAdapter } from './adapters/MouseAdapter.js';
export { default as GamepadAdapter } from './adapters/GamepadAdapter.js';

// Convenience function to create a fully configured input system
export async function createInputSystem(eventManager = null, debugManager = null, options = {}) {
  const { InputManager, KeyboardAdapter, MouseAdapter } = await import('./index.js');
  
  // Create input manager
  const inputManager = new InputManager(eventManager, debugManager);
  
  // Create and register device adapters
  const keyboardAdapter = new KeyboardAdapter();
  const mouseAdapter = new MouseAdapter();
  
  inputManager.registerAdapter('keyboard', keyboardAdapter);
  inputManager.registerAdapter('mouse', mouseAdapter);
  
  // Initialize the system
  await inputManager.initialize(options);
  
  // Initialize adapters
  keyboardAdapter.initialize();
  mouseAdapter.initialize();
  
  return {
    inputManager,
    adapters: {
      keyboard: keyboardAdapter,
      mouse: mouseAdapter
    }
  };
}
