# ECS Testing Guide

This directory contains comprehensive tests for the JavaScript Entity Component System with Event and Debug Management.

## Test Structure

### Core Framework Tests

#### `EventManager.test.js`
- **Event Registration**: Tests for `on()`, `once()`, `off()` methods
- **Event Emission**: Tests for `emit()` and event dispatching
- **Event Queuing**: Tests for `queue()` and `processQueue()`
- **Priority System**: Tests for event listener priority ordering
- **Debug Mode**: Tests for debug logging and statistics
- **Error Handling**: Tests for graceful error handling
- **Edge Cases**: Tests for performance and edge scenarios

#### `DebugManager.test.js`
- **Initialization**: Tests for debug system setup and configuration
- **Logging**: Tests for log levels, filtering, and output
- **Performance Tracking**: Tests for function performance monitoring
- **Debug Panel**: Tests for DOM-based debug panel creation and updates
- **System Registration**: Tests for ECS component tracking
- **Statistics**: Tests for debug information aggregation
- **Performance Monitoring**: Tests for FPS and frame time tracking

#### `ECS.integration.test.js`
- **System Integration**: Tests for complete ECS workflow
- **Event-System Communication**: Tests for event-driven system interactions
- **Render System Integration**: Tests for Three.js mesh management
- **Animation System Integration**: Tests for entity animation
- **Performance Integration**: Tests for debug tracking during system updates
- **Complex Scenarios**: Tests for multiple entities, animations, and edge cases

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Specific Test File
```bash
# Event Manager tests only
npm test EventManager

# Debug Manager tests only
npm test DebugManager

# Integration tests only
npm test integration
```

## Test Coverage

The tests aim for comprehensive coverage of:

- ✅ **Event Management**: 95%+ coverage
  - Event registration/unregistration
  - Event emission and queuing
  - Priority handling
  - Error scenarios
  
- ✅ **Debug Management**: 95%+ coverage
  - Debug panel functionality
  - Performance monitoring
  - Logging systems
  - Statistics tracking
  
- ✅ **Integration**: 90%+ coverage
  - System interactions
  - Event-driven workflows
  - Complex entity operations
  - Error handling

## Key Test Features

### Mocking Strategy
- **Three.js**: Mocked mesh, scene, camera, renderer objects
- **DOM**: jsdom environment for debug panel testing
- **Performance**: Mocked `performance.now()` and `requestAnimationFrame`
- **Console**: Mocked console methods to reduce test noise

### Test Scenarios
- **Unit Tests**: Individual component functionality
- **Integration Tests**: Cross-system interactions
- **Performance Tests**: System performance under load
- **Error Tests**: Graceful error handling
- **Edge Cases**: Boundary conditions and unusual inputs

### Assertions
- Function call verification
- State change validation
- Event emission confirmation
- Performance metric tracking
- DOM manipulation verification
- Error handling validation

## Test Best Practices

1. **Isolation**: Each test is independent and doesn't affect others
2. **Cleanup**: Proper cleanup of DOM elements, event listeners, and timers
3. **Mocking**: Appropriate mocking of external dependencies
4. **Coverage**: Comprehensive coverage of happy paths and edge cases
5. **Performance**: Tests run quickly and don't rely on real timers
6. **Readability**: Clear test descriptions and well-organized test structure

## Debugging Tests

### Running Individual Tests
```bash
# Run a specific test
npm test -- --testNamePattern="should register event listeners"

# Run tests for a specific file
npm test -- EventManager.test.js
```

### Debug Mode
```bash
# Run tests with debug output
npm test -- --verbose

# Run tests without coverage (faster)
npm test -- --collectCoverage=false
```

## Common Test Patterns

### Event Testing
```javascript
const callback = jest.fn();
eventManager.on('test:event', callback);
eventManager.emit('test:event', data);
expect(callback).toHaveBeenCalledWith(/* expected event object */);
```

### Debug Panel Testing
```javascript
debugManager.createDebugPanel();
const panel = document.getElementById('debug-panel');
expect(panel).toBeTruthy();
```

### System Integration Testing
```javascript
const entityId = ecsManager.createEntity('TestEntity');
ecsManager.addComponent(entityId, 'transform', data);
renderSystem.update(16.67, ecsManager);
expect(mockRenderer.render).toHaveBeenCalled();
```

## Contributing to Tests

When adding new features:

1. **Add Unit Tests**: Test individual methods and functionality
2. **Add Integration Tests**: Test how new features work with existing systems
3. **Update Coverage**: Ensure new code is adequately tested
4. **Document Tests**: Add clear descriptions and comments
5. **Test Edge Cases**: Consider error conditions and boundary cases
