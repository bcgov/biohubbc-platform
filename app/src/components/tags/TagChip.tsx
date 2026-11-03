import Chip, { ChipProps } from '@mui/material/Chip';
import { ITagSummary } from 'interfaces/useTagsApi.interface';
import { getContrastTextColor } from 'utils/color';

export interface ITagChipProps extends Omit<ChipProps, 'label' | 'color'> {
  tag: Pick<ITagSummary, 'name' | 'color'>;
}

/**
 * A tag's name on its color, with black or white text, whichever reads better on that color. Other chip props, such
 * as `onDelete` from an autocomplete's selected values, pass through.
 *
 * @param {ITagChipProps} props The tag, and any other chip props.
 * @returns {JSX.Element} The tag chip.
 */
export const TagChip = (props: ITagChipProps) => {
  const { tag, size = 'small', sx, ...chipProps } = props;
  const textColor = getContrastTextColor(tag.color);

  return (
    <Chip
      {...chipProps}
      size={size}
      label={tag.name}
      title={tag.name}
      sx={[
        {
          bgcolor: tag.color,
          color: textColor,
          fontWeight: 700,
          maxWidth: 200,
          '& .MuiChip-deleteIcon': { color: textColor, opacity: 0.7 },
          '& .MuiChip-deleteIcon:hover': { color: textColor, opacity: 1 }
        },
        ...(Array.isArray(sx) ? sx : [sx])
      ]}
    />
  );
};
