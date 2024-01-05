// Copyright 2024, University of Colorado Boulder

/**
 * A full reduction, with the method of reduction chosen based on the type and configuration.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BitOrder, BufferArraySlot, ceilDivideConstantDivisorWGSL, CompositeModule, ExecutionContext, getArrayType, MainRadixHistogramModule, MainRadixHistogramModuleOptions, MainRadixScatterModule, MainRadixScatterModuleOptions, ScanModule, ScanModuleOptions, u32, U32Add, U32Type } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';

type SelfOptions<T> = {
  // NOTE: Can be in-place of input and output point to the same slot
  input: BufferArraySlot<T>;
  output: BufferArraySlot<T>;

  order: BitOrder<T>;

  // NOTE: this is specified here, since we may be using FEWER than the maximum number of bits in the order.
  totalBits: number;

  radixWorkgroupSize: number;
  radixGrainSize: number;
  scanWorkgroupSize: number;
  scanGrainSize: number;
  lengthExpression: string; // TODO: we'll need ability to pass in context

  // radix options
  bitsPerPass?: number;
  bitsPerInnerPass?: number;
  earlyLoad?: boolean;

  // buffer options
  canMutateInput?: boolean;

  name?: string;
  log?: boolean;
};

type ParentOptions<T> = {
  mainRadixHistogramModuleOptions?: Partial<MainRadixHistogramModuleOptions<T>>;
  mainRadixScatterModuleOptions?: Partial<MainRadixScatterModuleOptions<T>>;
  scanModuleOptions?: Partial<ScanModuleOptions<number>>;
};

export type RadixSortModuleOptions<T> = SelfOptions<T> & ParentOptions<T>;

export const RADIX_SORT_MODULE_DEFAULTS = {
  name: 'radix sort',
  log: false, // TODO: how to deduplicate this? - We don't really need all of the defaults, right?
  bitsPerPass: 8,
  bitsPerInnerPass: 2,
  earlyLoad: false,
  canMutateInput: false,
  mainRadixHistogramModuleOptions: {},
  mainRadixScatterModuleOptions: {},
  scanModuleOptions: {}
} as const;

export const getMaxRadixBitsPerInnerPass = (
  workgroupSize: number,
  grainSize: number
): number => {
  const maxBitVectorSize = 4;

  const countBitQuantity = Math.ceil( Math.log2( workgroupSize * grainSize ) );
  const countsPerComponent = Math.floor( 32 / countBitQuantity );

  return Math.floor( Math.log2( maxBitVectorSize * countsPerComponent ) );
};

export const getRadixBitVectorSize = (
  workgroupSize: number,
  grainSize: number,
  bitsPerInnerPass: number
): number => {
  const countBitQuantity = Math.ceil( Math.log2( workgroupSize * grainSize ) );
  const countsPerComponent = Math.floor( 32 / countBitQuantity );

  const result = Math.ceil( ( 1 << bitsPerInnerPass ) / countsPerComponent );
  assert && assert( result <= 4 );

  return result;
};

// stageInputSize: number
export default class RadixSortModule<T> extends CompositeModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;
  public readonly histogram: BufferArraySlot<number>;

  public readonly extraSlots: BufferArraySlot<T>[];

  public constructor(
    providedOptions: RadixSortModuleOptions<T>
  ) {
    const options = optionize3<RadixSortModuleOptions<T>, SelfOptions<T>>()( {}, RADIX_SORT_MODULE_DEFAULTS, providedOptions );

    const radixReduction = options.radixWorkgroupSize * options.radixGrainSize;

    const initialStageInputSize = options.input.length;

    const order = options.order;
    const type = order.type;

    const iterationCount = Math.ceil( options.totalBits / options.bitsPerPass );

    assert && assert( getMaxRadixBitsPerInnerPass( options.radixWorkgroupSize, options.radixGrainSize ) >= options.bitsPerInnerPass,
      'Not enough bits for inner radix sort' );

    const bitVectorSize = getRadixBitVectorSize( options.radixWorkgroupSize, options.radixGrainSize, options.bitsPerInnerPass );

    const inPlace = options.input === options.output;

    const histogramElementCount = Math.ceil( initialStageInputSize / radixReduction ) * ( 1 << options.bitsPerPass );

    // TODO: perhaps sometime we can pack things more efficiently than this?
    const histogramSlot = new BufferArraySlot( getArrayType( U32Type, histogramElementCount ) );

    // based on inPlace/options.canMutateInput

    const iterationBufferPairs: BufferPair<T>[] = [];

    const extraSlots: BufferArraySlot<T>[] = [];

    if ( inPlace ) {
      // if we are in-place, we'll just ignore options.canMutateInput
      // NOTE: options.input === options.output

      // We'll always need a second buffer
      const extraBuffer = new BufferArraySlot( getArrayType( type, initialStageInputSize ) );
      extraSlots.push( extraBuffer );

      if ( iterationCount % 2 === 0 ) {
        // With an even number, we can ping-pong back to our original buffer!
        for ( let i = 0; i < iterationCount; i++ ) {
          iterationBufferPairs.push( new BufferPair(
            i % 2 === 0 ? options.input : extraBuffer,
            i % 2 === 0 ? extraBuffer : options.output
          ) );
        }
      }
      else {
        // We'll need a third buffer, since we can't ping-pong back to our original buffer otherwise (without a copy)
        const secondExtraBuffer = new BufferArraySlot( getArrayType( type, initialStageInputSize ) );
        extraSlots.push( secondExtraBuffer );

        assert && assert( iterationCount > 1, 'Here we would need to implement a copy? Just do not-in-place?' );

        iterationBufferPairs.push( new BufferPair(
          options.input,
          secondExtraBuffer
        ) );
        iterationBufferPairs.push( new BufferPair(
          secondExtraBuffer,
          extraBuffer
        ) );

        for ( let i = 2; i < iterationCount; i++ ) {
          iterationBufferPairs.push( new BufferPair(
            i % 2 === 0 ? extraBuffer : options.output,
            i % 2 === 0 ? options.output : extraBuffer
          ) );
        }
      }
    }
    else {
      if ( options.canMutateInput ) {
        if ( iterationCount % 2 === 0 ) {
          // We'll want an extra buffer, since the ping-pong would leave us with the input buffer as the output buffer
          const extraBuffer = new BufferArraySlot( getArrayType( type, initialStageInputSize ) );
          extraSlots.push( extraBuffer );

          for ( let i = 0; i < iterationCount; i++ ) {
            iterationBufferPairs.push( new BufferPair(
              i % 2 === 0 ? ( i === 0 ? options.input : options.output ) : extraBuffer,
              i % 2 === 0 ? extraBuffer : options.output
            ) );
          }
        }
        else {
          // If we have an odd number of iterations, we can just ping-pong between the input and output slots, no
          // extras!
          for ( let i = 0; i < iterationCount; i++ ) {
            iterationBufferPairs.push( new BufferPair(
              i % 2 === 0 ? options.input : options.output,
              i % 2 === 0 ? options.output : options.input
            ) );
          }
        }
      }
      else {
        // We'll always need an extra buffer, and we can choose which to output to first
        const extraBuffer = new BufferArraySlot( getArrayType( type, initialStageInputSize ) );
        extraSlots.push( extraBuffer );

        const evenOutputBuffer = iterationCount % 2 === 0 ? options.output : extraBuffer;
        const oddOutputBuffer = iterationCount % 2 === 0 ? extraBuffer : options.output;

        for ( let i = 0; i < iterationCount; i++ ) {
          iterationBufferPairs.push( new BufferPair(
            i % 2 === 0 ? ( i === 0 ? options.input : evenOutputBuffer ) : oddOutputBuffer,
            i % 2 === 0 ? oddOutputBuffer : evenOutputBuffer
          ) );
        }
      }
    }

    const histogramModules = _.range( 0, iterationCount ).map( i => {
      const bufferSlot = iterationBufferPairs[ i ].input;

      return new MainRadixHistogramModule( combineOptions<MainRadixHistogramModuleOptions<T>>( {
        name: `${options.name} histogram ${i} buf:#${bufferSlot.id}`,
        log: options.log,

        input: bufferSlot,
        output: histogramSlot,

        lengthExpression: options.lengthExpression,

        pass: i,
        order: options.order,
        bitsPerPass: options.bitsPerPass,

        workgroupSize: options.radixWorkgroupSize,
        grainSize: options.radixGrainSize
      }, options.mainRadixHistogramModuleOptions ) );
    } );

    const scatterModules = _.range( 0, iterationCount ).map( i => {
      const bufferPair = iterationBufferPairs[ i ];

      return new MainRadixScatterModule( combineOptions<MainRadixScatterModuleOptions<T>>( {
        name: `${options.name} scatter ${i} buf:#${bufferPair.input.id}=>#${bufferPair.output.id}`,
        log: options.log,

        input: bufferPair.input,
        output: bufferPair.output,
        histogramOffsets: histogramSlot,

        lengthExpression: options.lengthExpression,

        pass: i,
        order: options.order,
        bitsPerPass: options.bitsPerPass,
        bitsPerInnerPass: options.bitsPerInnerPass,
        innerBitVectorSize: bitVectorSize,
        earlyLoad: options.earlyLoad,

        workgroupSize: options.radixWorkgroupSize,
        grainSize: options.radixGrainSize
      }, options.mainRadixScatterModuleOptions ) );
    } );

    const scanModule = new ScanModule( combineOptions<ScanModuleOptions<number>>( {
      name: options.name + ' scan',
      log: options.log,

      input: histogramSlot,
      output: histogramSlot,

      binaryOp: U32Add,
      exclusive: true,
      lengthExpression: `( ${ceilDivideConstantDivisorWGSL( options.lengthExpression, radixReduction )} << ${u32( options.bitsPerPass )} )`,

      workgroupSize: options.scanWorkgroupSize,
      grainSize: options.scanGrainSize
    }, options.scanModuleOptions ) );

    super( _.range( 0, iterationCount ).flatMap( i => [
      histogramModules[ i ],
      scanModule,
      scatterModules[ i ]
    ] ), ( context: ExecutionContext, inputSize: number ) => {
      const scanSize = Math.ceil( inputSize / radixReduction ) * ( 1 << options.bitsPerPass );

      for ( let i = 0; i < iterationCount; i++ ) {
        // context.u32Numbers( histogramModules[ i ].input ).then( histogram => console.log( `input ${i} #${histogramModules[ i ].input.id}`, histogram ) ).catch( e => { throw e; } );

        histogramModules[ i ].execute( context, inputSize );
        scanModule.execute( context, scanSize );
        scatterModules[ i ].execute( context, inputSize );

        // context.u32Numbers( scatterModules[ i ].output ).then( histogram => console.log( `output ${i} #${scatterModules[ i ].output.id}`, histogram ) ).catch( e => { throw e; } );
      }
    } );

    this.input = providedOptions.input;
    this.output = providedOptions.output;
    this.histogram = histogramSlot;
    this.extraSlots = extraSlots;
  }

  public static getMaximumElementQuantity(
    radixWorkgroupSize: number,
    radixGrainSize: number,
    scanWorkgroupSize: number,
    scanGrainSize: number,
    bitsPerPass: number,
    scanLevels = 3
  ): number {
    // histogramCount = Math.ceil( inputSize / radixReduction ) * ( 1 << options.bitsPerPass )
    // max histogramCount = ( scanReduction ) ** scanLevels
    // Math.ceil( inputSize / radixReduction ) * ( 1 << options.bitsPerPass ) <= ( scanReduction ) ** scanLevels
    // Math.ceil( inputSize / radixReduction ) <= ( ( scanReduction ) ** scanLevels ) / ( 1 << options.bitsPerPass )
    // inputSize / radixReduction <= Math.floor( ( ( scanReduction ) ** scanLevels ) / ( 1 << options.bitsPerPass ) )
    // inputSize <= Math.floor( ( ( scanReduction ) ** scanLevels ) / ( 1 << options.bitsPerPass ) ) * radixReduction

    // TODO: can't specify array size with 4294967296 (2^32) or larger, since it can't be represented as an i32

    return ( radixWorkgroupSize * radixGrainSize ) * Math.floor( ( ( scanWorkgroupSize * scanGrainSize ) ** scanLevels ) / ( 1 << bitsPerPass ) );
  }
}
alpenglow.register( 'RadixSortModule', RadixSortModule );

class BufferPair<T> {
  public constructor(
    public readonly input: BufferArraySlot<T>,
    public readonly output: BufferArraySlot<T>
  ) {}

  public equals( other: BufferPair<T> ): boolean {
    return this.input === other.input && this.output === other.output;
  }
}