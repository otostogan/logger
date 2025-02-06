<p align="center">
  <a href="https://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

## Description

[Nest](https://github.com/nestjs/nest) utility module for multi level logging.
Includes logging in Nest Console, Logs Files and Grafana Loki

## Installation

```bash
$ npm install sobbey-micro-logger
```

## Logger Config

```bash
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IMicroLoggerModuleAsyncOptions } from 'sobbey-micro-logger';

export const getLoggerConfig = (): IMicroLoggerModuleAsyncOptions => ({
  inject: [ConfigService],
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    APP_NAME: configService.get('APP_NAME') ?? 'API',
    LOG_PATH: `${process.cwd()}/publisher/${configService.get('APP_NAME')}`,
    LOKI_HOST: configService.get<string>('LOKI_URL'),
  }),
});

```

## Declaring MicroLogger Module

```bash
@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true }),
    MicroLogModule.forRootAsync(getLoggerConfig()),
  ],
  exports: [MicroLogModule],
})
export class SetupConfigModule {}
```

## Support

sobbey-micro-logger is an open source project. It can grow thanks to the sponsors and support by the amazing backers.


