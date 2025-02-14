// Copyright 2023-2025, University of Colorado Boulder

/**
 * Assists in logging out timestamps for WebGPU profiling.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import type { DeviceContext } from './DeviceContext.js';
import { webgpu } from '../WebGPUAPI.js';
import type { BufferLogger } from './BufferLogger.js';
import { ByteEncoder } from './ByteEncoder.js';
import { roundSymmetric } from '../../../../dot/js/util/roundSymmetric.js';

export class TimestampLogger {

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
    if ( deviceContext && webgpu.deviceHasFeature( deviceContext.device, 'timestamp-query' ) ) {
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

  public resolve(
    encoder: GPUCommandEncoder,
    bufferLogger: BufferLogger
  ): Promise<TimestampLoggerResult | null> {
    if ( this.querySet && this.queryBuffer ) {
      webgpu.encoderResolveQuerySet( encoder, this.querySet, 0, this.index, this.queryBuffer, 0 );

      const buffer = this.queryBuffer;

      return new Promise( ( resolve, reject ) => {
        bufferLogger.withBuffer( encoder, buffer, async arrayBuffer => {
          const absoluteTimestamps: bigint[] = [ ...new BigInt64Array( arrayBuffer ) ].slice( 0, this.index );
          const relativeTimestamps: number[] = absoluteTimestamps.map( timestamp => Number( timestamp - absoluteTimestamps[ 0 ] ) );

          const result = new TimestampLoggerResult(
            relativeTimestamps,
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
    this.querySet && webgpu.querySetDestroy( this.querySet );
    this.queryBuffer && webgpu.bufferDestroy( this.queryBuffer );
  }
}

export class TimestampLoggerResult {

  public readonly deltas: number[];

  public constructor(
    public readonly timestamps: number[],
    public readonly timestampNames: string[]
  ) {
    this.deltas = timestamps.slice( 1 ).map( ( timestamp, i ) => timestamp - timestamps[ i ] );
  }

  public toString(): string {
    const numToTimestamp = ( n: number ): string => {
      let result = '';
      let digits = '' + roundSymmetric( n );

      while ( digits.length ) {
        if ( digits.length > 3 ) {
          result = ',' + digits.slice( -3 ) + result;
          digits = digits.slice( 0, -3 );
        }
        else {
          result = digits + result;
          digits = '';
        }
      }
      return result;
    };

    const timestampSize = Math.max( ...this.timestamps.map( n => numToTimestamp( n ).length ) );
    const deltaSize = Math.max( ...this.deltas.map( n => numToTimestamp( n ).length ) );
    const nameSize = Math.max( ...this.timestampNames.map( s => s.length ) );

    let result = '';
    const timestampHeader = ByteEncoder.padLeft( 'time', ' ', timestampSize );
    const nameHeader = ByteEncoder.padRight( 'name', ' ', nameSize );
    const deltaHeader = ByteEncoder.padLeft( 'delta', ' ', deltaSize );
    result += `${timestampHeader} ${nameHeader} ${deltaHeader}\n`;
    for ( let i = 0; i < this.timestamps.length; i++ ) {
      const timestampString = ByteEncoder.padLeft( numToTimestamp( this.timestamps[ i ] ), ' ', timestampSize );
      const nameString = ByteEncoder.padRight( this.timestampNames[ i ], ' ', nameSize );
      const deltaString = i < this.deltas.length ? ByteEncoder.padLeft( numToTimestamp( this.deltas[ i ] ), ' ', deltaSize ) : '';
      result += `${timestampString} ${nameString} ${deltaString}\n`;
    }
    return result;
  }

  public static averageTimestamps( results: TimestampLoggerResult[] ): TimestampLoggerResult {
    if ( results.length === 0 ) {
      throw new Error( 'Need at least one result' );
    }

    // TODO: check timestampNames in assertions?

    const timestamps = _.range( 0, results[ 0 ].timestamps.length ).map( i => {
      return _.sum( results.map( result => result.timestamps[ i ] ) ) / results.length;
    } );

    return new TimestampLoggerResult( timestamps, results[ 0 ].timestampNames );
  }
}

alpenglow.register( 'TimestampLogger', TimestampLogger );