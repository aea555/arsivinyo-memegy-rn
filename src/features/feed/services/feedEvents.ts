type FeedRandomRefreshListener = () => void;

const feedRandomRefreshListeners = new Set<FeedRandomRefreshListener>();

export function subscribeFeedRandomRefresh(listener: FeedRandomRefreshListener) {
  feedRandomRefreshListeners.add(listener);
  return () => {
    feedRandomRefreshListeners.delete(listener);
  };
}

export function notifyFeedRandomRefresh() {
  feedRandomRefreshListeners.forEach((listener) => {
    listener();
  });
}
