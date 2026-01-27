import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

export interface ToggleButtonView<ViewValueType extends string> {
  /** Value of the toggle button, passed to `onViewChange` */
  value: ViewValueType;
  /** Label to display */
  label: string;
  /** Optional start icon */
  icon?: string;
}

interface ToggleButtonsProps<ViewValueType extends string> {
  /** Available views */
  views: ToggleButtonView<ViewValueType>[];
  /** Currently active view */
  activeView: ViewValueType;
  /** Callback when a view is selected */
  onViewChange: (view: ViewValueType) => void;
  /** Orientation of the group */
  orientation?: 'horizontal' | 'vertical';
}

/**
 * A reusable toggle button group component
 * @template ViewValueType
 */
export const ToggleButtons = <ViewValueType extends string>({
  views,
  activeView,
  onViewChange,
  orientation = 'horizontal'
}: ToggleButtonsProps<ViewValueType>) => {
  return (
    <ToggleButtonGroup
      orientation={orientation}
      color="primary"
      value={activeView}
      exclusive
      onChange={(_, newView) => {
        if (newView) {
          onViewChange(newView as ViewValueType);
        }
      }}
      sx={{
        display: 'flex',
        '& .MuiToggleButton-root': {
          borderRadius: 1,
          textTransform: 'none',
          fontWeight: 700,
          fontSize: '0.875rem'
        }
      }}>
      {views.map((view) => {
        const startIcon = view.icon ? <Icon path={view.icon} size={0.75} /> : undefined;

        return (
          <ToggleButton key={view.value} value={view.value} component={Button} startIcon={startIcon}>
            {view.label}
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
};
