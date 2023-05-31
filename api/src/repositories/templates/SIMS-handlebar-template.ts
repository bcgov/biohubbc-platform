export const simsHandlebarsTemplate = `
  <div class="hbr-container">

  <!-- HEADER -->
    {{#if eml:eml.dataset.title}}
      <div class="hbr-header">
        <div class="hbr-header-title-primary"> {{eml:eml.dataset.title}}</div>

        {{#each eml:eml.additionalMetadata as | amd |}}
          {{#with (lookup amd.metadata "types") as | projectType | ~}}
            {{#ifCond amd.describes '===' @root.eml:eml.dataset.[@_id]}}
              <div class="hbr-header-title-secondary">Species Inventory {{#capFirst projectType.type}}{{/capFirst}}</div>
            {{/ifCond}}
          {{/with}}
        {{/each}}
      </div>
    {{/if}}

    <!-- DETAILS -->
    <div class="details-container">
      <div class="details-container-title">
        Details
      </div>
      
      <dl class="details-container-metadata">

        <!-- PROJECT OBJECTIVES -->
        {{#each eml:eml.dataset.project.abstract.section as | section |}}
          {{#ifCond section.title '===' "Objectives"}}
            <div>
              <dt>
                Project Objectives:
              </dt>
              <dd>
                {{section.para}}
              </dd>
            </div>
          {{/ifCond}}
        {{/each}}
        
        {{#if eml:eml.dataset.contact.individualName.givenName}}
          <div>
              <dt>
                Lead:
              </dt>
              <dd>
                {{#if eml:eml.dataset.contact.individualName.givenName}}
                  {{eml:eml.dataset.contact.individualName.givenName}}
                {{/if}}
                {{#if eml:eml.dataset.contact.individualName.surName}}
                  {{eml:eml.dataset.contact.individualName.surName}}
                {{/if}}
              </dd>
          </div>
        {{/if}}

        <!-- TIMELINE -->
        {{#if eml:eml.dataset.project.studyAreaDescription.coverage.temporalCoverage.rangeOfDates}}
          <div>
            <dt>
              Timeline:
            </dt>
            <dd>
              {{eml:eml.dataset.project.studyAreaDescription.coverage.temporalCoverage.rangeOfDates.beginDate.calendarDate}} to {{eml:eml.dataset.project.studyAreaDescription.coverage.temporalCoverage.rangeOfDates.endDate.calendarDate}}
            </dd>
          </div>
        {{/if}}

        <!-- PROJECT TYPE -->
        {{#each eml:eml.additionalMetadata as | amd |}}
        {{#each amd.metadata as | metadata |}}
            {{#ifCond @key '===' "projectTypes"}}
            <div>
              <dt>
                Project Type
              </dt>
              <dd>
                {{metadata.projectType}}
              </dd>
            </div>
            {{/ifCond}}
          {{/each}}
        {{/each}}

        {{#if eml:eml.dataset.project.studyAreaDescription.coverage.geographicCoverage.geographicDescription}}
          <div>
            <dt>
              Study Area:
            </dt>
            <dd>
              {{eml:eml.dataset.project.studyAreaDescription.coverage.geographicCoverage.geographicDescription}}
            </dd>
          </div>
        {{/if}}

        {{#each eml:eml.dataset.project.abstract.section as | section |}}
          {{#ifCond section.title '===' "Intended Outcomes"}}
            <div>
              <dt>
                Intended Outcomes:
              </dt>
              <dd>
                {{section.para}}
              </dd>
            </div>
          {{/ifCond}}
        {{/each}}

        {{#each eml:eml.dataset.project.designDescription.description.section as | section |}}
          {{#ifCond section.title '===' "Field Method"}}
            <div>
              <dt>
                Field Method:
              </dt>
              <dd>
                {{section.para}}
              </dd>
            </div>
          {{/ifCond}}
        {{/each}}
      </dl>
    </div>

    <!-- DOCUMENTS -->
    <div class="meta-container">
      {{#each eml:eml.additionalMetadata as | amd |}}
        {{#with (lookup amd.metadata "projectAttachments") as | attachments | ~}}

          <div class="meta-title-container">
            <div class="meta-title">
              Documents
            </div>
          </div>

          <div class="meta-body-container">

            {{#each attachments.projectAttachment as | a |}}
              <div>
                <a href="https://dev-biohubbc.apps.silver.devops.gov.bc.ca/"> {{a.file_name}}</a>
                {{#if a.is_secure}}
                  (secured)
                {{else}}
                  (public)
                {{/if}}
              </div>
            {{/each}}

            {{#if attachments.projectAttachment.file_name}}
              <a href="https://dev-biohubbc.apps.silver.devops.gov.bc.ca/"> {{attachments.projectAttachment.file_name}}</a>
              {{#if attachments.projectAttachment.is_secure}}
                (secured)
              {{else}}
                (public)
              {{/if}}
            {{/if}}
          </div>

        {{/with}}
      {{/each}}
    </div>


    <div class="meta-container">
      {{#each eml:eml.additionalMetadata as | amd |}}

        {{#with (lookup amd.metadata "projectReportAttachments") as | attachments | ~}}
          <div class="meta-title-container">
            <div class="meta-title">
              Reports
            </div>
          </div>
          <div class="meta-body-container">

            {{#each attachments.projectReportAttachment as | a |}}

            {{#if a.file_name}}
                <div>
                  <a href="https://dev-biohubbc.apps.silver.devops.gov.bc.ca/"> {{a.file_name}}</a>
                  {{#if a.is_secure}}
                    (secured)
                  {{else}}
                    (public)
                  {{/if}}
                </div>
              {{/if}}
            {{/each}}


            {{#if attachments.projectReportAttachment.file_name}}
              <a href="https://dev-biohubbc.apps.silver.devops.gov.bc.ca/"> {{attachments.projectReportAttachment.file_name}}</a>
              {{#if attachments.projectReportAttachment.is_secure}}
                (secured)
              {{else}}
                (public)
              {{/if}}
            {{/if}}
          </div>
        {{/with}}
      {{/each}}
    </div>
  </div>
`;
