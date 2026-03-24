# GIS Facility Data Recovery: MVT Tile Reverse-Extraction Plan

## Background
- Look under gis/docs so that you can recognize about the past jobs done.
- The jobs were being done in ordered by analysis -> implementation -> migration -> and now frontend.

## END-GOAL
- Check with actual web browser(playwright) so that the updated GIS system displays appropriate informations. Don't forget to save enough screenshots and test notes during QA.
- Enhance the user experience (UX) by improving the UI to ensure that sewer pipes and other features are clearly visible in screenshots, and by adding features such as the ability to switch between standard and satellite maps
- After migrating the infrastructure to iac, deploy gain within serengeti-iac and access gis.giraffe.ai.kr, log in, use the service, take screenshots, and verify that all features are functioning properly
- Continue planning and enhancing features, including a new GeoJSON-based data expansion, an admin page for data management (such as adding regions), user addition functionality, multi-tenancy, and backend features that allow assigning role-based permissions to users
- Design and develop pipelines for external integration and continuous automatic updates of data that users do not need to add manually, such as address data and local facilities based on South Korean public data. When information retrieval is required, the Perplexity tool accessible via IAC can be utilized
- This service must include all the query and verification functions provided by the front end of the existing legacy implementation, without exception. Of course, it would be even better if we could improve it to make it a more modern, sophisticated, and scalable service.
- If necessary, continue to refine the current file (PROMPT.md); completed tasks may be organized

### Usefull skills
- You may use skills like frontend-design, web-artifacts-builder and webapp-testing for advanced frontend development.
- Also you can use perplexity(/home/girinman/workspace/serengeti-iac/docs/perplexity) to search about information related to this project and enhance, enrich the service. 
