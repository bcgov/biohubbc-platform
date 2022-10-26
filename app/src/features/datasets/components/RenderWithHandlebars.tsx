import Box from '@mui/material/Box';
import * as DOMPurify from 'dompurify';
import Handlebars from 'handlebars';
import 'styles/handlebar.scss';

export interface IRenderWithHandleBarProps {
  dataset: any;
}

const RenderWithHandlebars: React.FC<IRenderWithHandleBarProps> = (props) => {
  const dataset = props.dataset.data;

  // const data = {
  //   name: 'Alan',
  //   hometown: 'Somewhere, TX',
  //   kids: [
  //     { name: 'Jimmy', age: '12' },
  //     { name: 'Sally', age: '4' }
  //   ],
  //   author: true,
  //   book_name: 'this is my book',
  //   friends1: [
  //     {
  //       name: 'Jimmy',
  //       age: '20',
  //       hobbies: [{ first: 'a', second: 'b' }]
  //     },
  //     {
  //       name: 'Sally',
  //       age: '30',
  //       hobbies: [{ first: 'c', second: 'd' }]
  //     },
  //     {
  //       name: 'Erin',
  //       age: '40',
  //       hobbies: [{ first: 'e', second: 'f' }]
  //     }
  //   ],
  //   friends2: [
  //     {
  //       name: 'Jimmy',
  //       age: '20',
  //       hobbies: [{ first: 'a', second: 'b' }]
  //     },
  //     {
  //       name: 'Sally',
  //       age: '30',
  //       hobbies: [{ first: 'c', second: 'd' }]
  //     },
  //     {
  //       name: 'Erin',
  //       age: '40',
  //       hobbies: [{ first: 'e', second: 'f' }]
  //     }
  //   ],
  //   friends3: [
  //     {
  //       name: 'Jimmy',
  //       age: '20',
  //       hobbies: [{ first: 'a', second: 'b' }]
  //     },
  //     {
  //       name: 'Sally',
  //       age: '30',
  //       hobbies: [{ first: 'c', second: 'd' }]
  //     },
  //     {
  //       name: 'Erin',
  //       age: '40',
  //       hobbies: [{ first: 'e', second: 'f' }]
  //     }
  //   ],
  //   friends4: [
  //     {
  //       name: 'Jimmy',
  //       age: '20',
  //       hobbies: [{ first: 'a', second: 'b' }]
  //     },
  //     {
  //       name: 'Sally',
  //       age: '30',
  //       hobbies: [{ first: 'c', second: 'd' }]
  //     },
  //     {
  //       name: 'Erin',
  //       age: '40',
  //       hobbies: [{ first: 'e', second: 'f' }]
  //     }
  //   ],
  //   city: {
  //     name: 'San Francisco',
  //     summary: 'San Francisco is the <b>cultural center</b> of <b>Northern California</b>',
  //     location: {
  //       north: '37.73,',
  //       east: -122.44
  //     },
  //     population: 883305
  //   }
  // };

  const color1 = '#036';
  // const myStyle2 = '#ea213a';
  // const myStyle3 = '#ba68c8';
  const myClass = 'hbr-color';

  const hbrForOurLearning = `
    <b>Rendering a variable, array length, and list</b>
    <p>Hello, my name is {{name}}. I am from {{hometown}}. I have
    {{kids.length}} kids:</p>
    <ul>{{#kids}}
    <li>{{name}} is {{age}}</li>{{/kids}}</ul>


    {{#if author}}
      <h3>{{book_name}}</h3>
    {{else}}
      <h3>Just pretending to be an author</h3>
    {{/if}}

    <h3>I live in </h3>

    {{#with  city as | city |}}
      {{#with city.location as | loc |}}
        {{city.name}}: {{loc.north}} {{loc.east}}
      {{/with}}
    {{/with}}

    <p class="hbr-color"> this section is testing the css classes. class = '${myClass}'</p>

    <h3>These are my friends, their ages and hobbies</h3>

    <p> **************Friends 1***************</p>

    <ul style="background-color:${color1};">{{#friends1}}
      <p><b>name: {{name}}</b></p>
      <p>age:{{age}}</p>
      <p>Hobbies:</p>
      <ul>{{#hobbies}}
        <li>{{first}} and {{second}}</li>
      {{/hobbies}}</ul>
    {{/friends1}}</ul>
  `;

  console.log(hbrForOurLearning);

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
          <ul>
            <li>
              <a href="https://dev-biohubbc.apps.silver.devops.gov.bc.ca/">${dataset['eml:eml'].additionalMetadata[6].metadata.projectAttachments.projectAttachment[1].file_name}</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  `;

  // let resultPreCompiled;
  // console.log(resultPreCompiled);
  let resultCompiled;
  console.log(resultCompiled);

  try {
    //DO_NOT DELETE : VERSION 1 (USING PRECOMPILE)
    // const parsedHbr = Handlebars.parse(hbr);

    // const preCompiled = Handlebars.precompile(parsedHbr);
    // const encodedHandlebarsFunction = `(handlebars) => handlebars.template(${preCompiled})`;
    // console.log('1: encoded - ', encodedHandlebarsFunction);

    // const handlebarsFunction = eval(encodedHandlebarsFunction);
    // const template = handlebarsFunction(Handlebars);
    // console.log('2: resulting PRECOMPILE template - ', template);

    // resultPreCompiled = template(data);
    // console.log('3: result - ', resultPreCompiled);

    //VERSION 2 - USING COMPILE


    const template = Handlebars.compile(simsHbr);
    //console.log('2: resulting COMPILE template - ', template);

    resultCompiled = template(dataset);
    //console.log('3: result - ', resultCompiled);
  } catch (error) {
    console.log('********* this is the error ***************');
    console.log(error);
  } finally {
    // eslint-disable-next-line no-unsafe-finally
    return (
      <Box>
        <div>{<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(resultCompiled as string) }} />}</div>
      </Box>
    );
  }
};

export default RenderWithHandlebars;
