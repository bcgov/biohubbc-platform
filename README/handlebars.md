# Working with Handlebars

We use Handlebars to create templates used to render the metadata based on:
* datasetId
* Source system (ie SIMS, etc),
* provided template

To precompile a template:
  1.  useHandlebars().applyConditionalChecks();
  * this is a custom function that allows Handlebars to process to use conditions such as '==='
  2. parse: Handlebars.parse(rawTemplate);
  3. preCompile" : Handlebars.precompile(parsedHbr);
  4. The precompiled template generated above get stored in the DB.
 

