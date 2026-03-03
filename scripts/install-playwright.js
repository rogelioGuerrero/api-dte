const { execSync } = require('child_process');
const path = require('path');

const cachePath = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/render/project/.cache/ms-playwright';
const revision = process.env.PLAYWRIGHT_CHROMIUM_REVISION || '1208';

const chromiumExec = path.join(cachePath, `chromium-${revision}`, 'chrome-linux', 'chrome');

const exists = () => {
  try {
    execSync(`${chromiumExec} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const install = () => {
  console.log(`Installing Playwright chromium (cache: ${cachePath}, rev: ${revision})...`);
  execSync(`npx playwright install chromium`, {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: cachePath,
      PLAYWRIGHT_CHROMIUM_REVISION: revision,
    },
  });
};

try {
  if (!exists()) {
    install();
  } else {
    console.log('Playwright chromium found in cache, skipping download');
  }

  console.log('Building project...');
  execSync('npm run build', { stdio: 'inherit', shell: true });
} catch (error) {
  console.error('Error in install-playwright:', error.message);
  process.exit(1);
}
