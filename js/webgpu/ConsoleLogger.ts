// Copyright 2023, University of Colorado Boulder

/**
 * Supports "console logging" from shaders. See log.wgsl.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../imports.js';
import Vector3 from '../../../dot/js/Vector3.js';

export type ConsoleLogInfo = {
  logName: string;
  shaderName: string;
  hasAdditionalIndex: boolean;
  dataLength: number;
};

export default class ConsoleLogger {
  private static nextGlobalId = 1;
  private static readonly identifierMap = new Map<number, ConsoleLogInfo>();

  public static register( info: ConsoleLogInfo ): number {
    const id = ConsoleLogger.nextGlobalId++;

    ConsoleLogger.identifierMap.set( id, info );

    return id;
  }

  public static toEntries( arrayBuffer: ArrayBuffer ): ConsoleLogEntry[] {
    const data = new Uint32Array( arrayBuffer );
    const length = data[ 0 ];
    const offsetLength = length + 1;

    const entries = [];

    let index = 1;
    while ( index < offsetLength ) {
      const id = data[ index ];
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

      entries.push( new ConsoleLogEntry(
        info,
        workgroupIndex,
        localIndex,
        rawData,
        additionalIndex
      ) );

      index += length;
    }

    return entries;
  }
}

export class ConsoleLogEntry {
  public constructor(
    public readonly info: ConsoleLogInfo,
    public readonly workgroupIndex: Vector3,
    public readonly localIndex: Vector3,
    public readonly rawData: Uint32Array,
    public readonly additionalIndex: number | null
  ) {}
}

alpenglow.register( 'ConsoleLogger', ConsoleLogger );
