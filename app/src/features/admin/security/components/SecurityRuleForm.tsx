import React from "react";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Typography from "@mui/material/Typography";
import Autocomplete from "@mui/material/Autocomplete";
import { Box, Button, Card, IconButton, List, ListItem, Paper } from "@mui/material";
import Icon from '@mdi/react';
import { mdiClose, mdiPlus } from '@mdi/js';
import grey from "@mui/material/colors/grey";

export default function SecurityRuleForm() {
  const [category, setCategory] = React.useState('');

  const selectSecurityCategory = (event: SelectChangeEvent) => {
    setCategory(event.target.value as string);
  };

  const conditionProperties = [
    { label: 'Geometry' },
    { label: 'Label' },
    { label: 'Start Date' },
    { label: 'Taxonomy' },
  ]

  return (
    <Stack gap={3}>
      <Stack gap={3} component="fieldset">
        <Typography component="legend">Details</Typography>
        <FormControl fullWidth>
          <InputLabel id="securityCategoryLabel">Security Category</InputLabel>
          <Select
            labelId="securityCategoryLabel"
            id="securityCategoryInput"
            value={category}
            label="Security Category"
            onChange={selectSecurityCategory}
          >
            <MenuItem value={10}>Government Interest</MenuItem>
            <MenuItem value={20}>Persecution and Harm</MenuItem>
            <MenuItem value={30}>Proprietary</MenuItem>
          </Select>
        </FormControl>
        <TextField label="Name"></TextField>
        <TextField label="Description" multiline rows={2}></TextField>
      </Stack>

      <Stack gap={3} component="fieldset" display="none">
        <Typography component="legend">Rule Conditions</Typography>

        <Stack flexDirection="row" alignItems="center" gap={1}>
          <Autocomplete
            id="conditionProperty"
            options={conditionProperties}
            fullWidth
            renderInput={(params) =>
              <TextField {...params}
                aria-label="Add property"
                label=""
                placeholder="Add property"
              />
            }
          />
          <IconButton
            sx={{
              flex: '0 0 auto'
            }}
          >
            <Icon path={mdiPlus} size={1} />
          </IconButton>
        </Stack>

        <Stack gap={1}>
          <Card variant="outlined" sx={{ pr: 2, background: grey[100] }}>
            <Stack flexDirection="row" gap={2}>
              <Box display="flex" alignItems="center" textAlign="center"
                sx={{ background: grey[200] }}
              >
                <Typography component="span" variant="body2" minWidth={150} fontWeight={700}>Taxonomy</Typography>
              </Box>
              <Stack flex="1 1 auto" flexDirection="row" justifyContent="space-around" gap={2} py={2}>
                <TextField label="Is" fullWidth />
                <TextField label="Descends from" fullWidth />
              </Stack>
              <IconButton
                sx={{
                  alignSelf: 'center',
                  flex: '0 0 auto'
                }}
              >
                <Icon path={mdiClose} size={1}></Icon>
              </IconButton>
            </Stack>
          </Card>
          <Card variant="outlined" sx={{ pr: 2, background: grey[100] }}>
            <Stack flexDirection="row" gap={2}>
              <Box display="flex" alignItems="center" textAlign="center"
                sx={{ background: grey[200] }}
              >
                <Typography component="span" variant="body2" minWidth={150} fontWeight={700}>Number</Typography>
              </Box>
              <Stack flex="1 1 auto" flexDirection="row" justifyContent="space-around" gap={2} py={2}>
                <TextField label="Is equal" fullWidth />
                <TextField label="Is greater than" fullWidth />
                <TextField label="Is less than" fullWidth />
              </Stack>
              <IconButton
                sx={{
                  alignSelf: 'center',
                  flex: '0 0 auto'
                }}
              >
                <Icon path={mdiClose} size={1}></Icon>
              </IconButton>
            </Stack>
          </Card>
          <Card variant="outlined" sx={{ pr: 2, background: grey[100] }}>
            <Stack flexDirection="row" gap={2}>
              <Box display="flex" alignItems="center" textAlign="center"
                sx={{ background: grey[200] }}
              >
                <Typography component="span" variant="body2" minWidth={150} fontWeight={700}>Label</Typography>
              </Box>
              <Stack flex="1 1 auto" flexDirection="row" justifyContent="space-around" gap={2} py={2}>
                <TextField label="Contains" fullWidth />
              </Stack>
              <IconButton
                sx={{
                  alignSelf: 'center',
                  flex: '0 0 auto'
                }}
              >
                <Icon path={mdiClose} size={1}></Icon>
              </IconButton>
            </Stack>
          </Card>
        </Stack>
      </Stack>

      <Stack gap={3} component="fieldset">
        <Typography component="legend">Conditions</Typography>
        <Stack gap={2}>

          <List disablePadding
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1
            }}
          >

            <ListItem disablePadding disableGutters>
              <Paper
                variant="outlined"
                sx={{
                  width: '100%',
                  pr: 2,
                  overflow: 'hidden'
                }}
              >
                <Stack flexDirection="row" gap={2}>
                  <Box flex="0 0 auto" p={2} display="flex" alignItems="center" textAlign="center"
                    sx={{ background: grey[100] }}
                    width={300}
                  >
                    <TextField label="Property" value="Taxonomy" fullWidth />
                  </Box>
                  <Stack flex="1 1 auto" flexDirection="row" gap={2} py={2}>
                    <TextField label="Is" fullWidth />
                    <TextField label="Descends from" fullWidth />
                  </Stack>
                  <IconButton
                    sx={{
                      alignSelf: 'center',
                      flex: '0 0 auto'
                    }}
                  >
                    <Icon path={mdiClose} size={1}></Icon>
                  </IconButton>
                </Stack>
              </Paper>
            </ListItem>

            <ListItem disablePadding disableGutters>
              <Paper
                variant="outlined"
                sx={{
                  width: '100%',
                  pr: 2,
                  overflow: 'hidden'
                }}
              >
                <Stack flexDirection="row" gap={2} width="100%">
                  <Box flex="0 0 auto" p={2} display="flex" alignItems="center" textAlign="center"
                    sx={{ background: grey[100] }}
                    width={300}
                  >
                    <TextField label="Number" value="Number" fullWidth />
                  </Box>
                  <Stack flex="1 1 auto" flexDirection="row" gap={2} py={2}>
                    <TextField label="Is equal" fullWidth />
                    <TextField label="Is greater than" fullWidth />
                    <TextField label="Is less than" fullWidth />
                  </Stack>
                  <IconButton
                    sx={{
                      alignSelf: 'center',
                      flex: '0 0 auto'
                    }}
                  >
                    <Icon path={mdiClose} size={1}></Icon>
                  </IconButton>
                </Stack>
              </Paper>
            </ListItem>

            <ListItem disablePadding disableGutters>
              <Paper
                variant="outlined"
                sx={{
                  width: '100%',
                  pr: 2,
                  overflow: 'hidden'
                }}
              >
                <Stack flexDirection="row" gap={2} width="100%">
                  <Box p={2} display="flex" alignItems="center" textAlign="center"
                    sx={{ background: grey[100] }}
                    width={300}
                  >
                    <TextField label="Property" fullWidth />
                  </Box>
                  <Stack flex="1 1 auto" flexDirection="row" justifyContent="center" gap={2} py={2}>
                    <Typography component="span" variant="body1" color="textSecondary"
                      sx={{
                        alignSelf: 'center'
                      }}
                    >
                      Select a property
                    </Typography>
                  </Stack>
                  <IconButton
                    sx={{
                      alignSelf: 'center',
                      flex: '0 0 auto'
                    }}
                  >
                    <Icon path={mdiClose} size={1}></Icon>
                  </IconButton>
                </Stack>
              </Paper>
            </ListItem>

          </List>

          <Button variant="outlined" color="primary" sx={{ alignSelf: 'flex-start' }}
            startIcon={
              <Icon path={mdiPlus} size={0.75}></Icon>
            }
          >
            Add Condition
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}