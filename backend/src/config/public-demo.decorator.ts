import { SetMetadata } from '@nestjs/common';

export const PUBLIC_DEMO_UNAVAILABLE = 'shipflow:public-demo-unavailable';

export const UnavailableInPublicDemo = () =>
  SetMetadata(PUBLIC_DEMO_UNAVAILABLE, true);
