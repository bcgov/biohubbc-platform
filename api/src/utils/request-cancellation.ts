import { Response } from 'express';
/**
 * Registered HTTP response listener that aborts request-owned work when the client disconnects.
 */
interface IRequestCancellationListener {
  /** Signal shared by request-owned operations. */
  signal: AbortSignal;
  /**
   * Removes the HTTP response listener.
   */
  unregister: () => void;
}

/**
 * Creates a signal that aborts when the HTTP client disconnects before the response completes.
 *
 * @param {Response} res Express response
 * @return {IRequestCancellationListener} Registered request cancellation listener
 */
export const registerRequestCancellation = (res: Response): IRequestCancellationListener => {
  const controller = new AbortController();

  /**
   * Aborts request-owned work when the response closes before normal completion.
   */
  const onRequestAbort = () => {
    if (res.writableEnded || controller.signal.aborted) {
      return;
    }

    controller.abort();
  };

  res.once('close', onRequestAbort);

  return {
    signal: controller.signal,
    /**
     * Removes the response-close listener.
     */
    unregister: () => {
      res.off('close', onRequestAbort);
    }
  };
};
