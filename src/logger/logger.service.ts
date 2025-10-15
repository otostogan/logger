import { Inject, Injectable } from '@nestjs/common';
import * as path from 'path';
import { appendFileSync, ensureDir, existsSync, writeFileSync } from 'fs-extra';
import { LOGGER_MODULE_OPTIONS } from '../app.constants';
import { ILoggerOptions } from '../app.interface';
import winston, { createLogger, format } from 'winston';
import LokiTransport = require('winston-loki');

interface LogOptions {
	loki?: boolean;
	archive?: boolean;
	terminal?: boolean;
	meta?: Record<string, any>;
}

@Injectable()
export class PublisherService {
	public LOG_PATH?: string;
	public APP_NAME: string;
	public LOKI_HOST?: string;
	public loki?: winston.Logger;

	private readonly colors: Record<string, string> = {
		cyan: '\x1b[36m%s\x1b[0m',
		yellow: '\x1b[33m%s\x1b[0m',
		red: '\x1b[31m%s\x1b[0m',
		magenta: '\x1b[35m%s\x1b[0m',
		bgRedWhite: '\x1b[41m\x1b[37m%s\x1b[0m',
		gray: '\x1b[90m%s\x1b[0m',
	};

	constructor(@Inject(LOGGER_MODULE_OPTIONS) options: ILoggerOptions) {
		this.LOG_PATH = options.LOG_PATH;
		this.APP_NAME = options.APP_NAME;
		this.LOKI_HOST = options.LOKI_HOST;

		if (this.LOKI_HOST) {
			this.loki = createLogger({
				format: format.combine(format.timestamp(), format.json()),
				defaultMeta: {
					app_name: this.APP_NAME,
					env: process.env.NODE_ENV || 'development',
				},
				transports: [
					new LokiTransport({
						host: this.LOKI_HOST,
						labels: {
							app_name: this.APP_NAME,
							env: process.env.NODE_ENV || 'development',
						},
						json: true,
						replaceTimestamp: true,
						onConnectionError: (err) => console.log(err),
					}),
				],
			});
			this.info('Loki connected', { loki: false });
		}
	}

	async info(message: string, options: LogOptions = {}) {
		await this.handleLog('info', message, { ...options, tag: 'info' });
	}

	async error(message: string, options: LogOptions = {}) {
		await this.handleLog('error', message, {
			...options,
			tag: 'exceptions',
		});
	}

	async critical(message: string, options: LogOptions = {}) {
		await this.handleLog('critical', message, {
			...options,
			tag: 'criticals',
		});
	}

	private async handleLog(
		level: 'info' | 'error' | 'critical',
		message: string,
		{
			loki = true,
			archive = true,
			terminal = true,
			meta = {},
			tag,
		}: LogOptions & { tag: 'info' | 'exceptions' | 'criticals' },
	) {
		const timestamp = new Date().toISOString();
		const baseMeta = {
			app_name: this.APP_NAME,
			timestamp,
			...meta,
		};

		if (terminal) {
			const prefix = `[${this.APP_NAME}]`;
			switch (level) {
				case 'info':
					console.log(this.colors.yellow, `${prefix} ${message}`);
					break;
				case 'error':
					console.error(this.colors.red, `${prefix} ${message}`);
					break;
				case 'critical':
					console.error(
						this.colors.bgRedWhite,
						`${prefix} CRITICAL ${message}`,
					);
					break;
				default:
					console.log(this.colors.cyan, `${prefix} ${message}`);
					break;
			}
		}

		if (archive)
			await this.publish(tag, `${message} ${JSON.stringify(baseMeta)}`);

		if (loki && this.loki) {
			this.loki.log({
				level: level === 'critical' ? 'error' : level,
				message,
				labels: baseMeta,
			});
		}
	}

	private async publish(tag: string, message: string) {
		if (!this.LOG_PATH) return;
		const [date, time] = new Date().toISOString().split('T');
		const dir = path.join(this.LOG_PATH, tag);
		const filePath = path.join(dir, `${date}.log`);
		const line = `[${this.APP_NAME}] ${time.trim()} ${message}\n`;

		await ensureDir(dir);

		if (!existsSync(filePath)) writeFileSync(filePath, line);
		else appendFileSync(filePath, line);
	}
}
