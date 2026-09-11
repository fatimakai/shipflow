import { ApiProperty } from '@nestjs/swagger';

export class LivenessResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: 'ShipFlow API' })
  service!: string;

  @ApiProperty({ example: '2026-08-07T08:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 42.7 })
  uptime!: number;
}

export class ReadinessChecksDto {
  @ApiProperty({ example: 'up' })
  configuration!: 'up';

  @ApiProperty({ example: 'up' })
  database!: 'up';
}

export class ReadinessResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ type: ReadinessChecksDto })
  checks!: ReadinessChecksDto;

  @ApiProperty({ example: '2026-08-07T08:00:00.000Z' })
  timestamp!: string;
}
