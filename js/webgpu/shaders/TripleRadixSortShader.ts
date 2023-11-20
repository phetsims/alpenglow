// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, ByteEncoder, ComputeShader, ComputeShaderSourceOptions, DeviceContext, ExecutableShader, Execution, u32, wgsl_main_radix_histogram, wgsl_main_radix_scatter, wgsl_main_reduce, wgsl_main_scan_replace, wgsl_main_scan_replace_add_2, wgsl_main_scan_replace_reduce } from '../../imports.js';
import { combineOptions, optionize3 } from '../../../../phet-core/js/optionize.js';

export type TripleRadixSortShaderOptions<T> = {

  // The type of the data for WGSL, e.g. 'f32'
  valueType: string;

  totalBits: number;

  // Extracting the bits from the value
  getBits: ( value: string, bitOffset: number, bitQuantity: number ) => string;

  workgroupSize?: number;
  grainSize?: number;
  lengthExpression?: string | null; // if null, no range checks will be made

  // radix options
  bitQuantity?: number;
  innerBitQuantity?: number;
  innerBitVectorSize?: number;
  earlyLoad?: boolean;

  // scan options
  factorOutSubexpressions?: boolean;
  nestSubexpressions?: boolean;
  isReductionExclusive?: boolean; // Whether our internal "reduces" data will be exclusive or inclusive (both are possible)

  // The number of bytes
  bytesPerElement: number;

  encodeElement: ( element: T, encoder: ByteEncoder ) => void;
  decodeElement: ( encoder: ByteEncoder, offset: number ) => T;
};

const DEFAULT_OPTIONS = {
  workgroupSize: 256,
  grainSize: 8,
  lengthExpression: null,

  bitQuantity: 8,
  innerBitQuantity: 2,
  innerBitVectorSize: 1,
  earlyLoad: false,

  factorOutSubexpressions: true,
  nestSubexpressions: false,
  isReductionExclusive: false,

  exclusive: false
} as const;

export default class TripleRadixSortShader<T> extends ExecutableShader<T[], T[]> {

