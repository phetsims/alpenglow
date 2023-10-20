// Copyright 2023, University of Colorado Boulder

/**
 * Assists in logging out timestamps for WebGPU profiling.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferLogger, DeviceContext } from '../imports.js';

export default class TimestampLogger {

  private readonly querySet: GPUQuerySet | null = null;
  private readonly queryBuffer: GPUBuffer | null = null;
  private index = 0;
  private timestampNames: string[] = [];

  // TODO: custom mark/measure like window.performance. Allow grouped/nested(!), add visual display?

  public constructor(
    // nullable so that we can pass through the same interface in cases where we do NOT want to profile the code
    private readonly deviceContext: DeviceContext | null,
    private readonly capacity: number
  ) {
    if ( deviceContext && deviceContext.device.features.has( 'timestamp-query' ) ) {
      this.querySet = deviceContext.createQuerySet( capacity );
      this.queryBuffer = deviceContext.createQueryBuffer( 8 * capacity );
    }
  }

  public getGPUComputePassTimestampWrites(
    name: string
  ): GPUComputePassTimestampWrites | null {
    if ( !this.querySet || !this.queryBuffer ) {
      return null;
    }
    else {
      this.timestampNames.push( `${name} start` );
      this.timestampNames.push( `${name} end` );

      const startIndex = this.index++;
      const endIndex = this.index++;

      assert && assert( this.index <= this.capacity );

      return {
        querySet: this.querySet,
        beginningOfPassWriteIndex: startIndex,
        endOfPassWriteIndex: endIndex
      };
    }
  }

  public mark( encoder: GPUCommandEncoder, name: string ): void {
    if ( this.querySet ) {
      this.timestampNames.push( name );

      encoder.writeTimestamp( this.querySet, this.index++ );
    }
  }

  public resolve(
    encoder: GPUCommandEncoder,
    bufferLogger: BufferLogger
  ): Promise<TimestampLoggerResult | null> {
    if ( this.querySet && this.queryBuffer ) {
      encoder.resolveQuerySet( this.querySet, 0, this.index, this.queryBuffer, 0 );

      const buffer = this.queryBuffer;

      return new Promise( ( resolve, reject ) => {
        bufferLogger.withBuffer( encoder, buffer, async arrayBuffer => {
          const result = new TimestampLoggerResult(
            [ ...new BigInt64Array( arrayBuffer ) ].slice( 0, this.index ),
            this.timestampNames
          );

          this.index = 0;
          this.timestampNames = [];

          resolve( result );
        } );
      } );
    }
    else {
      return Promise.resolve( null );
    }
  }

  public dispose(): void {
    this.querySet?.destroy();
    this.queryBuffer?.destroy();
  }
}

export class TimestampLoggerResult {
  public constructor(
    public readonly timestamps: bigint[],
    public readonly timestampNames: string[]
  ) {}
}

alpenglow.register( 'TimestampLogger', TimestampLogger );
