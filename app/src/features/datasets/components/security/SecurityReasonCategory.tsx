import { mdiArrowDown, mdiMinus, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import { Collapse, Divider, IconButton, Paper, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { FieldArray } from 'formik';
import { useState } from 'react';

export interface ISecurityReason {
  name: string;
  description?: string;
  category?: string;
}

export interface SecurityReasonProps {
  securityReason: ISecurityReason;
  onClickSecurityReason: (securityReason: ISecurityReason) => void;
  icon: string;
}

export interface SecurityReasonCategoryProps {
  categoryName: string;
  securityReasons: ISecurityReason[];
}
/**
 * Security Reason Selector for security application.
 *
 * @return {*}
 */
const SecurityReasonCategory: React.FC<SecurityReasonCategoryProps> = (props) => {
  const { categoryName, securityReasons } = props;

  const [open, setOpen] = useState(false);

  const sortedSecurityReasons = securityReasons.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      <Box m={4} sx={{ display: 'flex' }}>
        <Box sx={{ width: '100%' }}>
          <Typography variant="h3">{categoryName}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignContent: 'center' }}>
          <IconButton onClick={() => setOpen(!open)} color="primary" aria-label="dropdown arrow" component="label">
            <Icon path={mdiArrowDown} size={1} />
          </IconButton>
        </Box>
      </Box>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <FieldArray
          name="securityReasons"
          render={(arrayHelpers) => (
            <>
              {sortedSecurityReasons.map((securityReason) => {
                return (
                  <Box key={securityReason.name} py={1} px={2}>
                    <SecurityReason
                      securityReason={{ ...securityReason, category: categoryName }}
                      onClickSecurityReason={() => {
                        if (
                          !arrayHelpers.form.values.securityReasons.find(
                            (sr: ISecurityReason) => sr.name === securityReason.name
                          )
                        ) {
                          arrayHelpers.push({ ...securityReason, category: categoryName });
                        }
                      }}
                      icon={'add'}
                    />
                  </Box>
                );
              })}
            </>
          )}
        />
      </Collapse>
      <Divider />
    </>
  );
};

export const SecurityReason: React.FC<SecurityReasonProps> = (props) => {
  const { securityReason, onClickSecurityReason, icon } = props;

  return (
    <Paper elevation={0} variant="outlined">
      <Box m={2} sx={{ display: 'flex' }}>
        <Box sx={{ width: '100%' }} mr={2}>
          <Typography variant="h5">{securityReason.name}</Typography>
          <Typography variant="body1">{securityReason.description}</Typography>
          <Typography pt={1} variant="body2">
            {securityReason.category}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <IconButton onClick={() => onClickSecurityReason(securityReason)} color="primary" aria-label="add security">
            <Icon path={icon === 'add' ? mdiPlus : mdiMinus} size={1} />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
};

export default SecurityReasonCategory;
