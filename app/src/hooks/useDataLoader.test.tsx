import { renderHook, act, cleanup, RenderResult } from '@testing-library/react-hooks';
import { Deferred } from 'test-helpers/promises';
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
    const deferred = new Deferred();

    const { result } = renderHook(() => useDataLoader(() => deferred.promise));

    it('should mount with an empty data property', () => {
      expect(result.current.data).toBeUndefined();
    });
  
    it('should mount with an empty error property', () => {
      expect(result.current.error).toBeUndefined();
    });
    
    it('should mount and begin loading', () => {
      expect(result.current.isLoading).toEqual(true);
    });
  
    it('should mount and not be ready', () => {
      expect(result.current.isReady).toEqual(false);
    });

  });

  describe('with rejecting promise', () => {
    it('should expose an error when the promise rejects', async () => {
      const deferred = new Deferred<string, string>();
      const { result, waitForValueToChange } = renderHook(() => useDataLoader(() => deferred.promise));
  
      deferred.reject('promise-rejected');
      await waitForValueToChange(() => result.current.error);
  
      expect(result.current.error).toEqual('promise-rejected');
    });

    it('should be in a ready state once the promise rejects', async () => {
      const deferred = new Deferred<string, string>();
      const { result, waitForValueToChange } = renderHook(() => useDataLoader(() => deferred.promise));

      deferred.reject('promise-rejected');
      await waitForValueToChange(() => result.current.error);

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toEqual(false);
      expect(result.current.isReady).toEqual(true);
    });
  });
  
  
  describe('with resolved promise', () => {
    it('should expose data when the promise resolves', async () => {
      const deferred = new Deferred<string>();
      const { result, waitForValueToChange } = renderHook(() => useDataLoader(() => deferred.promise));
  
      deferred.resolve('promise-resolved');
      await waitForValueToChange(() => result.current.data);
  
      expect(result.current.data).toEqual('promise-resolved');
    });

    it('should be in a ready state once the promise resolves', async () => {
      const deferred = new Deferred<string>();
      const { result, waitForValueToChange } = renderHook(() => useDataLoader(() => deferred.promise));

      deferred.resolve('promise-resolved');
      await waitForValueToChange(() => result.current.data);

      expect(result.current.error).toBeUndefined();
      expect(result.current.isLoading).toEqual(false);
      expect(result.current.isReady).toEqual(true);
    });
  });
  

  describe('refreshing', () => {
    it('should begin loading and clear errors when refresh is called', async () => {
      const deferred = new Deferred<string>();
      const { result, waitForValueToChange, waitForNextUpdate } = renderHook(() => useDataLoader(() => deferred.promise));
      
      deferred.resolve('test1');
      await waitForValueToChange(() => result.current.data);
      expect(result.current.data).toEqual('test1');

      act(() => {
        result.current.refresh();
      })
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeUndefined();
      expect(result.current.isReady).toBe(false);
    });

    it('should still expose its old data after refresh is called', async () => {
      const deferred = new Deferred<string>();
      const { result, waitForValueToChange, waitForNextUpdate } = renderHook(() => useDataLoader(() => deferred.promise));

      deferred.resolve('test2');
      await waitForValueToChange(() => result.current.data);
      expect(result.current.data).toEqual('test2');
      expect

      act(() => {
        result.current.refresh();
      })
      expect(result.current.data).toBe('test2');
    });
    
    describe('resolves a successful refresh', () => {
      it('should update the data after refresh callback resolves', async () => {
        const deferred = new Deferred<string>();
        const { result, waitForValueToChange, waitForNextUpdate } = renderHook(() => useDataLoader(() => deferred.promise));
        
        deferred.resolve('test3');
        await waitForValueToChange(() => result.current.data);
        expect(result.current.data).toEqual('test3');
        
        //expect(result.current.isLoading).toEqual(false);

        act(() => {

          result.current.refresh();
        })
        // await waitForValueToChange(() => result.current.isLoading);
        deferred.recycle().resolve('test3-refreshed');
        await waitForValueToChange(() => result.current.data);

        expect(result.current.data).toEqual('test3-refreshed');
      });
    
      /*
      it('should be in a ready state after refresh resolves', async () => {

      });
      */

    });

    /*
    describe('rejects an unsuccessful refresh', () => {
      it('should not update the data after refresh callback rejects');
      it('should not be loading after refresh rejects');
      it('should be ready after the refresh rejects');
      it('should have a defined error property');
    });
    */
  });
});
