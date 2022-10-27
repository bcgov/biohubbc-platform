import Box from '@mui/material/Box';
import * as DOMPurify from 'dompurify';
import Handlebars from 'handlebars';
import 'styles/handlebar.scss';

export interface IRenderWithHandleBarProps {
  dataset: any;
}

const RenderWithHandlebars: React.FC<IRenderWithHandleBarProps> = (props) => {
  const dataset = props.dataset.data;

  //For project attachments and reports, we need to handle the case where the documents are in an array or as a single object
  const simsHbr = `
    <div class="hbr-container">

      {{#if eml:eml.dataset.title}}
        <div>
          <h1> {{eml:eml.dataset.title}}</h1>
        </div>
      {{/if}}

      {{#if eml:eml.dataset.pubDate}}
        <div>
          <div class="meta-container">
            <div class="meta-title-container">
              Published
            </div>
            <div class="meta-body-container">
              {{eml:eml.dataset.pubDate}}
            </div>
          </div>
        </div>
      {{/if}}

      {{#if eml:eml.dataset.creator}}
        <div class="meta-container">
          <div class="meta-title-container">
              Creator
          </div>
          <div class="meta-body-container">
            <div>
              {{#if eml:eml.dataset.creator.organizationName}}
                <div>
                  {{eml:eml.dataset.creator.organizationName}}
                </div>
              {{/if}}

              {{#if eml:eml.dataset.creator.electronicMailAddress}}
                <div>
                  <a href="mailto: {{eml:eml.dataset.creator.electronicMailAddress}}">
                    {{eml:eml.dataset.creator.electronicMailAddress}}
                  </a>
                </div>
              {{/if}}
            </div>
          </div>
        </div>
      {{/if}}

      {{#if eml:eml.dataset.metadataProvider}}
        <div class="meta-container">
          <div class="meta-title-container">
              Provider
          </div>
          <div class="meta-body-container">
            <div>
              <a href="mailto: {{eml:eml.dataset.metadataProvider.onlineUrl}}">
                {{eml:eml.dataset.metadataProvider.organizationName}}
              </a>
            </div>
          </div>
        </div>
      {{/if}}

      {{#each eml:eml.dataset.project.abstract.section as | section |}}
        {{#if (isEqual section.title "Objectives")}}
          <div class="meta-container">
            <div class="meta-title-container">
              Objectives
            </div>
            <div class="meta-body-container">
              {{section.para}}
            </div>
          </div>
        {{/if}}
      {{/each}}

      {{#if eml:eml.dataset.contact}}
        <div class="meta-container">
          <div class="meta-title-container">
            <div class="meta-title">
            Contacts
            </div>
          </div>
          <div class="meta-body-container">

            <div>
              {{#if eml:eml.dataset.contact.individualName.givenName}}
                {{eml:eml.dataset.contact.individualName.givenName}}
              {{/if}}
              {{#if eml:eml.dataset.contact.individualName.surName}}
                {{eml:eml.dataset.contact.individualName.surName}}
              {{/if}}
            </div>

            <div>
              {{#if eml:eml.dataset.contact.organizationName}}
                {{eml:eml.dataset.contact.organizationName}}
              {{/if}}
            </div>

            <div>
              {{#if eml:eml.dataset.creator.electronicMailAddress}}
                <a href="mailto:eml:eml.dataset.creator.electronicMailAddress}">
                  {{eml:eml.dataset.creator.electronicMailAddress}}
                </a>
              {{/if}}
            </div>

          </div>
        </div>
      {{/if}}

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

  // let resultPreCompiled;
  // console.log(resultPreCompiled);
  let result;

  try {
    //DO_NOT DELETE : VERSION 1 (USING PRECOMPILE)
    // const parsedHbr = Handlebars.parse(hbr);

    // const preCompiled = Handlebars.precompile(parsedHbr);
    // const encodedHandlebarsFunction = `(handlebars) => handlebars.template(${preCompiled})`;
    // console.log('1: encoded - ', encodedHandlebarsFunction);

    // const handlebarsFunction = eval(encodedHandlebarsFunction);
    // const template = handlebarsFunction(Handlebars);
    // console.log('2: resulting PRECOMPILE template - ', template);

    // result = template(data);
    // console.log('3: result - ', result);

    //VERSION 2 - USING COMPILE

    const template = Handlebars.compile(simsHbr);

    Handlebars.registerHelper('isEqual', (value1, value2, options) => {
      return value1 === value2;
    });

    result = template(dataset);
  } catch (error) {
    console.log(error);
  } finally {
    // eslint-disable-next-line no-unsafe-finally
    return (
      <Box>
        <div>{<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result as string) }} />}</div>
      </Box>
    );
  }
};

export default RenderWithHandlebars;
