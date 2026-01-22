import { Box, Typography } from '@mui/material';

interface SidebarHeaderProps {
  title: string;
}

export const SidebarHeader = ({ title }: SidebarHeaderProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 2
      }}>
      <Typography variant="h4" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
    </Box>
  );
};
