export const simsHandlebarsTemplate_HEADER = `
  <!-- HEADER -->
  {{#if eml:eml.dataset.title}}
    <div class="hbr-header">
      <h1 class="hbr-header-title-primary"> {{eml:eml.dataset.title}}</h1>
      {{#each eml:eml.additionalMetadata as | amd |}}
        {{#with (lookup amd.metadata "types") as | projectType | ~}}
          {{#ifCond amd.describes '===' @root.eml:eml.dataset.[@_id]}}
            <div class="hbr-header-badge">Inventory {{projectType.type}}</div>
          {{/ifCond}}
        {{/with}}
      {{/each}}
    </div>
  {{/if}}
`;

export const simsHandlebarsTemplate_DETAILS = `
  <div class="hbr-container">

    <!-- DETAILS -->
    <div class="details-container">
      <dl class="details-container-metadata">

        <!-- PROJECT OBJECTIVES -->
        {{#each eml:eml.dataset.project.abstract.section as | section |}}
          {{#ifCond section.title '===' "Objectives"}}
            <div>
              <dt>
                Project Objectives
              </dt>
              <dd>
                {{section.para}}
              </dd>
            </div>
          {{/ifCond}}
        {{/each}}

        <!-- TIMELINE -->
        {{#if eml:eml.dataset.project.studyAreaDescription.coverage.temporalCoverage.rangeOfDates}}
          <div>
            <dt>
              Timeline
            </dt>
            <dd>
              {{#formatDate eml:eml.dataset.project.studyAreaDescription.coverage.temporalCoverage.rangeOfDates.beginDate.calendarDate}}{{/formatDate}} - {{#formatDate eml:eml.dataset.project.studyAreaDescription.coverage.temporalCoverage.rangeOfDates.endDate.calendarDate}}{{/formatDate}}
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

        <!-- ACTIVITIES -->
        {{#each eml:eml.additionalMetadata as | amd |}}
          {{#each amd.metadata as | metadata |}}
            {{#ifCond @key '===' "projectActivities"}}
            <div>
              <dt>
                Activities
              </dt>
              <dd>
                {{#if (isAnArray metadata.projectActivity)}}
                  {{#each metadata.projectActivity as | activities |}}
                    {{activities.name}}{{#unless @last}}, {{/unless}}
                  {{/each}}
                {{else}}
                  {{metadata.projectActivity.name}}
                {{/if}}
              </dd>
            </div>
            {{/ifCond}}
          {{/each}}
        {{/each}}

        <!-- PROJECT COORDINATOR -->
        {{#if eml:eml.dataset.contact}}
          <div>
            <dt>
              Project Coordinator
            </dt>
            <dd>
              <ul class="hbr-project-coordinator">
                <li>{{eml:eml.dataset.contact.individualName.givenName}} {{eml:eml.dataset.contact.individualName.surName}}</li>
                <li>{{eml:eml.dataset.contact.organizationName}}</li>
                <li><a href="mailto:{{eml:eml.dataset.contact.electronicMailAddress}}">{{eml:eml.dataset.contact.electronicMailAddress}}</a></li>
              </ul>
            </dd>
          </div>
        {{/if}}

        <!-- FUNDING SOURCES -->
        {{#if eml:eml.dataset.project.funding.section}}
          <div>
            <dt>
              Funding Sources
            </dt>
            <dd>
              {{#each eml:eml.dataset.project.funding.section as | funding |}}
                {{funding.para}}{{#unless @last}}, {{/unless}}
              {{/each}}
            </dd>
          </div>
        {{/if}}

        <!-- PARTNERS -->
        {{#each eml:eml.additionalMetadata as | amd |}}
          {{#each amd.metadata as | metadata |}}
            {{#ifCond @key '===' "partnerships"}}
              {{#ifCond metadata '!==' ""}}
                <div>
                  <dt>
                    Partners
                  </dt>
                  <dd>
                    {{#if (isAnArray metadata.partnership)}}
                      {{#each metadata.partnership as | partnership |}}
                        {{partnership.name}}{{#unless @last}}, {{/unless}}
                      {{/each}}
                    {{else}}
                      {{metadata.partnership.name}}
                    {{/if}}
                  </dd>
                </div>
              {{/ifCond}}
            {{/ifCond}}
          {{/each}}
        {{/each}}

        <!-- CONSERVATION ACTIONS -->
        {{#each eml:eml.additionalMetadata as | amd |}}
          {{#each amd.metadata as | metadata |}}
            {{#ifCond @key '===' "IUCNConservationActions"}}              
              {{#ifCond metadata '!==' ""}}
                <div>
                  <dt>
                    Conservation Activities
                  </dt>
                  <dd>
                    {{#if (isAnArray metadata.IUCNConservationAction)}}
                      <ul style="padding-left: 20px">
                        {{#each metadata.IUCNConservationAction as | actions |}}
                          <li>
                            {{actions.IUCNConservationActionLevel1Classification}} > {{actions.IUCNConservationActionLevel2SubClassification}} > {{actions.IUCNConservationActionLevel3SubClassification}}
                          </li>
                        {{/each}}
                      </ul>
                    {{else}}
                      <ul style="padding-left: 20px">
                        <li>
                          {{metadata.IUCNConservationAction.IUCNConservationActionLevel1Classification}} > {{metadata.IUCNConservationAction.IUCNConservationActionLevel2SubClassification}} > {{metadata.IUCNConservationAction.IUCNConservationActionLevel3SubClassification}}
                        </li>
                      </ul>
                    {{/if}}
                  </dd>
                </div>
              {{/ifCond}}
            {{/ifCond}}
          {{/each}}
        {{/each}}

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
