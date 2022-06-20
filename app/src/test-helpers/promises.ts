/**
 * 
 */
export class Deferred<R = void, Q = void> {
    resolve: (value: R) => void = () => {};
    reject: (reason?: Q) => void = () => {};
    promise: Promise<R>;

    constructor() {
        this.promise = new Promise<R>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });

        return this;
    }

    recycle = () => {
        this.promise = new Promise<R>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });

        return this;
    }
}
