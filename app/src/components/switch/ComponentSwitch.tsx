import { ReactElement } from 'react';

interface ComponentSwitchProps<T extends string | number> {
  /**
   * The key of the component to switch to.
   */
  switch: T;
  /**
   * An object of components to switch between.
   */
  components: Record<T, ReactElement>;
}

/**
 * Switch between components based on the current switch value using an object.
 *
 * @template T The type of switch value (string or number).
 * @param props The props for the component switch.
 * @returns The rendered component, fallback, or null.
 */
export function ComponentSwitch<T extends string | number>(props: ComponentSwitchProps<T>): ReactElement | null {
  const { switch: switchValue, components } = props;

  return components[switchValue] ?? null;
}
