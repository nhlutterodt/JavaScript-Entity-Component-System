/**
 * ECSManager
 * Main ECS manager that coordinates all systems, entities, and components.
 * Integrates event management and debug management.
 * Handles system registration, entity/component lifecycle, update loop, and statistics.
 */

import EventManager from './EventManager.js';
import DebugManager from './DebugManager.js';

/**
 * Main ECS Manager that coordinates all systems
 * Integrates Event Management and Debug Management
 */
class ECSManager {
  constructor(options = {}) {
    // Initialize core managers
    this.eventManager = new EventManager();
    this.debugManager = new DebugManager();
    
    // ECS core data structures
    this.entities = new Map();
    this.components = new Map();
    this.systems = [];
    
    // Configuration
    this.running = false;
    this.lastUpdateTime = 0;
    this.entityIdCounter = 0;
    
    // Initialize with options
    this.init(options);
  }

  /**
   * Initialize the ECS Manager
   * @param {Object} options - Configuration options
   */
  init(options = {}) {
    // Initialize debug manager first
    this.debugManager.init({
      enabled: options.debug !== false,
      logLevel: options.debugLevel || 'info'
    });

    // Set up event manager debug mode
    this.eventManager.setDebugMode(options.debug === true);

    // Register core events
    this.registerCoreEvents();

    this.debugManager.log('info', 'ECS Manager initialized', {
      debug: options.debug,
      debugLevel: options.debugLevel
    });

    // Emit initialization event
    this.eventManager.emit('ecs:initialized', { manager: this });
  }

  /**
   * Register core ECS events
   */
  registerCoreEvents() {
    // System events
    this.eventManager.on('system:registered', (event) => {
      this.debugManager.log('info', `System registered: ${event.data.name}`);
    });

    this.eventManager.on('system:error', (event) => {
      this.debugManager.log('error', `System error: ${event.data.name}`, event.data.error);
    });

    // Entity events
    this.eventManager.on('entity:created', (event) => {
      this.debugManager.registerEntity(event.data.id, event.data.entity);
    });

    this.eventManager.on('entity:destroyed', (event) => {
      this.debugManager.log('debug', `Entity destroyed: ${event.data.id}`);
    });

    // Component events
    this.eventManager.on('component:added', (event) => {
      this.debugManager.registerComponent(
        event.data.type,
        event.data.component,
        event.data.entityId
      );
    });

    this.eventManager.on('component:removed', (event) => {
      this.debugManager.log('debug', `Component removed: ${event.data.type} from ${event.data.entityId}`);
    });
  }

  /**
   * Create a new entity
   * @param {string} name - Optional name for the entity
   * @returns {string} Entity ID
   */
  createEntity(name = null) {
    const id = `entity_${++this.entityIdCounter}`;
    const entity = {
      id,
      name: name || id,
      components: new Map(),
      active: true,
      created: Date.now()
    };

    this.entities.set(id, entity);
    this.eventManager.emit('entity:created', { id, entity });

    this.debugManager.log('debug', `Created entity: ${id} (${entity.name})`);
    return id;
  }

  /**
   * Destroy an entity and all its components
   * @param {string} entityId - The entity ID to destroy
   */
  destroyEntity(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      this.debugManager.log('warn', `Attempted to destroy non-existent entity: ${entityId}`);
      return false;
    }

    // Remove all components
    for (const [componentType] of entity.components) {
      this.removeComponent(entityId, componentType);
    }

    // Remove entity
    this.entities.delete(entityId);
    this.eventManager.emit('entity:destroyed', { id: entityId, entity });

