import { Button, Stack } from '@mui/material';
import { NavLink } from 'react-router-dom';
import { ISearchContainerLink } from './SearchTabs.interface';

interface ISearchTabsProps {
  links: ISearchContainerLink[];
}

export const SearchTabs = (props: ISearchTabsProps) => {
  const { links } = props;

  return (
    <Stack flexDirection="row">
      {links.map((link) => (
        <Button
          key={link.label}
          component={NavLink}
          to={link.to}
          color="primary"
          sx={{
            px: 2,
            fontSize: '0.9rem',
            textTransform: 'none'
          }}>
          {link.label}
        </Button>
      ))}
    </Stack>
  );
};
