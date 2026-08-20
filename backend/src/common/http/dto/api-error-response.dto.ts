import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({
    oneOf: [
      { type: 'string', example: 'Bad Request' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['property unexpected should not exist'],
      },
    ],
  })
  message!: string | string[];

  @ApiProperty({ example: '/api/v1/example' })
  path!: string;

  @ApiProperty({ example: 'POST' })
  method!: string;

  @ApiProperty({ example: '2026-08-07T08:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '6a886fac-66d7-49bb-96d3-23ce90f47eab' })
  requestId!: string;
}
