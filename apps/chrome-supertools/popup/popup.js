import { tools } from '../tools/registry.js';

const toolsEl = document.getElementById('tools');
const statusEl = document.getElementById('status');

for (const tool of tools) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = tool.label;
  button.dataset.toolId = tool.id;
  button.addEventListener('click', async () => {
    statusEl.textContent = '…';
    statusEl.textContent = await tool.run();
  });
  toolsEl.appendChild(button);
}
