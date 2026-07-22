import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // JwtStrategy reads the token from req.cookies; without this it's undefined.
  app.use(cookieParser());

  // Enforce the class-validator decorators on register/login DTOs.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // CORS - only allow requests from nginx origin
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? ['https://transcendence-ludo']
      : true, // Allow all origins in development
    credentials: true,
  });

  // Health endpoint
  const prisma = app.get(PrismaService);
  app.getHttpAdapter().get('/health', async () => {
    try {
      await prisma.db.$queryRaw`SELECT 1`;
      return { status: 'ok', timestamp: new Date().toISOString() };
    } catch (e) {
      return { status: 'error', timestamp: new Date().toISOString() };
    }
  });

  await app.listen(3000);
}
bootstrap();