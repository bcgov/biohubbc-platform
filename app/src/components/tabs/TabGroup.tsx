import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { SxProps, Theme } from '@mui/material/styles';

export interface ITabGroupItem<T extends string = string> {
  value: T;
  label: string;
  id?: string;
  ariaControls?: string;
  disabled?: boolean;
}

interface ITabGroupProps<T extends string = string> {
  value: T;
  tabs: ITabGroupItem<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  sx?: SxProps<Theme>;
}

/**
 * Reusable tab group with shared admin-header styling.
 *
 * @param {ITabGroupProps} props
 * @return {*}
 */
export const TabGroup = <T extends string>(props: ITabGroupProps<T>) => {
  const { value, tabs, onChange, ariaLabel, sx } = props;

  return (
    <Tabs value={value} onChange={(_, nextValue: T) => onChange(nextValue)} aria-label={ariaLabel} sx={sx}>
      {tabs.map((tab) => (
        <Tab
          key={tab.value}
          value={tab.value}
          label={tab.label}
          id={tab.id}
          aria-controls={tab.ariaControls}
          disabled={tab.disabled}
        />
      ))}
    </Tabs>
  );
};
