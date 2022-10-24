import Handlebars from 'handlebars';

const RenderWithHandlebars: React.FC = () => {
  const data = {
    name: 'Alan',
    hometown: 'Somewhere, TX',
    kids: [
      { name: 'Jimmy', age: '12' },
      { name: 'Sally', age: '4' }
    ],
    author: true,
    book_name: 'this is my book',
    friends1: [
      {
        name: 'Jimmy',
        age: '20',
        hobbies: [{ first: 'a', second: 'b' }]
      },
      {
        name: 'Sally',
        age: '30',
        hobbies: [{ first: 'c', second: 'd' }]
      },
      {
        name: 'Erin',
        age: '40',
        hobbies: [{ first: 'e', second: 'f' }]
      }
    ],
    friends2: [
      {
        name: 'Jimmy',
        age: '20',
        hobbies: [{ first: 'a', second: 'b' }]
      },
      {
        name: 'Sally',
        age: '30',
        hobbies: [{ first: 'c', second: 'd' }]
      },
      {
        name: 'Erin',
        age: '40',
        hobbies: [{ first: 'e', second: 'f' }]
      }
    ],
    friends3: [
      {
        name: 'Jimmy',
        age: '20',
        hobbies: [{ first: 'a', second: 'b' }]
      },
      {
        name: 'Sally',
        age: '30',
        hobbies: [{ first: 'c', second: 'd' }]
      },
      {
        name: 'Erin',
        age: '40',
        hobbies: [{ first: 'e', second: 'f' }]
      }
    ],
    friends4: [
      {
        name: 'Jimmy',
        age: '20',
        hobbies: [{ first: 'a', second: 'b' }]
      },
      {
        name: 'Sally',
        age: '30',
        hobbies: [{ first: 'c', second: 'd' }]
      },
      {
        name: 'Erin',
        age: '40',
        hobbies: [{ first: 'e', second: 'f' }]
      }
    ],
    city: {
      name: 'San Francisco',
      summary: 'San Francisco is the <b>cultural center</b> of <b>Northern California</b>',
      location: {
        north: '37.73,',
        east: -122.44
      },
      population: 883305
    }
  };

  const myStyle1 = '#036';
  const myStyle2 = '#ea213a';
  const myStyle3 = '#ba68c8';
  const myClass = 'hbr-color';

  const hbr = `<b>Rendering a variable, array length, and list</b>
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

  <p class="${myClass}"> this section is testing the css classes. class = '${myClass}'</p>


 <p> **************Friends 2***************</p>

  <ul style="background-color:${myStyle2};">{{#friends2}}
  <p><b>name: {{name}}</b></p>
  <p>age:{{age}}</p>
  <p>Hobbies:</p>
  <ul>{{#hobbies}}
    <li  > {{first}} and {{second}}</li>
  {{/hobbies}}</ul>
{{/friends2}}</ul>
<p> **************Friends 3***************</p>

<ul style="background-color:${myStyle3};">{{#friends3}}
<p><b>name: {{name}}</b></p>
<p>age:{{age}}</p>
<p>Hobbies:</p>
<ul>{{#hobbies}}
  <li  > {{first}} and {{second}}</li>
{{/hobbies}}</ul>
{{/friends3}}</ul>
  `;

  let resultPreCompiled;
  console.log(resultPreCompiled);
  let resultCompiled;
  console.log(resultCompiled);

  try {
    //VERSION 1 (USING PRECOMPILE)
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

    const template = Handlebars.compile(hbr);
    console.log('2: resulting COMPILE template - ', template);

    resultCompiled = template(data);
    console.log('3: result - ', resultCompiled);

  } catch (error) {
    console.log('********* this is the error ***************');
    console.log(error);
  } finally {
    // eslint-disable-next-line no-unsafe-finally
    //return <div>{<div dangerouslySetInnerHTML={{ __html: resultPreCompiled }} />}</div>;
    // eslint-disable-next-line no-unsafe-finally
    return <div>{<div dangerouslySetInnerHTML={{ __html: resultCompiled }} />}</div>;
  }
};

export default RenderWithHandlebars;
