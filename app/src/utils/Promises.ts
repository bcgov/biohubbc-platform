export const makeManualPromise = <R = void, Q = void>(): [() => Promise<R>, (data: R) => void, (error: Q) => void] => {
    let onResolve: any
    let onReject: any

    return [() => new Promise<R>((promiseResolve, promiseReject) => {
      onResolve = promiseResolve;
      onReject = promiseReject;
    }), onResolve, onReject];
}

export class ManualPromise<R = void, Q = void> {
    resolve: (value: R) => void;
    reject: (reason: Q) => void;
    promise: Promise<R>;

    constructor() {
        this.promise = new Promise<R>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });

        return this;
    }
}