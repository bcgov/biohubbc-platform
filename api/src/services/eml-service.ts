import jsonpatch, { Operation } from 'fast-json-patch';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { JSONPath } from 'jsonpath-plus';
import { z } from 'zod';
import { IDBConnection } from '../database/db';
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';
import { SystemConstantService } from './system-constant-service';

const defaultLog = getLogger('services/eml-service');

export class EMLService extends DBService {
  _XMLParserOptions = {
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    // Passes all values through as strings. This avoids problems where text fields have numbers only but need to be
    // interpreted as text.
    parseTagValue: false,
    isArray: (tagName: string) => {
      const tagsArray: Array<string> = ['relatedProject', 'section', 'taxonomicCoverage', 'metadataProvider'];

      return tagsArray.includes(tagName);
    }
  };

  /**
   * Creates an instance of EMLService.
   *
   * @param {IDBConnection} connection
   * @memberof DarwinCoreService
   */
  constructor(connection: IDBConnection) {
    super(connection);
  }

  /**
   * Converts an XML string to a JS Object.
   *
   * @param {string} xmlString
   * @return {*}  {Record<string, any>}
   * @memberof EMLService
   */
  convertXMLStringToJSObject(xmlString: string): Record<string, any> {
    const xmlParser = new XMLParser(this._XMLParserOptions);

    // Zod schema to validate value is type `Record<string, any>`
    const recordSchema = z.record(z.any());

    return recordSchema.parse(xmlParser.parse(xmlString));
  }

  /**
   * Converts a JS Object to an XML string.
   *
   * @param {Record<string, any>} jsObject
   * @return {*}  {string}
   * @memberof EMLService
   */
  convertJSObjectToXMLString(jsObject: Record<string, any>): string {
    const xmlBuilder = new XMLBuilder(this._XMLParserOptions);

    // Zod schema to validate value is type `string`
    const stringSchema = z.string();

    const x = xmlBuilder.build(jsObject);

    return stringSchema.parse(x);
  }

  /**
   * Get the BioHub system URL.
   *
   * @example
   * www.biohub.gov.bc.ca
   * @return {*}  {string}
   * @memberof EMLService
   */
  getSystemURL(): string {
    if (process.env.NODE_ENV === 'local') {
      return `http://${process.env.API_HOST}:${process.env.API_PORT}`;
    }

    return process.env.API_HOST || '';
  }

  /**
   * Get the BioHub dataset URL prefix. Used in combination with a dataset uuid to create a URL to a specific dataset.
   *
   * @example
   * www.biohub.gov.bc.ca/datasets</uuid>
   * @return {*}  {string}
   * @memberof EMLService
   */
  getDatasetSystemURL(): string {
    return `${this.getSystemURL()}/datasets`;
  }

  /**
   * Get the BioHub taxonomic system URL.F
   *
   * @example
   * www.biohub-elastic-search.gov.bc.ca/taxonomy_index
   * @return {*}  {string}
   * @memberof EMLService
   */
  getTaxonomicProviderURL(): string {
    return `${process.env.ELASTICSEARCH_URL}/${process.env.ELASTICSEARCH_TAXONOMY_INDEX}`;
  }

  /**
   * Get a BioHub `metadataProvider` object.
   *
   * @return {*}  {Promise<{ organizationName: string; onlineUrl: string }>}
   * @memberof EMLService
   */
  async getMetadataProviderNode(): Promise<{ organizationName: string; onlineUrl: string }> {
    const systemConstantService = new SystemConstantService(this.connection);
    const response = await systemConstantService.getSystemConstants(['ORGANIZATION_NAME_FULL', 'ORGANIZATION_URL']);

    const organizationName =
      response.find((item) => item.constant_name === 'ORGANIZATION_NAME_FULL')?.character_value || '';
    const onlineUrl = response.find((item) => item.constant_name === 'ORGANIZATION_URL')?.character_value || '';

    return { organizationName: organizationName, onlineUrl: onlineUrl };
  }

  /**
   * Decorates an EML object, adding additional BioHub metadata to the original EML.
   *
   * @param {Record<string, any>} eml
   * @return {*}  {Promise<Record<string, any>>}
   * @memberof EMLService
   */
  async decorateEML(eml: Record<string, any>): Promise<Record<string, any>> {
    // The config for a list of patch operations to perform on the EML.
    // Note: the order of these patches may be important. Below, when patches are being applied, they are applied in
    // order, allows iterative patches to be supported.
    const patches = [
      {
        // Set the `@_system` attribute on the `eml:eml` node.
        path: '$..eml:eml',
        property: '@_system',
        value: this.getSystemURL()
      },
      {
        // Set the `@_system` attribute on the `dataset` node.
        path: '$..eml:eml.dataset',
        property: '@_system',
        value: this.getDatasetSystemURL()
      },
      {
        // Set the `@_system` attribute on the `project` node.
        path: '$..eml:eml.dataset.project',
        property: '@_system',
        value: this.getDatasetSystemURL()
      },
      {
        // Set the `@_system` attribute on all `relatedProject` nodes.
        path: '$..eml:eml..relatedProject[*]',
        property: '@_system',
        value: this.getDatasetSystemURL()
      },
      {
        // Set the `@_provider` attribute on all `taxonId` nodes that are a descendent of `taxonomicCoverage`
        path: '$..eml:eml..taxonomicCoverage..taxonId',
        property: '@_provider',
        value: this.getTaxonomicProviderURL()
      },
      {
        // Add a `metadataProvider` node if one does not already exist
        path: '$..eml:eml.dataset',
        property: 'metadataProvider',
        value: []
      },
      {
        // Append an object to the `metadataProvider` node.
        path: '$..eml:eml.dataset.metadataProvider',
        property: '-', // append to the end of the array
        value: await this.getMetadataProviderNode()
      }
    ];

    const patchOperations: Operation[] = [];

    // Iterates over `patches` in order from first to last, applying all resulting patch operations one by one.
    // Note: subsequent patches will operate on the output of the previous patches. This means iterative patches are
    // possible, if needed.
    for (const patch of patches) {
      try {
        const paths = JSONPath({
          path: patch.path,
          json: eml,
          resultType: 'all'
        });

        paths.forEach((path: any) => {
          // Get value of target property
          const currentPropertyValue = path.value[patch.property];

          if (currentPropertyValue) {
            // Target property exists and its value is truthy: do not modify it
            return;
          }

          // Patch the value of the target property
          const patchOperation: Operation = {
            op: 'add',
            path: `${path.pointer}/${patch.property}`,
            value: patch.value
          };

          patchOperations.push(patchOperation);
        });
      } catch (error) {
        defaultLog.warn({ label: 'decorateEML', message: 'error', failed_patch: patch, error });
      }

      // Apply patch to eml object. This updated eml object will be used in subsequent patches.
      eml = jsonpatch.applyPatch(eml, patchOperations).newDocument;
    }

    return eml;
  }
}