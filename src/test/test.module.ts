import { Module } from '@nestjs/common';
import { MicroLogModule } from '../app.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { path } from 'app-root-path';
import { TestService } from './test.service';

@Module({
	imports: [
		MicroLogModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: () => {
				return {
					LOKI_HOST: 'http://loki:3100',
					LOG_PATH: path + '/publisher',
					APP_NAME: 'Test',
				};
			},
		}),
	],
	providers: [TestService],
})
export class TestModule {}
