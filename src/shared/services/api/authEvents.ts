type LogoutHandler = () => Promise<void> | void;

let logoutHandler: LogoutHandler | null = null;

export function setLogoutHandler(handler: LogoutHandler) {
  logoutHandler = handler;
}

export async function notifyLogout() {
  if (logoutHandler) {
    await logoutHandler();
  }
}
