import express from 'express';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

/**
 * An immediately invoked function that runs a simple express server to serve the app static build files.
 *
 * This includes a health check endpoint that OpenShift uses to determine if the app is healthy.
 *
 * This file is only used when serving the app in OpenShift.
 * When running the app locally, the app is served by compose.yml, and doesn't use this file at all.
 *
 * Note: All changes to env vars here must also be reflected in the `app/src/contexts/configContext.tsx` file, so that
 * the app has access to the same env vars when running in both OpenShift and local development.
 */
(() => {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
  // Express APP
  const app = express();
  // Getting Port
  const port = process.env.APP_PORT || 7100;
  // Resource path
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const resourcePath = path.resolve(__dirname, '../build');
  // Setting express static
  app.use(express.static(resourcePath));

  // App config
  app.use('/config', (_, resp) => {
    const config = {
      API_HOST: process.env.VITE_API_HOST,
      CHANGE_VERSION: process.env.CHANGE_VERSION,
      NODE_ENV: process.env.NODE_ENV,
      VITE_NODE_ENV: process.env.VITE_NODE_ENV,
      VERSION: `${process.env.VERSION}(build #${process.env.CHANGE_VERSION})`,
      KEYCLOAK_CONFIG: {
        authority: process.env.VITE_KEYCLOAK_HOST,
        realm: process.env.VITE_KEYCLOAK_REALM,
        clientId: process.env.VITE_KEYCLOAK_CLIENT_ID
      },
      SITEMINDER_LOGOUT_URL: process.env.VITE_SITEMINDER_LOGOUT_URL,
      MAX_UPLOAD_NUM_FILES: Number(process.env.VITE_MAX_UPLOAD_NUM_FILES),
      MAX_UPLOAD_FILE_SIZE: Number(process.env.VITE_MAX_UPLOAD_FILE_SIZE)
    };
    resp.status(200).json(config);
  });

  // Health check
  app.use('/healthcheck', async (_, resp) => {
    // Request server api
    const host = process.env.VITE_API_HOST || process.env.LOCAL_API_HOST || 'localhost';

    try {
      const response = await axios.get(`https://${host}/`);
      if (response.status === 200) {
        resp.status(200).json({ success: true });
      } else {
        resp.status(404).json({ error: 'API not responding' });
      }
    } catch (err) {
      resp.status(404).json({ error: `${err}`, host: host });
    }
  });

  // All routes
  const route = express.Router();
  route.get('/*splat', (req, res) => {
    res.sendFile(path.join(resourcePath, 'index.html'));
  });
  app.use('/', route);

  // Logging
  console.log(`Starting express web server on port with resource path => ${port}: ${resourcePath}`);
  // Listing to port
  app.listen(port, () => {
    console.log(`Application started on port => ${port}`);
  });
})();
