import { render } from '@testing-library/react';
import React from 'react';
import useDataLoader from './useDataLoader';

interface ITestComponentProps {
  callback: (() => any) | null | undefined;
  
}

const TestComponent: React.FC<ITestComponentProps> = (props) => {

  return <></>;
};

describe('useDataLoader', () => {
  beforeAll(() => {
    //
  });

  afterAll(() => {
    //
  });
});
