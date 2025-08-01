const path = require("path");
const fs = require("fs");

// Create cache directory if it doesn't exist
const cacheDir = path.join(__dirname, ".cache");

/**
 * Creates a model cache manager for a specific provider
 * @param {string} providerName - Name of the provider (used for cache file)
 * @param {function} fetchModelsFunction - Function to fetch models from API
 * @param {Object} options - Cache configuration options
 * @returns {function} getModels function that handles caching
 */
function createModelCache(providerName, fetchModelsFunction, options = {}) {
  const { cache = true, cacheTtl = 3600000 } = options; // 1 hour default
  const cacheFile = path.join(cacheDir, `${providerName}_models.json`);
  let memoryCache;

  return async function getModels(...args) {
    // If memory cache exists, return it (for cache: false mode)
    if (memoryCache) {
      return memoryCache;
    }
    
    // If cache is disabled, fetch once and keep in memory
    if (!cache) {
      try {
        const models = await fetchModelsFunction(...args);
        memoryCache = models;
        return models;
      } catch (error) {
        console.error(`Error fetching models for ${providerName}:`, error);
        throw error;
      }
    }
    
    // Disk cache mode
    // Check if cache exists and is within TTL
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile);
      const cacheAge = Date.now() - stats.mtimeMs;

      if (cacheAge < cacheTtl) {
        try {
          const cachedData = fs.readFileSync(cacheFile, "utf8");
          memoryCache = JSON.parse(cachedData);
          return memoryCache;
        } catch (error) {
          console.warn(`Error reading cache for ${providerName}:`, error);
          // Continue to fetch from API if cache reading fails
        }
      }
    }

    // Fetch from API if cache doesn't exist, is too old, or couldn't be read
    try {
      const models = await fetchModelsFunction(...args);
      memoryCache = models;

      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(cacheFile, JSON.stringify(models, null, "  "), "utf8");
      return models;
    } catch (error) {
      console.error(`Error fetching models for ${providerName}:`, error);
      throw error;
    }
  };
}

/**
 * Creates a context provider function with standard environment and regex matching
 * @param {string} providerName - Name of the provider
 * @param {Object} providerOptions - Provider configuration options
 * @returns {function} Factory function that accepts user options
 */
function createProviderContext(providerName, providerOptions) {
  const {
    apiKeyEnv,
    modelMatcher,
    modelFilter,
    createExecFunction,
    apiModelFetcher
  } = providerOptions;
  
  return function createProvider(userOptions = {}) {
    const {
      cache = false,        // JS apps default to memory-only
      cacheTtl = 3600000,   // 1 hour default
      apiKey,
      models: allowedModels,
      mount,
      expose = undefined,
      alias = {},
      default: defaultModel
    } = userOptions;

    const getModels = createModelCache(providerName, apiModelFetcher, { cache, cacheTtl });
    const envr = /^[A-Z_0-9]+$/;

    return async function providerContext(name, args) {
      // respond only to llm request or if type is 'any'
      if (args.type !== 'any' && args.type !== 'llm') {
        return;
      }
      
      const context = this;
      if (envr.test(name)) {
        return;
      }

      // Handle mount prefix
      let actualName = name;
      if (mount) {
        if (!name.startsWith(mount + '/')) {
          return; // This provider only handles names with its mount prefix
        }
        actualName = name.slice(mount.length + 1);
      }

      // Handle default model for this provider
      if (actualName === "default" && args.type === "llm" && defaultModel) {
        actualName = defaultModel;
      }

      // Handle aliases
      actualName = alias[actualName] || actualName;
      
      // Check if this model name should be handled by this provider
      if (modelMatcher && !modelMatcher(actualName)) {
        return;
      }

      if (expose && expose.indexOf(actualName) === -1) {
        return
      }
      
      const resolvedApiKey = apiKey || await context.read(apiKeyEnv);
      if (!resolvedApiKey) {
        return;
      }

      try {
        const models = await getModels(resolvedApiKey);

        // Filter by allowed models if specified
        let filteredModels = models;
        if (allowedModels && allowedModels.length > 0) {
          filteredModels = models.filter(model => 
            allowedModels.includes(model.id) || allowedModels.includes(model.name)
          );
        }

        // Filter models based on name and args
        let matchedModels = [];
        if (modelFilter) {
          matchedModels = modelFilter(filteredModels, actualName, args);
        } else {
          // Default filter by exact match or regex
          let re;
          if (args.match === "regex") {
            re = new RegExp(actualName);
          }

          matchedModels = filteredModels.filter((item) => {
            if (args.match === "exact" && item.id === actualName) {
              return true;
            }
            if (re) {
              return re.test(item.id);
            }
            return false;
          });
        }

        if (!matchedModels.length) {
          return;
        }

        if (args.output === 'all') {
          return matchedModels.map(model => ({ 
            type: "llm", 
            name: mount ? `${mount}/${model.id || model.name}` : (model.id || model.name)
          }));
        }

        const model = matchedModels[0];
        return {
          type: "llm",
          exec: async (payload) => {
            // Get a fresh key in case it's rotated
            const key = resolvedApiKey || await this.read(apiKeyEnv);
            return createExecFunction(model, payload, key, this);
          },
        };
      } catch (e ) {
        console.log(e)
        return
      }
    };
  }
}

module.exports = {
  createModelCache,
  createProviderContext
};
