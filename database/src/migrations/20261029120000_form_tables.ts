import { Knex } from 'knex';

/**
 * Adds the Form tables.
 *
 * A Form lets a submitter enter data directly instead of building a tarball. A form is addressed by its slug, so its
 * URL survives revisions. Its content is not stored here: every form version is joined to its own Blueprint, and the
 * form only decorates that Blueprint's feature types and property assignments with presentation (labels,
 * descriptions, and section row rules).
 *
 * Tables added:
 * - `form` — the form's identity, slug, descriptive metadata, and whether it is public.
 * - `form_version` — a revision of a form and the Blueprint it collects. A draft until `record_effective_date` is set;
 *   immutable once published. At most one draft and one active published version exist per form, so a form has a
 *   single active Blueprint. Revising a published form creates a new version with a new Blueprint, and publishing it
 *   retires the previous version.
 * - `form_version_feature_type` — section presentation for a Blueprint feature type within one version.
 * - `form_version_feature_type_property` — field presentation for a Blueprint property assignment within one version.
 * - `form_team` — the teams whose members may access a form that is not public.
 * - `form_submission` — one filled-in form: the draft a submitter edits, its owning team, and once first submitted the
 *   `submission` it became. A form has many form submissions; each is one submission.
 * - `form_submission_upload` — the immutable snapshot each submit ingests. Every submit creates a new
 *   `submission_upload` under the form submission's submission, so a revision supersedes the previous upload.
 *
 * Every form belongs to a contributor, which owns its submissions and whose codesets its code fields draw from, and
 * has an administration team (`form.team_id`) whose members review and approve its submissions.
 *
 * Section and field order are the Blueprint's `sort` columns. The two presentation tables have no soft delete: they
 * only decorate a draft, are replaced wholesale when the draft is saved, and are never rewritten once published.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Create the form table.
    ----------------------------------------------------------------------------------------
    CREATE TABLE form (
      form_id               integer        GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      slug                  varchar(100)   NOT NULL,
      contributor_id        integer        NOT NULL,
      team_id               uuid           NOT NULL,
      name                  text           NOT NULL,
      description           text,
      is_public             boolean        DEFAULT false NOT NULL,
      record_end_date       date,
      create_date           timestamptz(6) DEFAULT now() NOT NULL,
      create_user           integer        NOT NULL,
      update_date           timestamptz(6),
      update_user           integer,
      revision_count        integer        DEFAULT 0 NOT NULL,
      CONSTRAINT form_pk PRIMARY KEY (form_id),
      CONSTRAINT form_fk1 FOREIGN KEY (contributor_id) REFERENCES contributor(contributor_id),
      CONSTRAINT form_fk2 FOREIGN KEY (team_id) REFERENCES team(team_id)
    );

    -- A slug addresses one active form.
    CREATE UNIQUE INDEX form_nuk1 ON form(slug) WHERE record_end_date IS NULL;
    CREATE INDEX form_idx1 ON form(contributor_id);
    CREATE INDEX form_idx2 ON form(team_id);

    COMMENT ON TABLE form IS 'A form a submitter fills in to submit data without building a tarball. Its content is defined by the Blueprint of its active version.';
    COMMENT ON COLUMN form.form_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN form.slug IS 'A short, stable, URL-safe key for the form, set on creation; unique among active forms. The form is addressed by its slug, so its URL survives revisions.';
    COMMENT ON COLUMN form.contributor_id IS 'Foreign key to the contributor table; the contributor that owns the form''s submissions and whose codesets its code fields draw from. Set on creation.';
    COMMENT ON COLUMN form.team_id IS 'Foreign key to the team table; the form administration team, whose members review and approve the form''s submissions.';
    COMMENT ON COLUMN form.name IS 'Human-readable name of the form.';
    COMMENT ON COLUMN form.description IS 'Human-readable description of the form.';
    COMMENT ON COLUMN form.is_public IS 'Indicates anyone may access the form. When false, access requires an authenticated member of a team linked through form_team.';
    COMMENT ON COLUMN form.record_end_date IS 'The date the form was retired (soft delete); null when the record is active.';
    COMMENT ON COLUMN form.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN form.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN form.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN form.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN form.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_form
      BEFORE INSERT OR UPDATE OR DELETE ON form
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_form
      AFTER INSERT OR UPDATE OR DELETE ON form
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- 2. Create the form_version table.
    ----------------------------------------------------------------------------------------
    CREATE TABLE form_version (
      form_version_id       integer        GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      form_id               integer        NOT NULL,
      blueprint_id          integer        NOT NULL,
      version_number        integer        NOT NULL,
      record_effective_date date,
      record_end_date       date,
      create_date           timestamptz(6) DEFAULT now() NOT NULL,
      create_user           integer        NOT NULL,
      update_date           timestamptz(6),
      update_user           integer,
      revision_count        integer        DEFAULT 0 NOT NULL,
      CONSTRAINT form_version_pk PRIMARY KEY (form_version_id),
      CONSTRAINT form_version_fk1 FOREIGN KEY (form_id) REFERENCES form(form_id),
      CONSTRAINT form_version_fk2 FOREIGN KEY (blueprint_id) REFERENCES blueprint(blueprint_id)
    );

    CREATE UNIQUE INDEX form_version_nuk1 ON form_version(form_id, version_number);

    -- At most one active draft per form.
    CREATE UNIQUE INDEX form_version_nuk2 ON form_version(form_id) WHERE record_effective_date IS NULL AND record_end_date IS NULL;

    -- At most one active published version per form: a form has a single active Blueprint.
    CREATE UNIQUE INDEX form_version_nuk3 ON form_version(form_id) WHERE record_effective_date IS NOT NULL AND record_end_date IS NULL;

    -- Each version has its own Blueprint.
    CREATE UNIQUE INDEX form_version_nuk4 ON form_version(blueprint_id);

    COMMENT ON TABLE form_version IS 'A revision of a form and the Blueprint it collects. A draft while record_effective_date is null; published and immutable once it is set. Publishing a version retires the previously published one.';
    COMMENT ON COLUMN form_version.form_version_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN form_version.form_id IS 'Foreign key to the form table.';
    COMMENT ON COLUMN form_version.blueprint_id IS 'Foreign key to the blueprint table; the Blueprint that defines the content of this version. Unique: a revision gets a new Blueprint.';
    COMMENT ON COLUMN form_version.version_number IS 'The version number of this revision, unique within its form.';
    COMMENT ON COLUMN form_version.record_effective_date IS 'The date the version was published. Null indicates a draft.';
    COMMENT ON COLUMN form_version.record_end_date IS 'The date the version was retired, by publishing a newer version (soft delete); null when the record is active.';
    COMMENT ON COLUMN form_version.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN form_version.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN form_version.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN form_version.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN form_version.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_form_version
      BEFORE INSERT OR UPDATE OR DELETE ON form_version
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_form_version
      AFTER INSERT OR UPDATE OR DELETE ON form_version
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- 3. Create the form_version_feature_type table.
    ----------------------------------------------------------------------------------------
    CREATE TABLE form_version_feature_type (
      form_version_feature_type_id integer        GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      form_version_id              integer        NOT NULL,
      blueprint_feature_type_id    integer        NOT NULL,
      label                        text           NOT NULL,
      description                  text,
      required_value               boolean        DEFAULT false NOT NULL,
      allow_multiple               boolean        DEFAULT false NOT NULL,
      create_date                  timestamptz(6) DEFAULT now() NOT NULL,
      create_user                  integer        NOT NULL,
      update_date                  timestamptz(6),
      update_user                  integer,
      revision_count               integer        DEFAULT 0 NOT NULL,
      CONSTRAINT form_version_feature_type_pk PRIMARY KEY (form_version_feature_type_id),
      CONSTRAINT form_version_feature_type_fk1 FOREIGN KEY (form_version_id) REFERENCES form_version(form_version_id),
      CONSTRAINT form_version_feature_type_fk2 FOREIGN KEY (blueprint_feature_type_id) REFERENCES blueprint_feature_type(blueprint_feature_type_id)
    );

    CREATE UNIQUE INDEX form_version_feature_type_nuk1 ON form_version_feature_type(form_version_id, blueprint_feature_type_id);
    CREATE INDEX form_version_feature_type_idx1 ON form_version_feature_type(blueprint_feature_type_id);

    COMMENT ON TABLE form_version_feature_type IS 'Presentation of a Blueprint feature type as a section of one form version. Replaced wholesale when a draft is saved.';
    COMMENT ON COLUMN form_version_feature_type.form_version_feature_type_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN form_version_feature_type.form_version_id IS 'Foreign key to the form_version table; the version this section belongs to.';
    COMMENT ON COLUMN form_version_feature_type.blueprint_feature_type_id IS 'Foreign key to the blueprint_feature_type table; the feature type this section collects.';
    COMMENT ON COLUMN form_version_feature_type.label IS 'Display label of the section.';
    COMMENT ON COLUMN form_version_feature_type.description IS 'Display description of the section.';
    COMMENT ON COLUMN form_version_feature_type.required_value IS 'Indicates the section requires at least one row; when false the section accepts zero rows.';
    COMMENT ON COLUMN form_version_feature_type.allow_multiple IS 'Indicates the section accepts more than one row; when false the section accepts at most one row.';
    COMMENT ON COLUMN form_version_feature_type.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN form_version_feature_type.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN form_version_feature_type.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN form_version_feature_type.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN form_version_feature_type.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_form_version_feature_type
      BEFORE INSERT OR UPDATE OR DELETE ON form_version_feature_type
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_form_version_feature_type
      AFTER INSERT OR UPDATE OR DELETE ON form_version_feature_type
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- 4. Create the form_version_feature_type_property table.
    ----------------------------------------------------------------------------------------
    CREATE TABLE form_version_feature_type_property (
      form_version_feature_type_property_id integer        GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      form_version_id                       integer        NOT NULL,
      blueprint_feature_type_property_id    integer        NOT NULL,
      label                                 text           NOT NULL,
      description                           text,
      contributor_codeset_id                integer,
      create_date                           timestamptz(6) DEFAULT now() NOT NULL,
      create_user                           integer        NOT NULL,
      update_date                           timestamptz(6),
      update_user                           integer,
      revision_count                        integer        DEFAULT 0 NOT NULL,
      CONSTRAINT form_version_feature_type_property_pk PRIMARY KEY (form_version_feature_type_property_id),
      CONSTRAINT form_version_feature_type_property_fk1 FOREIGN KEY (form_version_id) REFERENCES form_version(form_version_id),
      CONSTRAINT form_version_feature_type_property_fk2 FOREIGN KEY (blueprint_feature_type_property_id) REFERENCES blueprint_feature_type_property(blueprint_feature_type_property_id),
      CONSTRAINT form_version_feature_type_property_fk3 FOREIGN KEY (contributor_codeset_id) REFERENCES contributor_codeset(contributor_codeset_id)
    );

    CREATE UNIQUE INDEX form_version_feature_type_property_nuk1 ON form_version_feature_type_property(form_version_id, blueprint_feature_type_property_id);
    CREATE INDEX form_version_feature_type_property_idx1 ON form_version_feature_type_property(blueprint_feature_type_property_id);
    CREATE INDEX form_version_feature_type_property_idx2 ON form_version_feature_type_property(contributor_codeset_id);

    COMMENT ON TABLE form_version_feature_type_property IS 'Presentation of a Blueprint property assignment as a field of one form version. Replaced wholesale when a draft is saved.';
    COMMENT ON COLUMN form_version_feature_type_property.form_version_feature_type_property_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN form_version_feature_type_property.form_version_id IS 'Foreign key to the form_version table; the version this field belongs to.';
    COMMENT ON COLUMN form_version_feature_type_property.blueprint_feature_type_property_id IS 'Foreign key to the blueprint_feature_type_property table; the property assignment this field collects.';
    COMMENT ON COLUMN form_version_feature_type_property.label IS 'Display label of the field.';
    COMMENT ON COLUMN form_version_feature_type_property.description IS 'Display description of the field.';
    COMMENT ON COLUMN form_version_feature_type_property.contributor_codeset_id IS 'Foreign key to the contributor_codeset table; for a code-valued field, the codeset of the form''s contributor whose codes the field accepts. Null for other fields.';
    COMMENT ON COLUMN form_version_feature_type_property.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN form_version_feature_type_property.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN form_version_feature_type_property.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN form_version_feature_type_property.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN form_version_feature_type_property.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_form_version_feature_type_property
      BEFORE INSERT OR UPDATE OR DELETE ON form_version_feature_type_property
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_form_version_feature_type_property
      AFTER INSERT OR UPDATE OR DELETE ON form_version_feature_type_property
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- 5. Create the form_team table.
    ----------------------------------------------------------------------------------------
    CREATE TABLE form_team (
      form_team_id    integer        GENERATED ALWAYS AS IDENTITY NOT NULL,
      form_id         integer        NOT NULL,
      team_id         uuid           NOT NULL,
      record_end_date timestamptz(6),
      create_date     timestamptz(6) DEFAULT now() NOT NULL,
      create_user     integer        NOT NULL,
      update_date     timestamptz(6),
      update_user     integer,
      revision_count  integer        DEFAULT 0 NOT NULL,
      CONSTRAINT form_team_pk PRIMARY KEY (form_team_id),
      CONSTRAINT form_team_fk1 FOREIGN KEY (form_id) REFERENCES form(form_id),
      CONSTRAINT form_team_fk2 FOREIGN KEY (team_id) REFERENCES team(team_id)
    );

    CREATE UNIQUE INDEX form_team_nuk1 ON form_team(form_id, team_id) WHERE record_end_date IS NULL;
    CREATE INDEX form_team_idx1 ON form_team(team_id);

    COMMENT ON TABLE form_team IS 'Join table linking forms to teams for team-based access control. Members of a linked team may access a form that is not public.';
    COMMENT ON COLUMN form_team.form_team_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN form_team.form_id IS 'Foreign key to the form table.';
    COMMENT ON COLUMN form_team.team_id IS 'Foreign key to the team table.';
    COMMENT ON COLUMN form_team.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN form_team.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN form_team.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN form_team.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN form_team.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN form_team.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_form_team
      BEFORE INSERT OR UPDATE OR DELETE ON form_team
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_form_team
      AFTER INSERT OR UPDATE OR DELETE ON form_team
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- 6. Create the form_submission table.
    ----------------------------------------------------------------------------------------
    CREATE TYPE form_submission_status AS ENUM ('draft', 'submitted');

    COMMENT ON TYPE form_submission_status IS 'Lifecycle of a form submission: draft=being edited, not yet submitted or revised since the last submit; submitted=its current content has been submitted.';

    CREATE TABLE form_submission (
      form_submission_id integer                GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      uuid               uuid                   DEFAULT public.gen_random_uuid() NOT NULL,
      form_id            integer                NOT NULL,
      form_version_id    integer                NOT NULL,
      team_id            uuid                   NOT NULL,
      submission_id      integer,
      status             form_submission_status DEFAULT 'draft' NOT NULL,
      data               jsonb                  NOT NULL,
      submitted_date     timestamptz(6),
      record_end_date    timestamptz(6),
      create_date        timestamptz(6)         DEFAULT now() NOT NULL,
      create_user        integer                NOT NULL,
      update_date        timestamptz(6),
      update_user        integer,
      revision_count     integer                DEFAULT 0 NOT NULL,
      CONSTRAINT form_submission_pk PRIMARY KEY (form_submission_id),
      CONSTRAINT form_submission_fk1 FOREIGN KEY (form_id) REFERENCES form(form_id),
      CONSTRAINT form_submission_fk2 FOREIGN KEY (form_version_id) REFERENCES form_version(form_version_id),
      CONSTRAINT form_submission_fk3 FOREIGN KEY (team_id) REFERENCES team(team_id),
      CONSTRAINT form_submission_fk4 FOREIGN KEY (submission_id) REFERENCES submission(submission_id)
    );

    CREATE UNIQUE INDEX form_submission_nuk1 ON form_submission(uuid);
    -- A submission is the result of exactly one form submission.
    CREATE UNIQUE INDEX form_submission_nuk2 ON form_submission(submission_id) WHERE submission_id IS NOT NULL;
    CREATE INDEX form_submission_idx1 ON form_submission(form_id, status) WHERE record_end_date IS NULL;
    CREATE INDEX form_submission_idx2 ON form_submission(team_id);
    CREATE INDEX form_submission_idx3 ON form_submission(form_version_id);

    COMMENT ON TABLE form_submission IS 'One filled-in form. Holds the draft the submitter edits and, once first submitted, the submission it became. Each submit adds a submission_upload to that submission.';
    COMMENT ON COLUMN form_submission.form_submission_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN form_submission.uuid IS 'Stable identifier used to address the form submission.';
    COMMENT ON COLUMN form_submission.form_id IS 'Foreign key to the form table.';
    COMMENT ON COLUMN form_submission.form_version_id IS 'Foreign key to the form_version table; the published version the draft was last saved against.';
    COMMENT ON COLUMN form_submission.team_id IS 'Foreign key to the team table; the team whose members may edit and submit the form submission.';
    COMMENT ON COLUMN form_submission.submission_id IS 'Foreign key to the submission table; the submission created on first submit. Null while never submitted.';
    COMMENT ON COLUMN form_submission.status IS 'Whether the current content has been submitted. Editing a submitted form submission returns it to draft.';
    COMMENT ON COLUMN form_submission.data IS 'The draft document: rows of field values per section, each row with a stable source identifier.';
    COMMENT ON COLUMN form_submission.submitted_date IS 'The datetime the form submission was last submitted.';
    COMMENT ON COLUMN form_submission.record_end_date IS 'Timestamp for soft delete; null when the record is active.';
    COMMENT ON COLUMN form_submission.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN form_submission.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN form_submission.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN form_submission.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN form_submission.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_form_submission
      BEFORE INSERT OR UPDATE OR DELETE ON form_submission
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_form_submission
      AFTER INSERT OR UPDATE OR DELETE ON form_submission
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    ----------------------------------------------------------------------------------------
    -- 7. Create the form_submission_upload table.
    ----------------------------------------------------------------------------------------
    CREATE TABLE form_submission_upload (
      submission_upload_id uuid           NOT NULL,
      form_submission_id   integer        NOT NULL,
      form_version_id      integer        NOT NULL,
      data                 jsonb          NOT NULL,
      features             jsonb          NOT NULL,
      create_date          timestamptz(6) DEFAULT now() NOT NULL,
      create_user          integer        NOT NULL,
      update_date          timestamptz(6),
      update_user          integer,
      revision_count       integer        DEFAULT 0 NOT NULL,
      CONSTRAINT form_submission_upload_pk PRIMARY KEY (submission_upload_id),
      CONSTRAINT form_submission_upload_fk1 FOREIGN KEY (submission_upload_id) REFERENCES submission_upload(submission_upload_id),
      CONSTRAINT form_submission_upload_fk2 FOREIGN KEY (form_submission_id) REFERENCES form_submission(form_submission_id),
      CONSTRAINT form_submission_upload_fk3 FOREIGN KEY (form_version_id) REFERENCES form_version(form_version_id)
    );

    CREATE INDEX form_submission_upload_idx1 ON form_submission_upload(form_submission_id);
    CREATE INDEX form_submission_upload_idx2 ON form_submission_upload(form_version_id);

    COMMENT ON TABLE form_submission_upload IS 'The immutable content of one submit of a form submission: the source of its submission_upload instead of a tarball.';
    COMMENT ON COLUMN form_submission_upload.submission_upload_id IS 'Primary key and foreign key to the submission_upload table; the upload this submit created.';
    COMMENT ON COLUMN form_submission_upload.form_submission_id IS 'Foreign key to the form_submission table.';
    COMMENT ON COLUMN form_submission_upload.form_version_id IS 'Foreign key to the form_version table; the published version the content was submitted against.';
    COMMENT ON COLUMN form_submission_upload.data IS 'The draft document as submitted, shown to reviewers.';
    COMMENT ON COLUMN form_submission_upload.features IS 'The submitted features, in the flattened shape tarball features use, which ingestion persists.';
    COMMENT ON COLUMN form_submission_upload.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN form_submission_upload.create_user IS 'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN form_submission_upload.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN form_submission_upload.update_user IS 'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN form_submission_upload.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_form_submission_upload
      BEFORE INSERT OR UPDATE OR DELETE ON form_submission_upload
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_form_submission_upload
      AFTER INSERT OR UPDATE OR DELETE ON form_submission_upload
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

/**
 * Roll back the Form tables and all associated objects.
 *
 * Drop order: submission uploads and submissions first, then team links and presentation tables, then versions and
 * forms.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_form_submission_upload ON form_submission_upload;
    DROP TRIGGER IF EXISTS audit_form_submission_upload ON form_submission_upload;
    DROP TRIGGER IF EXISTS journal_form_submission ON form_submission;
    DROP TRIGGER IF EXISTS audit_form_submission ON form_submission;
    DROP TRIGGER IF EXISTS journal_form_team ON form_team;
    DROP TRIGGER IF EXISTS audit_form_team ON form_team;
    DROP TRIGGER IF EXISTS journal_form_version_feature_type_property ON form_version_feature_type_property;
    DROP TRIGGER IF EXISTS audit_form_version_feature_type_property ON form_version_feature_type_property;
    DROP TRIGGER IF EXISTS journal_form_version_feature_type ON form_version_feature_type;
    DROP TRIGGER IF EXISTS audit_form_version_feature_type ON form_version_feature_type;
    DROP TRIGGER IF EXISTS journal_form_version ON form_version;
    DROP TRIGGER IF EXISTS audit_form_version ON form_version;
    DROP TRIGGER IF EXISTS journal_form ON form;
    DROP TRIGGER IF EXISTS audit_form ON form;

    DROP TABLE IF EXISTS form_submission_upload;
    DROP TABLE IF EXISTS form_submission;
    DROP TYPE IF EXISTS form_submission_status;
    DROP TABLE IF EXISTS form_team;
    DROP TABLE IF EXISTS form_version_feature_type_property;
    DROP TABLE IF EXISTS form_version_feature_type;
    DROP TABLE IF EXISTS form_version;
    DROP TABLE IF EXISTS form;
  `);
}
