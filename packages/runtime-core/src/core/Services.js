const registry = new Map();

const Services = {
  /**
   * Retrieve a service by name.
   * @param {string} name
   * @returns {*}
   */
  get(name) {
    return registry.get(name);
  },

  /**
   * Register a service instance.
   * @param {string} name
   * @param {*} instance
   */
  set(name, instance) {
    registry.set(name, instance);
  },

  /**
   * Check if a service exists.
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return registry.has(name);
  },

  /**
   * Clear all registered services.
   */
  clear() {
    registry.clear();
  },
};

export default Services;
