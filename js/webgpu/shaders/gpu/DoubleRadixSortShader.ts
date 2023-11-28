// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType, BitOrder, ByteEncoder, ComputeShader, ComputeShaderSourceOptions, ConsoleLogger, DeviceContext, ExecutableShader, Execution, getMaxRadixBitsPerInnerPass, u32, wgsl_main_radix_histogram, wgsl_main_radix_scatter, wgsl_main_reduce, wgsl_main_scan, wgsl_main_scan_add_1 } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import { getRadixBitVectorSize } from './TripleRadixSortShader.js';

export type DoubleRadixSortShaderOptions<T> = {
  order: BitOrder<T>;

  // NOTE: this is specified here, since we may be using FEWER than the maximum number of bits in the order.
  totalBits: number;

  workgroupSize?: number;
  grainSize?: number;
  lengthExpression?: string | null; // if null, no range checks will be made

  // radix options
  bitsPerPass?: number;
  bitsPerInnerPass?: number;
  earlyLoad?: boolean;

  // scan options
  factorOutSubexpressions?: boolean;
  nestSubexpressions?: boolean;
  isReductionExclusive?: boolean; // Whether our internal "reduces" data will be exclusive or inclusive (both are possible)

  log?: boolean;
};

const DEFAULT_OPTIONS = {
  workgroupSize: 256,
  grainSize: 8,
  lengthExpression: null,

  bitsPerPass: 8,
  bitsPerInnerPass: 2,
  earlyLoad: false,

  factorOutSubexpressions: true,
  nestSubexpressions: false,
  isReductionExclusive: false,

  log: false
} as const;

export default class DoubleRadixSortShader<T> extends ExecutableShader<T[], T[]> {

  public static getMaximumElementQuantity(
    workgroupSize: number,
    grainSize: number,
    bitsPerPass: number
  ): number {
    const scanDataCount = workgroupSize * grainSize;

    return scanDataCount * Math.floor( scanDataCount * scanDataCount / ( 1 << bitsPerPass ) );
  }

