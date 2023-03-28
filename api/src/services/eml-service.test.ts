import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ISystemConstant } from '../repositories/system-constant-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { EMLService } from './eml-service';
import { SystemConstantService } from './system-constant-service';

chai.use(sinonChai);

describe('EMLService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('convertXMLStringToJSObject', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('transforms an XML string to a JS Object', async () => {
      const mockDBConnection = getMockDBConnection();
      const emlService = new EMLService(mockDBConnection);

      const emlXMLString = `
        <?xml version="1.0" encoding="UTF-8"?>
            <eml:eml packageId="urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f">
                <dataset system="">
                    <title>
                        My Dataset Title
                    </title>
                    <project system="project_system">
                        <title>
                            My Project Title
                        </title>
                        <relatedProject system="">
                            <title>
                                My Related Project
                            </title>
                        </relatedProject>
                    </project>
                    <taxonomicCoverage>
                        <taxonId provider="">
                            M-ALAM
                        </taxonId>
                    </taxonomicCoverage>
                </dataset>
            </eml:eml>
      `;

      const emlJSObject = emlService.convertXMLStringToJSObject(emlXMLString);

      expect(emlJSObject).to.eql({
        '?xml': {
          '@_encoding': 'UTF-8',
          '@_version': '1.0'
        },
        'eml:eml': {
          '@_packageId': 'urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f',
          dataset: {
            '@_system': '',
            title: 'My Dataset Title',
            project: {
              '@_system': 'project_system',
              title: 'My Project Title',
              relatedProject: [
                {
                  '@_system': '',
                  title: 'My Related Project'
                }
              ]
            },
            taxonomicCoverage: [
              {
                taxonId: {
                  '@_provider': '',
                  '#text': 'M-ALAM'
                }
              }
            ]
          }
        }
      });
    });
  });

  describe('parseJSObjectToXMLString', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('transforms a JS Object to an XML string', async () => {
      const mockDBConnection = getMockDBConnection();
      const emlService = new EMLService(mockDBConnection);

      const emlJSObject = {
        '?xml': {
          '@_encoding': 'UTF-8',
          '@_version': '1.0'
        },
        'eml:eml': {
          '@_packageId': 'urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f',
          dataset: {
            '@_system': '',
            title: 'My Dataset Title',
            project: {
              '@_system': 'project_system',
              title: 'My Project Title',
              relatedProject: [
                {
                  '@_system': '',
                  title: 'My Related Project'
                }
              ]
            },
            taxonomicCoverage: [
              {
                taxonId: {
                  '@_provider': '',
                  '#text': 'M-ALAM'
                }
              }
            ]
          }
        }
      };

      const xmlString = emlService.convertJSObjectToXMLString(emlJSObject);

      expect(xmlString).to.eql(
        '<?xml encoding="UTF-8" version="1.0"?><eml:eml packageId="urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f"><dataset system=""><title>My Dataset Title</title><project system="project_system"><title>My Project Title</title><relatedProject system=""><title>My Related Project</title></relatedProject></project><taxonomicCoverage><taxonId provider="">M-ALAM</taxonId></taxonomicCoverage></dataset></eml:eml>'
      );
    });
  });

  describe('getSystemURL', () => {
    it('returns url string when NODE_ENV=local', () => {
      process.env.NODE_ENV = 'local';
      process.env.API_HOST = 'localhost';
      process.env.API_PORT = '1234';

      const mockDBConnection = getMockDBConnection();
      const emlService = new EMLService(mockDBConnection);

      const response = emlService.getSystemURL();

      expect(response).to.eql('http://localhost:1234');
    });

    it('returns url string when NODE_ENV!=local', () => {
      process.env.NODE_ENV = 'dev';
      process.env.API_HOST = 'www.host.com';

      const mockDBConnection = getMockDBConnection();
      const emlService = new EMLService(mockDBConnection);

      const response = emlService.getSystemURL();

      expect(response).to.eql('www.host.com');
    });
  });

  describe('getDatasetSystemURL', () => {
    it('returns url string when NODE_ENV=local', () => {
      process.env.NODE_ENV = 'local';
      process.env.API_HOST = 'localhost';
      process.env.API_PORT = '1234';

      const mockDBConnection = getMockDBConnection();
      const emlService = new EMLService(mockDBConnection);

      const response = emlService.getDatasetSystemURL();

      expect(response).to.eql('http://localhost:1234/datasets');
    });

    it('returns url string when NODE_ENV!=local', () => {
      process.env.NODE_ENV = 'dev';
      process.env.API_HOST = 'www.host.com';

      const mockDBConnection = getMockDBConnection();
      const emlService = new EMLService(mockDBConnection);

      const response = emlService.getDatasetSystemURL();

      expect(response).to.eql('www.host.com/datasets');
    });
  });

  describe('getTaxonomicProviderURL', () => {
    it('returns url string', () => {
      process.env.ELASTICSEARCH_URL = 'www.elastic.com';
      process.env.ELASTICSEARCH_TAXONOMY_INDEX = 'taxonomy_index';

      const mockDBConnection = getMockDBConnection();
      const emlService = new EMLService(mockDBConnection);

      const response = emlService.getTaxonomicProviderURL();

      expect(response).to.eql('www.elastic.com/taxonomy_index');
    });
  });

  describe('getMetadataProviderNode', () => {
    it('returns a metadataProvider object', async () => {
      const mockDBConnection = getMockDBConnection();
      const emlService = new EMLService(mockDBConnection);

      sinon.stub(SystemConstantService.prototype, 'getSystemConstants').resolves([
        { constant_name: 'ORGANIZATION_NAME_FULL', character_value: 'organization name' },
        { constant_name: 'ORGANIZATION_URL', character_value: 'www.organization-url.com' }
      ] as unknown as ISystemConstant[]);

      const response = await emlService.getMetadataProviderNode();

      expect(response).to.eql({
        organizationName: 'organization name',
        onlineUrl: 'www.organization-url.com'
      });
    });

    it('returns an empty metadataProvider object if system constants are not found', async () => {
      const mockDBConnection = getMockDBConnection();
      const emlService = new EMLService(mockDBConnection);

      sinon.stub(SystemConstantService.prototype, 'getSystemConstants').resolves([] as unknown as ISystemConstant[]);

      const response = await emlService.getMetadataProviderNode();

      expect(response).to.eql({
        organizationName: '',
        onlineUrl: ''
      });
    });
  });

  describe('decorateEML', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('decorates the eml', async () => {
      process.env.NODE_ENV = 'dev';
      process.env.API_HOST = 'www.host.com';
      process.env.ELASTICSEARCH_URL = 'www.elastic.com';
      process.env.ELASTICSEARCH_TAXONOMY_INDEX = 'taxonomy_index';

      const mockDBConnection = getMockDBConnection();
      const emlService = new EMLService(mockDBConnection);

      sinon.stub(SystemConstantService.prototype, 'getSystemConstants').resolves([
        { constant_name: 'ORGANIZATION_NAME_FULL', character_value: 'organization name' },
        { constant_name: 'ORGANIZATION_URL', character_value: 'www.organization-url.com' }
      ] as unknown as ISystemConstant[]);

      const emlXMLString = `
        <?xml version="1.0" encoding="UTF-8"?>
            <eml:eml packageId="urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f">
                <dataset system="">
                    <title>
                        My Dataset Title
                    </title>
                    <project system="">
                        <title>
                            My Project Title
                        </title>
                        <relatedProject system="">
                            <title>
                                My Related Project
                            </title>
                        </relatedProject>
                    </project>
                    <taxonomicCoverage>
                        <taxonId provider="">
                            M-ALAM
                        </taxonId>
                    </taxonomicCoverage>
                </dataset>
            </eml:eml>
      `;

      // Generate the sample test object using the real xml convert function
      const emlObject = emlService.convertXMLStringToJSObject(emlXMLString);

      const decoratedEMLObject = await emlService.decorateEML(emlObject);

      expect(decoratedEMLObject).to.eql({
        '?xml': {
          '@_encoding': 'UTF-8',
          '@_version': '1.0'
        },
        'eml:eml': {
          '@_packageId': 'urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f',
          '@_system': 'www.host.com',
          dataset: {
            '@_system': 'www.host.com/datasets',
            metadataProvider: [
              {
                onlineUrl: 'www.organization-url.com',
                organizationName: 'organization name'
              }
            ],
            title: 'My Dataset Title',
            project: {
              '@_system': 'www.host.com/datasets',
              title: 'My Project Title',
              relatedProject: [
                {
                  '@_system': 'www.host.com/datasets',
                  title: 'My Related Project'
                }
              ]
            },
            taxonomicCoverage: [
              {
                taxonId: {
                  '@_provider': 'www.elastic.com/taxonomy_index',
                  '#text': 'M-ALAM'
                }
              }
            ]
          }
        }
      });
    });
  });
});
