let configured = false;

export function configureConsoleForEnvironment() {
  if (configured || __DEV__) return;
  configured = true;

  const noop = () => {
    // Intentionally empty for production log suppression.
  };

  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = noop;
  console.error = noop;
  console.trace = noop;
}
