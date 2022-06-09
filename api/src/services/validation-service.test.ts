import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IInsertStyleSchema, IStyleModel, ValidationRepository } from '../repositories/validation-repository';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import * as validatorParser from '../utils/media/validation/validation-schema-parser';
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

      const response = await validationService.insertStyleSchema(({} as unknown) as IInsertStyleSchema);

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
        .resolves(({ style_id: 1 } as unknown) as IStyleModel);

      const response = await validationService.getStyleSchemaByStyleId(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ style_id: 1 });
    });
  });

  describe('validateDWCArchiveWithStyleSchema', () => {
    it('should return a false validation with error array', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new ValidationService(mockDBConnection);

      sinon
        .stub(validatorParser, 'ValidationSchemaParser')
        .returns(({} as unknown) as validatorParser.ValidationSchemaParser);

      const mockMediaState = { fileName: 'string', fileErrors: ['error'], isValid: false };

      const mockDWC = {
        isMediaValid: () => {
          return mockMediaState;
        }
      };

      const response = await validationService.validateDWCArchiveWithStyleSchema(
        (mockDWC as unknown) as DWCArchive,
        ({} as unknown) as IStyleModel
      );

      expect(response.validation).to.eql(false);
      expect(response.mediaState.isValid).to.eql(false);
      expect(response.mediaState.fileErrors).to.eql(['error']);
    });

    it('should return a true validation with csvState', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new ValidationService(mockDBConnection);

      sinon
        .stub(validatorParser, 'ValidationSchemaParser')
        .returns(({} as unknown) as validatorParser.ValidationSchemaParser);

      const mockMediaState = { fileName: 'string', fileErrors: [], isValid: true };
      const mockCsvState = [{ headerErrors: [], rowErrors: [] }];

      const mockDWC = {
        isMediaValid: () => {
          return mockMediaState;
        },
        isContentValid: () => {
          return mockCsvState;
        }
      };

      const response = await validationService.validateDWCArchiveWithStyleSchema(
        (mockDWC as unknown) as DWCArchive,
        ({} as unknown) as IStyleModel
      );

      expect(response.validation).to.eql(true);
      expect(response.mediaState.isValid).to.eql(true);
      expect(response.mediaState.fileErrors).to.eql([]);
      if (response.csvState) {
        expect(response.csvState[0].headerErrors).to.eql([]);
        expect(response.csvState[0].rowErrors).to.eql([]);
      }
    });
  });
});
