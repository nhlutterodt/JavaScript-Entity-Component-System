/**
 * Event Management System for ECS
 * Handles event registration, dispatching, and cleanup
 */
class EventManager {
  constructor() {
    this.listeners = new Map();
    this.eventQueue = [];
    this.isProcessing = false;
    this.debugMode = false;
  }

  /**
   * Subscribe to an event
   * @param {string} eventType - The type of event to listen for
   * @param {Function} callback - The callback function to execute
   * @param {Object} context - Optional context for the callback
   * @param {number} priority - Optional priority (higher = executed first)
   */
  on(eventType, callback, context = null, priority = 0) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    const listener = {
      callback,
      context,
      priority,
      id: this.generateListenerId()
    };

    const listeners = this.listeners.get(eventType);
    listeners.push(listener);
    
    // Sort by priority (higher priority first)
    listeners.sort((a, b) => b.priority - a.priority);

    if (this.debugMode) {
      console.log(`[EventManager] Registered listener for '${eventType}' with priority ${priority}`);
    }

    return listener.id;
  }

  /**
   * Subscribe to an event only once
   * @param {string} eventType - The type of event to listen for
   * @param {Function} callback - The callback function to execute
   * @param {Object} context - Optional context for the callback
   */
  once(eventType, callback, context = null) {
    const wrappedCallback = (...args) => {
      callback.apply(context, args);
      this.off(eventType, wrappedCallback);
    };

    return this.on(eventType, wrappedCallback, context);
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventType - The type of event
   * @param {Function|string} callbackOrId - The callback function or listener ID
   */
  off(eventType, callbackOrId) {
    if (!this.listeners.has(eventType)) {
      return false;
    }

    const listeners = this.listeners.get(eventType);
    const initialLength = listeners.length;

    if (typeof callbackOrId === 'string') {
      // Remove by ID
      const index = listeners.findIndex(listener => listener.id === callbackOrId);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    } else {
      // Remove by callback function
      const index = listeners.findIndex(listener => listener.callback === callbackOrId);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }

    // Clean up empty event types
    if (listeners.length === 0) {
      this.listeners.delete(eventType);
    }

    if (this.debugMode && listeners.length < initialLength) {
      console.log(`[EventManager] Removed listener for '${eventType}'`);
    }

    return listeners.length < initialLength;
  }

  /**
   * Emit an event immediately
   * @param {string} eventType - The type of event to emit
   * @param {*} data - The data to pass to listeners
   */
  emit(eventType, data = null) {
    if (!this.listeners.has(eventType)) {
      if (this.debugMode) {
        console.log(`[EventManager] No listeners for event '${eventType}'`);
      }
      return;
    }

    const listeners = this.listeners.get(eventType);
    const event = {
      type: eventType,
      data,
      timestamp: Date.now(),
      cancelled: false
    };

    if (this.debugMode) {
      console.log(`[EventManager] Emitting '${eventType}' to ${listeners.length} listeners`, data);
    }

    for (const listener of listeners) {
      if (event.cancelled) break;

      try {
        if (listener.context) {
          listener.callback.call(listener.context, event);
        } else {
          listener.callback(event);
        }
      } catch (error) {
        console.error(`[EventManager] Error in event listener for '${eventType}':`, error);
      }
    }
  }

  /**
   * Queue an event to be processed later
   * @param {string} eventType - The type of event to queue
   * @param {*} data - The data to pass to listeners
   */
  queue(eventType, data = null) {
    this.eventQueue.push({
      type: eventType,
      data,
      timestamp: Date.now()
    });

    if (this.debugMode) {
      console.log(`[EventManager] Queued event '${eventType}'`, data);
    }
  }

  /**
   * Process all queued events
   */
  processQueue() {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const eventsToProcess = [...this.eventQueue];
    this.eventQueue.length = 0;

    if (this.debugMode) {
      console.log(`[EventManager] Processing ${eventsToProcess.length} queued events`);
    }

    for (const event of eventsToProcess) {
      this.emit(event.type, event.data);
    }

    this.isProcessing = false;
  }

  /**
   * Remove all listeners for a specific event type
   * @param {string} eventType - The event type to clear
   */
  clear(eventType) {
    if (this.listeners.has(eventType)) {
      this.listeners.delete(eventType);
      if (this.debugMode) {
        console.log(`[EventManager] Cleared all listeners for '${eventType}'`);
      }
    }
  }

  /**
   * Remove all listeners
   */
  clearAll() {
    const eventCount = this.listeners.size;
    this.listeners.clear();
    this.eventQueue.length = 0;
    
    if (this.debugMode) {
      console.log(`[EventManager] Cleared all listeners (${eventCount} event types)`);
    }
  }

  /**
   * Get statistics about the event system
   */
  getStats() {
    const stats = {
      eventTypes: this.listeners.size,
      totalListeners: 0,
      queuedEvents: this.eventQueue.length,
      eventTypeBreakdown: {}
    };

    for (const [eventType, listeners] of this.listeners) {
      stats.totalListeners += listeners.length;
      stats.eventTypeBreakdown[eventType] = listeners.length;
    }

    return stats;
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log(`[EventManager] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Generate a unique listener ID
   * @returns {string} Unique identifier
   */
  generateListenerId() {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default EventManager;
