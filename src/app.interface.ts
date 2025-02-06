import { ModuleMetadata } from '@nestjs/common';

export interface IMicroLoggerOptions {
	LOG_PATH: string;
	APP_NAME: string;
	LOKI_HOST: string;
}

export interface IMicroLoggerModuleAsyncOptions
	extends Pick<ModuleMetadata, 'imports'> {
	useFactory: (
		...args: any[]
	) => Promise<IMicroLoggerOptions> | IMicroLoggerOptions;
	inject?: any[];
}
