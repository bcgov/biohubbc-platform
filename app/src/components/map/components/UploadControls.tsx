import { mdiTrayArrowUp } from '@mdi/js';
import Icon from '@mdi/react';
import { Button } from '@mui/material';
import { makeStyles } from '@mui/styles';
import { useLeafletContext } from '@react-leaflet/core';
import ComponentDialog from 'components/dialog/ComponentDialog';
import UploadBoundary, { BoundaryUploadInitialValues, IBoundaryUpload } from 'components/upload/UploadBoundary';
import { Formik, FormikProps } from 'formik';
import { Feature } from 'geojson';
import * as L from 'leaflet';
import React, { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import { calculateUpdatedMapBounds } from 'utils/mapUploadUtils';

const useStyles = makeStyles(() => ({
  upload: {
    position: 'absolute',
    left: '20px',
    bottom: '20px',
    padding: '10px',
    zIndex: 400
  }
}));

const UploadControls: React.FC<React.PropsWithChildren<any>> = (props) => {
  const classes = useStyles();
  const context = useLeafletContext();
  const formikRef = useRef<FormikProps<IBoundaryUpload>>(null);
  const map = useMap();

  const [boundary, setBoundary] = useState<IBoundaryUpload>(BoundaryUploadInitialValues);
  const [openUploadBoundary, setOpenUploadBoundary] = useState(false);

  const submitBoundary = (values: IBoundaryUpload) => {
    console.log('values' + JSON.stringify(values));

    setBoundary(values);
    setBounds(values.geometry);
    setOpenUploadBoundary(false);
  };

  const setBounds = (geometry: Feature[]) => {
    const bounds = calculateUpdatedMapBounds(geometry);
    if (bounds) {
      const newBounds = new L.LatLngBounds(bounds[0] as L.LatLngTuple, bounds[1] as L.LatLngTuple);
      map.fitBounds(newBounds, { padding: [30, 30] });
    }
  };

  const drawGeometries = (boundary: IBoundaryUpload) => {
    const container = context.layerContainer || context.map;
    const map = context.map;
    /*
      Used to draw geometries that are uploaded
    */
    boundary.geometry?.forEach((geometry: Feature) => {
      L.geoJSON(geometry, {
        pointToLayer: (feature, latlng) => {
          if (feature.properties?.radius) {
            return new L.Circle([latlng.lat, latlng.lng], feature.properties.radius);
          }

          return new L.Marker([latlng.lat, latlng.lng]);
        },
        onEachFeature: function (_feature, layer) {
          container.addLayer(layer);
        }
      })
        .bindTooltip(boundary.boundary_name, { permanent: false, direction: 'center', opacity: 0.8 })
        .openTooltip()
        .addTo(map);
    });
  };

  useEffect(() => {
    drawGeometries(boundary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundary]);

  return (
    <>
      <ComponentDialog
        open={openUploadBoundary}
        dialogTitle="Upload Boundary"
        onClose={() => setOpenUploadBoundary(false)}
      >
        <Formik
          key={'BoundaryUpload'}
          innerRef={formikRef}
          enableReinitialize={true}
          initialValues={BoundaryUploadInitialValues}
          // validationSchema={BoundaryUploadYupSchema}
          validateOnBlur={true}
          validateOnChange={false}
          onSubmit={submitBoundary}
        >
          <UploadBoundary />
        </Formik>
      </ComponentDialog>
      <Button
        className={classes.upload}
        color="primary"
        data-testid="boundary_file-upload"
        variant="contained"
        startIcon={<Icon path={mdiTrayArrowUp} size={1} />}
        onClick={() => setOpenUploadBoundary(true)}
      >
        Upload Boundary
      </Button>
    </>
  );
};

export default UploadControls;
