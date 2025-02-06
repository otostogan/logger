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
		if (!this.excludeRoutes.includes(url)) {
			this._publisher.info(
				`-----------------------------------------------------`,
			);
			this._publisher.info(
				`TRIGGERED: ${method} '${url}' body:${JSON.stringify({
					body,
				})}, params: ${JSON.stringify({ params })}, query: ${JSON.stringify(
					{
						query,
					},
				)}, requestID: ${requestId}`,
			);
		}

		return next.handle().pipe(
			tap(() => {
				if (!this.excludeRoutes.includes(url)) {
					const timeTaken = Date.now() - startTime;
					this._publisher.log(
						`Completed ${method} ${url}, requestID: ${requestId}, Time Taken: ${timeTaken}ms`,
					);
					this._publisher.info(
						`-----------------------------------------------------`,
					);
				}
			}),
			catchError((error) => {
				this._publisher.critical(
					`ENDPOINT ERROR ${method} '${url}' ${JSON.stringify(
						error,
					)}, requestID: ${requestId}`,
				);
				this._publisher.info(
					`-----------------------------------------------------`,
				);
				return throwError(() => error);
			}),
		);
	}
}
