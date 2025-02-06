import { Inject, Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { appendFileSync, ensureDir, existsSync, writeFileSync } from 'fs-extra';
import { MICRO_LOGGER_MODULE_OPTIONS } from '../app.constants';
import { IMicroLoggerOptions } from '../app.interface';
import winston, { createLogger } from 'winston';
import LokiTransport = require('winston-loki');

@Injectable()
export class PublisherService extends Logger {
	public LOG_PATH: string;
	public APP_NAME: string;
	public LOKI_HOST?: string;
	loki?: winston.Logger;

	constructor(
		@Inject(MICRO_LOGGER_MODULE_OPTIONS) options: IMicroLoggerOptions,
	) {
		super();

		this.LOG_PATH = options.LOG_PATH;
		this.APP_NAME = options.APP_NAME;
		this.LOKI_HOST = options.LOKI_HOST;

		if (this.LOKI_HOST) {
			this.loki = createLogger({
				transports: [
					new LokiTransport({
						labels: {
							appName: options.APP_NAME,
						},
						host: options.LOKI_HOST,
					}),
				],
			});
		}
	}

	async log(message: string) {
		const color = '\x1b[36m%s\x1b[0m'; // tail
		console.log(color, `[${this.APP_NAME}] `, message);

		await this.publish('logs', message);

		if (this.loki) this.loki.info(`[${this.APP_NAME}] ${message}`);
	}

	async error(message: string) {
		const color = '\x1b[35m%s\x1b[0m'; // red
		console.error(color, `[${this.APP_NAME}] `, message);

		await this.publish('exceptions', message);
		if (this.loki) this.loki.error(`[${this.APP_NAME}] ${message}`);
	}

	async info(
		message: string,
		{ archive, terminal, loki } = {
			archive: true,
			terminal: true,
			loki: false,
		},
	) {
		if (terminal) {
			const color = '\x1b[33m%s\x1b[0m'; // yellow
			console.info(color, `[${this.APP_NAME}] `, message);
		}

		if (archive) await this.publish('info', message);

		if (loki && this.loki) {
			this.loki.info(`[${this.APP_NAME}] ${message}`);
		}
	}

	async critical(
		message: string,
		{ archive, terminal, loki } = {
			archive: true,
			terminal: true,
			loki: false,
		},
	) {
		if (terminal) {
			const color = '\x1b[31m%s\x1b[0m'; // red
			console.error(color, `[${this.APP_NAME}] `, message);
		}

		if (archive) await this.publish('criticals', message);

		if (loki && this.loki) {
			this.loki.error(`[${this.APP_NAME}] ${message}`);
		}
	}

	private async publish(
		tag: 'info' | 'logs' | 'exceptions' | 'criticals',
		message: string,
	) {
		const partitions = new Date().toISOString().split('T');
		const date = partitions[0];

		message = `[${this.APP_NAME}] ${partitions[1]}: ${message}`;

		const url = path.join(this.LOG_PATH, `./${tag}/${date}.log`);

		await ensureDir(path.join(this.LOG_PATH, `./${tag}`));

		if (!existsSync(url)) writeFileSync(url, `${message}\n`);
		else appendFileSync(url, `${message}\n`);
	}
}
