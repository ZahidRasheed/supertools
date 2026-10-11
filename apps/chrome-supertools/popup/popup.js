import { tools } from '../tools/registry.js';
import { toolIcons } from '../tools/icons.js';
import { statusFromToolRun } from './run-tool.js';

const toolsEl = document.getElementById('tools');
const statusEl = document.getElementById('status');

for (const tool of tools) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.toolId = tool.id;

  const icon = document.createElement('span');
  icon.className = 'tool-icon';
  icon.innerHTML = toolIcons[tool.icon] || '';

  const label = document.createElement('span');
  label.className = 'tool-label';
  label.textContent = tool.label;

  button.append(icon, label);
  button.addEventListener('click', async () => {
    statusEl.textContent = '…';
    statusEl.textContent = await statusFromToolRun(tool.run);
  });
  toolsEl.appendChild(button);
}
