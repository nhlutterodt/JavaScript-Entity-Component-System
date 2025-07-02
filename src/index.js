import * as THREE from 'three';
import { GUI } from 'dat.gui';
import ECSManager from './core/ECSManager.js';
import RenderSystem from './systems/RenderSystem.js';
import AnimationSystem from './systems/AnimationSystem.js';
import { createInputSystem } from './input/index.js';

// Initialize the ECS Manager with debug enabled
const ecsManager = new ECSManager({
  debug: true,
  debugLevel: 'debug'
});

// Input system variables
let inputSystem;

// Three.js setup
let scene, camera, renderer, gui;

function initThreeJS() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  // Camera
  camera = new THREE.PerspectiveCamera(
    75, 
    window.innerWidth / window.innerHeight, 
    0.1, 
    1000
  );
  camera.position.z = 5;

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  // Handle window resize
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupGUI() {
  gui = new GUI();
  
  const ecsControls = gui.addFolder('ECS Controls');
  const debugControls = gui.addFolder('Debug Controls');
  const inputControls = gui.addFolder('Input Controls');
  const entityControls = gui.addFolder('Entity Controls');

  // ECS Controls
  const ecsActions = {
    createCube: () => createCubeEntity(),
    destroyRandomEntity: () => destroyRandomEntity(),
    toggleAnimation: () => toggleAnimation()
  };
  
  ecsControls.add(ecsActions, 'createCube').name('Create Cube');
  ecsControls.add(ecsActions, 'destroyRandomEntity').name('Destroy Random');
  ecsControls.add(ecsActions, 'toggleAnimation').name('Toggle Animation');

  // Debug Controls
  debugControls.add(ecsManager.debugManager, 'enabled').name('Debug Enabled').onChange((value) => {
    ecsManager.debugManager.setEnabled(value);
  });

  const logLevels = ['debug', 'info', 'warn', 'error'];
  debugControls.add(ecsManager.debugManager, 'logLevel', logLevels).name('Log Level').onChange((value) => {
    ecsManager.debugManager.setLogLevel(value);
  });

  // Input Controls
  if (inputSystem && inputSystem.inputManager) {
    const inputActions = {
      pushMenuContext: () => {
        inputSystem.inputManager.pushContext('menu');
        console.log('📋 Pushed menu context');
      },
      popContext: () => {
        inputSystem.inputManager.popContext();
        console.log('⬅️ Popped context');
      },
      toggleInputDebug: () => {
        const currentDebug = inputSystem.inputManager.debugMode;
        inputSystem.inputManager.setDebugMode(!currentDebug);
        console.log(`🔍 Input debug ${!currentDebug ? 'enabled' : 'disabled'}`);
      },
      showInputInfo: () => {
        const debugInfo = inputSystem.inputManager.getDebugInfo();
        console.log('🎮 Input System Debug Info:', debugInfo);
      }
    };
    
    inputControls.add(inputActions, 'pushMenuContext').name('Push Menu Context');
    inputControls.add(inputActions, 'popContext').name('Pop Context');
    inputControls.add(inputActions, 'toggleInputDebug').name('Toggle Input Debug');
    inputControls.add(inputActions, 'showInputInfo').name('Show Input Info');
  }

  // Entity Controls
  const statsObj = {
    entityCount: 0,
    systemCount: 0,
    fps: 0
  };
  
  entityControls.add(statsObj, 'entityCount').name('Entities').listen();
  entityControls.add(statsObj, 'systemCount').name('Systems').listen();
  entityControls.add(statsObj, 'fps').name('FPS').listen();

  ecsControls.open();
  debugControls.open();
  
  // Store reference for stats updates
  gui.statsObj = statsObj;
}

