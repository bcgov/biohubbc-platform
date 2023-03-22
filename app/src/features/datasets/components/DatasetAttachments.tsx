//import { mdiAttachment, mdiFilePdfBox } from "@mdi/js";
//import Icon from "@mdi/react";
import Box from "@mui/material/Box";
//import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
//import ListItemIcon from "@mui/material/ListItemIcon";
//import Menu from "@mui/material/Menu";
// import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useApi } from "hooks/useApi";
import useDataLoader from "hooks/useDataLoader";
import { useState } from 'react'

export interface IDatasetAttachmentsProps {
  datasetId: string;
}

/**
 * Project attachments content for a project.
 *
 * @return {*}
 */
const DatasetAttachments: React.FC<IDatasetAttachmentsProps> = (props) => {
  const { datasetId } = props;

  const [rowsPerPage] = useState(10);
  const [page] = useState(0);

  const biohubApi = useApi();
  const attachmentsDataLoader = useDataLoader(() => biohubApi.dataset.getDatasetAttachments(datasetId));

  attachmentsDataLoader.load();



  // Show/Hide Project Settings Menu
  // const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  /*
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };
  */

  const handleClickAttachment = (artifact: any) => {
    //
  }

  const attachmentsList = attachmentsDataLoader.data?.artifacts || [];

  return (
    <>
      <Toolbar style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h4" component="h2">
          Documents
        </Typography>
      </Toolbar>
      <Divider></Divider>
      <Box px={1}>
        <Box>
          <TableContainer>
            <Table aria-label="attachments-list-table">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell width="80px"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {attachmentsList.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((artifact, index) => {
                    return (
                      <TableRow key={`${artifact.artifact_id}-${index}`}>
                        <TableCell scope="row">
                          <Link style={{ fontWeight: 'bold' }} underline="always" onClick={() => handleClickAttachment(artifact)}>
                            {artifact.file_name}
                          </Link>
                        </TableCell>
                        <TableCell>{artifact.file_type}</TableCell>
                        <TableCell align="right">
                          {/*
                          <AttachmentItemMenuButton
                            attachment={row}
                            handleDownloadFileClick={handleDownloadFileClick}
                            handleDeleteFileClick={handleDeleteFileClick}
                            handleViewDetailsClick={handleViewDetailsClick}
                          />
                          */}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {!attachmentsList.length && (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      <Typography component="strong" color="textSecondary" variant="body2">
                        No Documents
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    </>
  );
};

export default DatasetAttachments;
