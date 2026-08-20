import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX, API_VERSION } from '../common/http/api.constants';
import { EnvironmentVariables } from '../config/env.validation';

export function setupSwagger(
  app: INestApplication,
  configService: ConfigService<EnvironmentVariables, true>,
): void {
  const appName = configService.getOrThrow<string>('APP_NAME');
  const documentConfig = new DocumentBuilder()
    .setTitle(appName)
    .setDescription('NestShip backend API')
    .setVersion(API_VERSION)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .addCookieAuth('nestship_refresh', {
      type: 'apiKey',
      in: 'cookie',
    })
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig);

  SwaggerModule.setup(`${API_PREFIX}/docs`, app, document, {
    jsonDocumentUrl: `${API_PREFIX}/docs-json`,
  });
}
