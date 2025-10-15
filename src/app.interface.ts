import { ModuleMetadata } from '@nestjs/common';

export interface ILoggerOptions {
	LOG_PATH?: string;
	APP_NAME: string;
	LOKI_HOST?: string;
}

export interface ILoggerModuleAsyncOptions
	extends Pick<ModuleMetadata, 'imports'> {
	useFactory: (...args: any[]) => Promise<ILoggerOptions> | ILoggerOptions;
	inject?: any[];
}
