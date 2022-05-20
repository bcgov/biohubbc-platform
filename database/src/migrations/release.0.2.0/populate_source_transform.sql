-- populate_source_transform.sql

insert into source_transform (system_user_id, version, metadata_transform, metadata_index) values ((select system_user_id from system_user where user_identifier = 'SIMS-SVC'), 1
, '<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:xs="http://www.w3.org/2001/XMLSchema"
    xmlns:eml="https://eml.ecoinformatics.org/eml-2.2.0"
    exclude-result-prefixes="xs"
    version="1.0">
    <xsl:template match="/">
        {
        "datasetName": "<xsl:value-of select="/eml:eml/dataset/title"/>",
        "publishDate": "<xsl:value-of select="/eml:eml/dataset/pubDate"/>",
        "projects": [<xsl:for-each select="//project|//relatedProject">{"projectId": "<xsl:value-of select="./@id"/>",
            "projectName": "<xsl:value-of select="./title"/>",
            "projectObjectives": "<xsl:value-of select="./abstract/section[title/text()=''Objectives'']/para"/>",
            "fundingSource": "<xsl:value-of select="./funding/section[title/text()=''Funding Source'']/para"/>"}
            <xsl:if test="position() != last()"><xsl:text>,</xsl:text></xsl:if></xsl:for-each>]
        }        
    </xsl:template>
</xsl:stylesheet>', 'biohub_metadata');
