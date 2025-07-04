/**
 * @jest-environment jsdom
 */
import ECSManager from '../src/core/ECSManager.js';
import RenderSystem from '../src/systems/RenderSystem.js';
import AnimationSystem from '../src/systems/AnimationSystem.js';

// Mock Three.js
const mockMesh = {
  position: { set: jest.fn() },
  rotation: { set: jest.fn() },
  scale: { set: jest.fn() }
};

const mockScene = {
  add: jest.fn(),
  remove: jest.fn()
};

const mockCamera = {};
const mockRenderer = {
  render: jest.fn()
};

describe('ECS Integration Tests', () => {
  let ecsManager;
  let renderSystem;
  let animationSystem;

  beforeEach(() => {
    // Clean up DOM
    const existingPanel = document.getElementById('debug-panel');
    if (existingPanel) {
      existingPanel.remove();
    }

    // Initialize ECS with debug enabled
    ecsManager = new ECSManager({
      debug: true,
      debugLevel: 'debug'
    });

    // Initialize systems
    renderSystem = new RenderSystem(mockScene, mockCamera, mockRenderer);
    animationSystem = new AnimationSystem();

    // Register systems
    ecsManager.registerSystem(renderSystem, 100);
    ecsManager.registerSystem(animationSystem, 50);

    // Clear mock calls
    jest.clearAllMocks();
  });

  afterEach(() => {
    ecsManager.stop();
    ecsManager.debug.clear();
  });

  describe('ECS Manager Integration', () => {
    test('should initialize with event and debug managers', () => {
      expect(ecsManager.eventManager).toBeDefined();
      expect(ecsManager.debugManager).toBeDefined();
      expect(ecsManager.debugManager.enabled).toBe(true);
      expect(ecsManager.eventManager.debugMode).toBe(true);
    });

    test('should register systems and track them in debug manager', () => {
      expect(ecsManager.systems).toHaveLength(2);
      expect(ecsManager.debugManager.systems.has('RenderSystem')).toBe(true);
      expect(ecsManager.debugManager.systems.has('AnimationSystem')).toBe(true);
    });

    test('should emit and handle system registration events', () => {
      const eventSpy = jest.fn();
      ecsManager.events.on('system:registered', eventSpy);

      const newSystem = {
        name: 'TestSystem',
        update: jest.fn()
      };

      ecsManager.registerSystem(newSystem);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          name: 'TestSystem'
        })
      }));
    });
  });

  describe('Entity Lifecycle Integration', () => {
    test('should create entity and trigger debug registration', () => {
      const debugSpy = jest.spyOn(ecsManager.debugManager, 'registerEntity');
      const eventSpy = jest.fn();
      ecsManager.events.on('entity:created', eventSpy);

      const entityId = ecsManager.createEntity('TestEntity');

      expect(debugSpy).toHaveBeenCalledWith(entityId, expect.any(Object));
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          id: entityId,
          entity: expect.objectContaining({
            name: 'TestEntity'
          })
        })
      }));
    });

    test('should destroy entity and clean up debug data', () => {
      const entityId = ecsManager.createEntity('TestEntity');
      const eventSpy = jest.fn();
      ecsManager.events.on('entity:destroyed', eventSpy);

      ecsManager.destroyEntity(entityId);

      expect(ecsManager.entities.has(entityId)).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          id: entityId
        })
      }));
    });
  });

  describe('Component System Integration', () => {
    test('should add component and trigger debug registration', () => {
      const entityId = ecsManager.createEntity('TestEntity');
      const debugSpy = jest.spyOn(ecsManager.debugManager, 'registerComponent');
      const eventSpy = jest.fn();
      ecsManager.events.on('component:added', eventSpy);

      ecsManager.addComponent(entityId, 'transform', {
        position: { x: 1, y: 2, z: 3 }
      });

      expect(debugSpy).toHaveBeenCalledWith('transform', expect.any(Object), entityId);
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          entityId,
          type: 'transform'
        })
      }));
    });

    test('should remove component and emit events', () => {
      const entityId = ecsManager.createEntity('TestEntity');
      ecsManager.addComponent(entityId, 'transform', { x: 1 });
      
      const eventSpy = jest.fn();
      ecsManager.events.on('component:removed', eventSpy);

      ecsManager.removeComponent(entityId, 'transform');

      expect(ecsManager.getComponent(entityId, 'transform')).toBeNull();
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          entityId,
          type: 'transform'
        })
      }));
    });
  });

  describe('Render System Integration', () => {
    test('should handle mesh component addition through events', () => {
      const entityId = ecsManager.createEntity('RenderableEntity');

      // Add mesh component
      ecsManager.addComponent(entityId, 'mesh', {
        mesh: mockMesh
      });

      // Check that the mesh was added to the scene
      expect(mockScene.add).toHaveBeenCalledWith(mockMesh);
      expect(renderSystem.meshes.has(entityId)).toBe(true);
    });

    test('should render entities with transform and mesh components', () => {
      const entityId = ecsManager.createEntity('RenderableEntity');

      // Add transform component
      ecsManager.addComponent(entityId, 'transform', {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0.1, y: 0.2, z: 0.3 },
        scale: { x: 2, y: 2, z: 2 }
      });

      // Add mesh component
      ecsManager.addComponent(entityId, 'mesh', {
        mesh: mockMesh
      });

      // Update render system
      renderSystem.update(16.67, ecsManager);

      // Check that mesh transforms were updated
      expect(mockMesh.position.set).toHaveBeenCalledWith(1, 2, 3);
      expect(mockMesh.rotation.set).toHaveBeenCalledWith(0.1, 0.2, 0.3);
      expect(mockMesh.scale.set).toHaveBeenCalledWith(2, 2, 2);
      expect(mockRenderer.render).toHaveBeenCalledWith(mockScene, mockCamera);
    });

    test('should remove mesh when entity is destroyed', () => {
      const entityId = ecsManager.createEntity('RenderableEntity');
      ecsManager.addComponent(entityId, 'mesh', { mesh: mockMesh });

      expect(renderSystem.meshes.has(entityId)).toBe(true);

      ecsManager.destroyEntity(entityId);

      expect(mockScene.remove).toHaveBeenCalledWith(mockMesh);
      expect(renderSystem.meshes.has(entityId)).toBe(false);
    });
  });

  describe('Animation System Integration', () => {
    test('should start animation through events', () => {
      const entityId = ecsManager.createEntity('AnimatedEntity');
      ecsManager.addComponent(entityId, 'transform', {
        rotation: { x: 0, y: 0, z: 0 }
      });

      ecsManager.events.emit('animation:start', {
        entityId,
        animation: {
          type: 'rotation',
          speed: { x: 1, y: 2, z: 3 },
          duration: 0
        }
      });

      expect(animationSystem.animations.has(entityId)).toBe(true);
    });

    test('should update entity transforms during animation', () => {
      const entityId = ecsManager.createEntity('AnimatedEntity');
      const transformData = {
        rotation: { x: 0, y: 0, z: 0 }
      };
      ecsManager.addComponent(entityId, 'transform', transformData);

      // Start animation
      animationSystem.startAnimation(entityId, {
        type: 'rotation',
        speed: { x: 1, y: 1, z: 1 },
        duration: 0
      });

      const initialRotation = { ...transformData.rotation };

      // Update animation system
      animationSystem.update(16.67, ecsManager);

      // Check that rotation has changed
      expect(transformData.rotation.x).not.toBe(initialRotation.x);
      expect(transformData.rotation.y).not.toBe(initialRotation.y);
      expect(transformData.rotation.z).not.toBe(initialRotation.z);
    });

    test('should emit animation completed event', () => {
      const entityId = ecsManager.createEntity('AnimatedEntity');
      ecsManager.addComponent(entityId, 'transform', {
        position: { x: 0, y: 0, z: 0 }
      });

      const eventSpy = jest.fn();
      ecsManager.events.on('animation:completed', eventSpy);

      // Start a short animation
      animationSystem.startAnimation(entityId, {
        type: 'position',
        velocity: { x: 1, y: 0, z: 0 },
        duration: 100 // 100ms
      });

      // Fast forward time
      animationSystem.update(150, ecsManager); // More than duration

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          entityId
        })
      }));
      expect(animationSystem.animations.has(entityId)).toBe(false);
    });
  });

  describe('System Update Loop Integration', () => {
    test('should update all systems in priority order', () => {
      const updateSpy1 = jest.spyOn(renderSystem, 'update');
      const updateSpy2 = jest.spyOn(animationSystem, 'update');

      ecsManager.updateSystems(16.67);

      expect(updateSpy1).toHaveBeenCalledWith(16.67, ecsManager);
      expect(updateSpy2).toHaveBeenCalledWith(16.67, ecsManager);

      // Render system should be called first (higher priority)
      expect(updateSpy1).toHaveBeenCalledBefore(updateSpy2);
    });

    test('should track system performance during updates', () => {
      const performanceSpy = jest.spyOn(ecsManager.debugManager, 'trackPerformance');

      ecsManager.updateSystems(16.67);

      expect(performanceSpy).toHaveBeenCalledWith('RenderSystem', expect.any(Function));
      expect(performanceSpy).toHaveBeenCalledWith('AnimationSystem', expect.any(Function));
    });

    test('should handle system errors gracefully', () => {
      const errorSystem = {
        name: 'ErrorSystem',
        update: jest.fn(() => {
          throw new Error('System error');
        })
      };

      ecsManager.registerSystem(errorSystem);

      const eventSpy = jest.fn();
      ecsManager.events.on('system:error', eventSpy);

      expect(() => {
        ecsManager.updateSystems(16.67);
      }).not.toThrow();

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          name: 'ErrorSystem',
          error: expect.any(Error)
        })
      }));
    });
  });

  describe('Performance and Debug Integration', () => {
    test('should provide comprehensive ECS statistics', () => {
      // Create some entities and components
      const entity1 = ecsManager.createEntity('Entity1');
      const entity2 = ecsManager.createEntity('Entity2');
      
      ecsManager.addComponent(entity1, 'transform', {});
      ecsManager.addComponent(entity1, 'mesh', {});
      ecsManager.addComponent(entity2, 'transform', {});

      const stats = ecsManager.getStats();

      expect(stats).toEqual({
        entities: 2,
        systems: 2,
        componentTypes: 2,
        componentStats: {
          transform: 2,
          mesh: 1
        },
        running: false,
        debug: expect.objectContaining({
          enabled: true,
          entities: 2
        }),
        events: expect.objectContaining({
          eventTypes: expect.any(Number),
          totalListeners: expect.any(Number)
        })
      });
    });

    test('should integrate event processing with game loop', () => {
      const eventSpy = jest.fn();
      ecsManager.events.on('test:event', eventSpy);

      // Queue an event
      ecsManager.events.queue('test:event', 'test data');

      // Process one frame of the game loop manually
      ecsManager.eventManager.processQueue();
      ecsManager.updateSystems(16.67);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'test:event',
        data: 'test data'
      }));
    });

    test('should maintain debug panel state during entity operations', () => {
      // Create debug panel
      expect(document.getElementById('debug-panel')).toBeTruthy();

      // Perform various operations
      const entityId = ecsManager.createEntity('TestEntity');
      ecsManager.addComponent(entityId, 'transform', {});
      ecsManager.addComponent(entityId, 'mesh', { mesh: mockMesh });

      // Update systems
      ecsManager.updateSystems(16.67);

      // Debug panel should still exist and be updated
      expect(document.getElementById('debug-panel')).toBeTruthy();
      expect(document.getElementById('debug-stats')).toBeTruthy();
    });
  });

  describe('Complex Integration Scenarios', () => {
    test('should handle multiple animated entities with different animation types', () => {
      const entities = [];
      
      // Create multiple entities with different animations
      for (let i = 0; i < 5; i++) {
        const entityId = ecsManager.createEntity(`Entity${i}`);
        entities.push(entityId);
        
        ecsManager.addComponent(entityId, 'transform', {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        
        ecsManager.addComponent(entityId, 'mesh', { mesh: { ...mockMesh } });
        
        // Different animation types
        const animationType = i % 3 === 0 ? 'rotation' : i % 3 === 1 ? 'scale' : 'position';
        ecsManager.events.emit('animation:start', {
          entityId,
          animation: {
            type: animationType,
            speed: { x: 1, y: 1, z: 1 },
            velocity: { x: 1, y: 1, z: 1 },
            frequency: 2,
            amplitude: 0.5,
            duration: 0
          }
        });
      }

      // Update systems multiple times
      for (let frame = 0; frame < 10; frame++) {
        animationSystem.update(16.67, ecsManager);
        renderSystem.update(16.67, ecsManager);
      }

      // All entities should still exist and be animated
      expect(entities.every(id => ecsManager.entities.has(id))).toBe(true);
      expect(animationSystem.animations.size).toBe(5);
    });

    test('should handle entity destruction during system updates', () => {
      const entityId = ecsManager.createEntity('ToBeDestroyed');
      ecsManager.addComponent(entityId, 'transform', {});
      ecsManager.addComponent(entityId, 'mesh', { mesh: mockMesh });

      // Start animation
      ecsManager.events.emit('animation:start', {
        entityId,
        animation: { type: 'rotation', speed: { x: 1, y: 1, z: 1 }, duration: 0 }
      });

      expect(animationSystem.animations.has(entityId)).toBe(true);
      expect(renderSystem.meshes.has(entityId)).toBe(true);

      // Destroy entity
      ecsManager.destroyEntity(entityId);

      // Systems should handle the missing entity gracefully
      expect(() => {
        animationSystem.update(16.67, ecsManager);
        renderSystem.update(16.67, ecsManager);
      }).not.toThrow();

      // Animation should be cleaned up
      expect(animationSystem.animations.has(entityId)).toBe(false);
      expect(renderSystem.meshes.has(entityId)).toBe(false);
    });

    test('should maintain consistent state across event queuing and processing', () => {
      const entityId = ecsManager.createEntity('QueueTestEntity');
      ecsManager.addComponent(entityId, 'transform', {});

      // Queue multiple events
      ecsManager.events.queue('animation:start', {
        entityId,
        animation: { type: 'rotation', speed: { x: 1, y: 1, z: 1 }, duration: 100 }
      });

      ecsManager.events.queue('animation:stop', { entityId });

      // Process queue
      ecsManager.events.processQueue();

      // Animation should not be active (stopped after being started)
      expect(animationSystem.animations.has(entityId)).toBe(false);
    });
  });

  describe('System Enable/Disable', () => {
    test('should have systems enabled by default after registration', () => {
      expect(ecsManager.systems.find(s => s.name === 'RenderSystem').enabled).toBe(true);
      expect(ecsManager.systems.find(s => s.name === 'AnimationSystem').enabled).toBe(true);
    });

    test('should disable a system and prevent its update', () => {
      const updateSpy = jest.spyOn(renderSystem, 'update');
      ecsManager.disableSystem('RenderSystem');
      ecsManager.updateSystems(16.67);
      expect(ecsManager.systems.find(s => s.name === 'RenderSystem').enabled).toBe(false);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('should enable a previously disabled system and resume its update', () => {
      const updateSpy = jest.spyOn(renderSystem, 'update');
      ecsManager.disableSystem('RenderSystem');
      ecsManager.enableSystem('RenderSystem');
      ecsManager.updateSystems(16.67);
      expect(ecsManager.systems.find(s => s.name === 'RenderSystem').enabled).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(16.67, ecsManager);
    });

    test('should return false when enabling/disabling a non-existent system', () => {
      expect(ecsManager.disableSystem('BogusSystem')).toBe(false);
      expect(ecsManager.enableSystem('BogusSystem')).toBe(false);
    });

    test('should be idempotent when enabling/disabling an already enabled/disabled system', () => {
      expect(ecsManager.enableSystem('RenderSystem')).toBe(true); // already enabled
      ecsManager.disableSystem('RenderSystem');
      expect(ecsManager.disableSystem('RenderSystem')).toBe(true); // already disabled
    });
  });
});
