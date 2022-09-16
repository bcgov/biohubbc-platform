import { kml } from '@tmcw/togeojson';
import bbox from '@turf/bbox';
import { FormikContextType } from 'formik';
import { Feature, FeatureCollection } from 'geojson';
import JSZip from 'jszip';
import get from 'lodash-es/get';
import { read } from 'shapefile';
/**
 * Function to handle zipped shapefile spatial boundary uploads
 *
 * @template T Type of the formikProps (should be auto-determined if the incoming formikProps are properly typed)
 * @param {File} file The file to upload
 * @param {string} name The name of the formik field that the parsed geometry will be saved to
 * @param {FormikContextType<T>} formikProps The formik props
 * @return {*}
 */
export const handleShapefileUpload = async <T,>(file: File, name: string, formikProps: FormikContextType<T>) => {
  const { values, setFieldValue, setFieldError } = formikProps;
  // Back out if not a zipped file
  if (!file?.type.match(/zip/) || !file?.name.includes('.zip')) {
    setFieldError(name, 'You must upload a valid shapefile (.zip format). Please try again.');
    return;
  }

  const archive = await file.arrayBuffer().then((buffer) => JSZip.loadAsync(buffer));

  const shpFileName = Object.keys(archive.files).find((key) => {
    return key.includes('.shp');
  });

  if (!shpFileName) {
    setFieldError(name, 'You must upload a valid shapefile (.zip format). That contains .shp file. Please try again.');
    return;
  }

  const shpFile = await archive.file(shpFileName)?.async('arraybuffer');
  if (!shpFile) {
    setFieldError(name, 'You must upload a valid shapefile (.zip format). .shp file is invalid. Please try again.');
    return;
  }
  // Run the conversion
  const collection = (await read(shpFile)) as FeatureCollection;

  const sanitizedGeoJSON: Feature[] = [];
  if (Array.isArray(collection.features)) {
    collection.features.forEach((feature) => {
      if (feature.geometry && feature.geometry.type === 'Polygon') {
        sanitizedGeoJSON.push(feature);
      }
    });
  }

  setFieldValue(name, [...sanitizedGeoJSON, ...get(values, name)]);
};

/**
 * Function to handle KML file spatial boundary uploads
 *
 * @template T Type of the formikProps (should be auto-determined if the incoming formikProps are properly typed)
 * @param {File} file The file to upload
 * @param {string} name The name of the formik field that the parsed geometry will be saved to
 * @param {FormikContextType<T>} formikProps The formik props
 * @return {*}
 */
export const handleKMLUpload = async <T,>(file: File, name: string, formikProps: FormikContextType<T>) => {
  const { values, setFieldValue, setFieldError } = formikProps;

  const fileAsString = await file?.text().then((xmlString: string) => {
    return xmlString;
  });

  if (file?.type !== 'application/vnd.google-earth.kml+xml' && !fileAsString?.includes('</kml>')) {
    setFieldError(name, 'You must upload a KML file, please try again.');
    return;
  }

  const domKml = new DOMParser().parseFromString(fileAsString, 'application/xml');
  const geojson = kml(domKml);

  const sanitizedGeoJSON: Feature[] = [];
  geojson.features.forEach((feature: Feature) => {
    if (feature.geometry && feature.geometry.type === 'Polygon') {
      sanitizedGeoJSON.push(feature);
    }
  });

  setFieldValue(name, [...sanitizedGeoJSON, ...get(values, name)]);
};
/**
 * @param geometries geometry values on map
 */
export const calculateUpdatedMapBounds = (geometries: Feature[]): any[][] | undefined => {
  /*
    If no geometries, we do not need to set bounds

    If there is only one geometry and it is a point, we cannot do the bound setting
    because leaflet does not know how to handle that and tries to zoom in way too much

    If there are multiple points or a polygon and a point, this is not an issue
  */
  if (!geometries || !geometries.length || (geometries.length === 1 && geometries[0]?.geometry?.type === 'Point')) {
    return;
  }

  const allGeosFeatureCollection = {
    type: 'FeatureCollection',
    features: [...geometries]
  };
  const bboxCoords = bbox(allGeosFeatureCollection);

  return [
    [bboxCoords[1], bboxCoords[0]],
    [bboxCoords[3], bboxCoords[2]]
  ];
};
