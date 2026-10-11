import { run as copyAllOpenLinks } from './copy-all-urls.js';
import { run as copyCleanedLink } from './copy-cleaned-link.js';

export const tools = [
  {
    id: 'copy-all-open-links',
    label: 'Copy all open links',
    icon: 'links',
    run: copyAllOpenLinks,
  },
  {
    id: 'copy-link-cleaned',
    label: 'Copy Link (Cleaned)',
    icon: 'clean',
    run: copyCleanedLink,
  },
];
