// Copyright 2023, University of Colorado Boulder

/**
 * Represents a compiled shader and associated data.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, DualSnippet, DualSnippetSource } from '../imports.js';
import { optionize3 } from '../../../phet-core/js/optionize.js';

const LOG_SHADERS = true;

export type ComputeShaderDispatchOptions = {
  timestampIndex?: number | null;
  querySet?: GPUQuerySet | null;
};

const DEFAULT_DISPATCH_OPTIONS = {
  timestampIndex: null,
  querySet: null
} as const;

export default class ComputeShader {

  public readonly module: GPUShaderModule;
  public readonly bindGroupLayout: GPUBindGroupLayout;
  public readonly pipeline: GPUComputePipeline;

  // TODO: improve this, it's pretty temporary!
  public constructor(
    public readonly name: string,
    public readonly wgsl: string,
    public readonly bindings: Binding[],
    public readonly device: GPUDevice
  ) {
    if ( LOG_SHADERS ) {
      console.groupCollapsed( `[shader] ${name}` );
      console.log( wgsl.split( '\n' ).map( ( s, i ) => `${i + 1} ${s}` ).join( '\n' ) );
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

    this.pipeline = device.createComputePipeline( {
      label: `${name} pipeline`,
      layout: device.createPipelineLayout( {
        bindGroupLayouts: [ this.bindGroupLayout ]
      } ),
      compute: {
        module: this.module,
        entryPoint: 'main'
      }
    } );
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
      false, options.querySet, options.timestampIndex
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
      true, options.querySet, options.timestampIndex
    ) );
    computePass.setPipeline( this.pipeline );
    computePass.setBindGroup( 0, this.getBindGroup( resources ) );
    computePass.dispatchWorkgroupsIndirect( indirectBuffer, indirectOffset );
    computePass.end();
  }

  private getComputePassDescriptor(
    isIndirect: boolean,
    querySet: GPUQuerySet | null,
    timestampIndex: number | null
  ): GPUComputePassDescriptor {
    const descriptor: GPUComputePassDescriptor = {
      label: `${this.name}${isIndirect ? ' indirect' : ''} compute pass`
    };

    if ( querySet && timestampIndex !== null ) {
      descriptor.timestampWrites = {
        querySet: querySet,
        beginningOfPassWriteIndex: 2 * timestampIndex,
        endOfPassWriteIndex: 2 * timestampIndex + 1
      };
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
    return new ComputeShader( name, snippet.toString(), bindings, device );
  }
}

alpenglow.register( 'ComputeShader', ComputeShader );
