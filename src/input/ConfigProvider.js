/**
 * Configuration Provider System
 * Handles loading, saving, and managing input configuration
 * Supports multiple storage backends and user profiles
 */
import defaultInputConfig from './defaultConfig.js';

class ConfigProvider {
  constructor(options = {}) {
    this.storageBackend = options.storageBackend || 'localStorage';
    this.configKey = options.configKey || 'ecs_input_config';
    this.profileKey = options.profileKey || 'ecs_input_profiles';
    this.currentProfile = options.defaultProfile || 'default';
    this.debugMode = false;
    
    // Use imported default configuration
    this.defaultConfig = defaultInputConfig;
    
    this.currentConfig = null;
    this.configCache = new Map();
    this.profileCache = new Map();
  }

  /**
   * Initialize the configuration provider
   */
  async initialize() {
    try {
      await this.loadConfig();
      
      if (this.debugMode) {
        console.log('[ConfigProvider] Initialized successfully');
      }
    } catch (error) {
      console.error('[ConfigProvider] Initialization failed:', error);
      // Create default configuration if loading fails
      await this.createDefaultConfig();
    }
  }

  /**
   * Load configuration from storage
   * @param {string} profile - Profile name to load (optional)
   * @returns {Object} Loaded configuration
   */
  async loadConfig(profile = null) {
    const targetProfile = profile || this.currentProfile;
    
    try {
      let config;
      
      // Check cache first
      if (this.configCache.has(targetProfile)) {
        config = this.configCache.get(targetProfile);
      } else {
        // Load from storage backend
        config = await this.loadFromStorage();
        
        if (!config) {
          // No config found, create default
          config = this.createDefaultConfigStructure();
          await this.saveToStorage(config);
        }
        
        // Cache the config
        this.configCache.set(targetProfile, config);
      }
      
      // Validate and migrate if necessary
      config = this.validateAndMigrateConfig(config);
      
      // Set current config
      this.currentConfig = config;
      
      if (this.debugMode) {
        console.log(`[ConfigProvider] Loaded config for profile: ${targetProfile}`);
      }
      
      return this.getProfileConfig(targetProfile);
      
    } catch (error) {
      console.error('[ConfigProvider] Failed to load configuration:', error);
      
      // Fallback to default configuration
      const defaultConfig = this.createDefaultConfigStructure();
      this.currentConfig = defaultConfig;
      
      return this.getProfileConfig(targetProfile);
    }
  }

  /**
   * Save configuration to storage
   * @param {Object} config - Configuration object to save (optional)
   * @param {string} profile - Profile name to save (optional)
   */
  async saveConfig(config = null, profile = null) {
    const targetProfile = profile || this.currentProfile;
    const configToSave = config || this.currentConfig;
    
    try {
      // Update metadata
      if (configToSave.metadata) {
        configToSave.metadata.lastModified = Date.now();
      }
      
      // Save to storage backend
      await this.saveToStorage(configToSave);
      
      // Update cache
      this.configCache.set(targetProfile, configToSave);
      this.currentConfig = configToSave;
      
      if (this.debugMode) {
        console.log(`[ConfigProvider] Saved config for profile: ${targetProfile}`);
      }
      
    } catch (error) {
      console.error('[ConfigProvider] Failed to save configuration:', error);
      throw error;
    }
  }

  /**
   * Get configuration for a specific profile
   * @param {string} profile - Profile name
   * @returns {Object} Profile configuration
   */
  getProfileConfig(profile = null) {
    const targetProfile = profile || this.currentProfile;
    
    if (!this.currentConfig || !this.currentConfig.profiles) {
      return this.defaultConfig.profiles.default;
    }
    
    return this.currentConfig.profiles[targetProfile] || this.defaultConfig.profiles.default;
  }

  /**
   * Create a new profile
   * @param {string} profileName - Name of the new profile
   * @param {Object} baseProfile - Base profile to copy from (optional)
   * @returns {Object} Created profile configuration
   */
  async createProfile(profileName, baseProfile = null) {
    if (!this.currentConfig) {
      await this.loadConfig();
    }
    
    const baseConfig = baseProfile 
      ? this.getProfileConfig(baseProfile)
      : this.defaultConfig.profiles.default;
    
    const newProfile = {
      name: profileName,
      bindings: JSON.parse(JSON.stringify(baseConfig.bindings)), // Deep copy
      settings: { ...baseConfig.settings }
    };
    
    this.currentConfig.profiles[profileName] = newProfile;
    await this.saveConfig();
    
    if (this.debugMode) {
      console.log(`[ConfigProvider] Created profile: ${profileName}`);
    }
    
    return newProfile;
  }

