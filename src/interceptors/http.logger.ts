import {
	CallHandler,
	ExecutionContext,
	Inject,
	Injectable,
	NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { PublisherService } from '../logger/logger.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class HTTPLoggerInterceptor implements NestInterceptor {
	constructor(
		private readonly _publisher: PublisherService,
		@Inject('EXCLUDE_ROUTE_LOGGING')
		private readonly excludeRoutes: string[],
	) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const request = context.switchToHttp().getRequest();
		const { method, url, body, params, query } = request;
		const requestId = uuidv4();
		const startTime = Date.now();

		const safeJson = (obj: any) => {
			try {
				return JSON.stringify(obj);
			} catch {
				return '"[Unserializable]"';
			}
		};

		if (!this.excludeRoutes.includes(url)) {
			this._publisher.info(
				'-----------------------------------------------------',
				{
					loki: false,
				},
			);

			this._publisher.info(
				`TRIGGERED: ${method} '${url}' body=${safeJson(body)} params=${safeJson(
					params,
				)} query=${safeJson(query)} requestID=${requestId}`,
				{ loki: false },
			);
		}

		return next.handle().pipe(
			tap(() => {
				if (!this.excludeRoutes.includes(url)) {
					const timeTaken = Date.now() - startTime;

					this._publisher.log(
						`Completed ${method} ${url}, requestID: ${requestId}, Time Taken: ${timeTaken}ms`,
						{ loki: false },
					);

					this._publisher['pushOTEL']?.('INFO', 'Request completed', {
						request_id: requestId,
						request_method: method,
						request_path: url,
						duration_ms: timeTaken,
						status: 'SUCCESS',
						request_body: safeJson(body),
						request_params: safeJson(params),
						request_query: safeJson(query),
					});

					this._publisher.info(
						'-----------------------------------------------------',
						{
							loki: false,
						},
					);
				}
			}),
			catchError((error) => {
				const timeTaken = Date.now() - startTime;

				const safeError =
					error && typeof error === 'object'
						? safeJson({
								name: error.name,
								message: error.message,
								stack: error.stack,
							})
						: String(error);

				this._publisher.critical(
					`ENDPOINT ERROR ${method} '${url}' ${safeError}, requestID: ${requestId}`,
					{ loki: false },
				);

				this._publisher['pushOTEL']?.('ERROR', 'Request failed', {
					request_id: requestId,
					request_method: method,
					request_path: url,
					duration_ms: timeTaken,
					error_message: error.message || 'Unknown error',
					status: 'FAILED',
					request_body: safeJson(body),
					request_params: safeJson(params),
					request_query: safeJson(query),
				});

				this._publisher.info(
					'-----------------------------------------------------',
					{
						loki: false,
					},
				);
				return throwError(() => error);
			}),
		);
	}
}
