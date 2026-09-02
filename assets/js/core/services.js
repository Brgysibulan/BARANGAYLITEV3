/**
 * Purpose: assemble the data/auth services shared by all three app shells.
 * Depends on: core client/auth and the modules under data/.
 * Debug: follow a service name here to its implementation; tests inject a mock client.
 */
import { getClient } from './client.js';
import { createAuth } from './auth.js';
import { createContent } from '../data/content.js';
import { createSettings } from '../data/settings.js';
import { createVerification } from '../data/verification.js';
import { createStorage } from '../data/storage.js';
import { createEditors } from '../data/editors.js';
import { createApplications } from '../data/applications.js';
import { createDesign } from '../data/design.js';

/** Dependency injection keeps tests away from production accounts and records. */
export function createServices(client) {
  const auth = createAuth(client);
  const content = createContent(client, auth);
  return Object.freeze({
    auth, content,
    settings: createSettings(client, auth),
    verification: createVerification(client, auth),
    storage: createStorage(client, auth, content),
    editors: createEditors(client, auth),
    applications: createApplications(client, auth),
    design: createDesign(client, auth),
  });
}
/** Browser entry point: service wrappers share the single configured client. */
export const getServices = () => createServices(getClient());
