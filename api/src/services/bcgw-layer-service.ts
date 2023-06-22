import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import { Epsg3005, WebFeatureService, WebMapService } from './geo-service';

/**
 * BCGW (BCGov) ENV regional boundaries layer.
 *
 * @see https://catalogue.data.gov.bc.ca/dataset/env-regional-boundaries
 */
export type BcgwEnvRegionsLayer = 'WHSE_ADMIN_BOUNDARIES.EADM_WLAP_REGION_BND_AREA_SVW';
export const BcgwEnvRegionsLayer: BcgwEnvRegionsLayer = 'WHSE_ADMIN_BOUNDARIES.EADM_WLAP_REGION_BND_AREA_SVW';
/**
 * The name of the field in the layer that contains the spatial data.
 *
 * Note: this value is needed when creating a CQL filter.
 */
export const BcgwEnvRegionsLayerGeometryField = 'GEOMETRY';

/**
 * BCGW (BCGov) NRM regional boundaries layer.
 *
 * @see https://catalogue.data.gov.bc.ca/dataset/natural-resource-nr-regions
 */
export type BcgwNrmRegionsLayer = 'WHSE_ADMIN_BOUNDARIES.ADM_NR_REGIONS_SPG';
export const BcgwNrmRegionsLayer: BcgwNrmRegionsLayer = 'WHSE_ADMIN_BOUNDARIES.ADM_NR_REGIONS_SPG';
/**
 * The name of the field in the layer that contains the spatial data.
 *
 * Note: this value is needed when creating a CQL filter.
 */
export const BcgwNrmRegionsLayerGeometryField = 'SHAPE';

/**
 * Service for fetching information from known BCGW layers.
 *
 * @export
 * @class BcgwLayerService
 */
export class BcgwLayerService {
  webFeatureService: WebFeatureService;
  webMapService: WebMapService;

  xmlParser: XMLParser;

  _xmlParserOptions = {
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    // Passes all values through as strings. This avoids problems where text fields have numbers only but need to be
    // interpreted as text.
    parseTagValue: false,
    isArray: (tagName: string) => {
      // Ensure specified nodes are always parsed as arrays
      const tagsArray: Array<string> = ['wfs:member'];

      return tagsArray.includes(tagName);
    }
  };

  // Zod schema used to verify the ENV and NRM region GetPropertyValue responses, after converting from XML to JSON.
  _getGetRegionPropertyValueZodSchema = z.object({
    'wfs:ValueCollection': z.object({
      'wfs:member': z.array(
        z.object({
          'pub:REGION_NAME': z.string()
        })
      )
    })
  });

  constructor() {
    this.webFeatureService = new WebFeatureService();
    this.webMapService = new WebMapService();

    this.xmlParser = new XMLParser(this._xmlParserOptions);
  }

  /**
   * Get region names, from the ENV regions layer, that intersect the provided geometry.
   *
   * @param {string} geometry a WKT geometry string. Must already be in the SRID that matches the ENV layer.
   * @return {*}  {Promise<string[]>}
   * @memberof DatasetRegionService
   */
  async getEnvRegionNames(geometry: string): Promise<string[]> {
    const responseXml = await this.webFeatureService.getPropertyValue({
      typeNames: BcgwEnvRegionsLayer,
      srsName: Epsg3005,
      cql_filter: `INTERSECTS(${BcgwEnvRegionsLayerGeometryField}, ${geometry})`,
      valueReference: 'REGION_NAME'
    });

    // Convert XML response to JSON and verify with Zod
    const responseObj = this._getGetRegionPropertyValueZodSchema.parse(this.xmlParser.parse(responseXml as string));

    // Return array of region name values
    return responseObj['wfs:ValueCollection']['wfs:member'].map((item) => item['pub:REGION_NAME']);
  }

  /**
   * Get region names, from the NRM regions layer, that intersect the provided geometry.
   *
   * @param {string} geometry a WKT geometry string. Must already be in the SRID that matches the NRM layer.
   * @return {*}  {Promise<string[]>}
   * @memberof DatasetRegionService
   */
  async getNrmRegionNames(geometry: string): Promise<string[]> {
    const responseXml = await this.webFeatureService.getPropertyValue({
      typeNames: BcgwNrmRegionsLayer,
      srsName: Epsg3005,
      cql_filter: `INTERSECTS(${BcgwNrmRegionsLayerGeometryField}, ${geometry})`,
      valueReference: 'REGION_NAME'
    });

    // Convert XML response to JSON and verify with Zod
    const responseObj = this._getGetRegionPropertyValueZodSchema.parse(this.xmlParser.parse(responseXml as string));

    // Return array of region name values
    return responseObj['wfs:ValueCollection']['wfs:member'].map((item) => item['pub:REGION_NAME']);
  }
}
