/**
 * EventManager.test.js
 * Unit tests for the EventManager class, covering event registration, emission, unregistration,
 * queuing, debug mode, statistics, and edge cases.
 * Uses Jest for assertions and mocking.
 */

import EventManager from '../src/core/EventManager.js';

describe('EventManager', () => {
  let eventManager;

  beforeEach(() => {
    eventManager = new EventManager();
  });

  afterEach(() => {
    eventManager.clearAll();
  });

  describe('Event Registration', () => {
    test('should register event listeners', () => {
      const callback = jest.fn();
      const listenerId = eventManager.on('test:event', callback);

      expect(listenerId).toBeDefined();
      expect(typeof listenerId).toBe('string');
      expect(eventManager.listeners.has('test:event')).toBe(true);
      expect(eventManager.listeners.get('test:event')).toHaveLength(1);
    });

    test('should register multiple listeners for the same event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      eventManager.on('test:event', callback1);
      eventManager.on('test:event', callback2);

      expect(eventManager.listeners.get('test:event')).toHaveLength(2);
    });

    test('should register listeners with priority ordering', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      eventManager.on('test:event', callback1, null, 1);
      eventManager.on('test:event', callback2, null, 3);
      eventManager.on('test:event', callback3, null, 2);

      const listeners = eventManager.listeners.get('test:event');
      expect(listeners[0].priority).toBe(3);
      expect(listeners[1].priority).toBe(2);
      expect(listeners[2].priority).toBe(1);
    });

    test('should register one-time listeners', () => {
      const callback = jest.fn();
      eventManager.once('test:event', callback);

      eventManager.emit('test:event', 'data');
      eventManager.emit('test:event', 'data2');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'test:event',
        data: 'data'
      }));
    });
  });

  describe('Event Emission', () => {
    test('should emit events to registered listeners', () => {
      const callback = jest.fn();
      eventManager.on('test:event', callback);

      eventManager.emit('test:event', { message: 'hello' });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'test:event',
        data: { message: 'hello' },
        timestamp: expect.any(Number),
        cancelled: false
      }));
    });

    test('should not throw error when emitting to non-existent event', () => {
      expect(() => {
        eventManager.emit('non:existent', 'data');
      }).not.toThrow();
    });

    test('should call listeners in priority order', () => {
      const callOrder = [];
      const callback1 = jest.fn(() => callOrder.push(1));
      const callback2 = jest.fn(() => callOrder.push(2));
      const callback3 = jest.fn(() => callOrder.push(3));

      eventManager.on('test:event', callback1, null, 1);
      eventManager.on('test:event', callback2, null, 3);
      eventManager.on('test:event', callback3, null, 2);

      eventManager.emit('test:event');

      expect(callOrder).toEqual([2, 3, 1]); // Priority 3, 2, 1
    });

    test('should handle listener context correctly', () => {
      const context = { name: 'testContext' };
      const callback = jest.fn(function(event) {
        expect(this).toBe(context);
      });

      eventManager.on('test:event', callback, context);
      eventManager.emit('test:event');

      expect(callback).toHaveBeenCalled();
    });

    test('should handle errors in listeners gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Test error');
      });
      const normalCallback = jest.fn();
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      eventManager.on('test:event', errorCallback);
      eventManager.on('test:event', normalCallback);

      expect(() => {
        eventManager.emit('test:event');
      }).not.toThrow();

      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Event Unregistration', () => {
    test('should unregister listeners by callback', () => {
      const callback = jest.fn();
      eventManager.on('test:event', callback);

      expect(eventManager.listeners.get('test:event')).toHaveLength(1);

      const result = eventManager.off('test:event', callback);

      expect(result).toBe(true);
      expect(eventManager.listeners.has('test:event')).toBe(false);
    });

    test('should unregister listeners by ID', () => {
      const callback = jest.fn();
      const listenerId = eventManager.on('test:event', callback);

      const result = eventManager.off('test:event', listenerId);

      expect(result).toBe(true);
      expect(eventManager.listeners.has('test:event')).toBe(false);
    });

    test('should return false when trying to remove non-existent listener', () => {
      const callback = jest.fn();
      const result = eventManager.off('test:event', callback);

      expect(result).toBe(false);
    });

    test('should clear all listeners for an event type', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      eventManager.on('test:event', callback1);
      eventManager.on('test:event', callback2);
      eventManager.on('other:event', callback1);

      eventManager.clear('test:event');

      expect(eventManager.listeners.has('test:event')).toBe(false);
      expect(eventManager.listeners.has('other:event')).toBe(true);
    });

    test('should clear all listeners', () => {
      const callback = jest.fn();

      eventManager.on('test:event1', callback);
      eventManager.on('test:event2', callback);
      eventManager.queue('test:event3', 'data');

      eventManager.clearAll();

      expect(eventManager.listeners.size).toBe(0);
      expect(eventManager.eventQueue).toHaveLength(0);
    });
  });

  describe('Event Queuing', () => {
    test('should queue events', () => {
      eventManager.queue('test:event', { message: 'queued' });

      expect(eventManager.eventQueue).toHaveLength(1);
      expect(eventManager.eventQueue[0]).toEqual(expect.objectContaining({
        type: 'test:event',
        data: { message: 'queued' },
        timestamp: expect.any(Number)
      }));
    });

    test('should process queued events', () => {
      const callback = jest.fn();
      eventManager.on('test:event', callback);

      eventManager.queue('test:event', 'data1');
      eventManager.queue('test:event', 'data2');

      expect(callback).not.toHaveBeenCalled();

      eventManager.processQueue();

      expect(callback).toHaveBeenCalledTimes(2);
      expect(eventManager.eventQueue).toHaveLength(0);
    });

    test('should not process queue if already processing', () => {
      const callback = jest.fn(() => {
        // Try to process queue again during processing
        eventManager.processQueue();
      });

      eventManager.on('test:event', callback);
      eventManager.queue('test:event', 'data');

      eventManager.processQueue();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Debug Mode', () => {
    test('should enable/disable debug mode', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      eventManager.setDebugMode(true);
      expect(eventManager.debugMode).toBe(true);

      eventManager.setDebugMode(false);
      expect(eventManager.debugMode).toBe(false);

      consoleSpy.mockRestore();
    });

    test('should log debug information when enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      eventManager.setDebugMode(true);

      const callback = jest.fn();
      eventManager.on('test:event', callback);
      eventManager.emit('test:event', 'data');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Registered listener')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Emitting'),
        'data'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Statistics', () => {
    test('should provide accurate statistics', () => {
      const callback = jest.fn();

      eventManager.on('event1', callback);
      eventManager.on('event1', callback);
      eventManager.on('event2', callback);
      eventManager.queue('event3', 'data');

      const stats = eventManager.getStats();

      expect(stats).toEqual({
        eventTypes: 2,
        totalListeners: 3,
        queuedEvents: 1,
        eventTypeBreakdown: {
          event1: 2,
          event2: 1
        }
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid event emission', () => {
      const callback = jest.fn();
      eventManager.on('test:event', callback);

      for (let i = 0; i < 1000; i++) {
        eventManager.emit('test:event', i);
      }

      expect(callback).toHaveBeenCalledTimes(1000);
    });

    test('should handle event cancellation', () => {
      const callback1 = jest.fn((event) => {
        event.cancelled = true;
      });
      const callback2 = jest.fn();

      eventManager.on('test:event', callback1, null, 2);
      eventManager.on('test:event', callback2, null, 1);

      eventManager.emit('test:event');

      expect(callback1).toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    test('should generate unique listener IDs', () => {
      const ids = new Set();
      
      for (let i = 0; i < 100; i++) {
        const id = eventManager.generateListenerId();
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
    });
  });
});
