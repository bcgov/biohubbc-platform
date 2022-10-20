import Handlebars from 'handlebars';
import React from 'react';

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

  <h3>These are my friends, their ages and hobbies</h3>

  <ul>{{#friends1}}
    <p><b>name: {{name}}</b></p>
    <p>age:{{age}}</p>
    <p>Hobbies:</p>
    <ul>{{#hobbies}}
      <li> {{first}} and {{second}}</li>
    {{/hobbies}}</ul>
  {{/friends1}}</ul>

  <h3>I live in </h3>


  {{#with city as | city |}}
    {{#with city.location as | loc |}}
      {{city.name}}: {{loc.north}} {{loc.east}}
    {{/with}}
  {{/with}}

  `;

  let resultPreCompiled;
  try {
    const parsedHbr = Handlebars.parse(hbr);

    const preCompiled = Handlebars.precompile(parsedHbr);
    //console.log('1: parsed - ', preCompiled);

    //fs.writeFileSync("preCompiled.txt", preCompiled);

    const encodedHandlebarsFunction = `(handlebars) => handlebars.template(${preCompiled})`;
    console.log('2: encoded - ', encodedHandlebarsFunction);

    const handlebarsFunction = eval(encodedHandlebarsFunction);
    console.log('3: eval - ', handlebarsFunction);

    const template = handlebarsFunction(Handlebars);
    console.log('4: resulting template - ', template);

    resultPreCompiled = template(data);
    console.log('5: result - ', resultPreCompiled);
  } catch (error) {
    console.log('********* this is the preCompile error ***************');
    console.log(error);
  } finally {
    // eslint-disable-next-line no-unsafe-finally
    return <div>{<div dangerouslySetInnerHTML={{ __html: resultPreCompiled }} />}</div>;
  }
};

export default RenderWithHandlebars;
