import * as THREE from 'three';
import { GUI } from 'dat.gui';

// Example Three.js scene with dat.gui controls for ECS project
class ThreeJSExample {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cube = null;
    this.gui = null;
    
    this.params = {
      rotationSpeed: 0.01,
      color: 0x00ff00,
      wireframe: false
    };
    
    this.init();
    this.setupGUI();
    this.animate();
  }
  
  init() {
    // Scene
    this.scene = new THREE.Scene();
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    this.camera.position.z = 5;
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
    
    // Cube geometry and material
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ 
      color: this.params.color,
      wireframe: this.params.wireframe
    });
    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }
  
  setupGUI() {
    this.gui = new GUI();
    
    // Rotation speed control
    this.gui.add(this.params, 'rotationSpeed', 0, 0.1)
      .name('Rotation Speed');
    
    // Color control
    this.gui.addColor(this.params, 'color')
      .name('Cube Color')
      .onChange(() => {
        this.cube.material.color.setHex(this.params.color);
      });
    
    // Wireframe toggle
    this.gui.add(this.params, 'wireframe')
      .name('Wireframe')
      .onChange(() => {
        this.cube.material.wireframe = this.params.wireframe;
      });
  }
  
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Rotate cube
    this.cube.rotation.x += this.params.rotationSpeed;
    this.cube.rotation.y += this.params.rotationSpeed;
    
    this.renderer.render(this.scene, this.camera);
  }
}

export default ThreeJSExample;
