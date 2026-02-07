type LogoutHandler = () => Promise<void> | void;
type TokenRefreshListener = () => void;

let logoutHandler: LogoutHandler | null = null;
const tokenRefreshListeners = new Set<TokenRefreshListener>();

export function setLogoutHandler(handler: LogoutHandler) {
  logoutHandler = handler;
}

export async function notifyLogout() {
  if (logoutHandler) {
    await logoutHandler();
  }
}

export function subscribeTokenRefresh(listener: TokenRefreshListener) {
  tokenRefreshListeners.add(listener);
  return () => {
    tokenRefreshListeners.delete(listener);
  };
}

export function notifyTokenRefresh() {
  tokenRefreshListeners.forEach((listener) => {
    listener();
  });
}
