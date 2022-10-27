const debugLoggerFactory = require('debug')

interface ILogger {
  warning: typeof console.warn
  debug: typeof console.debug
}

export function createDebugLogger(name = 'default'): ILogger {
  const debugLogger = debugLoggerFactory(name)
  return {
    ...createLogger(name),
    debug(message, ...parameters) {
      debugLogger(message, ...parameters)
    },
  }
}

export function createLogger(name = 'default'): ILogger {
  return {
    debug(message, ...parameters) {
      console.debug(`[${name}]${message}`, ...parameters)
    },
    warning(message, ...parameters) {
      console.warn(`[${name}]${message}`, ...parameters)
    },
  }
}
