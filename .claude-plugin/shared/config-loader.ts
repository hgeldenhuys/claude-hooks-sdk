/**
 * Shared configuration loader for all plugins
 * Supports config.json, environment variables, and defaults
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PluginConfig {
  enabled: boolean;
  [key: string]: any;
}

export interface FullConfig {
  'analytics-tracker': any;
  'anomaly-monitor': any;
  'event-recorder': any;
  'performance-monitor': any;
  'file-auditor': any;
  'real-time-dashboard': any;
}

/**
 * Load configuration from multiple sources (priority order):
 * 1. Environment variables (highest priority)
 * 2. config.json in .claude-plugin/
 * 3. Default values
 */
export function loadConfig(pluginName: string): PluginConfig {
  const configPath = path.join(process.cwd(), '.claude-plugin', 'config.json');

  let fileConfig: any = {};

  // Try to load from config.json
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const fullConfig = JSON.parse(content);
      fileConfig = fullConfig[pluginName] || {};
    } catch (error) {
      console.warn(`[${pluginName}] Failed to parse config.json:`, error);
    }
  }

  // Merge with environment variables (env vars override file config)
  const envPrefix = pluginName.toUpperCase().replace(/-/g, '_');
  const envConfig: any = {};

  // Check for PLUGIN_ENABLED env var
  const enabledKey = `${envPrefix}_ENABLED`;
  if (process.env[enabledKey]) {
    envConfig.enabled = process.env[enabledKey] === 'true';
  }

  // Merge all sources (env > file > defaults)
  return {
    enabled: true, // Default to enabled
    ...fileConfig,
    ...envConfig,
  };
}

/**
 * Get a config value with fallback
 */
export function getConfigValue<T>(
  config: PluginConfig,
  key: string,
  defaultValue: T
): T {
  return config[key] !== undefined ? config[key] : defaultValue;
}

/**
 * Check if a plugin is enabled
 */
export function isPluginEnabled(pluginName: string): boolean {
  const config = loadConfig(pluginName);
  return config.enabled !== false;
}