function createCubeEntity() {
  const entityId = ecsManager.createEntity(`Cube_${Date.now()}`);

  // Add transform component
  ecsManager.addComponent(entityId, 'transform', {
    position: { 
      x: (Math.random() - 0.5) * 4, 
      y: (Math.random() - 0.5) * 4, 
      z: (Math.random() - 0.5) * 4 
    },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });

  // Create Three.js mesh
  const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const material = new THREE.MeshLambertMaterial({ 
    color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6)
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Add mesh component
  ecsManager.addComponent(entityId, 'mesh', { mesh });

  // Start rotation animation
  ecsManager.events.emit('animation:start', {
    entityId,
    animation: {
      type: 'rotation',
      speed: { 
        x: (Math.random() - 0.5) * 2, 
        y: (Math.random() - 0.5) * 2, 
        z: (Math.random() - 0.5) * 2 
      },
      duration: 0 // Infinite
    }
  });

  ecsManager.events.emit('entity:cube_created', { entityId });
  return entityId;
}

function destroyRandomEntity() {
  const entities = Array.from(ecsManager.entities.keys());
  if (entities.length > 0) {
    const randomIndex = Math.floor(Math.random() * entities.length);
    const entityToDestroy = entities[randomIndex];
    ecsManager.destroyEntity(entityToDestroy);
  }
}

function toggleAnimation() {
  const entities = ecsManager.getEntitiesWith('transform');
  for (const entityId of entities) {
    // Toggle between rotation and scale animation
    const randomType = Math.random() > 0.5 ? 'rotation' : 'scale';
    
    if (randomType === 'rotation') {
      ecsManager.events.emit('animation:start', {
        entityId,
        animation: {
          type: 'rotation',
          speed: { 
            x: (Math.random() - 0.5) * 4, 
            y: (Math.random() - 0.5) * 4, 
            z: (Math.random() - 0.5) * 4 
          },
          duration: 0
        }
      });
    } else {
      ecsManager.events.emit('animation:start', {
        entityId,
        animation: {
          type: 'scale',
          frequency: 2 + Math.random() * 3,
          amplitude: 0.3 + Math.random() * 0.4,
          duration: 0
        }
      });
    }
  }
}

function updateGUIStats() {
  const stats = ecsManager.getStats();
  if (gui.statsObj) {
    gui.statsObj.entityCount = stats.entities;
    gui.statsObj.systemCount = stats.systems;
    gui.statsObj.fps = Math.round(ecsManager.debugManager.stats.fps);
  }
}

function setupInputHandlers() {
  if (!inputSystem || !inputSystem.inputManager) {
    console.warn('Input system not available for handler setup');
    return;
  }

  const { inputManager } = inputSystem;

  // Set up action event listeners
  ecsManager.events.on('input:action_pressed', (data) => {
    console.log(`Action pressed: ${data.action} (value: ${data.value})`);
    
    switch (data.action) {
      case 'create_cube':
        createCubeEntity();
        break;
      case 'destroy_cube':
        destroyRandomEntity();
        break;
      case 'toggle_animation':
        toggleAnimation();
        break;
      case 'debug_toggle':
        ecsManager.debugManager.setEnabled(!ecsManager.debugManager.enabled);
        console.log(`Debug mode ${ecsManager.debugManager.enabled ? 'enabled' : 'disabled'}`);
        break;
    }
  });

  ecsManager.events.on('input:action_released', (data) => {
    console.log(`Action released: ${data.action}`);
  });

  // Set up input context switching
  ecsManager.events.on('input:context_changed', (data) => {
    console.log(`Input context changed to: ${data.context}`);
  });

  // Set up combo detection
  ecsManager.events.on('input:combo', (data) => {
    console.log('Combo detected:', data.comboId);
    
    if (data.comboId === 'konami_code') {
      // Easter egg: Konami code creates rainbow cubes
      for (let i = 0; i < 5; i++) {
        setTimeout(() => createCubeEntity(), i * 100);
      }
      console.log('🌈 Konami Code activated! Creating rainbow cubes!');
    }
  });

  // Load default input configuration
  const defaultBindings = {
    default: {
      // Demo actions
      create_cube: [
        { key: '1', deviceType: 'keyboard', inputType: 'key' },
        { key: 'c', deviceType: 'keyboard', inputType: 'key' }
      ],
      destroy_cube: [
        { key: '2', deviceType: 'keyboard', inputType: 'key' },
        { key: 'x', deviceType: 'keyboard', inputType: 'key' }
      ],
      toggle_animation: [
        { key: '3', deviceType: 'keyboard', inputType: 'key' },
        { key: 'space', deviceType: 'keyboard', inputType: 'key' }
      ],
      debug_toggle: [
        { key: 'd', deviceType: 'keyboard', inputType: 'key', modifiers: { ctrl: true } }
      ]
    }
  };

  // Load bindings into the input system
  inputManager.loadConfig({ bindings: defaultBindings });

  // Register some combo patterns for fun
  if (inputManager.comboTracker) {
    // Konami Code: Up, Up, Down, Down, Left, Right, Left, Right, B, A
    inputManager.comboTracker.registerCombo('konami_code', {
      name: 'Konami Code',
      pattern: 'up up down down left right left right b a',
      timeout: 10000 // 10 second window
    });

    // Quick double-tap to create cube
    inputManager.comboTracker.registerCombo('double_tap_create', {
      name: 'Double Tap Create',
      steps: [
        { key: 'c', type: 'press' },
        { key: 'c', type: 'press' }
      ],
      timeout: 300 // 300ms window
    });
  }

  console.log('Input handlers configured successfully!');
  console.log('Input controls:');
  console.log('  1 or C - Create cube');
  console.log('  2 or X - Destroy random cube');
  console.log('  3 or Space - Toggle animation');
  console.log('  Ctrl+D - Toggle debug mode');
  console.log('  Try the Konami Code for a surprise!');
}

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing JavaScript Entity Component System with Event, Debug, and Input Management');
  
  // Initialize Three.js
  initThreeJS();
  
  // Initialize input system
  try {
    inputSystem = await createInputSystem(
      ecsManager.events, 
      ecsManager.debugManager,
      {
        enableDebugOverlay: true,
        bufferSize: 32,
        comboTimeout: 500
      }
    );
    
    console.log('Input system initialized successfully');
    
    // Set up input event listeners for demo
    setupInputHandlers();
    
  } catch (error) {
    console.error('Failed to initialize input system:', error);
  }
  
  // Register systems
  const renderSystem = new RenderSystem(scene, camera, renderer);
  const animationSystem = new AnimationSystem();
  
  ecsManager.registerSystem(renderSystem, 100); // High priority for rendering
  ecsManager.registerSystem(animationSystem, 50);
  
  // Set up GUI
  setupGUI();
  
  // Create some initial entities
  for (let i = 0; i < 3; i++) {
    createCubeEntity();
  }
  
  // Set up event listeners
  ecsManager.events.on('entity:cube_created', (event) => {
    console.log('New cube entity created:', event.data.entityId);
  });
  
  ecsManager.events.on('animation:completed', (event) => {
    console.log('Animation completed for entity:', event.data.entityId);
  });
  
  // Start the ECS update loop with input updates
  const originalUpdate = ecsManager.update.bind(ecsManager);
  ecsManager.update = function(deltaTime) {
    // Update input system first
    if (inputSystem && inputSystem.inputManager) {
      inputSystem.inputManager.update(deltaTime);
    }
    
    // Then update ECS
    originalUpdate(deltaTime);
  };
  
  ecsManager.start();
  
  // Update GUI stats periodically
  setInterval(updateGUIStats, 1000);
  
  console.log('ECS with Three.js, Event Management, Debug Management, and Input System initialized successfully!');
  console.log('Stats:', ecsManager.getStats());
  console.log('Try pressing WASD, Space, Enter, or number keys to test input!');
});
