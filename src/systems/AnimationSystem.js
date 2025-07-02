/**
 * Example Animation System
 * Demonstrates system interactions with event management
 */
class AnimationSystem {
  constructor() {
    this.name = 'AnimationSystem';
    this.ecsManager = null;
    this.animations = new Map(); // entityId -> animation data
  }

  /**
   * Set reference to ECS Manager
   * @param {ECSManager} ecsManager - The ECS Manager instance
   */
  setECSManager(ecsManager) {
    this.ecsManager = ecsManager;
    
    // Listen for animation events
    ecsManager.events.on('animation:start', (event) => {
      this.startAnimation(event.data.entityId, event.data.animation);
    });

    ecsManager.events.on('animation:stop', (event) => {
      this.stopAnimation(event.data.entityId);
    });

    ecsManager.events.on('entity:destroyed', (event) => {
      this.animations.delete(event.data.id);
    });
  }

  /**
   * Start an animation for an entity
   * @param {string} entityId - Entity ID
   * @param {Object} animationData - Animation configuration
   */
  startAnimation(entityId, animationData) {
    this.animations.set(entityId, {
      ...animationData,
      startTime: Date.now(),
      elapsed: 0
    });

    if (this.ecsManager) {
      this.ecsManager.debug.log('debug', `Started animation for entity: ${entityId}`, animationData);
    }
  }

  /**
   * Stop an animation for an entity
   * @param {string} entityId - Entity ID
   */
  stopAnimation(entityId) {
    if (this.animations.has(entityId)) {
      this.animations.delete(entityId);
      
      if (this.ecsManager) {
        this.ecsManager.debug.log('debug', `Stopped animation for entity: ${entityId}`);
        this.ecsManager.events.emit('animation:stopped', { entityId });
      }
    }
  }

  /**
   * System update method
   * @param {number} deltaTime - Time since last update
   * @param {ECSManager} ecsManager - ECS Manager instance
   */
  update(deltaTime, ecsManager) {
    for (const [entityId, animation] of this.animations) {
      animation.elapsed += deltaTime;
      
      const transformComponent = ecsManager.getComponent(entityId, 'transform');
      if (!transformComponent) continue;

      const transform = transformComponent.data;
      const progress = Math.min(animation.elapsed / animation.duration, 1);

      // Handle different animation types
      switch (animation.type) {
        case 'rotation':
          if (!transform.rotation) transform.rotation = { x: 0, y: 0, z: 0 };
          transform.rotation.x += animation.speed.x * deltaTime * 0.001;
          transform.rotation.y += animation.speed.y * deltaTime * 0.001;
          transform.rotation.z += animation.speed.z * deltaTime * 0.001;
          break;

        case 'scale':
          if (!transform.scale) transform.scale = { x: 1, y: 1, z: 1 };
          const scaleProgress = Math.sin(animation.elapsed * 0.001 * animation.frequency) * animation.amplitude;
          transform.scale.x = 1 + scaleProgress;
          transform.scale.y = 1 + scaleProgress;
          transform.scale.z = 1 + scaleProgress;
          break;

        case 'position':
          if (!transform.position) transform.position = { x: 0, y: 0, z: 0 };
          transform.position.x += animation.velocity.x * deltaTime * 0.001;
          transform.position.y += animation.velocity.y * deltaTime * 0.001;
          transform.position.z += animation.velocity.z * deltaTime * 0.001;
          break;
      }

      // Check if animation is complete
      if (animation.duration > 0 && progress >= 1) {
        ecsManager.events.emit('animation:completed', { entityId, animation });
        this.stopAnimation(entityId);
      }
    }
  }
}

export default AnimationSystem;
