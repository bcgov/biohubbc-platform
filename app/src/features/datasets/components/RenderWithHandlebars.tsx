import Box from '@mui/material/Box';
import * as DOMPurify from 'dompurify';
import Handlebars from 'handlebars';
import 'styles/handlebar.scss';

export interface IRenderWithHandleBarProps {
  dataset: any;
}

const RenderWithHandlebars: React.FC<IRenderWithHandleBarProps> = (props) => {
  const dataset = props.dataset.data;

  const simsHbr = `
    <div class="hbr-container">

      <div>
        <h1>${dataset['eml:eml'].dataset.title}</h1>
      </div>

      <div class="meta-container">
        <div class="meta-title-container">
            Published
        </div>
        <div class="meta-body-container">
          ${dataset['eml:eml'].dataset.pubDate}
        </div>
      </div>

      <div class="meta-container">
        <div class="meta-title-container">
            Creator
        </div>
        <div class="meta-body-container">
          <div>
          <div>
          ${dataset['eml:eml'].dataset.creator.organizationName}
          </div>
            <a href="mailto:${dataset['eml:eml'].dataset.creator.electronicMailAddress}">
              ${dataset['eml:eml'].dataset.creator.electronicMailAddress}
            </a>
          </div>
        </div>
      </div>

      <div class="meta-container">
        <div class="meta-title-container">
            Provider
        </div>
        <div class="meta-body-container">
          <a href=${dataset['eml:eml'].dataset.metadataProvider.onlineUrl}>${dataset['eml:eml'].dataset.metadataProvider.organizationName} </a>
        </div>
      </div>

      <div class="meta-container">
        <div class="meta-title-container">
          Objectives
        </div>
        <div class="meta-body-container">
        ${dataset['eml:eml'].dataset.project.abstract.section[0].para}
        </div>
      </div>

      <div class="meta-container">
        <div class="meta-title-container">
            Rights
        </div>
        <div class="meta-body-container">
         Copyright © 2022, Province of British Columbia
        </div>
      </div>

      <div class="meta-container">
        <div class="meta-title-container">
          <div class="meta-title">
          Contacts
          </div>
        </div>
        <div class="meta-body-container">
          <div>
            ${dataset['eml:eml'].dataset.contact.individualName.givenName} ${dataset['eml:eml'].dataset.contact.individualName.surName}
          </div>
          <div>
             ${dataset['eml:eml'].dataset.contact.organizationName}
          </div>
          <div>
            <a href="mailto:${dataset['eml:eml'].dataset.creator.electronicMailAddress}">
              ${dataset['eml:eml'].dataset.creator.electronicMailAddress}
            </a>
          </div>

        </div>
      </div>

      <div class="meta-container">
        <div class="meta-title-container">
          <div class="meta-title">
            Documents
          </div>
        </div>
        <div class="meta-body-container">
          {{#each eml:eml.additionalMetadata as | amd |}}
            {{#with (lookup amd.metadata "projectAttachments") as | attachments | ~}}
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
           {{/with}}
          {{/each}}
        </div>
      </div>

      <div class="meta-container">
      <div class="meta-title-container">
        <div class="meta-title">
          Reports
        </div>
      </div>
      <div class="meta-body-container">
        {{#each eml:eml.additionalMetadata as | amd |}}
          {{#with (lookup amd.metadata "projectReportAttachments") as | attachments | ~}}
            <a href="https://dev-biohubbc.apps.silver.devops.gov.bc.ca/"> {{attachments.projectReportAttachment.file_name}}</a>
            {{#if attachments.projectReportAttachment.is_secure}}
              (secured)
            {{else}}
              (public)
            {{/if}}
          {{/with}}
        {{/each}}
      </div>
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
