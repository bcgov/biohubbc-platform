import { ReactNode } from 'react';

interface ComponentSwitchProps<T extends string | number> {
  /**
   * The key of the component to switch to.
   *
   * @type {T} The type of the current view.
   */
  switch: T;
  /**
   * A record of components to switch between.
   *
   * Note: Partial allows switches of an `enum` type to not require components for all values.
   *
   * @type {Partial<Record<T, ReactNode>>} A record of components to switch between.
   */
  components: Partial<Record<T, ReactNode>>;
}

/**
 * Switch between components based on the current switch value.
 *
 * @template T The type of switch value.
 * @param {ComponentSwitchProps} props The props for the component.
 * @returns {ReactNode | null} The rendered component.
 */
export const ComponentSwitch = <T extends string>(props: ComponentSwitchProps<T>): ReactNode | null => {
  const component = props.components[props.switch];

  if (!component) {
    return null;
  }

  return component;
};