  public static async create<T>(
    deviceContext: DeviceContext,
    name: string,
    providedOptions: TripleRadixSortShaderOptions<T>
  ): Promise<TripleRadixSortShader<T>> {
    const options = optionize3<TripleRadixSortShaderOptions<T>>()( {}, DEFAULT_OPTIONS, providedOptions );

    const dataCount = options.workgroupSize * options.grainSize;

    const iterationCount = Math.ceil( options.totalBits / options.bitQuantity );

    const radixSharedOptions: Record<string, unknown> = {
      valueType: options.valueType,
      workgroupSize: options.workgroupSize,
      grainSize: options.grainSize,
      factorOutSubexpressions: options.factorOutSubexpressions,
      nestSubexpressions: options.nestSubexpressions
    };

    const histogramShaders: ComputeShader[] = [];
    const scatterShaders: ComputeShader[] = [];

    for ( let i = 0; i < iterationCount; i++ ) {
      histogramShaders.push( await ComputeShader.fromSourceAsync(
        deviceContext.device, `${name} histogram ${i}`, wgsl_main_radix_histogram, [
          Binding.READ_ONLY_STORAGE_BUFFER,
          Binding.STORAGE_BUFFER
        ], combineOptions<ComputeShaderSourceOptions>( {
          length: options.lengthExpression,
          bitQuantity: options.bitQuantity,
          getBits: ( value: string ) => options.getBits( value, i * options.bitQuantity, options.bitQuantity )
        }, radixSharedOptions )
      ) );
      scatterShaders.push( await ComputeShader.fromSourceAsync(
        deviceContext.device, `${name} scatter ${i}`, wgsl_main_radix_scatter, [
          Binding.READ_ONLY_STORAGE_BUFFER,
          Binding.READ_ONLY_STORAGE_BUFFER,
          Binding.STORAGE_BUFFER
        ], combineOptions<ComputeShaderSourceOptions>( {
          length: options.lengthExpression,
          bitQuantity: options.bitQuantity,
          innerBitQuantity: options.innerBitQuantity,
          innerBitVectorSize: options.innerBitVectorSize,
          getBits: ( value: string ) => options.getBits( value, i * options.bitQuantity, options.bitQuantity ),
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
      nestSubexpressions: options.nestSubexpressions
    };

    // WGSL "ceil" equivalent
    // TODO: yeah, get length statements/expressions handled.
    const scanLength = options.lengthExpression ? `( ( ( ( ${options.lengthExpression} ) + ${u32( options.workgroupSize * options.grainSize - 1 )} ) / ${u32( options.workgroupSize * options.grainSize )} ) << ${u32( options.bitQuantity )} )` : null;

    // If we have a non-commutative reduction (with a striped access order)
    const reduceShader = await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} reduction`, wgsl_main_reduce, [
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], combineOptions<ComputeShaderSourceOptions>( {
        convergent: true,
        convergentRemap: false, // TODO: reconsider if we can enable this?
        inputOrder: 'blocked',
        inputAccessOrder: 'striped',
        length: scanLength,
        stripeOutput: false
      }, reduceSharedOptions )
    );

    const middleScanShader = await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} middle scan`, wgsl_main_scan_replace_reduce, [
        Binding.STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], combineOptions<ComputeShaderSourceOptions>( {
        // WGSL "ceil" equivalent
        length: scanLength ? `( ${scanLength} + ${u32( dataCount - 1 )} ) / ${u32( dataCount )}` : null,
        inputOrder: 'blocked',
        inputAccessOrder: 'striped',
        exclusive: options.isReductionExclusive,
        getAddedValue: null,
        stripeReducedOutput: false
      }, reduceSharedOptions )
    );

    const lowerScanShader = await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} lower scan`, wgsl_main_scan_replace, [
        Binding.STORAGE_BUFFER
      ], combineOptions<ComputeShaderSourceOptions>( {
        // WGSL "ceil" equivalent
        length: scanLength ? `( ${scanLength} + ${u32( dataCount * dataCount - 1 )} ) / ${u32( dataCount * dataCount )}` : null,
        inputOrder: 'blocked',
        inputAccessOrder: 'striped',
        exclusive: options.isReductionExclusive,
        getAddedValue: null
      }, reduceSharedOptions )
    );

    const upperScanShader = await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} upper scan`, wgsl_main_scan_replace_add_2, [
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], combineOptions<ComputeShaderSourceOptions>( {
        length: scanLength,
        inputOrder: 'blocked',
        inputAccessOrder: 'striped',
        exclusive: true,
        isReductionExclusive: options.isReductionExclusive
      }, reduceSharedOptions )
    );

    return new TripleRadixSortShader<T>( async ( execution: Execution, values: T[] ) => {
      const upperDispatchSize = Math.ceil( values.length / ( options.workgroupSize * options.grainSize ) );

      const histogramElementCount = upperDispatchSize * ( 2 ** options.bitQuantity );

      assert && assert( histogramElementCount <= dataCount * dataCount * dataCount );

      const middleDispatchSize = Math.ceil( histogramElementCount / ( options.workgroupSize * options.grainSize ) );
      const lowerDispatchSize = Math.ceil( histogramElementCount / ( options.workgroupSize * options.workgroupSize * options.grainSize * options.grainSize ) );

      // TODO: improve buffer usage patterns(!)

      const inputBuffer = execution.createByteEncoderBuffer( new ByteEncoder().encodeValues( values, options.encodeElement ) );
      const histogramBuffer = execution.createBuffer( 4 * histogramElementCount );
      const scannedHistogramBuffer = execution.createBuffer( 4 * histogramElementCount ); // TODO: just replace
      const reductionBuffer = execution.createBuffer( 4 * middleDispatchSize );
      const doubleReductionBuffer = execution.createBuffer( 4 * lowerDispatchSize );
      const otherDataBuffer = execution.createBuffer( options.bytesPerElement * values.length );

      let inBuffer = inputBuffer;
      let outBuffer = otherDataBuffer;

      for ( let i = 0; i < iterationCount; i++ ) {
        // execution.u32Numbers( inBuffer ).then( histogram => console.log( `input ${i}`, histogram ) ).catch( e => { throw e; } );

        execution.dispatch( histogramShaders[ i ], [
          inBuffer, histogramBuffer
        ], upperDispatchSize );

        // execution.u32Numbers( histogramBuffer ).then( histogram => console.log( `histogram ${i}`, histogram ) ).catch( e => { throw e; } );

        execution.dispatch( reduceShader, [
          histogramBuffer, reductionBuffer
        ], middleDispatchSize );

        // execution.u32Numbers( reductionBuffer ).then( histogram => console.log( `reduction ${i}`, histogram ) ).catch( e => { throw e; } );

        // TODO: use atomics so this stage isn't needed?
        execution.dispatch( middleScanShader, [
          reductionBuffer, doubleReductionBuffer
        ], lowerDispatchSize );

        // execution.u32Numbers( reductionBuffer ).then( histogram => console.log( `reduction (scanned) ${i}`, histogram ) ).catch( e => { throw e; } );
        // execution.u32Numbers( doubleReductionBuffer ).then( histogram => console.log( `double reduction ${i}`, histogram ) ).catch( e => { throw e; } );

        execution.dispatch( lowerScanShader, [
          doubleReductionBuffer
        ] );

        // execution.u32Numbers( doubleReductionBuffer ).then( histogram => console.log( `double reduction (scanned) ${i}`, histogram ) ).catch( e => { throw e; } );

        execution.dispatch( upperScanShader, [
          histogramBuffer, reductionBuffer, doubleReductionBuffer, scannedHistogramBuffer
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

      return new ByteEncoder( await execution.arrayBuffer( inBuffer ) ).decodeValues( options.decodeElement, options.bytesPerElement ).slice( 0, values.length );
    } );
  }
}

alpenglow.register( 'TripleRadixSortShader', TripleRadixSortShader );