  /**
   * Delete a profile
   * @param {string} profileName - Name of the profile to delete
   */
  async deleteProfile(profileName) {
    if (profileName === 'default') {
      throw new Error('Cannot delete default profile');
    }
    
    if (!this.currentConfig || !this.currentConfig.profiles[profileName]) {
      throw new Error(`Profile '${profileName}' does not exist`);
    }
    
    delete this.currentConfig.profiles[profileName];
    
    // Switch to default profile if current profile was deleted
    if (this.currentProfile === profileName) {
      this.currentProfile = 'default';
    }
    
    await this.saveConfig();
    
    if (this.debugMode) {
      console.log(`[ConfigProvider] Deleted profile: ${profileName}`);
    }
  }

  /**
   * Switch to a different profile
   * @param {string} profileName - Name of the profile to switch to
   */
  async switchProfile(profileName) {
    if (!this.currentConfig || !this.currentConfig.profiles[profileName]) {
      throw new Error(`Profile '${profileName}' does not exist`);
    }
    
    this.currentProfile = profileName;
    
    if (this.debugMode) {
      console.log(`[ConfigProvider] Switched to profile: ${profileName}`);
    }
  }

  /**
   * Get list of available profiles
   * @returns {Array<Object>} Array of profile information
   */
  getAvailableProfiles() {
    if (!this.currentConfig || !this.currentConfig.profiles) {
      return [{ name: 'default', displayName: 'Default' }];
    }
    
    return Object.entries(this.currentConfig.profiles).map(([key, profile]) => ({
      name: key,
      displayName: profile.name || key,
      isActive: key === this.currentProfile
    }));
  }

  /**
   * Load configuration from storage backend
   * @returns {Object|null} Loaded configuration or null
   */
  async loadFromStorage() {
    switch (this.storageBackend) {
      case 'localStorage':
        return this.loadFromLocalStorage();
        
      case 'indexedDB':
        return this.loadFromIndexedDB();
        
      case 'file':
        return this.loadFromFile();
        
      default:
        throw new Error(`Unsupported storage backend: ${this.storageBackend}`);
    }
  }

  /**
   * Save configuration to storage backend
   * @param {Object} config - Configuration to save
   */
  async saveToStorage(config) {
    switch (this.storageBackend) {
      case 'localStorage':
        return this.saveToLocalStorage(config);
        
      case 'indexedDB':
        return this.saveToIndexedDB(config);
        
      case 'file':
        return this.saveToFile(config);
        
      default:
        throw new Error(`Unsupported storage backend: ${this.storageBackend}`);
    }
  }

  /**
   * Load from localStorage
   * @returns {Object|null} Loaded configuration
   */
  loadFromLocalStorage() {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    
    try {
      const configString = localStorage.getItem(this.configKey);
      return configString ? JSON.parse(configString) : null;
    } catch (error) {
      console.error('[ConfigProvider] Error loading from localStorage:', error);
      return null;
    }
  }

  /**
   * Save to localStorage
   * @param {Object} config - Configuration to save
   */
  saveToLocalStorage(config) {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available');
    }
    
