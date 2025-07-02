/**
 * Debug Management System for ECS
 * Provides debugging tools, performance monitoring, and system inspection
 */
class DebugManager {
  constructor() {
    this.enabled = false;
    this.logLevel = 'info'; // 'debug', 'info', 'warn', 'error'
    this.performanceMetrics = new Map();
    this.debugPanel = null;
    this.stats = {
      frameCount: 0,
      lastFrameTime: 0,
      fps: 0,
      deltaTime: 0,
      averageDeltaTime: 0,
      frameTimeHistory: [],
      maxHistoryLength: 60
    };
    
    this.systems = new Map();
    this.entities = new Map();
    this.components = new Map();
    
    this.colors = {
      debug: '#888888',
      info: '#00ff00',
      warn: '#ffff00',
      error: '#ff0000',
      performance: '#00ffff',
      system: '#ff8800'
    };

    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  /**
   * Initialize the debug system
   * @param {Object} options - Configuration options
   */
  init(options = {}) {
    this.enabled = options.enabled !== false;
    this.logLevel = options.logLevel || 'info';
    
    if (this.enabled) {
      this.createDebugPanel();
      this.startPerformanceMonitoring();
      this.log('info', 'Debug Manager initialized');
    }
  }

  /**
   * Enable or disable the debug system
   * @param {boolean} enabled - Whether to enable debugging
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    
    if (enabled) {
      this.createDebugPanel();
      this.log('info', 'Debug Manager enabled');
    } else {
      this.removeDebugPanel();
      this.log('info', 'Debug Manager disabled');
    }
  }

  /**
   * Set the logging level
   * @param {string} level - The logging level ('debug', 'info', 'warn', 'error')
   */
  setLogLevel(level) {
    if (this.logLevels.hasOwnProperty(level)) {
      this.logLevel = level;
      this.log('info', `Log level set to: ${level}`);
    }
  }

  /**
   * Log a message with a specific level
   * @param {string} level - The log level
   * @param {string} message - The message to log
   * @param {*} data - Optional additional data
   */
  log(level, message, data = null) {
    if (!this.enabled || this.logLevels[level] < this.logLevels[this.logLevel]) {
      return;
    }

    const timestamp = new Date().toISOString().substr(11, 12);
    const color = this.colors[level] || this.colors.info;
    const prefix = `[${timestamp}] [DEBUG:${level.toUpperCase()}]`;

    console.log(
      `%c${prefix} ${message}`,
      `color: ${color}; font-weight: bold;`,
      data || ''
    );

    // Add to debug panel if it exists
    if (this.debugPanel) {
      this.addLogToPanel(level, timestamp, message, data);
    }
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    this.stats.lastFrameTime = performance.now();
    
    const updateStats = () => {
      if (!this.enabled) return;
      
      const currentTime = performance.now();
      this.stats.deltaTime = currentTime - this.stats.lastFrameTime;
      this.stats.lastFrameTime = currentTime;
      this.stats.frameCount++;
      
      // Calculate FPS
      this.stats.frameTimeHistory.push(this.stats.deltaTime);
      if (this.stats.frameTimeHistory.length > this.stats.maxHistoryLength) {
        this.stats.frameTimeHistory.shift();
      }
      
      const avgFrameTime = this.stats.frameTimeHistory.reduce((a, b) => a + b, 0) / this.stats.frameTimeHistory.length;
      this.stats.averageDeltaTime = avgFrameTime;
      this.stats.fps = 1000 / avgFrameTime;
      
      // Update debug panel
      this.updateDebugPanel();
      
      requestAnimationFrame(updateStats);
    };
    
    requestAnimationFrame(updateStats);
  }

  /**
   * Track performance of a function or code block
   * @param {string} name - Name of the operation being tracked
   * @param {Function} fn - Function to execute and track
   * @returns {*} The result of the function
   */
  trackPerformance(name, fn) {
    if (!this.enabled) {
      return fn();
    }

    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (!this.performanceMetrics.has(name)) {
      this.performanceMetrics.set(name, {
        calls: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        lastTime: 0
      });
    }

    const metrics = this.performanceMetrics.get(name);
    metrics.calls++;
    metrics.totalTime += duration;
    metrics.averageTime = metrics.totalTime / metrics.calls;
    metrics.minTime = Math.min(metrics.minTime, duration);
    metrics.maxTime = Math.max(metrics.maxTime, duration);
    metrics.lastTime = duration;

    if (duration > 16.67) { // Slower than 60fps frame time
      this.log('warn', `Performance warning: ${name} took ${duration.toFixed(2)}ms`);
    }

    return result;
  }

  /**
   * Register a system for debugging
   * @param {string} name - System name
   * @param {Object} system - System instance
   */
  registerSystem(name, system) {
    this.systems.set(name, {
      instance: system,
      enabled: true,
      lastUpdateTime: 0,
      updateCount: 0,
      averageUpdateTime: 0
    });
    
    this.log('debug', `Registered system: ${name}`);
  }

  /**
   * Register an entity for debugging
   * @param {string} id - Entity ID
   * @param {Object} entity - Entity instance
   */
  registerEntity(id, entity) {
    this.entities.set(id, {
      instance: entity,
      components: new Set(),
      created: Date.now()
    });
    
    this.log('debug', `Registered entity: ${id}`);
  }

  /**
   * Register a component for debugging
   * @param {string} type - Component type
   * @param {Object} component - Component instance
   * @param {string} entityId - Entity ID that owns this component
   */
  registerComponent(type, component, entityId) {
    if (!this.components.has(type)) {
      this.components.set(type, new Set());
    }
    
    this.components.get(type).add({
      instance: component,
      entityId,
      created: Date.now()
    });
    
    if (this.entities.has(entityId)) {
      this.entities.get(entityId).components.add(type);
    }
    
    this.log('debug', `Registered component: ${type} for entity: ${entityId}`);
  }

  /**
   * Create the debug panel UI
   */
  createDebugPanel() {
    if (this.debugPanel || !this.enabled) return;

    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'debug-panel';
    this.debugPanel.innerHTML = `
      <div id="debug-header">
        <h3>ECS Debug Panel</h3>
        <button id="debug-toggle">Hide</button>
      </div>
      <div id="debug-content">
        <div id="debug-stats"></div>
        <div id="debug-systems"></div>
        <div id="debug-entities"></div>
        <div id="debug-performance"></div>
        <div id="debug-logs"></div>
      </div>
    `;

    // Add styles
    this.debugPanel.style.cssText = `
      position: fixed;
      top: 50px;
      right: 10px;
      width: 300px;
      max-height: 80vh;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      border: 1px solid #333;
      border-radius: 5px;
      overflow-y: auto;
      z-index: 10000;
      padding: 10px;
    `;

    document.body.appendChild(this.debugPanel);

    // Add toggle functionality
    const toggleBtn = document.getElementById('debug-toggle');
    toggleBtn.addEventListener('click', () => {
      const content = document.getElementById('debug-content');
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
      toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
    });

    this.log('info', 'Debug panel created');
  }

  /**
   * Remove the debug panel
   */
  removeDebugPanel() {
    if (this.debugPanel) {
      this.debugPanel.remove();
      this.debugPanel = null;
    }
  }

  /**
   * Update the debug panel with current information
   */
  updateDebugPanel() {
    if (!this.debugPanel || !this.enabled) return;

    const statsDiv = document.getElementById('debug-stats');
    const systemsDiv = document.getElementById('debug-systems');
    const entitiesDiv = document.getElementById('debug-entities');
    const performanceDiv = document.getElementById('debug-performance');

    // Update stats
    if (statsDiv) {
      statsDiv.innerHTML = `
        <h4>Performance Stats</h4>
        <div>FPS: ${this.stats.fps.toFixed(1)}</div>
        <div>Frame Time: ${this.stats.deltaTime.toFixed(2)}ms</div>
        <div>Avg Frame Time: ${this.stats.averageDeltaTime.toFixed(2)}ms</div>
        <div>Frame Count: ${this.stats.frameCount}</div>
      `;
    }

    // Update systems
    if (systemsDiv) {
      let systemsHtml = '<h4>Systems</h4>';
      for (const [name, system] of this.systems) {
        systemsHtml += `<div>${name}: ${system.enabled ? 'ON' : 'OFF'}</div>`;
      }
      systemsDiv.innerHTML = systemsHtml;
    }

    // Update entities
    if (entitiesDiv) {
      entitiesDiv.innerHTML = `
        <h4>Entities</h4>
        <div>Count: ${this.entities.size}</div>
      `;
    }

    // Update performance metrics
    if (performanceDiv) {
      let perfHtml = '<h4>Performance Metrics</h4>';
      for (const [name, metrics] of this.performanceMetrics) {
        perfHtml += `
          <div>${name}:</div>
          <div style="margin-left: 10px;">
            Calls: ${metrics.calls}<br>
            Avg: ${metrics.averageTime.toFixed(2)}ms<br>
            Last: ${metrics.lastTime.toFixed(2)}ms
          </div>
        `;
      }
      performanceDiv.innerHTML = perfHtml;
    }
  }

  /**
   * Add a log entry to the debug panel
   * @param {string} level - Log level
   * @param {string} timestamp - Timestamp
   * @param {string} message - Log message
   * @param {*} data - Additional data
   */
  addLogToPanel(level, timestamp, message, data) {
    const logsDiv = document.getElementById('debug-logs');
    if (!logsDiv) return;

    const logEntry = document.createElement('div');
    logEntry.style.cssText = `
      color: ${this.colors[level]};
      margin: 2px 0;
      font-size: 10px;
    `;
    logEntry.textContent = `[${timestamp.substr(0, 8)}] ${message}`;
    
    logsDiv.appendChild(logEntry);
    
    // Limit log entries
    while (logsDiv.children.length > 50) {
      logsDiv.removeChild(logsDiv.firstChild);
    }
    
    // Auto-scroll to bottom
    logsDiv.scrollTop = logsDiv.scrollHeight;
  }

  /**
   * Get debug information as an object
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      enabled: this.enabled,
      stats: { ...this.stats },
      systems: Array.from(this.systems.keys()),
      entities: this.entities.size,
      components: Array.from(this.components.keys()),
      performanceMetrics: Object.fromEntries(this.performanceMetrics)
    };
  }

  /**
   * Clear all debug data
   */
  clear() {
    this.performanceMetrics.clear();
    this.systems.clear();
    this.entities.clear();
    this.components.clear();
    
    if (this.debugPanel) {
      const logsDiv = document.getElementById('debug-logs');
      if (logsDiv) {
        logsDiv.innerHTML = '';
      }
    }
    
    this.log('info', 'Debug data cleared');
  }
}

export default DebugManager;
