/**
 * Example Render System for Three.js integration
 * Demonstrates how systems work with the event and debug management
 */
class RenderSystem {
  constructor(scene, camera, renderer) {
    this.name = 'RenderSystem';
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.ecsManager = null;
    this.meshes = new Map(); // entityId -> THREE.Mesh
  }

  /**
   * Set reference to ECS Manager
   * @param {ECSManager} ecsManager - The ECS Manager instance
   */
  setECSManager(ecsManager) {
    this.ecsManager = ecsManager;
    
    // Listen to component events
    ecsManager.events.on('component:added', (event) => {
      if (event.data.type === 'mesh') {
        this.addMesh(event.data.entityId, event.data.component);
      }
    });

    ecsManager.events.on('component:removed', (event) => {
      if (event.data.type === 'mesh') {
        this.removeMesh(event.data.entityId);
      }
    });

    ecsManager.events.on('entity:destroyed', (event) => {
      this.removeMesh(event.data.id);
    });
  }

  /**
   * Add a mesh to the scene
   * @param {string} entityId - Entity ID
   * @param {Object} meshComponent - Mesh component data
   */
  addMesh(entityId, meshComponent) {
    if (this.meshes.has(entityId)) {
      this.removeMesh(entityId);
    }

    const mesh = meshComponent.data.mesh;
    if (mesh) {
      this.scene.add(mesh);
      this.meshes.set(entityId, mesh);
      
      if (this.ecsManager) {
        this.ecsManager.debug.log('debug', `Added mesh for entity: ${entityId}`);
        this.ecsManager.events.emit('render:mesh_added', { entityId, mesh });
      }
    }
  }

  /**
   * Remove a mesh from the scene
   * @param {string} entityId - Entity ID
   */
  removeMesh(entityId) {
    const mesh = this.meshes.get(entityId);
    if (mesh) {
      this.scene.remove(mesh);
      this.meshes.delete(entityId);
      
      if (this.ecsManager) {
        this.ecsManager.debug.log('debug', `Removed mesh for entity: ${entityId}`);
        this.ecsManager.events.emit('render:mesh_removed', { entityId, mesh });
      }
    }
  }

  /**
   * System update method
   * @param {number} deltaTime - Time since last update
   * @param {ECSManager} ecsManager - ECS Manager instance
   */
  update(deltaTime, ecsManager) {
    // Get all entities with transform and mesh components
    const renderableEntities = ecsManager.getEntitiesWith('transform', 'mesh');

    for (const entityId of renderableEntities) {
      const transformComponent = ecsManager.getComponent(entityId, 'transform');
      const mesh = this.meshes.get(entityId);

      if (transformComponent && mesh) {
        const transform = transformComponent.data;
        
        // Update mesh position, rotation, scale
        if (transform.position) {
          mesh.position.set(transform.position.x || 0, transform.position.y || 0, transform.position.z || 0);
        }
        
        if (transform.rotation) {
          mesh.rotation.set(transform.rotation.x || 0, transform.rotation.y || 0, transform.rotation.z || 0);
        }
        
        if (transform.scale) {
          mesh.scale.set(transform.scale.x || 1, transform.scale.y || 1, transform.scale.z || 1);
        }
      }
    }

    // Render the scene
    this.renderer.render(this.scene, this.camera);
  }
}

export default RenderSystem;
