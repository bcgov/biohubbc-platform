import { TileLayer } from 'react-leaflet';

// Compare this with BaseLayerControls.tsx
// Without the parent control component this component can only return a single Tile Layer
const BaseLayer: React.FC<React.PropsWithChildren> = () => {
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
