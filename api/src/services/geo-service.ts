import axios, { CancelTokenSource } from 'axios';
import qs from 'qs';

export namespace SpatialProjection {
  /**
   * WGS 84
   *
   * Typically the default coordinate system for GeoJSON.
   *
   * @see https://epsg.io/4326
   */
  export const Epsg4326 = 'EPSG:4326';
  /**
   * The number (id) portion of {@link Epsg4326}
   */
  export const Srid4326 = 4326;

  /**
   * BC Albers
   *
   * Typically used by BCGW (BCGov) map layers.
   *
   * @see https://epsg.io/3005
   */
  export const Epsg3005 = 'EPSG:3005';
  /**
   * The number (id) portion of {@link Epsg3005}
   */
  export const Srid3005 = 3005;

  /**
   * WGS 84 / Pseudo-Mercator
   *
   * @see https://epsg.io/3857
   */
  export const Epsg3857 = 'EPSG:3857';
  /**
   * The number (id) portion of {@link Epsg3857}
   */
  export const Srid3857 = 3857;

  /**
   * Common (Coordinate Reference System) CRS types.
   *
   * Synonymous with {@link Srs}.
   */
  export type Crs =
    | typeof SpatialProjection.Epsg4326
    | typeof SpatialProjection.Epsg3005
    | typeof SpatialProjection.Epsg3857;

  /**
   * Common (Spatial Reference System) SRS types.
   *
   * Synonymous with {@link Crs}.
   */
  export type Srs = Crs;

  export type Srid = typeof Srid4326 | typeof Srid3005 | typeof Srid3857;
}

export namespace SpatialService {
  /**
   * Web Map Service (WMS) type.
   */
  export type Wms = 'WMS';
  export const Wms: Wms = 'WMS';

  /**
   * Web Feature Service (WFS) type.
   */
  export type Wfs = 'WFS';
  export const Wfs: Wfs = 'WFS';

  /**
   * Base request parameters for both WMS and WFS services.
   */
  export type OwsBaseOptions = {
    /**
     * The request type.
     *
     * @type {string}
     */
    request: string;
    /**
     * The type of the service to call.
     *
     * @type {(Wms | Wfs)}
     */
    service: SpatialService.Wms | SpatialService.Wfs;
    /**
     * The version of the WFS service to query.
     *
     * Note: if no version is provided, the latest version will be used by default.
     *
     * @type {string}
     */
    version?: string;
  };

  /**
   * Parameters required to make a WFS GetFeature request without CQL filter.
   */
  export type WfsGetBaseOptions = {
    /**
     * The name of the layer to fetch features from.
     *
     * @type {string}
     */
    typeNames: string;
    /**
     * The format of the response. (see GetCapabilities response for supported values).
     *
     * Note: default format if none provided, or if no extra formats are supported by the service, is typically XML.
     *
     * @type {string}
     */
    outputFormat?: string;
    /**
     * The version of the WFS service to query.
     *
     * Note: if no version is provided, the latest version will be used by default.
     *
     * @type {string}
     */
    version?: string;
  };

  /**
   * Parameters required to make a WFS get request with CQL filter.
   */
  export type WfsGetFilterBaseOptions = WfsGetBaseOptions & {
    /**
     * A filter that gets applied to the source layer to determine what subset of the layer to return in the response.
     *
     * Ex: fetch features from the source layer that intersect a filter polygon (defined as part of the cql_filter).
     *
     * @type {string}
     */
    cql_filter: string;
    /**
     * The CRS (aka SRS) of the geometry used in the cql_filter.
     *
     * @type {SpatialProjection.Crs}
     */
    srsName?: SpatialProjection.Crs;
  };

  /**
   * Parameters required to make a WFS GetFeature request.
   */
  export type WfsGetFeatureOptions = WfsGetBaseOptions;
  /**
   * Parameters required to make a WFS GetFeature request with CQL filter.
   */
  export type WfsGetFeatureFilterOptions = WfsGetFilterBaseOptions;

  /**
   * Parameters required to make a WFS GetPropertyValue request.
   */
  export type WfsGetPropertyValueOptions = WfsGetBaseOptions & {
    /**
     * The name of a property.
     *
     * @type {string}
     */
    valueReference: string;
  };
  /**
   * Parameters required to make a WFS GetPropertyValue request with CQL filter.
   */
  export type WfsGetPropertyValueFilterOptions = WfsGetPropertyValueOptions & WfsGetFilterBaseOptions;

  export type WmsGetMapOptions = {
    /**
     * The name of the layer to fetch tiles from.
     *
     * @type {string}
     */
    layers: string;
    /**
     * The bounding box of the area of the layer to return tiles from.
     *
     * @type {string}
     */
    bbox: string;
    /**
     * The CRS (aka SRS) of the bound box geometry.
     *
     * @type {SpatialProjection.Crs}
     */
    crs: SpatialProjection.Crs;
    /**
     * The format of the response tiles (ex: `image/png`)
     *
     * @type {string}
     */
    format: string;
    /**
     * The width of the response (pixels).
     *
     * @type {number}
     */
    width: number;
    /**
     * The height of the response (pixels).
     *
     * @type {number}
     */
    height: number;
    /**
     * The style of the response tiles (see GetCapabilities response for supported values).
     *
     * @type {string}
     */
    styles?: string;
    /**
     * The version of the WFS service to query.
     *
     * Note: if no version is provided, the latest version will be used by default.
     *
     * @type {string}
     */
    version?: string;
  };
}

