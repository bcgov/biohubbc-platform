import { DependencyList, EffectCallback, useEffect } from 'react';
import { useDeepCompareMemo } from './useDeepCompareMemo';

export function useDeepCompareEffect(
  callback: EffectCallback,
  dependencies: DependencyList
): ReturnType<typeof useEffect> {
  return useEffect(callback, useDeepCompareMemo(dependencies));
}
