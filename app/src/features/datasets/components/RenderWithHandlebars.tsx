import Handlebars from 'handlebars';

export interface IRenderWithHandleBarProps {
  dataset: any;
}

const RenderWithHandlebars: React.FC<IRenderWithHandleBarProps> = (props) => {
  const dataset = props.dataset.data;

  console.log('dataset is: ', dataset);

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

  const myStyle1 = '#036';
  // const myStyle2 = '#ea213a';
  // const myStyle3 = '#ba68c8';
  const myClass = 'hbr-color';

  const hbrForOurLearning = `<b>Rendering a variable, array length, and list</b>
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

  <p class="${myClass}"> this section is testing the css classes. class = '${myClass}'</p>

  <h3>These are my friends, their ages and hobbies</h3>

  <p> **************Friends 1***************</p>

  <ul style="background-color:${myStyle1};">{{#friends1}}
    <p><b>name: {{name}}</b></p>
    <p>age:{{age}}</p>
    <p>Hobbies:</p>
    <ul>{{#hobbies}}
      <li  > {{first}} and {{second}}</li>
    {{/hobbies}}</ul>
  {{/friends1}}</ul>
  `;

  console.log(hbrForOurLearning);

  const simsHbr = `
  <h1>${dataset['eml:eml'].dataset.title}</h1>
  <p>Creator:
Organization: ${dataset['eml:eml'].dataset.creator.organizationName}
Email: ${dataset['eml:eml'].dataset.creator.electronicMailAddress}
  </p>

  <div>Provider:
  <p>Organization: ${dataset['eml:eml'].dataset.metadataProvider.organizationName}</p>
  <p>URL: ${dataset['eml:eml'].dataset.metadataProvider.onlineUrl}</p>
    </div>

  <div>
    <p>Objectives: ${dataset['eml:eml'].dataset.project.abstract.section[0].para}</p>
  <p>Published: ${dataset['eml:eml'].dataset.pubDate}</p>

  <p>Rights: Copyright © 2022, Province of British Columbia</p>

  <div>
  Contacts:
  <p>Individual: ${dataset['eml:eml'].dataset.contact.individualName.givenName} ${dataset['eml:eml'].dataset.contact.individualName.surName}  </p>
<p>Organization: ${dataset['eml:eml'].dataset.contact.organizationName}</p>
<p>Email: ${dataset['eml:eml'].dataset.contact.electronicMailAddress}</p>
<p>Role: ${dataset['eml:eml'].dataset.project.personnel.role}</p>
  </div>

  `;

  console.log('email address is: ', simsHbr);

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
    //return <div>{<div dangerouslySetInnerHTML={{ __html: resultPreCompiled }} />}</div>;
    // eslint-disable-next-line no-unsafe-finally
    return <div>{<div dangerouslySetInnerHTML={{ __html: resultCompiled as string }} />}</div>;
  }
};

export default RenderWithHandlebars;
