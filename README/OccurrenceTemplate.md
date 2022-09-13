# BioHub Templates
## Observation/ Record Templates
## Adding New Template

1. Get template from Confluence [SIMS Templates](https://apps.nrs.gov.bc.ca/int/confluence/display/TASHIS/SIMS+Templates)
2. Create validation object at:
```
biohubbc/database/src/migrations/template_methodology_species_validations/new_template.ts
```
3. Create migration for new validation object. Use example of previous template migrations to get started. Your migration file should start with a timestamp in the format: YYYYMMDDHHmmss
```
biohubbc/database/src/migrations/YYYYMMDDHHmmss_new_migration.ts
```
4. Start App and check the migration was successful.
```
make web
make log-db-setup
```


A successful migration will look something like this
![Successful Migration](./images/templates/successful%20migration.png)

5. Update Template Properties with `sims_template_id` and `sims_csm_id` values
    1. Open the template in excel
    2. Navigate to File tab in the ribbon
    3. Then select Info -> Properties -> Advanced Properties
![Advanced Properties](./images/templates/advanced%20properties.png)
    4. In the new panel navigate to the Custom tab
    ![Custom Tab](./images/templates/custom%20tab.png)
    5. Add `sims_template_id`. This values comes from `template_id` in the `template_methodology_species` table
    6. Add `sims_csm_id`. This values comes from `field_method_id` in the `template_methodology_species` table

6. Add tempalte to resource tab
```
biohubbc/app/src/resources/ResourcesPage.tsx
```
7. [Connect](#setup-s3-browser) and add file to S3 Bucket templates folder
11. Update original template in confluence if anything has changed (fixed fields, spelling, worksheet names ect.)



# Summary Templates
## This is going to change in the future
1. Get template from Confluence (link)
2. Check template is inline with other summary templates*
3. 
# Tempalte Standards
1. Any look up table worksheets should be named `Picklist Values`


# Setup S3 Browser

1. Download [S3 Browser](https://s3browser.com/)
2. Add account to connect to S3 bucket
3. Update account type to be: `S3 Compatable Storage`
4. Go to open shift

![Open Shift Secrets](./images/templates/open%20shift%20secrets.png)

6. Search for object-store
7. Copy object_url, access_key and secret key into S3 Bucket fields
8. Create account and connect