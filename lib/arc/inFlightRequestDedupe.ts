export function createInFlightRequestDedupe<T>() {
  const activeRequests = new Map<string, Promise<T>>();

  return function runDeduped(key: string, request: () => Promise<T>) {
    const activeRequest = activeRequests.get(key);

    if (activeRequest) {
      return activeRequest;
    }

    let promise: Promise<T>;

    try {
      promise = request();
    } catch (error) {
      promise = Promise.reject(error);
    }

    activeRequests.set(key, promise);

    void promise.then(
      () => {
        if (activeRequests.get(key) === promise) {
          activeRequests.delete(key);
        }
      },
      () => {
        if (activeRequests.get(key) === promise) {
          activeRequests.delete(key);
        }
      }
    );

    return promise;
  };
}
