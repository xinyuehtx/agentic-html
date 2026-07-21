/**
 * Configuration system for agentic-html
 * Supports environment variable overrides and partial configuration merging.
 */

/** Complete configuration for the HTML Editor plugin */
export interface HtmlEditorConfig {
  preview: {
    port: number;
    watch: boolean;
    maxFileSize: number;
  };
  annotation: {
    maxScreenshotSize: number;
  };
  version: {
    maxVersions: number;
    storageDir: string;
  };
  snapshot: {
    hitTestTimeout: number;
    hitTestThreshold: number;
    hitTestGridStep: number;
    maxTextContent: number;
  };
}

/** Returns the default configuration */
export function getDefaultConfig(): HtmlEditorConfig {
  return {
    preview: {
      port: 0,
      watch: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB
    },
    annotation: {
      maxScreenshotSize: 500 * 1024, // 500KB
    },
    version: {
      maxVersions: 200,
      storageDir: '.html-editor',
    },
    snapshot: {
      hitTestTimeout: 2000,
      hitTestThreshold: 0.3,
      hitTestGridStep: 10,
      maxTextContent: 100,
    },
  };
}

/**
 * Deep merge helper for config objects.
 * Only merges plain objects; arrays and primitives are overwritten.
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target } as Record<string, unknown>;
  const src = source as Record<string, unknown>;
  const tgt = target as Record<string, unknown>;
  for (const key of Object.keys(src)) {
    const sourceVal = src[key];
    const targetVal = tgt[key];
    if (
      sourceVal !== undefined &&
      typeof sourceVal === 'object' &&
      sourceVal !== null &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      );
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }
  return result as T;
}

/**
 * Reads environment variables and maps them to config overrides.
 */
function getEnvOverrides(): Partial<HtmlEditorConfig> {
  const overrides: Partial<HtmlEditorConfig> = {};

  const port = process.env['HTML_EDITOR_PORT'];
  const watch = process.env['HTML_EDITOR_WATCH'];
  const maxFileSize = process.env['HTML_EDITOR_MAX_FILE_SIZE'];
  const storageDir = process.env['HTML_EDITOR_STORAGE_DIR'];
  const maxVersions = process.env['HTML_EDITOR_MAX_VERSIONS'];

  if (port !== undefined || watch !== undefined || maxFileSize !== undefined) {
    overrides.preview = {} as HtmlEditorConfig['preview'];
    if (port !== undefined) {
      overrides.preview!.port = parseInt(port, 10);
    }
    if (watch !== undefined) {
      overrides.preview!.watch = watch !== '0' && watch.toLowerCase() !== 'false';
    }
    if (maxFileSize !== undefined) {
      overrides.preview!.maxFileSize = parseInt(maxFileSize, 10);
    }
  }

  if (storageDir !== undefined || maxVersions !== undefined) {
    overrides.version = {} as HtmlEditorConfig['version'];
    if (storageDir !== undefined) {
      overrides.version!.storageDir = storageDir;
    }
    if (maxVersions !== undefined) {
      overrides.version!.maxVersions = parseInt(maxVersions, 10);
    }
  }

  return overrides;
}

/**
 * Load configuration with optional overrides.
 * Priority: overrides > environment variables > defaults
 */
export function loadConfig(overrides?: Partial<HtmlEditorConfig>): HtmlEditorConfig {
  let config = getDefaultConfig();

  // Apply environment variable overrides
  const envOverrides = getEnvOverrides();
  config = deepMerge(config, envOverrides);

  // Apply explicit overrides
  if (overrides) {
    config = deepMerge(config, overrides);
  }

  return config;
}
