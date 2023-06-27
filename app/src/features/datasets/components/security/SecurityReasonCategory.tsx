import { mdiArrowDown, mdiArrowUp, mdiMinus, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import { Collapse, Divider, IconButton, Paper, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { FieldArray } from 'formik';
import { useState } from 'react';

export interface ISecurityReason {
  name: string;
  id: number;
  type_id: number;
  wldtaxonomic_units_id: number;
  description: string | null;
  category: string;
}

export interface ISecurityReasonProps {
  securityReason: ISecurityReason;
  onClick: (securityReason: ISecurityReason) => void;
  isSelected: boolean;
}

export interface ISecurityReasonCategoryProps {
  categoryName: string;
  securityReasons: ISecurityReason[];
}
/**
 * Security Reason Selector for security application.
 *
 * @return {*}
 */
const SecurityReasonCategory = (props: ISecurityReasonCategoryProps) => {
  const { categoryName, securityReasons } = props;

  const [open, setOpen] = useState(true);

  return (
    <Box px={2}>
      <Box m={1} sx={{ display: 'flex' }}>
        <Typography variant="h4" py={1} sx={{ flexGrow: 1, textAlign: 'start' }}>
          {categoryName}
        </Typography>
        <Box>
          <IconButton onClick={() => setOpen(!open)} color="primary" aria-label="dropdown arrow" component="label">
            <Icon path={open ? mdiArrowUp : mdiArrowDown} size={1} />
          </IconButton>
        </Box>
      </Box>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <FieldArray
          name="securityReasons"
          render={(arrayHelpers) => (
            <>
              {securityReasons
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((securityReason) => {
                  return (
                    <Box key={securityReason.name} py={0.5}>
                      <SecurityReason
                        securityReason={{ ...securityReason, category: categoryName }}
                        onClick={() => {
                          if (
                            !arrayHelpers.form.values.securityReasons.find(
                              (sr: ISecurityReason) => sr.name === securityReason.name
                            )
                          ) {
                            arrayHelpers.push({ ...securityReason, category: categoryName });
                          }
                        }}
                        isSelected={false}
                      />
                    </Box>
                  );
                })}
            </>
          )}
        />
      </Collapse>
      <Divider />
    </Box>
  );
};

export const SecurityReason = (props: ISecurityReasonProps) => {
  const { securityReason, onClick, isSelected } = props;

  return (
    <Paper elevation={0} variant="outlined">
      <Box m={1} sx={{ display: 'flex' }}>
        <Box sx={{ width: '100%' }} mr={2}>
          <Typography variant="h5">{securityReason.name}</Typography>
          <Typography variant="body2">{securityReason.description}</Typography>
          <Typography variant="body2">
            <i>{securityReason.category}</i>
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <IconButton onClick={() => onClick(securityReason)} color="primary" aria-label="add security">
            <Icon path={isSelected ? mdiMinus : mdiPlus} size={1} />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
};

export default SecurityReasonCategory;
