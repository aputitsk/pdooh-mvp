type ValidationEntry = {
  key: string;
  promise: Promise<void>;
};

export function createArcEscrowValidationCache() {
  let entry: ValidationEntry | null = null;

  return function validateCached(key: string, validate: () => Promise<void>) {
    if (entry?.key === key) {
      return entry.promise;
    }

    const promise = validate();
    entry = { key, promise };

    void promise.catch(() => {
      if (entry?.promise === promise) {
        entry = null;
      }
    });

    return promise;
  };
}
