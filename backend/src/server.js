const app = require('./app');
const env = require('./config/env');
const { verifyConnection } = require('./config/database');

async function bootstrap() {
  try {
    const databaseTime = await verifyConnection();
    console.log('Database connected successfully at', databaseTime.current_time);
  } catch (error) {
    console.error('Database verification failed:', error.message);
  }

  app.listen(env.port, () => {
    console.log(`${env.appName} is running at http://localhost:${env.port}`);
  });
}

bootstrap();