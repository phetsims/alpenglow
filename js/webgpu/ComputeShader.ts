// Copyright 2023, University of Colorado Boulder

/**
 * Represents a compiled shader and associated data.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { addLineNumbers, alpenglow, BindingType, DualSnippet, DualSnippetSource, partialWGSLBeautify, TimestampLogger, WGSLContext, WGSLModuleDeclarations } from '../imports.js';
import { combineOptions, optionize3 } from '../../../phet-core/js/optionize.js';

const LOG_SHADERS = true;

export type ComputeShaderOptions = {
  partialBeautify?: boolean;
  log?: boolean;
};

export type ComputeShaderDispatchOptions = {
  // Mutually exclusive options
  timestampLogger?: TimestampLogger | null;
  timestampWrites?: GPUComputePassTimestampWrites | null;

  logBuffer?: GPUBuffer | null;
};

export type ComputeShaderSourceOptions = Record<string, unknown>;

// Our logging buffer will be at @group(0) @binding(${LOG_BINDING})
const LOG_BINDING = 64;

const DEFAULT_OPTIONS = {
  partialBeautify: true,
  log: false
} as const;

const DEFAULT_DISPATCH_OPTIONS = {
  timestampLogger: null,
  timestampWrites: null,
  logBuffer: null
} as const;

const DEFAULT_SOURCE_OPTIONS = {
  log: false,
  logBinding: LOG_BINDING
};

export default class ComputeShader {

  public readonly wgsl: WGSLModuleDeclarations;
  public readonly module: GPUShaderModule;
  public readonly bindGroupLayout: GPUBindGroupLayout;

  // This will be available by the time it can be accessed publicly
  public pipeline!: GPUComputePipeline;

  private readonly pipelinePromise: Promise<GPUComputePipeline>;

  private readonly log: boolean;

  public constructor(
    public readonly name: string,
    wgsl: string,
    public readonly bindingTypes: BindingType[],
    public readonly device: GPUDevice,
    async: boolean,
    providedOptions?: ComputeShaderOptions
  ) {

    const options = optionize3<ComputeShaderOptions>()( {}, DEFAULT_OPTIONS, providedOptions );

    this.log = options.log;

    if ( options.partialBeautify ) {
      wgsl = partialWGSLBeautify( wgsl );
    }

    this.wgsl = wgsl;

    if ( LOG_SHADERS ) {
      console.groupCollapsed( `[shader] ${name}` );
      console.log( addLineNumbers( wgsl ) );
      // console.log( wgsl ) );
      console.groupEnd();
    }

    this.module = device.createShaderModule( {
      label: name,
      code: this.wgsl
    } );

    this.bindGroupLayout = device.createBindGroupLayout( {
      label: `${name} bindGroupLayout`,
      entries: [
        ...this.bindingTypes.map( ( binding, i ) => binding.getBindGroupLayoutEntry( i ) ),

        // Add in an entry for our logging buffer (if we're logging)
        ...( this.log ? [ BindingType.STORAGE_BUFFER.getBindGroupLayoutEntry( LOG_BINDING ) ] : [] )
      ]
    } );

    const pipelineDescriptor: GPUComputePipelineDescriptor = {
      label: `${name} pipeline`,
      layout: device.createPipelineLayout( {
        bindGroupLayouts: [ this.bindGroupLayout ]
      } ),
      compute: {
        module: this.module,
        entryPoint: 'main'
      }
    };

    if ( async ) {
      this.pipelinePromise = device.createComputePipelineAsync( pipelineDescriptor );

      // TODO: order promises better
      this.pipelinePromise.then( pipeline => {
        this.pipeline = pipeline;
      } ).catch( e => { throw e; } );
    }
    else {
      this.pipeline = device.createComputePipeline( pipelineDescriptor );
      this.pipelinePromise = Promise.resolve( this.pipeline );
    }
  }

  private getBindGroup( resources: ( GPUBuffer | GPUTextureView )[], logBuffer: GPUBuffer | null ): GPUBindGroup {
    assert && assert( this.bindingTypes.length === resources.length );
    assert && assert( !this.log || logBuffer, 'logBuffer should be provided if we are logging' );

    // TODO: can we avoid creating bind groups for EVERY dispatch?
    return this.device.createBindGroup( {
      label: `${this.name} bindGroup`,
      layout: this.bindGroupLayout,
      entries: [
        ...this.bindingTypes.map( ( binding, i ) => binding.getBindGroupEntry( i, resources[ i ] ) ),
        ...( ( this.log && logBuffer ) ? [ BindingType.STORAGE_BUFFER.getBindGroupEntry( LOG_BINDING, logBuffer ) ] : [] )
      ]
    } );
  }

  public dispatch(
    encoder: GPUCommandEncoder,
    resources: ( GPUBuffer | GPUTextureView )[],
    dispatchX = 1,
    dispatchY = 1,
    dispatchZ = 1,
    providedOptions?: ComputeShaderDispatchOptions
  ): void {

    const options = optionize3<ComputeShaderDispatchOptions>()( {}, DEFAULT_DISPATCH_OPTIONS, providedOptions );

    const computePass = encoder.beginComputePass( this.getComputePassDescriptor(
      false, options.timestampLogger, options.timestampWrites
    ) );
    computePass.setPipeline( this.pipeline );
    computePass.setBindGroup( 0, this.getBindGroup( resources, options.logBuffer ) );
    computePass.dispatchWorkgroups( dispatchX, dispatchY, dispatchZ );
    computePass.end();
  }

  public dispatchIndirect(
    encoder: GPUCommandEncoder,
    resources: ( GPUBuffer | GPUTextureView )[],
    indirectBuffer: GPUBuffer,
    indirectOffset: number,
    providedOptions?: ComputeShaderDispatchOptions
  ): void {

    const options = optionize3<ComputeShaderDispatchOptions>()( {}, DEFAULT_DISPATCH_OPTIONS, providedOptions );

    const computePass = encoder.beginComputePass( this.getComputePassDescriptor(
      true, options.timestampLogger, options.timestampWrites
    ) );
    computePass.setPipeline( this.pipeline );
    computePass.setBindGroup( 0, this.getBindGroup( resources, options.logBuffer ) );
    computePass.dispatchWorkgroupsIndirect( indirectBuffer, indirectOffset );
    computePass.end();
  }

  private getComputePassDescriptor(
    isIndirect: boolean,
    timestampLogger: TimestampLogger | null,
    timestampWrites: GPUComputePassTimestampWrites | null
  ): GPUComputePassDescriptor {
    const descriptor: GPUComputePassDescriptor = {
      label: `${this.name}${isIndirect ? ' indirect' : ''} compute pass`
    };

    assert && assert( !timestampLogger || !timestampWrites,
      'A timestampLogger AND timestampWrites not supported at the same time' );

    if ( timestampLogger ) {
      const timestampWrites = timestampLogger.getGPUComputePassTimestampWrites( this.name );
      if ( timestampWrites ) {
        descriptor.timestampWrites = timestampWrites;
      }
    }
    else if ( timestampWrites ) {
      descriptor.timestampWrites = timestampWrites;
    }

    return descriptor;
  }

  public static fromSource(
    device: GPUDevice,
    name: string,
    source: DualSnippetSource,
    bindingTypes: BindingType[],
    providedOptions: ComputeShaderSourceOptions = {}
  ): ComputeShader {
    const options = combineOptions<ComputeShaderSourceOptions>( {
      shaderName: name
    }, DEFAULT_SOURCE_OPTIONS, providedOptions );

    assert && assert( typeof options.log === 'boolean' );
    const log = options.log as boolean;

    const snippet = DualSnippet.fromSource( source, options );
    return new ComputeShader( name, snippet.toString(), bindingTypes, device, false, {
      log: log
    } );
  }

  public static async fromSourceAsync(
    device: GPUDevice,
    name: string,
    source: DualSnippetSource,
    bindingTypes: BindingType[],
    providedOptions: ComputeShaderSourceOptions = {}
  ): Promise<ComputeShader> {
    const options = combineOptions<ComputeShaderSourceOptions>( {
      shaderName: name
    }, DEFAULT_SOURCE_OPTIONS, providedOptions );

    assert && assert( typeof options.log === 'boolean' );
    const log = options.log as boolean;

    const snippet = DualSnippet.fromSource( source, options );
    return ComputeShader.fromWGSLAsync( device, name, snippet.toString(), bindingTypes, {
      log: log
    } );
  }

  public static async fromContextAsync(
    device: GPUDevice,
    name: string,
    context: WGSLContext,
    bindingTypes: BindingType[],
    providedOptions?: ComputeShaderOptions
  ): Promise<ComputeShader> {
    return ComputeShader.fromWGSLAsync( device, name, context.toString(), bindingTypes, combineOptions<ComputeShaderOptions>( {
      log: context.log
    }, providedOptions ) );
  }

  public static async fromWGSLAsync(
    device: GPUDevice,
    name: string,
    wgsl: WGSLModuleDeclarations,
    bindingTypes: BindingType[],
    providedOptions?: ComputeShaderOptions
  ): Promise<ComputeShader> {
    const options = combineOptions<ComputeShaderOptions>( {}, DEFAULT_OPTIONS, providedOptions );

    const computeShader = new ComputeShader( name, wgsl, bindingTypes, device, true, options );
    await computeShader.pipelinePromise;
    return computeShader;
  }
}

alpenglow.register( 'ComputeShader', ComputeShader );
