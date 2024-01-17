// Copyright 2023-2024, University of Colorado Boulder

/**
 * Supports "console logging" from shaders. See log.wgsl.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ByteEncoder, ConcreteType } from '../../imports.js';
import Vector3 from '../../../../dot/js/Vector3.js';
import StrictOmit from '../../../../phet-core/js/types/StrictOmit.js';

export type ConsoleLogInfo<T = unknown> = {
  // Filled in when registered
  id: number;

  // Provided by the registering code
  logName: string;
  shaderName: string;
  hasAdditionalIndex: boolean;

  type: ConcreteType<T> | null;
  dataCount: number | null; // null if it is dynamic, and will be written into the entry
  lineToLog: ( line: ConsoleLoggedLine ) => unknown;
};

export default class ConsoleLogger {
  private static nextGlobalId = 1;
  private static readonly identifierMap = new Map<number, ConsoleLogInfo>();

  public static register<T>( info: StrictOmit<ConsoleLogInfo<T>, 'id'> ): number {
    assert && assert( ( info.type === null ) === ( info.dataCount === 0 ) );

    const id = ConsoleLogger.nextGlobalId++;

    // @ts-expect-error We're changing the type of the object (effectively)
    info.id = id;

    ConsoleLogger.identifierMap.set( id, info as ConsoleLogInfo );

    return id;
  }

  public static analyze( arrayBuffer: ArrayBuffer ): ConsoleLoggedShader[] {
    const encoder = new ByteEncoder( arrayBuffer );
    const data = encoder.fullU32Array;

    const length = data[ 0 ];
    const offsetLength = length + 1;

    const result: ConsoleLoggedShader[] = [];
    let shader = new ConsoleLoggedShader();

    let index = 1;
    while ( index < offsetLength ) {

      // TODO: clean up old console.logs once this code is more mature

      // console.log( `reading ${index}` );

      const id = data[ index++ ];

      // handle "shader barriers" (null entries)
      if ( id === 0 ) {
        // console.log( 'shader barrier' );
        if ( !shader.isEmpty() ) {
          shader.finalize();
          result.push( shader );
          shader = new ConsoleLoggedShader();
        }
        continue;
      }

      // console.log( `id: ${id}` );

      const info = ConsoleLogger.identifierMap.get( id )!;
      // if ( !info ) {
      //   debugger;
      // }
      assert && assert( info );

      const workgroupIndex = new Vector3(
        data[ index++ ],
        data[ index++ ],
        data[ index++ ]
      );

      const localIndex = new Vector3(
        data[ index++ ],
        data[ index++ ],
        data[ index++ ]
      );

      const additionalIndex = info.hasAdditionalIndex ? data[ index++ ] : null;

      let deserializedData: unknown = null;

      if ( info.type ) {
        const type = info.type;
        const u32sPerElement = type.bytesPerElement / 4;
        const dataCount = info.dataCount === null ? data[ index++ ] : info.dataCount;

        const dataOffset = index;

        deserializedData = _.range( 0, dataCount ).map( i => {
          return type.decode( encoder, dataOffset + i * u32sPerElement );
        } );

        index += dataCount * u32sPerElement;
      }

      // console.log( info, workgroupIndex, localIndex, deserializedData, additionalIndex );
      shader.add( info, workgroupIndex, localIndex, deserializedData, additionalIndex );
    }

    if ( !shader.isEmpty() ) {
      shader.finalize();
      result.push( shader );
    }

    return result;
  }

}

export class ConsoleLoggedEntry<T = unknown> {

  public readonly uniqueId: string;

  public constructor(
    public readonly info: ConsoleLogInfo,
    public readonly data: T,
    public readonly additionalIndex: number | null,
    otherEntries: ConsoleLoggedEntry[]
  ) {
    // We'll want to "increment" our ID if it shows up multiple times in the same thread
    let id = `${info.id}:${additionalIndex}`;

    // Hopefully doesn't come up a lot, this isn't the best algorithm for this (!)
    // eslint-disable-next-line @typescript-eslint/no-loop-func
    while ( otherEntries.some( entry => entry.uniqueId === id ) ) {
      id += '!';
    }

    this.uniqueId = id;
  }
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
    this.entries.push( new ConsoleLoggedEntry( info, data, additionalIndex, this.entries ) );
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

export class ConsoleLoggedLine<T = unknown> {
  public constructor(
    public readonly info: ConsoleLogInfo,
    public readonly additionalIndex: number | null,
    public readonly dataArray: T[],

    // Stored so it can be used for display (since our data is matched to these)
    public readonly threads: ConsoleLoggedThread[]
  ) {}

  public static toLogNull( line: ConsoleLoggedLine ): unknown {
    return null;
  }

  public static toLogRaw( line: ConsoleLoggedLine ): unknown {
    return line.dataArray;
  }

  public static toLogExisting( line: ConsoleLoggedLine ): unknown {
    return line.dataArray.filter( data => data !== null );
  }

  public static toLogExistingFlat( line: ConsoleLoggedLine ): unknown {
    return line.dataArray.filter( data => data !== null ).flat();
  }
}

export class ConsoleLoggedShader {

  public shaderName: string | null = null;
  public readonly threads: ConsoleLoggedThread[] = [];
  public readonly threadMap: Record<string, ConsoleLoggedThread> = {};
  public readonly logLines: ConsoleLoggedLine[] = [];

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

    const uniqueIdSet = new Set<string>();
    for ( const thread of this.threads ) {
      for ( const entry of thread.entries ) {
        uniqueIdSet.add( entry.uniqueId );
      }
    }

    const uniqueIds = Array.from( uniqueIdSet );

    const comparisons = new Map<string, number>();

    for ( let i = 0; i < uniqueIds.length; i++ ) {
      for ( let j = i + 1; j < uniqueIds.length; j++ ) {
        const a = uniqueIds[ i ];
        const b = uniqueIds[ j ];

        let count = 0;
        for ( const thread of this.threads ) {
          const indexA = thread.entries.findIndex( entry => entry.uniqueId === a );
          const indexB = thread.entries.findIndex( entry => entry.uniqueId === b );

          if ( indexA >= 0 && indexB >= 0 ) {
            count += Math.sign( indexA - indexB );
          }
        }

        comparisons.set( `${a} ${b}`, count );
        comparisons.set( `${b} ${a}`, -count );
      }
    }

    const compare = ( a: string, b: string ) => {
      return comparisons.get( `${a} ${b}` )!;
    };

    const sortedIds: string[] = [];

    // Since we might have some ids that are "tied" in comparisons, we'll do an O(n^3) sort (sorry!).
    // TODO: find a better way of doing these comparisons! We can probably subtract off things? Find a better-in-general
    // TODO: way of handling this.
    while ( uniqueIds.length ) {
      const scores = uniqueIds.map( id => {
        let score = 0;
        for ( const otherId of uniqueIds ) {
          if ( id === otherId ) { continue; }

          const comp = compare( id, otherId );

          if ( comp > 0 ) {
            score += 0xffff;
          }
          else if ( comp < 0 ) {
            score--;
          }
        }
        return score;
      } );

      const minIndex = scores.indexOf( Math.min( ...scores ) );

      const id = uniqueIds[ minIndex ];
      sortedIds.push( id );
      uniqueIds.splice( minIndex, 1 );
    }

    sortedIds.forEach( id => {
      const entries = this.threads.map( thread => thread.entries.find( entry => entry.uniqueId === id ) || null );
      const firstEntry = entries.find( entry => entry !== null )!;

      this.logLines.push( new ConsoleLoggedLine(
        firstEntry.info,
        firstEntry.additionalIndex,
        entries.map( entry => entry ? entry.data : null ),
        this.threads
      ) );
    } );
  }

  private sortThreads(): void {
    this.threads.sort( ( a, b ) => a.compare( b ) );
  }
}

alpenglow.register( 'ConsoleLogger', ConsoleLogger );
