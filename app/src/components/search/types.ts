import { ChangeEvent } from 'react';

/**
 * Props for the SearchInput component (keyword search only).
 */
export interface ISearchInputProps {
  placeholder: string;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  value: string;
  onClear?: () => void;
}
