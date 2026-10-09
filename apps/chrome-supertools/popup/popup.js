import { tools } from '../tools/registry.js';
import { statusFromToolRun } from './run-tool.js';

const toolsEl = document.getElementById('tools');
const statusEl = document.getElementById('status');

for (const tool of tools) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = tool.label;
  button.dataset.toolId = tool.id;
  button.addEventListener('click', async () => {
    statusEl.textContent = '…';
    statusEl.textContent = await statusFromToolRun(tool.run);
  });
  toolsEl.appendChild(button);
}
