import { TileLayer } from 'react-leaflet';

interface IBaseLayerProps {
  layerControlEnabled?: boolean;
}

const BaseLayer: React.FC<React.PropsWithChildren<IBaseLayerProps>> = (props) => {
  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.esri.com/en-us/arcgis/products/location-services/services/basemaps">ESRI Basemap</a>'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
      />
    </>
  );
};

export default BaseLayer;
