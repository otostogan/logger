import { Inject, Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { appendFileSync, ensureDir, existsSync, writeFileSync } from 'fs-extra';
import { LOGGER_MODULE_OPTIONS } from '../app.constants';
import { ILoggerOptions } from '../app.interface';
import {
	LoggerProvider,
	BatchLogRecordProcessor,
} from '@opentelemetry/sdk-logs';

import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import {
	Logger as OTelLoggerInstance,
	SeverityNumber,
} from '@opentelemetry/api-logs';

@Injectable()
export class PublisherService {
	private APP_NAME: string;
	private OTEL_HOST?: string;
	private LOG_PATH?: string;
	private otelLogger?: OTelLoggerInstance;

	constructor(@Inject(LOGGER_MODULE_OPTIONS) options: ILoggerOptions) {
		this.APP_NAME = options.APP_NAME;
		this.OTEL_HOST = options.LOKI_HOST;
		this.LOG_PATH = options.LOG_PATH;

		if (this.OTEL_HOST) {
			try {
				const provider = new LoggerProvider({
					resource: resourceFromAttributes({
						[ATTR_SERVICE_NAME]: this.APP_NAME,
						[ATTR_SERVICE_VERSION]:
							process.env.APP_VERSION || '1.0.0',
					}),
					processors: [
						new BatchLogRecordProcessor(
							new OTLPLogExporter({
								url: `${this.OTEL_HOST.replace(/\/$/, '')}/v1/logs`,
							}),
						),
					],
				});

				this.otelLogger = provider.getLogger(this.APP_NAME);

				this.safeConsole(
					`✅ OTLP Logger connected → ${this.OTEL_HOST}`,
					'cyan',
				);
			} catch (err) {
				this.safeConsole(
					`❌ Failed to init OTEL logger: ${err}`,
					'red',
					true,
				);
			}
		} else {
			this.safeConsole(
				'⚠️ OTEL disabled (no LOKI_HOST / OTEL endpoint)',
				'yellow',
			);
		}
	}

	async log(
		message: string,
		opts: { archive?: boolean; terminal?: boolean; loki?: boolean } = {},
	) {
		const { archive = false, terminal = true, loki = true } = opts;

		if (terminal) this.safeConsole(message, 'yellow');
		if (loki) await this.pushOTEL('INFO', message);
		if (archive) await this.archive('logs', message);
	}

	async info(
		message: string,
		opts: { archive?: boolean; terminal?: boolean; loki?: boolean } = {},
	) {
		const { archive = false, terminal = true, loki = true } = opts;

		if (terminal) this.safeConsole(message, 'yellow');
		if (loki) await this.pushOTEL('INFO', message);
		if (archive) await this.archive('info', message);
	}

	async error(message: string) {
		this.safeConsole(message, 'magenta', true);
		await this.pushOTEL('ERROR', message);
		await this.archive('exceptions', message);
	}

	async critical(
		message: string,
		opts: { archive?: boolean; terminal?: boolean; loki?: boolean } = {},
	) {
		const { archive = false, terminal = true, loki = true } = opts;
		if (terminal) this.safeConsole(message, 'red', true);
		if (loki) await this.pushOTEL('ERROR', `[CRITICAL] ${message}`);
		if (archive) await this.archive('criticals', message);
	}

	private safeConsole(message: string, color: string, error = false) {
		const colors: Record<string, string> = {
			cyan: '\x1b[36m%s\x1b[0m',
			yellow: '\x1b[33m%s\x1b[0m',
			red: '\x1b[31m%s\x1b[0m',
			magenta: '\x1b[35m%s\x1b[0m',
		};
		const colorCode = colors[color] || '\x1b[0m%s\x1b[0m';
		const output = `[${this.APP_NAME}] ${message}`;

		if (error) console.error(colorCode, output);
		else console.log(colorCode, output);
	}

	private async pushOTEL(
		level: 'INFO' | 'ERROR',
		message: string,
		context: Record<string, any> = {},
	) {
		if (!this.otelLogger) return;

		try {
			this.otelLogger.emit({
				severityNumber:
					level === 'ERROR'
						? SeverityNumber.ERROR
						: SeverityNumber.INFO,
				severityText: level,
				body: message,
				attributes: {
					app: this.APP_NAME,
					env: process.env.NODE_ENV || 'dev',
					...context,
				},
			});
		} catch (err) {
			this.safeConsole(`❌ Failed to push OTEL log: ${err}`, 'red', true);
		}
	}

	private async archive(
		tag: 'info' | 'logs' | 'exceptions' | 'criticals',
		message: string,
	) {
		if (!this.LOG_PATH) return;
		try {
			const date = new Date().toISOString().split('T')[0];
			const file = path.join(this.LOG_PATH, tag, `${date}.log`);
			await ensureDir(path.dirname(file));
			const line = `[${new Date().toISOString()}] [${this.APP_NAME}] ${message}\n`;
			if (!existsSync(file)) writeFileSync(file, line);
			else appendFileSync(file, line);
		} catch (err) {
			this.safeConsole(`Failed to write file log: ${err}`, 'red', true);
		}
	}
}
