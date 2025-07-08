/**
 * defaultConfig.js
 * 
 * Provides the default input configuration for the input system, including key bindings, mouse actions, and settings for different gameplay contexts (default, menu, debug). This file is automatically loaded by the input system to initialize input profiles and settings.
 */

/**
 * Default Input Configuration
 * This configuration will be loaded automatically by the input system
 */

// Default input configuration
const defaultInputConfig = {
  version: '1.0.0',
  profiles: {
    default: {
      name: 'Default',
      bindings: {
        // Default gameplay context
        default: {
          // Movement actions (WASD + Arrow keys)
          move_up: [
            'w',
            'up'
          ],
          move_down: [
            's', 
            'down'
          ],
          move_left: [
            'a',
            'left'
          ],
          move_right: [
            'd',
            'right'
          ],
          
          // Action buttons
          jump: 'space',
          action: 'enter',
          cancel: 'escape',
          
          // Number keys for camera positions
          number_1: '1',
          number_2: '2', 
          number_3: '3',
          number_4: '4',
          number_5: '5',
          
          // Utility actions
          destroy: 'delete',
          menu: 'escape',
          pause: 'p',
          
          // Mouse actions
          mouse_left: {
            deviceType: 'mouse',
            inputType: 'button',
            button: 'left'
          },
          mouse_right: {
            deviceType: 'mouse',
            inputType: 'button', 
            button: 'right'
          },
          
          // Advanced combinations
          quick_save: 'ctrl+s',
          quick_load: 'ctrl+l',
          screenshot: 'f12',
          fullscreen: 'f11'
        },
        
        // Menu context bindings
        menu: {
          navigate_up: [
            'up',
            'w'
          ],
          navigate_down: [
            'down', 
            's'
          ],
          navigate_left: [
            'left',
            'a'
          ],
          navigate_right: [
            'right',
            'd'
          ],
          select: [
            'enter',
            'space'
          ],
          back: 'escape',
          cancel: 'escape'
        },
        
        // Debug context bindings  
        debug: {
          toggle_debug: 'f1',
          toggle_wireframe: 'f2',
          toggle_stats: 'f3',
          reset_camera: 'home',
          cycle_debug_level: 'f4'
        }
      },
      settings: {
        analogDeadzone: 0.1,
        analogSensitivity: 1.0,
        comboTimeout: 500,
        bufferSize: 32,
        enableDebugOverlay: false,
        mouseSensitivity: 1.0,
        mouseSmoothing: false
      }
    }
  },
  metadata: {
    created: Date.now(),
    lastModified: Date.now(),
    version: '1.0.0'
  }
};

export default defaultInputConfig;
