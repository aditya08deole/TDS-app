// @ts-ignore
import localtunnel from 'localtunnel';

async function main() {
  const port = Number(process.env.PORT || 5000);
  console.log(`🚀 Establishing secure outbound public tunnel for port ${port}...`);

  try {
    const tunnel = await localtunnel({
      port,
      subdomain: 'evaratds-iiith-' + Math.floor(Math.random() * 1000),
    });

    console.log(`===============================================================`);
    console.log(`🌐 Public Tunnel HTTPS URL: ${tunnel.url}`);
    console.log(`===============================================================`);

    tunnel.on('close', () => {
      console.log('⚠️ Tunnel connection closed. Reconnecting...');
      setTimeout(main, 5000);
    });

    tunnel.on('error', (err: any) => {
      console.error('❌ Tunnel Error:', err);
    });
  } catch (error) {
    console.error('❌ Failed to establish public tunnel:', error);
    setTimeout(main, 5000);
  }
}

main();
