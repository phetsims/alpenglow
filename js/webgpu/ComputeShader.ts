// Copyright 2023, University of Colorado Boulder

/**
 * Represents a compiled shader and associated data.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, DualSnippet, DualSnippetSource } from '../imports.js';

const LOG_SHADERS = true;

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
      console.groupCollapsed( name );
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
    dispatchZ = 1
  ): void {
    const computePass = encoder.beginComputePass( {
      label: `${this.name} compute pass`
    } );
    computePass.setPipeline( this.pipeline );
    computePass.setBindGroup( 0, this.getBindGroup( resources ) );
    computePass.dispatchWorkgroups( dispatchX, dispatchY, dispatchZ );
    computePass.end();
  }

  public dispatchIndirect(
    encoder: GPUCommandEncoder,
    resources: ( GPUBuffer | GPUTextureView )[],
    indirectBuffer: GPUBuffer,
    indirectOffset: number
  ): void {
    const computePass = encoder.beginComputePass( {
      label: `${this.name} indirect compute pass`
    } );
    computePass.setPipeline( this.pipeline );
    computePass.setBindGroup( 0, this.getBindGroup( resources ) );
    computePass.dispatchWorkgroupsIndirect( indirectBuffer, indirectOffset );
    computePass.end();
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
