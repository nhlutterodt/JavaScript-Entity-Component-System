import InputManager from '../src/input/InputManager.js';

describe('InputManager Error Handling', () => {
  let inputManager;
  let mockEventManager;
  let mockDebugManager;

  beforeEach(() => {
    mockEventManager = { emit: jest.fn() };
    mockDebugManager = { log: jest.fn() };
    inputManager = new InputManager(mockEventManager, mockDebugManager);
    inputManager.debugMode = true;
  });

  test('handleError emits input:error and calls debugManager.log', () => {
    const error = new Error('test error');
    inputManager.handleError(error, 'testContext');

    expect(mockEventManager.emit).toHaveBeenCalledWith('input:error', expect.objectContaining({ error, context: 'testContext' }));
    expect(mockDebugManager.log).toHaveBeenCalledWith('error', 'Error in testContext', error);
  });

  test('saveConfig catches errors and emits input:error', async () => {
    // Replace configProvider with one that throws
    inputManager.configProvider = { saveConfig: jest.fn(() => Promise.reject(new Error('save fail'))) };
    inputManager.bindingMap = { getBindings: () => ({}) };

    await inputManager.saveConfig();

    expect(mockEventManager.emit).toHaveBeenCalledWith(
      'input:error',
      expect.objectContaining({ context: 'saveConfig' })
    );
  });

  test('loadConfig retries and on failure emits input:error then applies defaults', async () => {
    let callCount = 0;
    inputManager.bindingMap = { loadBindings: jest.fn() };
    // Provider that always throws
    inputManager.configProvider = { loadConfig: jest.fn(() => { callCount++; return Promise.reject(new Error('load fail')); }) };

    await inputManager.loadConfig();

    // Should attempt maxRetries times and emit input:error each time
    expect(callCount).toBe(3);
    // At least one error event
    expect(mockEventManager.emit).toHaveBeenCalledWith(
      'input:error',
      expect.objectContaining({ context: 'loadConfig' })
    );
    // Defaults applied: bindingMap.loadBindings called with empty object
    expect(inputManager.bindingMap.loadBindings).toHaveBeenCalledWith({});
  });

  test('processRawInput with invalid parameters emits input:error', () => {
    inputManager.processRawInput(123, null);
    expect(mockEventManager.emit).toHaveBeenCalledWith(
      'input:error',
      expect.objectContaining({ context: 'processRawInput' })
    );
  });

  test('processComboInput with invalid combo emits input:error', () => {
    inputManager.processComboInput(null);
    expect(mockEventManager.emit).toHaveBeenCalledWith(
      'input:error',
      expect.objectContaining({ context: 'processComboInput' })
    );
  });

  test('processActionInput with invalid action emits input:error', () => {
    inputManager.processActionInput({ foo: 'bar' });
    expect(mockEventManager.emit).toHaveBeenCalledWith(
      'input:error',
      expect.objectContaining({ context: 'processActionInput' })
    );
  });
});
