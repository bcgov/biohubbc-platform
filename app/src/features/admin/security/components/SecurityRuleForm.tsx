import React from "react";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Typography from "@mui/material/Typography";



export default function SecurityRuleForm() {
  const [age, setAge] = React.useState('');

  const handleChange = (event: SelectChangeEvent) => {
    setAge(event.target.value as string);
  };
  
  return (
    <Stack gap={3}>
      <Typography variant="body1" color="textSecondary">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</Typography>
      <FormControl fullWidth>
        <InputLabel id="demo-simple-select-label">Security Category</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="demo-simple-select"
          value={age}
          label="Security Category"
          onChange={handleChange}
        >
          <MenuItem value={10}>Government Interest</MenuItem>
          <MenuItem value={20}>Persecution and Harm</MenuItem>
          <MenuItem value={30}>Proprietary</MenuItem>
        </Select>
      </FormControl>
      <TextField label="Name"></TextField>
      <TextField label="Description" multiline rows={3}></TextField>
    </Stack>
  );
}