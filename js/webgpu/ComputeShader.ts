// Copyright 2023, University of Colorado Boulder

/**
 * Represents a compiled shader and associated data.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, DualSnippet, DualSnippetSource, TimestampLogger } from '../imports.js';
import { optionize3 } from '../../../phet-core/js/optionize.js';

const LOG_SHADERS = true;

export type ComputeShaderOptions = {
  partialBeautify?: boolean;
};

export type ComputeShaderDispatchOptions = {
  // Mutually exclusive options
  timestampLogger?: TimestampLogger | null;
  timestampWrites?: GPUComputePassTimestampWrites | null;
};

export type ComputeShaderSourceOptions = Record<string, unknown>;

const DEFAULT_OPTIONS = {
  partialBeautify: true
} as const;

const DEFAULT_DISPATCH_OPTIONS = {
  timestampLogger: null,
  timestampWrites: null
} as const;

export default class ComputeShader {

  public readonly module: GPUShaderModule;
  public readonly bindGroupLayout: GPUBindGroupLayout;

  // This will be available by the time it can be accessed publicly
  public pipeline!: GPUComputePipeline;

  private readonly pipelinePromise: Promise<GPUComputePipeline>;

  public constructor(
    public readonly name: string,
    public readonly wgsl: string,
    public readonly bindings: Binding[],
    public readonly device: GPUDevice,
    async: boolean,
    providedOptions?: ComputeShaderOptions
  ) {

    const options = optionize3<ComputeShaderOptions>()( {}, DEFAULT_OPTIONS, providedOptions );

    if ( options.partialBeautify ) {
      const lines = wgsl.split( '\n' ).filter( s => s.trim().length > 0 );
      let count = 0;
      let beautified = '';
      for ( let i = 0; i < lines.length; i++ ) {
        const line = lines[ i ].trim();

        // better version of indentation for ( and {
        if ( line.startsWith( '}' ) || line.startsWith( ')' ) ) {
          count--;
        }
        beautified += `${'  '.repeat( count )}${line}\n`;
        if ( line.endsWith( '{' ) || line.endsWith( '(' ) ) {
          count++;
        }
      }
      wgsl = beautified;
    }

    if ( LOG_SHADERS ) {
      console.groupCollapsed( `[shader] ${name}` );
      console.log( wgsl.split( '\n' ).map( ( s, i ) => `${i + 1} ${s}` ).join( '\n' ) );
      // console.log( wgsl.split( '\n' ).filter( _.identity ).map( ( s, i ) => `${s}` ).join( '\n' ) );
      console.groupEnd();
    }

    this.module = device.createShaderModule( {
      label: name,
      code: this.wgsl
    } );

    this.bindGroupLayout = device.createBindGroupLayout( {
      label: `${name} bindGroupLayout`,
      entries: this.bindings.map( ( binding, i ) => binding.getBindGroupLayoutEntry( i ) )
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

      this.pipelinePromise.then( pipeline => {
        this.pipeline = pipeline;
      } ).catch( e => { throw e; } );
    }
    else {
      this.pipeline = device.createComputePipeline( pipelineDescriptor );
      this.pipelinePromise = Promise.resolve( this.pipeline );
    }
  }

  private getBindGroup( resources: ( GPUBuffer | GPUTextureView )[] ): GPUBindGroup {
    assert && assert( this.bindings.length === resources.length );

    return this.device.createBindGroup( {
      label: `${this.name} bindGroup`,
      layout: this.bindGroupLayout,
      entries: this.bindings.map( ( binding, i ) => binding.getBindGroupEntry( i, resources[ i ] ) )
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
    computePass.setBindGroup( 0, this.getBindGroup( resources ) );
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
    computePass.setBindGroup( 0, this.getBindGroup( resources ) );
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
    bindings: Binding[],
    options: Record<string, unknown> = {}
  ): ComputeShader {
    const snippet = DualSnippet.fromSource( source, options );
    return new ComputeShader( name, snippet.toString(), bindings, device, false );
  }

  public static async fromSourceAsync(
    device: GPUDevice,
    name: string,
    source: DualSnippetSource,
    bindings: Binding[],
    options: Record<string, unknown> = {}
  ): Promise<ComputeShader> {
    const snippet = DualSnippet.fromSource( source, options );
    const computeShader = new ComputeShader( name, snippet.toString(), bindings, device, true );
    await computeShader.pipelinePromise;
    return computeShader;
  }
}

alpenglow.register( 'ComputeShader', ComputeShader );
