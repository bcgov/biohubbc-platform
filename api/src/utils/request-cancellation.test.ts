import { expect } from 'chai';
import { EventEmitter } from 'node:events';
import sinon from 'sinon';
import { registerRequestCancellation } from './request-cancellation';

describe('registerRequestCancellation', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('aborts request-owned work when the response closes before completion', () => {
    const res = Object.assign(new EventEmitter(), { writableEnded: false });
    const cancellation = registerRequestCancellation(res as any);

    res.emit('close');

    expect(cancellation.signal.aborted).to.be.true;
  });

  it('does not abort after the response has completed', () => {
    const res = Object.assign(new EventEmitter(), { writableEnded: true });
    const cancellation = registerRequestCancellation(res as any);

    res.emit('close');

    expect(cancellation.signal.aborted).to.be.false;
  });

  it('removes its listener during cleanup', () => {
    const res = Object.assign(new EventEmitter(), { writableEnded: false });
    const cancellation = registerRequestCancellation(res as any);

    cancellation.unregister();

    expect(cancellation.signal.aborted).to.be.false;
    expect(res.listenerCount('close')).to.equal(0);
  });
});
