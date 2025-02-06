import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { IMicroLoggerModuleAsyncOptions } from './app.interface';
import { MICRO_LOGGER_MODULE_OPTIONS } from './app.constants';
import { PublisherService } from './logger/logger.service';

@Global()
@Module({})
export class MicroLogModule {
	static forRootAsync(
		options: IMicroLoggerModuleAsyncOptions,
	): DynamicModule {
		const asyncOptions = this.createAsyncOptionsProvider(options);
		return {
			module: MicroLogModule,
			imports: options.imports,
			providers: [asyncOptions, PublisherService],
			exports: [MicroLogModule, PublisherService],
		};
	}

	private static createAsyncOptionsProvider(
		options: IMicroLoggerModuleAsyncOptions,
	): Provider {
		return {
			provide: MICRO_LOGGER_MODULE_OPTIONS,
			useFactory: async (...args: any[]) => {
				const config = await options.useFactory(...args);
				return config;
			},
			inject: options.inject || [],
		};
	}
}