    this.debugManager.log('debug', `Destroyed entity: ${entityId}`);
    return true;
  }

  /**
   * Add a component to an entity
   * @param {string} entityId - The entity ID
   * @param {string} componentType - The component type
   * @param {Object} componentData - The component data
   */
  addComponent(entityId, componentType, componentData = {}) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      this.debugManager.log('error', `Cannot add component to non-existent entity: ${entityId}`);
      return false;
    }

    const component = {
      type: componentType,
      data: componentData,
      entityId,
      created: Date.now()
    };

    entity.components.set(componentType, component);

    // Add to global component index
    if (!this.components.has(componentType)) {
      this.components.set(componentType, new Map());
    }
    this.components.get(componentType).set(entityId, component);

    this.eventManager.emit('component:added', {
      entityId,
      type: componentType,
      component
    });

    this.debugManager.log('debug', `Added component ${componentType} to entity ${entityId}`);
    return true;
  }

  /**
   * Remove a component from an entity
   * @param {string} entityId - The entity ID
   * @param {string} componentType - The component type
   */
  removeComponent(entityId, componentType) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      this.debugManager.log('error', `Cannot remove component from non-existent entity: ${entityId}`);
      return false;
    }

    const component = entity.components.get(componentType);
    if (!component) {
      this.debugManager.log('warn', `Component ${componentType} not found on entity ${entityId}`);
      return false;
    }

    // Remove from entity
    entity.components.delete(componentType);

    // Remove from global component index
    if (this.components.has(componentType)) {
      this.components.get(componentType).delete(entityId);
      
      // Clean up empty component type
      if (this.components.get(componentType).size === 0) {
        this.components.delete(componentType);
      }
    }

    this.eventManager.emit('component:removed', {
      entityId,
      type: componentType,
      component
    });

    this.debugManager.log('debug', `Removed component ${componentType} from entity ${entityId}`);
    return true;
  }

  /**
   * Get a component from an entity
   * @param {string} entityId - The entity ID
   * @param {string} componentType - The component type
   * @returns {Object|null} The component or null if not found
   */
  getComponent(entityId, componentType) {
    const entity = this.entities.get(entityId);
    if (!entity) return null;

    return entity.components.get(componentType) || null;
  }

  /**
   * Get all entities that have specific components
   * @param {...string} componentTypes - The component types to match
   * @returns {Array} Array of entity IDs
   */
  getEntitiesWith(...componentTypes) {
    const matchingEntities = [];

    for (const [entityId, entity] of this.entities) {
      if (!entity.active) continue;

      const hasAllComponents = componentTypes.every(type => 
        entity.components.has(type)
      );

      if (hasAllComponents) {
        matchingEntities.push(entityId);
      }
    }

    return matchingEntities;
  }

  /**
   * Register a system
   * @param {Object} system - The system to register
   * @param {number} priority - System priority (higher = runs first)
   */
  registerSystem(system, priority = 0) {
    if (!system.update || typeof system.update !== 'function') {
      this.debugManager.log('error', 'System must have an update method');
      return false;
    }

    const systemWrapper = {
      instance: system,
      name: system.name || system.constructor.name,
      priority,
      enabled: true,
      lastUpdateTime: 0,
      updateCount: 0
    };

    this.systems.push(systemWrapper);
    this.systems.sort((a, b) => b.priority - a.priority);

    // Give system access to ECS manager
    if (system.setECSManager && typeof system.setECSManager === 'function') {
      system.setECSManager(this);
    }

    this.debugManager.registerSystem(systemWrapper.name, system);
    this.eventManager.emit('system:registered', { name: systemWrapper.name, system });

    this.debugManager.log('info', `Registered system: ${systemWrapper.name} (priority: ${priority})`);
    return true;
  }

  /**
   * Enable a system by name
   * @param {string} systemName - The name of the system to enable
   * @returns {boolean} True if enabled, false if not found
   */
  enableSystem(systemName) {
    const system = this.systems.find(s => s.name === systemName);
    if (!system) {
      this.debugManager.log('warn', `System not found: ${systemName}`);
      return false;
    }
    if (!system.enabled) {
      system.enabled = true;
      this.debugManager.log('info', `System enabled: ${systemName}`);
      this.eventManager.emit('system:enabled', { name: systemName, system: system.instance });
    }
    return true;
  }

  /**
   * Disable a system by name
   * @param {string} systemName - The name of the system to disable
   * @returns {boolean} True if disabled, false if not found
   */
  disableSystem(systemName) {
    const system = this.systems.find(s => s.name === systemName);
    if (!system) {
      this.debugManager.log('warn', `System not found: ${systemName}`);
      return false;
    }
    if (system.enabled) {
      system.enabled = false;
      this.debugManager.log('info', `System disabled: ${systemName}`);
      this.eventManager.emit('system:disabled', { name: systemName, system: system.instance });
    }
    return true;
  }

  /**
   * Start the main update loop
   */
  start() {
    if (this.running) {
      this.debugManager.log('warn', 'ECS Manager is already running');
      return;
    }

    this.running = true;
    this.lastUpdateTime = performance.now();
    
    this.debugManager.log('info', 'ECS Manager started');
    this.eventManager.emit('ecs:started');

    this.gameLoop();
  }

  /**
   * Stop the update loop
   */
  stop() {
    this.running = false;
    this.debugManager.log('info', 'ECS Manager stopped');
    this.eventManager.emit('ecs:stopped');
  }

  /**
   * Main game loop
   */
  gameLoop() {
    if (!this.running) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;

    // Process queued events first
    this.eventManager.processQueue();

    // Update all systems
    this.updateSystems(deltaTime);

    // Continue loop
    requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Update all registered systems
   * @param {number} deltaTime - Time since last update
   */
  updateSystems(deltaTime) {
    for (const systemWrapper of this.systems) {
      if (!systemWrapper.enabled) continue;

      try {
        this.debugManager.trackPerformance(systemWrapper.name, () => {
          systemWrapper.instance.update(deltaTime, this);
          systemWrapper.updateCount++;
          systemWrapper.lastUpdateTime = performance.now();
        });
      } catch (error) {
        this.debugManager.log('error', `System ${systemWrapper.name} update failed`, error);
        this.eventManager.emit('system:error', { 
          name: systemWrapper.name, 
          error,
          system: systemWrapper.instance 
        });
      }
    }
  }

  /**
   * Get statistics about the ECS
   * @returns {Object} ECS statistics
   */
  getStats() {
    const componentStats = {};
    for (const [type, components] of this.components) {
      componentStats[type] = components.size;
    }

    return {
      entities: this.entities.size,
      systems: this.systems.length,
      componentTypes: this.components.size,
      componentStats,
      running: this.running,
      debug: this.debugManager.getDebugInfo(),
      events: this.eventManager.getStats()
    };
  }

  /**
   * Access to the event manager
   * @returns {EventManager} The event manager instance
   */
  get events() {
    return this.eventManager;
  }

  /**
   * Access to the debug manager
   * @returns {DebugManager} The debug manager instance
   */
  get debug() {
    return this.debugManager;
  }

  /**
   * Check if an entity exists
   * @param {string} entityId - The entity ID to check
   * @returns {boolean} True if the entity exists, false otherwise
   */
  hasEntity(entityId) {
    return this.entities.has(entityId);
  }
}

export default ECSManager;
