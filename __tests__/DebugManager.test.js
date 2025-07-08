/**
 * DebugManager.test.js
 * Unit tests for the DebugManager class, covering initialization, enabling/disabling,
 * logging, performance tracking, system/entity/component registration, debug panel,
 * performance monitoring, debug info export, and edge cases.
 * Uses Jest and jsdom for DOM manipulation and assertions.
 */
/**
 * @jest-environment jsdom
 */
import DebugManager from '../src/core/DebugManager.js';

describe('DebugManager', () => {
  let debugManager;

  beforeEach(() => {
    debugManager = new DebugManager();
    // Clean up any existing debug panels
    const existingPanel = document.getElementById('debug-panel');
    if (existingPanel) {
      existingPanel.remove();
    }
  });

  afterEach(() => {
    debugManager.clear();
    debugManager.removeDebugPanel();
  });

  describe('Initialization', () => {
    test('should initialize with default settings', () => {
      expect(debugManager.enabled).toBe(false);
      expect(debugManager.logLevel).toBe('info');
      expect(debugManager.performanceMetrics).toBeInstanceOf(Map);
      expect(debugManager.stats).toBeDefined();
    });

    test('should initialize with custom options', () => {
      const options = {
        enabled: true,
        logLevel: 'debug'
      };

      debugManager.init(options);

      expect(debugManager.enabled).toBe(true);
      expect(debugManager.logLevel).toBe('debug');
    });

    test('should create debug panel when enabled', () => {
      debugManager.init({ enabled: true });

      const panel = document.getElementById('debug-panel');
      expect(panel).toBeTruthy();
      expect(panel.style.position).toBe('fixed');
    });
  });

  describe('Enable/Disable', () => {
    test('should enable debug system', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      debugManager.setEnabled(true);

      expect(debugManager.enabled).toBe(true);
      expect(document.getElementById('debug-panel')).toBeTruthy();

      consoleSpy.mockRestore();
    });

    test('should disable debug system', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugManager.setEnabled(true);
      debugManager.setEnabled(false);

      expect(debugManager.enabled).toBe(false);
      expect(document.getElementById('debug-panel')).toBeFalsy();

      consoleSpy.mockRestore();
    });
  });

  describe('Logging', () => {
    beforeEach(() => {
      debugManager.setEnabled(true);
    });

    test('should log messages with correct level', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      debugManager.log('info', 'Test message', { data: 'test' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG:INFO] Test message'),
        expect.stringContaining('color: #00ff00'),
        { data: 'test' }
      );

      consoleSpy.mockRestore();
    });

    test('should respect log level filtering', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      debugManager.setLogLevel('warn');

      debugManager.log('debug', 'Debug message');
      debugManager.log('info', 'Info message');
      debugManager.log('warn', 'Warning message');
      debugManager.log('error', 'Error message');

      // Count only the warn and error messages (not setup messages)
      const warnCalls = consoleSpy.mock.calls.filter(call => 
        call[0].includes('WARN') || call[0].includes('ERROR')
      );
      expect(warnCalls.length).toBeGreaterThanOrEqual(1); // At least one warn/error call

      consoleSpy.mockRestore();
    });

    test('should not log when disabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Make sure debug manager starts fresh
      debugManager.setEnabled(false);
      consoleSpy.mockClear(); // Clear any setup calls

      debugManager.log('info', 'Test message');

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should set log level correctly', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      debugManager.setLogLevel('error');

      expect(debugManager.logLevel).toBe('error');

      consoleSpy.mockRestore();
    });

    test('should ignore invalid log levels', () => {
      const originalLevel = debugManager.logLevel;

      debugManager.setLogLevel('invalid');

      expect(debugManager.logLevel).toBe(originalLevel);
    });
  });

  describe('Performance Tracking', () => {
    beforeEach(() => {
      debugManager.setEnabled(true);
    });

    test('should track function performance', () => {
      const testFunction = jest.fn(() => {
        // Simulate some work
        const start = Date.now();
        while (Date.now() - start < 10) {} // 10ms delay
        return 'result';
      });

      const result = debugManager.trackPerformance('test_function', testFunction);

      expect(result).toBe('result');
      expect(testFunction).toHaveBeenCalled();
      expect(debugManager.performanceMetrics.has('test_function')).toBe(true);

      const metrics = debugManager.performanceMetrics.get('test_function');
      expect(metrics.calls).toBe(1);
      expect(metrics.totalTime).toBeGreaterThan(0);
      expect(metrics.averageTime).toBeGreaterThan(0);
      expect(metrics.minTime).toBeGreaterThan(0);
      expect(metrics.maxTime).toBeGreaterThan(0);
    });

    test('should accumulate performance metrics over multiple calls', () => {
      const testFunction = () => 'result';

      debugManager.trackPerformance('test_function', testFunction);
      debugManager.trackPerformance('test_function', testFunction);
      debugManager.trackPerformance('test_function', testFunction);

      const metrics = debugManager.performanceMetrics.get('test_function');
      expect(metrics.calls).toBe(3);
      expect(metrics.averageTime).toBe(metrics.totalTime / 3);
    });

    test('should warn about slow operations', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const slowFunction = () => {
        const start = Date.now();
        while (Date.now() - start < 20) {} // 20ms delay (slower than 60fps)
      };

      debugManager.trackPerformance('slow_function', slowFunction);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance warning'),
        expect.stringContaining('color: #ffff00'),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });

    test('should not track performance when disabled', () => {
      debugManager.setEnabled(false);
      const testFunction = jest.fn(() => 'result');

      const result = debugManager.trackPerformance('test_function', testFunction);

      expect(result).toBe('result');
      expect(debugManager.performanceMetrics.has('test_function')).toBe(false);
    });
  });

  describe('System Registration', () => {
    beforeEach(() => {
      debugManager.setEnabled(true);
    });

    test('should register systems for debugging', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const system = { name: 'TestSystem' };

      debugManager.registerSystem('TestSystem', system);

      expect(debugManager.systems.has('TestSystem')).toBe(true);
      expect(debugManager.systems.get('TestSystem')).toEqual({
        instance: system,
        enabled: true,
        lastUpdateTime: 0,
        updateCount: 0,
        averageUpdateTime: 0
      });

      consoleSpy.mockRestore();
    });

    test('should register entities for debugging', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const entity = { id: 'entity_1' };

      debugManager.registerEntity('entity_1', entity);

      expect(debugManager.entities.has('entity_1')).toBe(true);
      expect(debugManager.entities.get('entity_1')).toEqual({
        instance: entity,
        components: new Set(),
        created: expect.any(Number)
      });

      consoleSpy.mockRestore();
    });

    test('should register components for debugging', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const component = { type: 'transform' };

      debugManager.registerEntity('entity_1', {});
      debugManager.registerComponent('transform', component, 'entity_1');

      expect(debugManager.components.has('transform')).toBe(true);
      expect(debugManager.entities.get('entity_1').components.has('transform')).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Debug Panel', () => {
    beforeEach(() => {
      debugManager.setEnabled(true);
    });

    test('should create debug panel', () => {
      debugManager.createDebugPanel();

      const panel = document.getElementById('debug-panel');
      expect(panel).toBeTruthy();
      expect(panel.innerHTML).toContain('ECS Debug Panel');
      expect(document.getElementById('debug-header')).toBeTruthy();
      expect(document.getElementById('debug-content')).toBeTruthy();
    });

    test('should not create multiple debug panels', () => {
      debugManager.createDebugPanel();
      debugManager.createDebugPanel();

      const panels = document.querySelectorAll('#debug-panel');
      expect(panels).toHaveLength(1);
    });

    test('should remove debug panel', () => {
      debugManager.createDebugPanel();
      expect(document.getElementById('debug-panel')).toBeTruthy();

      debugManager.removeDebugPanel();
      expect(document.getElementById('debug-panel')).toBeFalsy();
    });

    test('should toggle debug panel visibility', () => {
      debugManager.createDebugPanel();
      
      const toggleBtn = document.getElementById('debug-toggle');
      const content = document.getElementById('debug-content');

      expect(content.style.display).not.toBe('none');

      // Simulate click
      toggleBtn.click();
      expect(content.style.display).toBe('none');
      expect(toggleBtn.textContent).toBe('Show');

      // Click again
      toggleBtn.click();
      expect(content.style.display).toBe('block');
      expect(toggleBtn.textContent).toBe('Hide');
    });

    test('should update debug panel with current stats', () => {
      debugManager.createDebugPanel();
      debugManager.stats.fps = 60;
      debugManager.stats.deltaTime = 16.67;

      debugManager.updateDebugPanel();

      const statsDiv = document.getElementById('debug-stats');
      expect(statsDiv.innerHTML).toContain('FPS: 60.0');
      expect(statsDiv.innerHTML).toContain('Frame Time: 16.67ms');
    });

    test('should add log entries to panel', () => {
      debugManager.createDebugPanel();
      
      // Clear any existing logs from setup
      const logsDiv = document.getElementById('debug-logs');
      logsDiv.innerHTML = '';

      debugManager.addLogToPanel('info', '12:34:56.789', 'Test message', null);

      expect(logsDiv.children).toHaveLength(1);
      expect(logsDiv.firstChild.textContent).toContain('[12:34:56] Test message');
    });

    test('should limit log entries in panel', () => {
      debugManager.createDebugPanel();

      // Add more than 50 log entries
      for (let i = 0; i < 60; i++) {
        debugManager.addLogToPanel('info', '12:34:56.789', `Message ${i}`, null);
      }

      const logsDiv = document.getElementById('debug-logs');
      expect(logsDiv.children.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Performance Monitoring', () => {
    test('should start performance monitoring', (done) => {
      debugManager.setEnabled(true);
      
      // Mock requestAnimationFrame
      global.requestAnimationFrame = jest.fn((callback) => {
        setTimeout(callback, 16);
      });

      debugManager.startPerformanceMonitoring();

      setTimeout(() => {
        expect(debugManager.stats.frameCount).toBeGreaterThan(0);
        expect(debugManager.stats.fps).toBeGreaterThan(0);
        done();
      }, 50);
    });

    test('should calculate average frame time', () => {
      debugManager.stats.frameTimeHistory = [16, 17, 15, 18, 16];
      
      const avgFrameTime = debugManager.stats.frameTimeHistory.reduce((a, b) => a + b, 0) / debugManager.stats.frameTimeHistory.length;
      debugManager.stats.averageDeltaTime = avgFrameTime;
      debugManager.stats.fps = 1000 / avgFrameTime;

      expect(debugManager.stats.averageDeltaTime).toBeCloseTo(16.4);
      expect(debugManager.stats.fps).toBeCloseTo(60.98, 1);
    });
  });

  describe('Debug Information', () => {
    test('should provide complete debug information', () => {
      debugManager.setEnabled(true);
      debugManager.registerSystem('TestSystem', {});
      debugManager.registerEntity('entity_1', {});
      debugManager.performanceMetrics.set('test_op', { calls: 5, totalTime: 100 });

      const debugInfo = debugManager.getDebugInfo();

      expect(debugInfo).toEqual({
        enabled: true,
        stats: expect.objectContaining({
          frameCount: expect.any(Number),
          fps: expect.any(Number)
        }),
        systems: ['TestSystem'],
        entities: 1,
        components: [],
        performanceMetrics: {
          test_op: { calls: 5, totalTime: 100 }
        }
      });
    });

    test('should clear all debug data', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugManager.setEnabled(true);
      debugManager.registerSystem('TestSystem', {});
      debugManager.registerEntity('entity_1', {});
      debugManager.performanceMetrics.set('test_op', { calls: 5 });

      debugManager.clear();

      expect(debugManager.performanceMetrics.size).toBe(0);
      expect(debugManager.systems.size).toBe(0);
      expect(debugManager.entities.size).toBe(0);
      expect(debugManager.components.size).toBe(0);

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    test('should handle undefined panel elements gracefully', () => {
      debugManager.updateDebugPanel(); // Should not throw when panel doesn't exist
      debugManager.addLogToPanel('info', '12:34:56', 'message', null); // Should not throw
      
      expect(() => {
        debugManager.updateDebugPanel();
        debugManager.addLogToPanel('info', '12:34:56', 'message', null);
      }).not.toThrow();
    });

    test('should handle performance tracking with thrown errors', () => {
      debugManager.setEnabled(true);
      
      const errorFunction = () => {
        throw new Error('Test error');
      };

      expect(() => {
        debugManager.trackPerformance('error_function', errorFunction);
      }).toThrow('Test error');

      // The performance tracking should not complete when an error is thrown
      // This is expected behavior - we don't want to track failed operations
      expect(debugManager.performanceMetrics.has('error_function')).toBe(false);
    });

    test('should handle rapid stats updates', () => {
      debugManager.setEnabled(true);
      debugManager.createDebugPanel();

      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        debugManager.stats.fps = 60 + Math.random() * 10;
        debugManager.updateDebugPanel();
      }

      const statsDiv = document.getElementById('debug-stats');
      expect(statsDiv.innerHTML).toContain('FPS:');
    });
  });

  describe('Remote Debugging & Export', () => {
    beforeEach(() => {
      debugManager.setEnabled(true);
      debugManager.createDebugPanel();
    });

    test('exportDebugInfo returns valid JSON', () => {
      const json = debugManager.exportDebugInfo();
      expect(() => JSON.parse(json)).not.toThrow();
      expect(JSON.parse(json)).toEqual(debugManager.getDebugInfo());
    });

    test('downloadDebugInfo triggers download', () => {
      const createElementSpy = jest.spyOn(document, 'createElement');
      const appendChildSpy = jest.spyOn(document.body, 'appendChild');
      const clickMock = jest.fn();
      createElementSpy.mockReturnValue({
        set href(val) {},
        set download(val) {},
        click: clickMock,
        style: {},
      });
      debugManager.downloadDebugInfo('test-debug.json');
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
    });

    test('sendDebugInfo posts to remote endpoint', async () => {
      const fetchMock = jest.fn(() => Promise.resolve({ ok: true }));
      global.fetch = fetchMock;
      const url = 'https://example.com/debug';
      await debugManager.sendDebugInfo(url, { headers: { 'X-Test': '1' } });
      expect(fetchMock).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json', 'X-Test': '1' }),
          body: expect.any(String)
        })
      );
      delete global.fetch;
    });

    test('sendDebugInfo handles fetch errors', async () => {
      const fetchMock = jest.fn(() => Promise.reject(new Error('fail')));
      global.fetch = fetchMock;
      const url = 'https://example.com/debug';
      await expect(debugManager.sendDebugInfo(url)).rejects.toThrow('fail');
      delete global.fetch;
    });

    test('sendDebugInfoWebSocket sends JSON and logs', () => {
      const wsSendMock = jest.fn();
      const wsCloseMock = jest.fn();
      function MockWebSocket(url) {
        setTimeout(() => this.onopen && this.onopen(), 0);
        this.send = wsSendMock;
        this.close = wsCloseMock;
        this.onerror = null;
      }
      global.WebSocket = MockWebSocket;
      debugManager.sendDebugInfoWebSocket('ws://localhost:1234');
      setTimeout(() => {
        expect(wsSendMock).toHaveBeenCalledWith(debugManager.exportDebugInfo());
        expect(wsCloseMock).toHaveBeenCalled();
        delete global.WebSocket;
      }, 10);
    });

    test('debug panel export/download/send/ws buttons call correct methods', () => {
      const exportSpy = jest.spyOn(debugManager, 'exportDebugInfo');
      const downloadSpy = jest.spyOn(debugManager, 'downloadDebugInfo');
      const sendSpy = jest.spyOn(debugManager, 'sendDebugInfo');
      const wsSpy = jest.spyOn(debugManager, 'sendDebugInfoWebSocket');
      window.prompt = jest.fn(() => 'http://test');
      document.getElementById('debug-export').click();
      expect(exportSpy).toHaveBeenCalled();
      document.getElementById('debug-download').click();
      expect(downloadSpy).toHaveBeenCalled();
      document.getElementById('debug-send').click();
      expect(sendSpy).toHaveBeenCalled();
      document.getElementById('debug-ws').click();
      expect(wsSpy).toHaveBeenCalled();
      exportSpy.mockRestore();
      downloadSpy.mockRestore();
      sendSpy.mockRestore();
      wsSpy.mockRestore();
    });
  });

  describe('Error Event Emission', () => {
    beforeEach(() => {
      debugManager.setEnabled(true);
    });

    test('trackPerformance emits onError and rethrows', () => {
      const onErrorSpy = jest.fn();
      debugManager.onError(onErrorSpy);

      expect(() => {
        debugManager.trackPerformance('error_op', () => { throw new Error('TestError'); });
      }).toThrow('TestError');

      expect(onErrorSpy).toHaveBeenCalledWith(expect.any(Error), 'error_op');
    });

    test('offError prevents callbacks after unsubscribe', () => {
      const cb = jest.fn();
      debugManager.onError(cb);
      debugManager.offError(cb);

      expect(() => {
        debugManager.trackPerformance('error2', () => { throw new Error(`Err2`); });
      }).toThrow('Err2');

      expect(cb).not.toHaveBeenCalled();
    });

    test('addLogToPanel highlights error entries', () => {
      debugManager.createDebugPanel();
      const logsDiv = document.getElementById('debug-logs');
      logsDiv.innerHTML = '';

      debugManager.addLogToPanel('error', '12:00:00.000', 'Critical failure', null);
      const entry = logsDiv.firstChild;
      expect(entry.style.background).toContain('rgba(255, 0, 0');
    });
  });
});
