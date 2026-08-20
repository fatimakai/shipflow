import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER } from './api.constants';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestIdMiddleware(
  request: RequestWithId,
  response: Response,
  next: NextFunction,
): void {
  const suppliedRequestId = request.header(REQUEST_ID_HEADER);
  const requestId =
    suppliedRequestId && REQUEST_ID_PATTERN.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();

  request.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