/**
 * Service for calling a WMS or WFS API.
 *
 * What is WMS and WFS?
 * - Web Map Service (WMS) is an API spec for fetching map tiles (ex PNG).
 * - Web Feature Service (WFS) is an API spec for fetching map features (ex: GeoJSON), and related information.
 *
 * Useful documentation on WMS and WFS:
 * - WMS Root Doc: https://docs.geoserver.org/latest/en/user/services/wms/index.html
 *   - Reference: https://docs.geoserver.org/latest/en/user/services/wms/reference.html
 * - WFS Root Doc: https://docs.geoserver.org/latest/en/user/services/wfs/index.html
 *   - Reference: https://docs.geoserver.org/latest/en/user/services/wfs/reference.html
 *   - Filtering: https://docs.geoserver.org/latest/en/user/filter/ecql_reference.html#filter-ecql-reference
 *
 * Useful online tools:
 * - http://geojson.io (easily generate GeoJSON)
 * - https://geojson-to-wkt-converter.onrender.com/ (convert GeoJSON to WKT, so it can be manipulated using PostGIS)
 * - https://epsg.io/ (information on spatial projections)
 *
 * @class GeoService
 */
export class GeoService {
  baseUrl: string;

  constructor(options?: { baseUrl?: string }) {
    this.baseUrl = options?.baseUrl || process.env.BcgwBaseUrl || 'https://openmaps.gov.bc.ca/geo/pub/ows';
  }

  /**
   * Builds a Url, adding any `options` to the query string portion of the url.
   *
   * @template Options
   * @param {Options} options
   * @return {*}  {string}
   * @memberof GeoService
   */
  _buildURL<Options extends SpatialService.OwsBaseOptions>(options: Options): string {
    const queryString = qs.stringify(options);

    return `${this.baseUrl}?${queryString}`;
  }

  /**
   * Executes a Http Get request, returning the response data.
   *
   * @param {string} url
   * @param {CancelTokenSource} [cancelTokenSource]
   * @return {*}  {Promise<unknown>}
   * @memberof GeoService
   */
  async _externalGet(url: string, cancelTokenSource?: CancelTokenSource): Promise<unknown> {
    const { data } = await axios.get(url, { cancelToken: cancelTokenSource?.token });

    return data;
  }
}

/**
 * Service for calling a Web Feature Service (WFS) API.
 *
 * @export
 * @class WebFeatureService
 * @extends {GeoService}
 */
export class WebFeatureService extends GeoService {
  /**
   * Executes a WFS GetCapabilities request.
   *
   * @param {SpatialService.OwsBaseOptions} [options]
   * @return {*}  {Promise<unknown>}
   * @memberof WebFeatureService
   */
  async getCapabilities(options?: SpatialService.OwsBaseOptions): Promise<unknown> {
    const version = options?.version || '2.0.0';

    const url = this._buildURL({
      ...options,
      request: 'GetCapabilities',
      service: SpatialService.Wfs,
      version: version
    });

    return this._externalGet(url);
  }

  /**
   * Executes a WFS GetFeature request, returning features (exact response depends on the provided `options`).
   *
   * @param {(SpatialService.WfsGetBaseOptions | SpatialService.WfsGetFilterBaseOptions)} options
   * @return {*}  {Promise<unknown>}
   * @memberof WebFeatureService
   */
  async getFeature(
    options: SpatialService.WfsGetBaseOptions | SpatialService.WfsGetFilterBaseOptions
  ): Promise<unknown> {
    const version = options?.version || '2.0.0';

    const url = this._buildURL({ ...options, request: 'GetFeature', service: SpatialService.Wfs, version: version });

    return this._externalGet(url);
  }

  /**
   * Executes a WFS GetPropertyValue request, returning property values (exact response depends on the provided `options`).
   *
   * @param {(SpatialService.WfsGetBaseOptions | SpatialService.WfsGetFilterBaseOptions)} options
   * @return {*}  {Promise<unknown>}
   * @memberof WebFeatureService
   */
  async getPropertyValue(
    options: SpatialService.WfsGetPropertyValueOptions | SpatialService.WfsGetPropertyValueFilterOptions
  ): Promise<unknown> {
    const version = options?.version || '2.0.0';

    const url = this._buildURL({
      ...options,
      request: 'GetPropertyValue',
      service: SpatialService.Wfs,
      version: version
    });

    return this._externalGet(url);
  }

  /**
   * Executes a WFS describeFeatureType request, returning a data element that describes the layer (names,
   * types, properties, etc).
   *
   * Note: the BCGW
   *
   * @memberof WebFeatureService
   */
  async describeFeatureType() {}
}

/**
 * Service for calling a Web Map Service (WMS) API.
 *
 * @export
 * @class WebMapService
 * @extends {GeoService}
 */
export class WebMapService extends GeoService {
  /**
   * Executes a WMS GetCapabilities request.
   *
   * @param {SpatialService.OwsBaseOptions} [options]
   * @return {*}  {Promise<unknown>}
   * @memberof WebMapService
   */
  async GetCapabilities(options?: SpatialService.OwsBaseOptions): Promise<unknown> {
    const version = options?.version || '2.0.0';

    const url = this._buildURL({
      ...options,
      request: 'GetCapabilities',
      service: SpatialService.Wms,
      version: version
    });

    return this._externalGet(url);
  }

  /**
   * Executes a WMS GetMap request, returning map tiles (exact response depends on the provided `options`).
   *
   * @param {SpatialService.WmsGetMapOptions} options
   * @return {*}  {Promise<unknown>}
   * @memberof WebMapService
   */
  async getMap(options: SpatialService.WmsGetMapOptions): Promise<unknown> {
    const version = options?.version || '1.3.0';

    const url = this._buildURL({ ...options, request: 'GetMap', service: SpatialService.Wms, version: version });

    return this._externalGet(url);
  }

  /**
   * // TODO Not implemented
   *
   * @memberof WebMapService
   */
  getFeatureInfo() {}
}
