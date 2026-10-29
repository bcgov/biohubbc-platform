import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError, ApiNotFoundError, ApiValidationError } from '../errors/api-error';
import { AdminBlueprint, Blueprint } from '../models/blueprint';
import { AdministrativeContributor } from '../models/contributor';
import { CreateForm, Form, FormFieldRow, FormSectionRow, FormVersion, SaveFormVersion } from '../models/form';
import { FormService } from './form-service';

chai.use(sinonChai);

const mockForm: Form = {
  form_id: 1,
  slug: 'caribou',
  contributor_id: 3,
  team_id: '22222222-2222-2222-2222-222222222222',
  name: 'Caribou',
  description: null,
  is_public: false,
  record_end_date: null
};

const mockDraftVersion: FormVersion = {
  form_version_id: 2,
  form_id: 1,
  blueprint_id: 4,
  version_number: 2,
  record_effective_date: null,
  record_end_date: null
};

const mockPublishedVersion: FormVersion = {
  ...mockDraftVersion,
  form_version_id: 5,
  blueprint_id: 6,
  version_number: 1,
  record_effective_date: '2026-10-29'
};

const mockBlueprint: Blueprint = {
  blueprint_id: 4,
  name: 'Caribou',
  version_number: 9,
  description: null,
  is_default: false,
  parent_blueprint_id: null,
  record_effective_date: null,
  record_end_date: null
};

const mockSectionRow: FormSectionRow = {
  blueprint_feature_type_id: 10,
  feature_type_id: 100,
  feature_type_name: 'observation',
  feature_type_display_name: 'Observation',
  label: 'Observation',
  description: null,
  required_value: true,
  allow_multiple: true,
  sort: 0
};

const mockFieldRow: FormFieldRow = {
  blueprint_feature_type_property_id: 20,
  blueprint_feature_type_id: 10,
  feature_property_id: 200,
  feature_property_name: 'count',
  feature_property_display_name: 'Count',
  type_name: 'number',
  label: 'Count',
  description: null,
  contributor_codeset_id: null,
  sort: 0
};

const makeLayout = (): SaveFormVersion => ({
  name: 'Caribou',
  description: null,
  isPublic: false,
  sections: [
    {
      featureTypeId: 100,
      label: 'Observation',
      description: null,
      requiredValue: true,
      allowMultiple: true,
      fields: [{ featurePropertyId: 200, label: 'Count', description: null, contributorCodesetId: null }]
    }
  ]
});

const makeCreateForm = (): CreateForm => ({ slug: 'caribou', contributorId: 3, ...makeLayout() });

/**
 * Stub every dependency of a layout save and read with resolving defaults.
 *
 * @param service Service under test.
 * @param formVersion Version returned by version reads.
 * @returns The stubs callers assert against.
 */
const stubLayout = (service: FormService, formVersion: FormVersion) => {
  sinon.stub(service.featureTypeService, 'getActiveFeatureTypeIds').resolves([100]);
  sinon
    .stub(service.featurePropertyService, 'getActiveFeaturePropertyTypes')
    .resolves([{ feature_property_id: 200, type_name: 'number' }]);
  sinon.stub(service.contributorCodesetService, 'getContributorCodesetsByContributorId').resolves([]);
  sinon.stub(service.formRepository, 'getForm').resolves(mockForm);
  sinon.stub(service.formVersionFeatureTypeRepository, 'getFormSections').resolves([mockSectionRow]);
  sinon.stub(service.formVersionFeatureTypePropertyRepository, 'getFormFields').resolves([mockFieldRow]);

  return {
    getFormVersion: sinon.stub(service.formVersionRepository, 'getFormVersion').resolves(formVersion),
    lock: sinon.stub(service.blueprintService, 'lockEditableBlueprint').resolves('2026-10-29'),
    ensureTypes: sinon
      .stub(service.blueprintFeatureTypeService, 'ensureBlueprintFeatureTypes')
      .resolves([{ blueprint_feature_type_id: 10, feature_type_id: 100 }]),
    deleteTypes: sinon.stub(service.blueprintFeatureTypeService, 'deleteBlueprintFeatureTypesNotIn').resolves(),
    ensureProperties: sinon
      .stub(service.blueprintFeatureTypePropertyService, 'ensureBlueprintFeatureTypeProperties')
      .resolves([{ blueprint_feature_type_property_id: 20, blueprint_feature_type_id: 10, feature_property_id: 200 }]),
    deleteProperties: sinon
      .stub(service.blueprintFeatureTypePropertyService, 'deleteBlueprintFeatureTypePropertiesNotIn')
      .resolves(),
    deleteSections: sinon.stub(service.formVersionFeatureTypeRepository, 'deleteFormSections').resolves(),
    deleteFields: sinon.stub(service.formVersionFeatureTypePropertyRepository, 'deleteFormFields').resolves(),
    insertSections: sinon.stub(service.formVersionFeatureTypeRepository, 'insertFormSections').resolves(),
    insertFields: sinon.stub(service.formVersionFeatureTypePropertyRepository, 'insertFormFields').resolves()
  };
};

