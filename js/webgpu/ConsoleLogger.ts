// Copyright 2023, University of Colorado Boulder

/**
 * Supports "console logging" from shaders. See log.wgsl.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ComputeShader, DeviceContext, wgsl_main_log_barrier } from '../imports.js';
import Vector3 from '../../../dot/js/Vector3.js';

export type ConsoleLogInfo<T = unknown> = {
  logName: string;
  shaderName: string;
  hasAdditionalIndex: boolean;
  dataLength: number;
  deserialize: ( arr: Uint32Array ) => T;
};

export default class ConsoleLogger {
  private static nextGlobalId = 1;
  private static readonly identifierMap = new Map<number, ConsoleLogInfo>();

  public static register( info: ConsoleLogInfo ): number {
    const id = ConsoleLogger.nextGlobalId++;

    ConsoleLogger.identifierMap.set( id, info );

    return id;
  }

  public static analyze( arrayBuffer: ArrayBuffer ): ConsoleLoggedShader[] {
    const data = new Uint32Array( arrayBuffer );
    const length = data[ 0 ];
    const offsetLength = length + 1;

    const result: ConsoleLoggedShader[] = [];
    let shader = new ConsoleLoggedShader();

    let index = 1;
    while ( index < offsetLength ) {
      const id = data[ index ];

      // handle "shader barriers" (null entries)
      if ( id === 0 ) {
        if ( !shader.isEmpty() ) {
          shader.finalize();
          result.push( shader );
          shader = new ConsoleLoggedShader();
        }
        index++;
        continue;
      }

      const info = ConsoleLogger.identifierMap.get( id )!;
      assert && assert( info );

      const length = info.dataLength + ( info.hasAdditionalIndex ? 1 : 0 ) + 7;

      const workgroupIndex = new Vector3(
        data[ index + 1 ],
        data[ index + 2 ],
        data[ index + 3 ]
      );

      const localIndex = new Vector3(
        data[ index + 4 ],
        data[ index + 5 ],
        data[ index + 6 ]
      );

      const additionalIndex = info.hasAdditionalIndex ? data[ index + 7 ] : null;

      const dataOffset = index + ( info.hasAdditionalIndex ? 8 : 7 );

      const rawData = data.slice( dataOffset, dataOffset + info.dataLength );

      const deserializedData = rawData.length ? info.deserialize( rawData ) : null;

      shader.add( info, workgroupIndex, localIndex, deserializedData, additionalIndex );

      index += length;
    }

    if ( !shader.isEmpty() ) {
      shader.finalize();
      result.push( shader );
    }

    return result;
  }

  public static async getLogBarrierComputeShader( deviceContext: DeviceContext ): Promise<ComputeShader> {
    // TODO: memoize
    return ComputeShader.fromSourceAsync(
      deviceContext.device, 'log barrier', wgsl_main_log_barrier, [], {
        log: true
      }
    );
  }
}

export class ConsoleLoggedEntry<T = unknown> {
  public constructor(
    public readonly info: ConsoleLogInfo,
    public readonly data: T,
    public readonly additionalIndex: number | null
  ) {}
}

// TODO: Should we create ConsoleLoggedWorkgroup?
export class ConsoleLoggedThread {

  public readonly entries: ConsoleLoggedEntry[] = [];

  public constructor(
    public readonly workgroupIndex: Vector3,
    public readonly localIndex: Vector3
  ) {}

  public add(
    info: ConsoleLogInfo,
    data: unknown,
    additionalIndex: number | null
  ): void {
    this.entries.push( new ConsoleLoggedEntry( info, data, additionalIndex ) );
  }

  public compare( other: ConsoleLoggedThread ): number {
    if ( this.workgroupIndex.z !== other.workgroupIndex.z ) {
      return this.workgroupIndex.z - other.workgroupIndex.z;
    }
    if ( this.workgroupIndex.y !== other.workgroupIndex.y ) {
      return this.workgroupIndex.y - other.workgroupIndex.y;
    }
    if ( this.workgroupIndex.x !== other.workgroupIndex.x ) {
      return this.workgroupIndex.x - other.workgroupIndex.x;
    }
    if ( this.localIndex.z !== other.localIndex.z ) {
      return this.localIndex.z - other.localIndex.z;
    }
    if ( this.localIndex.y !== other.localIndex.y ) {
      return this.localIndex.y - other.localIndex.y;
    }
    if ( this.localIndex.x !== other.localIndex.x ) {
      return this.localIndex.x - other.localIndex.x;
    }
    return 0;
  }
}

export class ConsoleLoggedShader {

  public shaderName: string | null = null;
  public readonly threads: ConsoleLoggedThread[] = [];
  public readonly threadMap: Record<string, ConsoleLoggedThread> = {};

  public add(
    info: ConsoleLogInfo,
    workgroupIndex: Vector3,
    localIndex: Vector3,
    data: unknown,
    additionalIndex: number | null
  ): void {
    const key = `${workgroupIndex.x},${workgroupIndex.y},${workgroupIndex.z},${localIndex.x},${localIndex.y},${localIndex.z}`;
    let thread = this.threadMap[ key ];
    if ( !thread ) {
      thread = new ConsoleLoggedThread( workgroupIndex, localIndex );
      this.threadMap[ key ] = thread;
      this.threads.push( thread );
    }
    thread.add( info, data, additionalIndex );

    if ( this.shaderName === null ) {
      this.shaderName = info.shaderName;
    }

    assert && assert( this.shaderName === info.shaderName );
  }

  public isEmpty(): boolean {
    return this.threads.length === 0;
  }

  public finalize(): void {
    this.sortThreads();
  }

  private sortThreads(): void {
    this.threads.sort( ( a, b ) => a.compare( b ) );
  }
}

alpenglow.register( 'ConsoleLogger', ConsoleLogger );
