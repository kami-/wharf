export interface CancelToken {
    isCancelled: () => boolean;
    promise: () => Promise<void>;
    cancel: () => void;
}

export function createCancelToken(): CancelToken {
    let cancelled = false;
    let cancelResolver: () => void;
    const cancelPromise = new Promise<void>(resolve => {
        cancelResolver = resolve;
    });
    return {
        isCancelled: () => cancelled,
        promise: () => cancelPromise,
        cancel: () => {
            cancelled = true;
            cancelResolver();
        }
    };
}