describe('FormService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getFormVersionLayout', () => {
    it('nests fields under their section', async () => {
      const service = new FormService(getMockDBConnection());
      stubLayout(service, mockDraftVersion);

      const result = await service.getFormVersionLayout(1, 2);

      expect(result.form).to.eql(mockForm);
      expect(result.sections).to.eql([{ ...mockSectionRow, fields: [mockFieldRow] }]);
    });

    it('throws when the version is not in the form', async () => {
      const service = new FormService(getMockDBConnection());
      sinon.stub(service.formRepository, 'getForm').resolves(mockForm);
      sinon.stub(service.formVersionRepository, 'getFormVersion').resolves(undefined);

      try {
        await service.getFormVersionLayout(1, 99);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiNotFoundError);
      }
    });
  });

  describe('getPublishedFormBySlug', () => {
    it('throws when the form has no published version', async () => {
      const service = new FormService(getMockDBConnection());
      sinon.stub(service.formRepository, 'findActiveFormBySlug').resolves(mockForm);
      sinon.stub(service.formVersionRepository, 'getPublishedFormVersion').resolves(undefined);

      try {
        await service.getPublishedFormBySlug('caribou');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiNotFoundError);
      }
    });
  });

  describe('isUserAuthorizedForForm', () => {
    it('allows anyone to access a public form', async () => {
      const service = new FormService(getMockDBConnection());
      sinon.stub(service.formRepository, 'findActiveFormBySlug').resolves({ ...mockForm, is_public: true });
      const teamCheck = sinon.stub(service.formTeamRepository, 'isUserAuthorizedForForm');

      expect(await service.isUserAuthorizedForForm('caribou', null)).to.be.true;
      expect(teamCheck).not.to.have.been.called;
    });

    it('denies an anonymous request to a protected form', async () => {
      const service = new FormService(getMockDBConnection());
      sinon.stub(service.formRepository, 'findActiveFormBySlug').resolves(mockForm);

      expect(await service.isUserAuthorizedForForm('caribou', null)).to.be.false;
    });

    it('requires team membership for a protected form', async () => {
      const service = new FormService(getMockDBConnection());
      sinon.stub(service.formRepository, 'findActiveFormBySlug').resolves(mockForm);
      const teamCheck = sinon.stub(service.formTeamRepository, 'isUserAuthorizedForForm').resolves(false);

      expect(await service.isUserAuthorizedForForm('caribou', 7)).to.be.false;
      expect(teamCheck).to.have.been.calledOnceWith(1, 7);
    });

    it('lets an unknown slug through so it is answered with not found', async () => {
      const service = new FormService(getMockDBConnection());
      sinon.stub(service.formRepository, 'findActiveFormBySlug').resolves(undefined);

      expect(await service.isUserAuthorizedForForm('missing', null)).to.be.true;
    });
  });

  describe('createForm', () => {
    it('joins the first version to a new blueprint and writes composition and presentation', async () => {
      const service = new FormService(getMockDBConnection({ systemUserId: () => 9 }));
      const stubs = stubLayout(service, mockDraftVersion);
      const getContributor = sinon
        .stub(service.contributorService, 'getAdministrativeContributor')
        .resolves({} as AdministrativeContributor);
      const createTeam = sinon
        .stub(service.teamService, 'createTeam')
        .resolves({ team_id: mockForm.team_id, name: 'team', description: null, member_count: 1 });
      const createBlueprint = sinon.stub(service.blueprintService, 'createBlueprint').resolves(mockBlueprint);
      sinon.stub(service.formRepository, 'findActiveFormBySlug').resolves(undefined);
      const insertForm = sinon.stub(service.formRepository, 'insertForm').resolves(mockForm);
      const insertVersion = sinon.stub(service.formVersionRepository, 'insertFormVersion').resolves(mockDraftVersion);

      await service.createForm(makeCreateForm());

      expect(createBlueprint).to.have.been.calledBefore(insertForm);
      expect(getContributor).to.have.been.calledOnceWith(3);
      expect(createTeam.firstCall.args[0].system_user_ids).to.eql([9]);
      expect(insertForm).to.have.been.calledOnceWith({
        slug: 'caribou',
        contributorId: 3,
        teamId: mockForm.team_id,
        name: 'Caribou',
        description: null,
        isPublic: false
      });
      expect(insertVersion).to.have.been.calledOnceWith(1, 4);
      expect(stubs.ensureTypes).to.have.been.calledOnceWith(4, [{ featureTypeId: 100, sort: 0 }]);
      expect(stubs.deleteTypes).to.have.been.calledOnceWith(4, [100], '2026-10-29');
      expect(stubs.insertSections).to.have.been.calledOnceWith([
        {
          formVersionId: 2,
          blueprintFeatureTypeId: 10,
          label: 'Observation',
          description: null,
          requiredValue: true,
          allowMultiple: true
        }
      ]);
      expect(stubs.insertFields).to.have.been.calledOnceWith([
        {
          formVersionId: 2,
          blueprintFeatureTypePropertyId: 20,
          label: 'Count',
          description: null,
          contributorCodesetId: null
        }
      ]);
    });

    it('rejects a slug an active form already uses', async () => {
      const service = new FormService(getMockDBConnection());
      stubLayout(service, mockDraftVersion);
      sinon.stub(service.contributorService, 'getAdministrativeContributor').resolves({} as AdministrativeContributor);
      sinon.stub(service.blueprintService, 'createBlueprint').resolves(mockBlueprint);
      sinon.stub(service.formRepository, 'findActiveFormBySlug').resolves(mockForm);
      const insertForm = sinon.stub(service.formRepository, 'insertForm');

      try {
        await service.createForm(makeCreateForm());
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiConflictError);
        expect(insertForm).not.to.have.been.called;
      }
    });

    it('rejects a feature type added twice', async () => {
      const service = new FormService(getMockDBConnection());
      sinon.stub(service.contributorService, 'getAdministrativeContributor').resolves({} as AdministrativeContributor);
      const data = makeCreateForm();
      data.sections.push({ ...data.sections[0] });

      try {
        await service.createForm(data);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiValidationError);
      }
    });
  });

  describe('validateFormSections', () => {
    it('requires a codeset of the form contributor on a code field', async () => {
      const service = new FormService(getMockDBConnection());
      stubLayout(service, mockDraftVersion);
      (service.featurePropertyService.getActiveFeaturePropertyTypes as sinon.SinonStub).resolves([
        { feature_property_id: 200, type_name: 'code' }
      ]);
      (service.contributorCodesetService.getContributorCodesetsByContributorId as sinon.SinonStub).resolves([
        {
          contributor_codeset_id: 50,
          contributor_id: 3,
          key: 'sex',
          label: 'Sex',
          description: null,
          external_id: null
        }
      ]);
      const layout = makeLayout();
      layout.sections[0].fields[0].contributorCodesetId = 51;

      try {
        await service.updateFormVersion(1, 2, layout);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiValidationError);
      }
    });

    it('rejects a property type a form cannot collect', async () => {
      const service = new FormService(getMockDBConnection());
      stubLayout(service, mockDraftVersion);
      (service.featurePropertyService.getActiveFeaturePropertyTypes as sinon.SinonStub).resolves([
        { feature_property_id: 200, type_name: 'geometry' }
      ]);

      try {
        await service.updateFormVersion(1, 2, makeLayout());
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiValidationError);
      }
    });
  });

  describe('updateFormVersion', () => {
    it('takes the lock before reading the version lifecycle it checks', async () => {
      const service = new FormService(getMockDBConnection());
      const stubs = stubLayout(service, mockDraftVersion);
      sinon.stub(service.formRepository, 'updateForm').resolves(mockForm);
      sinon.stub(service.blueprintService, 'updateBlueprint').resolves(mockBlueprint);

      await service.updateFormVersion(1, 2, makeLayout());

      expect(stubs.lock).to.have.been.calledOnceWith(4);
      expect(stubs.lock.firstCall.calledBefore(stubs.getFormVersion.secondCall)).to.be.true;
      expect(stubs.deleteFields).to.have.been.calledOnceWith(2);
      expect(stubs.deleteSections).to.have.been.calledOnceWith(2);
    });

    it('scopes removal to the version blueprint when every section is removed', async () => {
      const service = new FormService(getMockDBConnection());
      const stubs = stubLayout(service, mockDraftVersion);
      sinon.stub(service.formRepository, 'updateForm').resolves(mockForm);
      sinon.stub(service.blueprintService, 'updateBlueprint').resolves(mockBlueprint);

      await service.updateFormVersion(1, 2, { ...makeLayout(), sections: [] });

      expect(stubs.deleteProperties).to.have.been.calledOnceWith(4, [], '2026-10-29');
      expect(stubs.deleteTypes).to.have.been.calledOnceWith(4, [], '2026-10-29');
    });

    it('rejects a published version', async () => {
      const service = new FormService(getMockDBConnection());
      stubLayout(service, mockPublishedVersion);
      const updateForm = sinon.stub(service.formRepository, 'updateForm');

      try {
        await service.updateFormVersion(1, 5, makeLayout());
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiConflictError);
        expect(updateForm).not.to.have.been.called;
      }
    });
  });

  describe('createFormVersion', () => {
    it('copies the published blueprint and presentation onto a new draft version', async () => {
      const service = new FormService(getMockDBConnection());
      stubLayout(service, mockDraftVersion);
      sinon.stub(service.formVersionRepository, 'getPublishedFormVersion').resolves(mockPublishedVersion);
      const createBlueprintVersion = sinon
        .stub(service.blueprintVersionService, 'createBlueprintVersion')
        .resolves(mockBlueprint as AdminBlueprint);
      sinon.stub(service.formVersionRepository, 'getDraftFormVersion').resolves(undefined);
      const insertVersion = sinon.stub(service.formVersionRepository, 'insertFormVersion').resolves(mockDraftVersion);
      const copySections = sinon.stub(service.formVersionFeatureTypeRepository, 'copyFormSections').resolves();
      const copyFields = sinon.stub(service.formVersionFeatureTypePropertyRepository, 'copyFormFields').resolves();

      await service.createFormVersion(1);

      expect(createBlueprintVersion).to.have.been.calledOnceWith(6, {});
      expect(insertVersion).to.have.been.calledOnceWith(1, 4);
      expect(copySections).to.have.been.calledOnceWith(5, 2);
      expect(copyFields).to.have.been.calledOnceWith(5, 2);
    });

    it('rejects a form that already has a draft', async () => {
      const service = new FormService(getMockDBConnection());
      sinon.stub(service.formRepository, 'getForm').resolves(mockForm);
      sinon.stub(service.formVersionRepository, 'getPublishedFormVersion').resolves(mockPublishedVersion);
      sinon.stub(service.blueprintVersionService, 'createBlueprintVersion').resolves(mockBlueprint as AdminBlueprint);
      sinon.stub(service.formVersionRepository, 'getDraftFormVersion').resolves(mockDraftVersion);
      const insertVersion = sinon.stub(service.formVersionRepository, 'insertFormVersion');

      try {
        await service.createFormVersion(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiConflictError);
        expect(insertVersion).not.to.have.been.called;
      }
    });

    it('rejects a form that has never been published', async () => {
      const service = new FormService(getMockDBConnection());
      sinon.stub(service.formRepository, 'getForm').resolves(mockForm);
      sinon.stub(service.formVersionRepository, 'getPublishedFormVersion').resolves(undefined);

      try {
        await service.createFormVersion(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiConflictError);
      }
    });
  });

  describe('publishFormVersion', () => {
    it('retires the previous version and its blueprint before publishing the revision', async () => {
      const service = new FormService(getMockDBConnection());
      stubLayout(service, mockDraftVersion);
      sinon.stub(service.formVersionRepository, 'getPublishedFormVersion').resolves(mockPublishedVersion);
      const retireVersion = sinon.stub(service.formVersionRepository, 'retireFormVersion').resolves();
      const retireBlueprint = sinon.stub(service.blueprintService, 'retireBlueprint').resolves(mockBlueprint);
      const publishBlueprint = sinon.stub(service.blueprintService, 'publishBlueprint').resolves(mockBlueprint);
      const publishVersion = sinon.stub(service.formVersionRepository, 'publishFormVersion').resolves();

      await service.publishFormVersion(1, 2);

      expect(retireVersion).to.have.been.calledOnceWith(5);
      expect(retireBlueprint).to.have.been.calledOnceWith(6);
      expect(retireVersion).to.have.been.calledBefore(publishVersion);
      expect(publishBlueprint).to.have.been.calledOnceWith(4, { is_default: false });
      expect(publishVersion).to.have.been.calledOnceWith(2);
    });

    it('rejects a section without fields', async () => {
      const service = new FormService(getMockDBConnection());
      stubLayout(service, mockDraftVersion);
      (service.formVersionFeatureTypePropertyRepository.getFormFields as sinon.SinonStub).resolves([]);
      const publishBlueprint = sinon.stub(service.blueprintService, 'publishBlueprint');

      try {
        await service.publishFormVersion(1, 2);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiValidationError);
        expect(publishBlueprint).not.to.have.been.called;
      }
    });
  });

  describe('updateFormTeams', () => {
    it('ends links not retained, then links the requested teams once each', async () => {
      const service = new FormService(getMockDBConnection());
      sinon.stub(service.formRepository, 'getForm').resolves(mockForm);
      const deleteTeams = sinon.stub(service.formTeamRepository, 'deleteFormTeamsNotIn').resolves();
      const insertTeams = sinon.stub(service.formTeamRepository, 'insertFormTeams').resolves();
      sinon.stub(service.formTeamRepository, 'getFormTeams').resolves([]);

      await service.updateFormTeams(1, ['a', 'a', 'b']);

      expect(deleteTeams).to.have.been.calledOnceWith(1, ['a', 'b']);
      expect(insertTeams).to.have.been.calledOnceWith(1, ['a', 'b']);
      expect(deleteTeams).to.have.been.calledBefore(insertTeams);
    });
  });

  describe('codesets', () => {
    it("lists the codesets of the form's contributor", async () => {
      const service = new FormService(getMockDBConnection());
      sinon.stub(service.formRepository, 'findActiveFormBySlug').resolves(mockForm);
      const result = { codesets: [], pagination: { total: 0, per_page: 10, current_page: 1, last_page: 1 } };
      const listStub = sinon
        .stub(service.contributorCodesetService, 'listAdministrativeContributorCodesets')
        .resolves(result);

      expect(await service.getFormCodesets('caribou', { page: 1, limit: 10 })).to.eql(result);
      expect(listStub).to.have.been.calledOnceWith(3, { page: 1, limit: 10 });
    });

    it("scopes codeset codes to the form's contributor", async () => {
      const service = new FormService(getMockDBConnection());
      sinon.stub(service.formRepository, 'findActiveFormBySlug').resolves(mockForm);
      const listStub = sinon
        .stub(service.contributorCodesetCodeService, 'listAdministrativeContributorCodesetCodes')
        .resolves({ codes: [], pagination: { total: 0, per_page: 10, current_page: 1, last_page: 1 } });

      await service.getFormCodesetCodes('caribou', 50, { page: 1, limit: 10 });

      expect(listStub).to.have.been.calledOnceWith(
        { contributorId: 3, contributorCodesetId: 50 },
        { page: 1, limit: 10 }
      );
    });

    it('throws when no active form uses the slug', async () => {
      const service = new FormService(getMockDBConnection());
      sinon.stub(service.formRepository, 'findActiveFormBySlug').resolves(undefined);

      try {
        await service.getFormCodesets('missing', { page: 1, limit: 10 });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiNotFoundError);
      }
    });
  });
});
