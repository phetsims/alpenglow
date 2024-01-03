// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { addLineNumbers, alpenglow, DeviceContext, mainLogBarrier, partialWGSLBeautify, PipelineLayout, stripWGSLComments, PipelineBlueprint, WGSLModuleDeclarations } from '../../imports.js';

export default class ComputePipeline {
  // This will be available by the time it can be accessed publicly
  public pipeline!: GPUComputePipeline;
  public logBarrierPipeline: GPUComputePipeline | null = null;

  private readonly pipelinePromise: Promise<GPUComputePipeline>;

  private constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly wgsl: string,
    public readonly pipelineLayout: PipelineLayout,
    async: boolean
  ) {
    console.groupCollapsed( `[shader] ${name}` );
    console.log( addLineNumbers( wgsl ) );
    console.groupEnd();

    const module = deviceContext.device.createShaderModule( {
      label: name,
      code: wgsl,

      // Can potentially increase performance, see https://www.w3.org/TR/webgpu/#shader-module-compilation-hints
      compilationHints: [
        {
          entryPoint: 'main',
          layout: pipelineLayout.layout
        }
      ]
    } );

    const pipelineDescriptor: GPUComputePipelineDescriptor = {
      label: `${name} pipeline`,
      layout: pipelineLayout.layout,
      compute: {
        module: module,
        entryPoint: 'main'
      }
    };

    const logBarrierPipelineDescriptor = pipelineLayout.hasBindingWithSlot( PipelineBlueprint.LOG_BUFFER_SLOT ) ? {
      label: 'logBarrier pipeline',
      layout: pipelineLayout.layout, // we share the layout
      compute: {
        module: deviceContext.device.createShaderModule( {
          label: 'logBarrier',
          code: ComputePipeline.getLogBarrierWGSL( pipelineLayout )
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

  public static getLogBarrierWGSL(
    pipelineLayout: PipelineLayout
  ): WGSLModuleDeclarations {
    // TODO: remove the superfluous main add
    const logBarrierPipelineBlueprint = new PipelineBlueprint( {
      name: 'logBarrier',
      log: true
    } );
    mainLogBarrier( logBarrierPipelineBlueprint );
    return partialWGSLBeautify( stripWGSLComments( logBarrierPipelineBlueprint.toString( pipelineLayout ) ) );
  }

  // NOTE: Create the non-async version if we ever REALLY want it.
  public static async withContextAsync(
    deviceContext: DeviceContext,
    name: string,
    wgsl: WGSLModuleDeclarations,
    pipelineLayout: PipelineLayout
  ): Promise<ComputePipeline> {
    const actualWGSL = partialWGSLBeautify( stripWGSLComments( wgsl, false ) );

    const computePipeline = new ComputePipeline( deviceContext, name, actualWGSL, pipelineLayout, true );
    await computePipeline.pipelinePromise;
    return computePipeline;
  }
}
alpenglow.register( 'ComputePipeline', ComputePipeline );
