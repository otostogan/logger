import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ILoggerModuleAsyncOptions } from './app.interface';
import { LOGGER_MODULE_OPTIONS } from './app.constants';
import { PublisherService } from './logger/logger.service';

@Global()
@Module({})
export class LogModule {
	static forRootAsync(options: ILoggerModuleAsyncOptions): DynamicModule {
		const asyncOptions = this.createAsyncOptionsProvider(options);
		return {
			module: LogModule,
			imports: options.imports,
			providers: [asyncOptions, PublisherService],
			exports: [LogModule, PublisherService],
		};
	}

	private static createAsyncOptionsProvider(
		options: ILoggerModuleAsyncOptions,
	): Provider {
		return {
			provide: LOGGER_MODULE_OPTIONS,
			useFactory: async (...args: any[]) => {
				const config = await options.useFactory(...args);
				return config;
			},
			inject: options.inject || [],
		};
	}
}
