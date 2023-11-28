// Copyright 2023, University of Colorado Boulder

/**
 * Wrapper for a GPUComputePipeline.
 *
 * Provides a "name => Binding" map that is combined from the BindGroupLayouts.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { addLineNumbers, alpenglow, BindingMapType, DeviceContext, mainLogBarrier, partialWGSLBeautify, PipelineLayout, stripWGSLComments, WGSLContext, WGSLModuleDeclarations } from '../imports.js';

export default class ComputePipeline<BindingMap extends BindingMapType> {
  // This will be available by the time it can be accessed publicly
  public pipeline!: GPUComputePipeline;
  public logBarrierPipeline: GPUComputePipeline | null = null;

  private readonly pipelinePromise: Promise<GPUComputePipeline>;

  private static readonly logBarrierMap = new WeakMap<DeviceContext, GPUComputePipeline>();

  private constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly wgsl: string,
    public readonly pipelineLayout: PipelineLayout<BindingMap>,
    public readonly log: boolean,
    async: boolean
  ) {
    console.groupCollapsed( `[shader] ${name}` );
    console.log( addLineNumbers( wgsl ) );
    console.groupEnd();

    const module = deviceContext.device.createShaderModule( {
      label: name,
      code: wgsl
    } );

    const pipelineDescriptor: GPUComputePipelineDescriptor = {
      label: `${name} pipeline`,
      layout: pipelineLayout.layout,
      compute: {
        module: module,
        entryPoint: 'main'
      }
    };

    const logBarrierPipelineDescriptor = log ? {
      label: 'logBarrier pipeline',
      layout: pipelineLayout.layout, // we share the layout
      compute: {
        module: deviceContext.device.createShaderModule( {
          label: 'logBarrier',
          code: ComputePipeline.getLogBarrierWGSL()
        } ),
        entryPoint: 'main'
      }
    } : null;

    if ( async ) {
      this.pipelinePromise = ( async () => {
        this.pipeline = await deviceContext.device.createComputePipelineAsync( pipelineDescriptor );
        if ( logBarrierPipelineDescriptor ) {
          this.logBarrierPipeline = await deviceContext.device.createComputePipelineAsync( logBarrierPipelineDescriptor );
        }

        return this.pipeline;
      } )();
    }
    else {
      this.pipeline = deviceContext.device.createComputePipeline( pipelineDescriptor );
      this.pipelinePromise = Promise.resolve( this.pipeline );

      if ( logBarrierPipelineDescriptor ) {
        this.logBarrierPipeline = deviceContext.device.createComputePipeline( logBarrierPipelineDescriptor );
      }
    }
  }

  public static getLogBarrierWGSL(): WGSLModuleDeclarations {
    const logBarrierWgslContext = new WGSLContext( 'log barrier', true ).with( context => mainLogBarrier( context ) );
    return partialWGSLBeautify( stripWGSLComments( logBarrierWgslContext.toString() ) );
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

    return new ComputePipeline( deviceContext, name, wgsl, pipelineLayout, log, false );
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

    const computePipeline = new ComputePipeline( deviceContext, name, wgsl, pipelineLayout, log, true );
    await computePipeline.pipelinePromise;
    return computePipeline;
  }
}

alpenglow.register( 'ComputePipeline', ComputePipeline );