  public static async create<T>(
    deviceContext: DeviceContext,
    name: string,
    providedOptions: DoubleRadixSortShaderOptions<T>
  ): Promise<DoubleRadixSortShader<T>> {
    const options = optionize3<DoubleRadixSortShaderOptions<T>>()( {}, DEFAULT_OPTIONS, providedOptions );

    const order = options.order;
    const type = order.type;

    const dataCount = options.workgroupSize * options.grainSize;

    const iterationCount = Math.ceil( options.totalBits / options.bitsPerPass );

    assert && assert( getMaxRadixBitsPerInnerPass( options.workgroupSize, options.grainSize ) >= options.bitsPerInnerPass,
      'Not enough bits for inner radix sort' );

    const bitVectorSize = getRadixBitVectorSize( options.workgroupSize, options.grainSize, options.bitsPerInnerPass );

    const histogramShaders: ComputeShader[] = [];
    const scatterShaders: ComputeShader[] = [];

    for ( let i = 0; i < iterationCount; i++ ) {
      const radixSharedOptions: Record<string, unknown> = {
        order: order,
        pass: i,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        factorOutSubexpressions: options.factorOutSubexpressions,
        nestSubexpressions: options.nestSubexpressions,
        length: options.lengthExpression,
        bitsPerPass: options.bitsPerPass,
        log: options.log
      };

      histogramShaders.push( await ComputeShader.fromSourceAsync(
        deviceContext.device, `${name} histogram ${i}`, wgsl_main_radix_histogram, [
          BindingType.READ_ONLY_STORAGE_BUFFER,
          BindingType.STORAGE_BUFFER
        ], combineOptions<ComputeShaderSourceOptions>( {

        }, radixSharedOptions )
      ) );
      scatterShaders.push( await ComputeShader.fromSourceAsync(
        deviceContext.device, `${name} scatter ${i}`, wgsl_main_radix_scatter, [
          BindingType.READ_ONLY_STORAGE_BUFFER,
          BindingType.READ_ONLY_STORAGE_BUFFER,
          BindingType.STORAGE_BUFFER
        ], combineOptions<ComputeShaderSourceOptions>( {
          bitsPerInnerPass: options.bitsPerInnerPass,
          innerBitVectorSize: bitVectorSize,
          factorOutSubexpressions: options.factorOutSubexpressions,
          earlyLoad: options.earlyLoad
        }, radixSharedOptions )
      ) );
    }

    const reduceSharedOptions = {
      valueType: 'u32',
      workgroupSize: options.workgroupSize,
      grainSize: options.grainSize,
      identity: '0u',
      combineExpression: ( a: string, b: string ) => `${a} + ${b}`,
      combineStatements: null,
      factorOutSubexpressions: options.factorOutSubexpressions,
      nestSubexpressions: options.nestSubexpressions,
      log: options.log
    };

    // WGSL "ceil" equivalent
    // TODO: yeah, get length statements/expressions handled.
    const scanLength = options.lengthExpression ? `( ( ( ( ${options.lengthExpression} ) + ${u32( options.workgroupSize * options.grainSize - 1 )} ) / ${u32( options.workgroupSize * options.grainSize )} ) << ${u32( options.bitsPerPass )} )` : null;

    const reduceShader = await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} reduction`, wgsl_main_reduce, [
        BindingType.READ_ONLY_STORAGE_BUFFER,
        BindingType.STORAGE_BUFFER
      ], combineOptions<ComputeShaderSourceOptions>( {
        length: scanLength,
        convergent: true,
        convergentRemap: false, // NOTE: could consider trying to enable this, but probably not worth it
        inputOrder: 'blocked',
        inputAccessOrder: 'striped',
        stripeOutput: false
      }, reduceSharedOptions )
    );

    const lowerScanShader = await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} lower scan`, wgsl_main_scan, [
        BindingType.STORAGE_BUFFER
      ], combineOptions<ComputeShaderSourceOptions>( {
        // WGSL "ceil" equivalent
        length: scanLength ? `( ${scanLength} + ${u32( dataCount - 1 )} ) / ${u32( dataCount )}` : null,
        inputOrder: 'blocked',
        inputAccessOrder: 'striped',
        exclusive: options.isReductionExclusive,
        getAddedValue: null,
        inPlace: true
      }, reduceSharedOptions )
    );

    const upperScanShader = await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} upper scan`, wgsl_main_scan_add_1, [
        BindingType.READ_ONLY_STORAGE_BUFFER,
        BindingType.READ_ONLY_STORAGE_BUFFER,
        BindingType.STORAGE_BUFFER
      ], combineOptions<ComputeShaderSourceOptions>( {
        length: scanLength,
        inputOrder: 'blocked',
        inputAccessOrder: 'striped',
        exclusive: true,
        isReductionExclusive: options.isReductionExclusive,
        inPlace: false // TODO: allow in-place!
      }, reduceSharedOptions )
    );

    // TODO: can we factor this out(!)
    const logShader = options.log ? await ConsoleLogger.getLogBarrierComputeShader( deviceContext ) : null;

    return new DoubleRadixSortShader<T>( async ( execution: Execution, values: T[] ) => {
      const upperDispatchSize = Math.ceil( values.length / ( options.workgroupSize * options.grainSize ) );

      const histogramElementCount = upperDispatchSize * ( 2 ** options.bitsPerPass );

      assert && assert( histogramElementCount <= dataCount * dataCount );

      const middleDispatchSize = Math.ceil( histogramElementCount / ( options.workgroupSize * options.grainSize ) );

      // TODO: improve buffer usage patterns(!)

      const inputBuffer = execution.createByteEncoderBuffer( new ByteEncoder().encodeValues( values, type.encode ) );
      const histogramBuffer = execution.createBuffer( 4 * histogramElementCount );
      const scannedHistogramBuffer = execution.createBuffer( 4 * histogramElementCount ); // TODO: just replace
      const reductionBuffer = execution.createBuffer( 4 * middleDispatchSize );
      const otherDataBuffer = execution.createBuffer( type.bytesPerElement * values.length );

      let inBuffer = inputBuffer;
      let outBuffer = otherDataBuffer;

      logShader && execution.setLogBarrierShader( logShader );

      for ( let i = 0; i < iterationCount; i++ ) {
        // execution.u32Numbers( inBuffer ).then( histogram => console.log( `input ${i}`, histogram ) ).catch( e => { throw e; } );

        execution.dispatch( histogramShaders[ i ], [
          inBuffer, histogramBuffer
        ], upperDispatchSize );

        // execution.u32Numbers( histogramBuffer ).then( histogram => console.log( `histogram ${i}`, histogram ) ).catch( e => { throw e; } );

        execution.dispatch( reduceShader, [
          histogramBuffer, reductionBuffer
        ], middleDispatchSize );
        execution.dispatch( lowerScanShader, [
          reductionBuffer
        ] );
        execution.dispatch( upperScanShader, [
          histogramBuffer, reductionBuffer, scannedHistogramBuffer
        ], middleDispatchSize );

        // execution.u32Numbers( scannedHistogramBuffer ).then( histogram => console.log( `scanned histogram ${i}`, histogram ) ).catch( e => { throw e; } );

        execution.dispatch( scatterShaders[ i ], [
          inBuffer, scannedHistogramBuffer, outBuffer
        ], upperDispatchSize );

        // execution.u32Numbers( outBuffer ).then( histogram => console.log( `output ${i}`, histogram ) ).catch( e => { throw e; } );

        const temp = inBuffer;
        inBuffer = outBuffer;
        outBuffer = temp;
      }

      return new ByteEncoder( await execution.arrayBuffer( inBuffer ) ).decodeValues( type.decode, type.bytesPerElement ).slice( 0, values.length );
    }, options );
  }
}

alpenglow.register( 'DoubleRadixSortShader', DoubleRadixSortShader );