    try {
      const configString = JSON.stringify(config, null, 2);
      localStorage.setItem(this.configKey, configString);
    } catch (error) {
      console.error('[ConfigProvider] Error saving to localStorage:', error);
      throw error;
    }
  }

  /**
   * Load from IndexedDB (placeholder for future implementation)
   * @returns {Object|null} Loaded configuration
   */
  async loadFromIndexedDB() {
    // TODO: Implement IndexedDB storage
    throw new Error('IndexedDB storage not yet implemented');
  }

  /**
   * Save to IndexedDB (placeholder for future implementation)
   * @param {Object} config - Configuration to save
   */
  async saveToIndexedDB(config) {
    // TODO: Implement IndexedDB storage
    throw new Error('IndexedDB storage not yet implemented');
  }

  /**
   * Load from file (placeholder for future implementation)
   * @returns {Object|null} Loaded configuration
   */
  async loadFromFile() {
    // TODO: Implement file storage (for Electron apps, etc.)
    throw new Error('File storage not yet implemented');
  }

  /**
   * Save to file (placeholder for future implementation)
   * @param {Object} config - Configuration to save
   */
  async saveToFile(config) {
    // TODO: Implement file storage (for Electron apps, etc.)
    throw new Error('File storage not yet implemented');
  }

  /**
   * Validate and migrate configuration if necessary
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validated and migrated configuration
   */
  validateAndMigrateConfig(config) {
    // Check version and migrate if necessary
    const currentVersion = config.metadata?.version || '0.0.0';
    const targetVersion = this.defaultConfig.metadata.version;
    
    if (currentVersion !== targetVersion) {
      config = this.migrateConfig(config, currentVersion, targetVersion);
    }
    
    // Validate structure
    if (!config.profiles) {
      config.profiles = {};
    }
    
    if (!config.profiles.default) {
      config.profiles.default = { ...this.defaultConfig.profiles.default };
    }
    
    if (!config.metadata) {
      config.metadata = {
        created: Date.now(),
        lastModified: Date.now(),
        version: targetVersion
      };
    }
    
    return config;
  }

  /**
   * Migrate configuration between versions
   * @param {Object} config - Configuration to migrate
   * @param {string} fromVersion - Source version
   * @param {string} toVersion - Target version
   * @returns {Object} Migrated configuration
   */
  migrateConfig(config, fromVersion, toVersion) {
    if (this.debugMode) {
      console.log(`[ConfigProvider] Migrating config from ${fromVersion} to ${toVersion}`);
    }
    
    // Add migration logic here for different versions
    // For now, just update the version
    config.metadata = config.metadata || {};
    config.metadata.version = toVersion;
    config.metadata.lastModified = Date.now();
    
    return config;
  }

  /**
   * Create default configuration structure
   * @returns {Object} Default configuration
   */
  createDefaultConfigStructure() {
    return JSON.parse(JSON.stringify(this.defaultConfig)); // Deep copy
  }

  /**
   * Create default configuration and save it
   */
  async createDefaultConfig() {
    this.currentConfig = this.createDefaultConfigStructure();
    await this.saveConfig();
    
    if (this.debugMode) {
      console.log('[ConfigProvider] Created default configuration');
    }
  }

  /**
   * Export configuration for backup
   * @param {string} profile - Profile to export (optional)
   * @returns {string} JSON string of configuration
   */
  exportConfig(profile = null) {
    const config = profile ? this.getProfileConfig(profile) : this.currentConfig;
    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration from backup
   * @param {string} configString - JSON string of configuration
   * @param {boolean} merge - Whether to merge with existing config
   */
  async importConfig(configString, merge = false) {
    try {
      const importedConfig = JSON.parse(configString);
      
      if (merge && this.currentConfig) {
        // Merge profiles
        this.currentConfig.profiles = {
          ...this.currentConfig.profiles,
          ...importedConfig.profiles
        };
      } else {
        this.currentConfig = this.validateAndMigrateConfig(importedConfig);
      }
      
      await this.saveConfig();
      
      if (this.debugMode) {
        console.log('[ConfigProvider] Imported configuration successfully');
      }
      
    } catch (error) {
      console.error('[ConfigProvider] Failed to import configuration:', error);
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   * @param {boolean} keepProfiles - Whether to keep custom profiles
   */
  async resetConfig(keepProfiles = false) {
    const defaultConfig = this.createDefaultConfigStructure();
    
    if (keepProfiles && this.currentConfig && this.currentConfig.profiles) {
      // Keep custom profiles, reset default profile
      defaultConfig.profiles = {
        ...this.currentConfig.profiles,
        default: this.defaultConfig.profiles.default
      };
    }
    
    this.currentConfig = defaultConfig;
    await this.saveConfig();
    
    if (this.debugMode) {
      console.log('[ConfigProvider] Reset configuration to defaults');
    }
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  /**
   * Get debug information
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      storageBackend: this.storageBackend,
      currentProfile: this.currentProfile,
      availableProfiles: this.getAvailableProfiles(),
      configVersion: this.currentConfig?.metadata?.version,
      cacheSize: this.configCache.size,
      lastModified: this.currentConfig?.metadata?.lastModified
    };
  }
}

export default ConfigProvider;
