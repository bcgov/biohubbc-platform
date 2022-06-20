import { renderHook, act, cleanup, RenderResult } from '@testing-library/react-hooks';
import { makeManualPromise, ManualPromise } from 'utils/Promises';
// import React from 'react';
import useDataLoader, { DataLoader } from './useDataLoader';

interface ITestComponentProps {
  callback: () => Promise<any>
  onError: (error: unknown) => void 
}
/*
const TestComponent: React.FC<ITestComponentProps> = (props) => {
  const {
    data,
    error,
    isLoading,
    isReady,
    refresh
  } = useDataLoader(props.callback, props.onError);
  
  return <></>;
};
*/

const testError = 'promise-did-not-resolve';
const testResponse = {
  teststring: 'string'
};



describe('useDataLoader', () => {
  // jest.useFakeTimers();
  // jest.spyOn(global, 'setTimeout')

  const makeSampleErrorHandler = () => (error: unknown) => {
    return;
  }

  // let result: RenderResult<DataLoader<unknown, unknown>>

  /*
  beforeAll(() => {
    jest.useFakeTimers();
  });
  
  afterAll(() => {
    jest.useRealTimers();
  });
  */
  
  describe('mounting conditions', () => {
    const [callback, _resolvePromise, _rejectPromise] = makeManualPromise();

    const { result } = renderHook(() => useDataLoader(callback));

    it('should mount with an empty data property', async () => {
      expect(result.current.data).toBeUndefined();
    });
  
    it('should mount with an empty error property', async () => {
      expect(result.current.error).toBeUndefined();
    });
    
    it('should mount and begin loading', async () => {
      expect(result.current.isLoading).toEqual(true);
    });
  
    it('should mount and not be ready', async () => {
      expect(result.current.isReady).toEqual(false);
    });

  });

  describe('with rejecting promise', () => {
    const mp = new ManualPromise<string, string>();
    // const [callback, _resolvePromise, rejectPromise] = makeManualPromise<string, string>();

    const { result, waitForNextUpdate } = renderHook(() => useDataLoader(() => mp.promise));
    
    it('should expose an error when the promise rejects', async () => {
      act(() => {
        mp.reject('promise-rejected');
      })
      expect(result.current.error).toEqual('promise-rejected');
      // await waitForNextUpdate();
    });

    it('should have an empty data property when the promise rejects', () => {
      expect(result.current.data).toBeUndefined();
    });

    it('should not be loading when the promise rejects', () => {
      expect(result.current.isLoading).toEqual(false);
    });

    it('should be ready when the promise rejects', () => {
      expect(result.current.isReady).toEqual(true);
    });
  });
  
 
  /*
  describe('with resolved promise', () => {
    it('should expose data when the promise resolves');
    it('should have an empty error property when the promise resolves');
    it('should not be loading when the promise resolves');
    it('should be ready whe the promise resolves');
  });

  describe('refreshing', () => {
    it('should begin loading when refresh is called');
    it('should still expose its old data after refresh is called');
    it('should clear any error messages upon refresh');

    describe('resolves a successful refresh', () => {
      it('should update the data after refresh callback resolves');
      it('should not be loading after refresh resolves');
      it('should be ready after the refresh resolves');
      it('should not have a defined error property');
    });

    describe('rejects an unsuccessful refresh', () => {
      it('should not update the data after refresh callback rejects');
      it('should not be loading after refresh rejects');
      it('should be ready after the refresh rejects');
      it('should have a defined error property');
    });
  });
  */
});
