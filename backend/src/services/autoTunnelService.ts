import { getRemoteConfig } from 'firebase-admin/remote-config';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import https from 'https';

let activeTunnelProcess: any = null;
let activeLocaltunnel: any = null;

/**
 * Auto-assigns the generated tunnel URL directly to Firebase Remote Config
 * so all mobile APKs & remote users get the new endpoint in <1 second with 0 rebuilds.
 */
export async function syncUrlToRemoteConfig(apiUrl: string): Promise<void> {
  try {
    const rc = getRemoteConfig();
    const template = await rc.getTemplate();
    template.parameters['api_url'] = {
      defaultValue: { value: apiUrl },
      description: 'Automated Backend Tunnel HTTPS Endpoint',
    };
    await rc.publishTemplate(template);
    console.log(`⚡ [AUTO-ASSIGN] Firebase Remote Config updated ➔ ${apiUrl}`);
  } catch (err) {
    console.warn('ℹ️ [AUTO-ASSIGN] Remote Config sync skipped (or offline mode).');
  }
}

/**
 * Downloads cloudflared executable if missing on host machine
 */
async function ensureCloudflaredBinary(): Promise<string | null> {
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'cloudflared.exe' : 'cloudflared';
  const toolsDir = path.resolve(__dirname, '../../tools');
  const binPath = path.join(toolsDir, binName);

  if (fs.existsSync(binPath) && fs.statSync(binPath).size > 10000000) {
    return binPath;
  }

  if (!fs.existsSync(toolsDir)) fs.mkdirSync(toolsDir, { recursive: true });

  const url = isWin
    ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
    : 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64';

  console.log(`📥 [AUTO-TUNNEL] Binary missing — downloading ${binName}...`);

  return new Promise((resolve) => {
    function downloadFile(targetUrl: string, redirects = 0) {
      if (redirects > 5) {
        console.warn('⚠️ [AUTO-TUNNEL] Too many redirects during binary download.');
        return resolve(null);
      }
      https.get(targetUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return downloadFile(res.headers.location || '', redirects + 1);
        }
        if (res.statusCode !== 200) {
          console.warn(`⚠️ [AUTO-TUNNEL] Binary download failed with HTTP ${res.statusCode}`);
          return resolve(null);
        }
        const file = fs.createWriteStream(binPath);
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            if (!isWin) fs.chmodSync(binPath, '755');
            console.log(`✅ [AUTO-TUNNEL] ${binName} downloaded successfully (${fs.statSync(binPath).size} bytes).`);
            resolve(binPath);
          });
        });
      }).on('error', (err) => {
        console.warn('⚠️ [AUTO-TUNNEL] Download error:', err.message);
        resolve(null);
      });
    }

    downloadFile(url);
  });
}

/**
 * Starts Cloudflare Tunnel or falls back to Localtunnel
 */
export async function startAutoTunnel(port: number = 5000): Promise<string | null> {
  console.log(`🌐 [AUTO-TUNNEL] Initializing public outbound HTTPS tunnel for port ${port}...`);

  // 1. Try Cloudflare Tunnel executable
  try {
    const binPath = await ensureCloudflaredBinary();
    if (binPath) {
      console.log(`🚀 [AUTO-TUNNEL] Launching Cloudflare Tunnel process...`);
      const child = spawn(binPath, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`]);
      activeTunnelProcess = child;

      return new Promise((resolve) => {
        let resolved = false;

        const checkOutput = (data: Buffer) => {
          const str = data.toString();
          const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
          if (match && !resolved) {
            resolved = true;
            const publicUrl = match[0];
            console.log(`===============================================================`);
            console.log(`🌐 AUTOMATED CLOUDFLARE TUNNEL ACTIVE`);
            console.log(`🌐 HTTPS Endpoint: ${publicUrl}`);
            console.log(`===============================================================`);
            syncUrlToRemoteConfig(publicUrl);
            resolve(publicUrl);
          }
        };

        child.stdout.on('data', checkOutput);
        child.stderr.on('data', checkOutput);

        // Fallback to localtunnel if Cloudflare doesn't output URL in 15 seconds
        setTimeout(() => {
          if (!resolved) {
            console.warn('⏱️ [AUTO-TUNNEL] Cloudflare Tunnel startup timed out — switching to Localtunnel fallback...');
            resolve(startLocaltunnelFallback(port));
          }
        }, 15000);
      });
    }
  } catch (err) {
    console.warn('⚠️ [AUTO-TUNNEL] Cloudflare Tunnel failed, falling back:', err);
  }

  // 2. Fallback to Localtunnel
  return startLocaltunnelFallback(port);
}

async function startLocaltunnelFallback(port: number): Promise<string | null> {
  try {
    console.log(`🚀 [AUTO-TUNNEL] Launching Localtunnel fallback for port ${port}...`);
    // localtunnel is a dev-only dependency (see package.json devDependencies) —
    // it's only ever reached when AUTO_TUNNEL=true, which is itself a local-dev
    // opt-in flag never intended for Railway/production. Loaded lazily here so
    // production builds (npm ci --only=production) don't need the package
    // installed at all, since it's never imported at module load time.
    // @ts-ignore — localtunnel ships no type declarations
    const { default: localtunnel } = await import('localtunnel');
    const subdomain = 'evaratds-iiith-' + Math.floor(1000 + Math.random() * 9000);
    activeLocaltunnel = await localtunnel({ port, subdomain });

    console.log(`===============================================================`);
    console.log(`🌐 AUTOMATED LOCALTUNNEL ACTIVE`);
    console.log(`🌐 HTTPS Endpoint: ${activeLocaltunnel.url}`);
    console.log(`===============================================================`);

    await syncUrlToRemoteConfig(activeLocaltunnel.url);

    activeLocaltunnel.on('close', () => {
      console.warn('⚠️ [AUTO-TUNNEL] Localtunnel closed. Reconnecting in 5s...');
      setTimeout(() => startAutoTunnel(port), 5000);
    });

    return activeLocaltunnel.url;
  } catch (err) {
    console.error('❌ [AUTO-TUNNEL] All tunnel providers failed:', err);
    return null;
  }
}

export function stopAutoTunnel(): void {
  if (activeTunnelProcess) {
    try { activeTunnelProcess.kill(); } catch (e) {}
  }
  if (activeLocaltunnel) {
    try { activeLocaltunnel.close(); } catch (e) {}
  }
  console.log('⏹️ [AUTO-TUNNEL] Stopped.');
}
