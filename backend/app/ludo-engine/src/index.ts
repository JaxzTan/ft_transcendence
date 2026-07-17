import { SocketServer } from './socket/server';

const PORT = parseInt(process.env.PORT || '3001');

async function main() {
  const server = new SocketServer();
  await server.start(PORT);

  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch(console.error);