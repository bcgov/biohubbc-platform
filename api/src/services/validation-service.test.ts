import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IInsertStyleSchema, IStyleModel, ValidationRepository } from '../repositories/validation-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { ValidationService } from './validation-service';

chai.use(sinonChai);

describe('ValidationService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertStyleSchema', () => {
    it('should return style_id on insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new ValidationService(mockDBConnection);

      const repo = sinon.stub(ValidationRepository.prototype, 'insertStyleSchema').resolves({ style_id: 1 });

      const response = await validationService.insertStyleSchema({} as unknown as IInsertStyleSchema);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ style_id: 1 });
    });
  });

  describe('getStyleSchemaByStyleId', () => {
    it('should return style row object', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new ValidationService(mockDBConnection);

      const repo = sinon
        .stub(ValidationRepository.prototype, 'getStyleSchemaByStyleId')
        .resolves({ style_id: 1 } as unknown as IStyleModel);

      const response = await validationService.getStyleSchemaByStyleId(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ style_id: 1 });
    });
  });

  describe('validateProperties', () => {
    it('should throw an error if data properties are missing', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type_name: 'string', required_value: true },
        { name: 'start_date', display_name: '', description: '', type_name: 'datetime', required_value: true }
      ];

      const dataProperties = {
        name: 'project name'
      };

      const validationService = new ValidationService(mockDBConnection);

      expect(() => validationService.validateProperties(properties, dataProperties)).to.throw(
        'Property start_date is required but is null or undefined'
      );
    });

    it('should throw an error if a property type is incorrect', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'count', display_name: '', description: '', type_name: 'number', required_value: true }
      ];

      const dataProperties = { count: 'not a number' };

      const validationService = new ValidationService(mockDBConnection);

      expect(() => validationService.validateProperties(properties, dataProperties)).to.throw(
        'Property count is not of type number'
      );
    });

    it('should throw an error if datetime is invalid', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'start_date', display_name: '', description: '', type_name: 'datetime', required_value: true }
      ];

      const dataProperties = { start_date: 'not a valid date' };

      const validationService = new ValidationService(mockDBConnection);

      expect(() => validationService.validateProperties(properties, dataProperties)).to.throw(
        'Property start_date is not a valid date'
      );
    });

    it('should return true if all data properties are valid', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type_name: 'string', required_value: true },
        { name: 'count', display_name: '', description: '', type_name: 'number', required_value: true },
        { name: 'published', display_name: '', description: '', type_name: 'boolean', required_value: true },
        { name: 'permit', display_name: '', description: '', type_name: 'object', required_value: true },
        { name: 'start_date', display_name: '', description: '', type_name: 'datetime', required_value: true }
      ];

      const dataProperties = {
        name: 'project name',
        count: 10,
        published: true,
        permit: {},
        start_date: '2024-01-01'
      };

      const validationService = new ValidationService(mockDBConnection);

      const result = validationService.validateProperties(properties, dataProperties);

      expect(result).to.be.true;
    });
  });

  describe('getFeatureValidationProperties', () => {
    it('should fetch properties when cache is empty', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new ValidationService(mockDBConnection);

      const mockValidationProperties = [
        { name: 'name', display_name: 'Name', description: '', type_name: 'string', required_value: true }
      ];

      const getFeatureValidationPropertiesStub = sinon
        .stub(ValidationRepository.prototype, 'getFeatureValidationProperties')
        .resolves(mockValidationProperties);

      const result = await validationService.getFeatureValidationProperties('dataset');

      expect(getFeatureValidationPropertiesStub).to.have.been.calledOnceWith('dataset');
      expect(result).to.eql(mockValidationProperties);
    });

    it('should return cached properties if already stored', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new ValidationService(mockDBConnection);

      const cachedProps = [
        { name: 'cached', display_name: 'Cached', description: '', type_name: 'string', required_value: true }
      ];

      validationService.validationPropertiesCache.set('dataset', cachedProps);

      const result = await validationService.getFeatureValidationProperties('dataset');

      expect(result).to.eql(cachedProps);
    });
  });
});
