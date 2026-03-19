const path = require("path");
const logger = require("./logger");

function loadPlugins(pluginsConfig) {
  const enabled = Array.isArray(pluginsConfig.enabled)
    ? pluginsConfig.enabled
    : [];
  const commandMap = new Map();

  for (const pluginName of enabled) {
    const pluginPath = path.join(process.cwd(), "plugins", `${pluginName}.js`);

    try {
      const plugin = require(pluginPath);
      const commands = Array.isArray(plugin.commands) ? plugin.commands : [];

      for (const command of commands) {
        if (
          !command ||
          !command.name ||
          typeof command.execute !== "function"
        ) {
          continue;
        }
        commandMap.set(command.name.toLowerCase(), command);
      }

      logger.info(`Plugin loaded: ${pluginName}`);
    } catch (error) {
      logger.error(`Failed loading plugin ${pluginName}: ${error.message}`);
    }
  }

  return commandMap;
}

module.exports = {
  loadPlugins,
};
