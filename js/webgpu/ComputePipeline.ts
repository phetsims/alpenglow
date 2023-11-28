// Copyright 2023, University of Colorado Boulder

/**
 * Wrapper for a GPUComputePipeline.
 *
 * Provides a "name => Binding" map that is combined from the BindGroupLayouts.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { addLineNumbers, alpenglow, BindingMapType, DeviceContext, partialWGSLBeautify, PipelineLayout, stripWGSLComments, WGSLContext, WGSLModuleDeclarations } from '../imports.js';

export default class ComputePipeline<BindingMap extends BindingMapType> {
  public readonly module: GPUShaderModule;

  // This will be available by the time it can be accessed publicly
  public pipeline!: GPUComputePipeline;

  private readonly pipelinePromise: Promise<GPUComputePipeline>;

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly wgsl: string,
    public readonly pipelineLayout: PipelineLayout<BindingMap>,
    async: boolean
  ) {
    console.groupCollapsed( `[shader] ${name}` );
    console.log( addLineNumbers( wgsl ) );
    console.groupEnd();

    this.module = deviceContext.device.createShaderModule( {
      label: name,
      code: wgsl
    } );

    const pipelineDescriptor: GPUComputePipelineDescriptor = {
      label: `${name} pipeline`,
      layout: pipelineLayout.layout,
      compute: {
        module: this.module,
        entryPoint: 'main'
      }
    };

    if ( async ) {
      this.pipelinePromise = deviceContext.device.createComputePipelineAsync( pipelineDescriptor ).then( pipeline => {
        this.pipeline = pipeline;
        return pipeline;
      } );
    }
    else {
      this.pipeline = deviceContext.device.createComputePipeline( pipelineDescriptor );
      this.pipelinePromise = Promise.resolve( this.pipeline );
    }
  }

  public static withContext<BindingMap extends BindingMapType>(
    deviceContext: DeviceContext,
    name: string,
    toWGSL: ( context: WGSLContext ) => WGSLModuleDeclarations,
    pipelineLayout: PipelineLayout<BindingMap>,
    log: boolean
  ): ComputePipeline<BindingMap> {
    const wgslContext = new WGSLContext( name, log ).with( toWGSL );

    const wgsl = partialWGSLBeautify( stripWGSLComments( wgslContext.toString(), false ) );

    return new ComputePipeline( deviceContext, name, wgsl, pipelineLayout, false );
  }

  public static async withContextAsync<BindingMap extends BindingMapType>(
    deviceContext: DeviceContext,
    name: string,
    toWGSL: ( context: WGSLContext ) => WGSLModuleDeclarations,
    pipelineLayout: PipelineLayout<BindingMap>,
    log: boolean
  ): Promise<ComputePipeline<BindingMap>> {
    const wgslContext = new WGSLContext( name, log ).with( toWGSL );

    const wgsl = partialWGSLBeautify( stripWGSLComments( wgslContext.toString(), false ) );

    const computePipeline = new ComputePipeline( deviceContext, name, wgsl, pipelineLayout, true );
    await computePipeline.pipelinePromise;
    return computePipeline;
  }
}

alpenglow.register( 'ComputePipeline', ComputePipeline );
