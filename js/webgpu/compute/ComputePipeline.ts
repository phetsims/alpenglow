// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import type { DeviceContext } from './DeviceContext.js';
import type { PipelineLayout } from './PipelineLayout.js';
import { addLineNumbers, partialWGSLBeautify, stripWGSLComments } from '../wgsl/WGSLUtils.js';
import { webgpu } from '../WebGPUAPI.js';
import { logBufferSlot } from './logBufferSlot.js';
import { getLogBarrierWGSL } from './getLogBarrierWGSL.js';

export class ComputePipeline {
  // This will be available by the time it can be accessed publicly
  declare public pipeline: GPUComputePipeline;
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

    const module = webgpu.deviceCreateShaderModule( deviceContext.device, {
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

    const logBarrierPipelineDescriptor = pipelineLayout.hasBindingWithSlot( logBufferSlot ) ? {
      label: 'logBarrier pipeline',
      layout: pipelineLayout.layout, // we share the layout
      compute: {
        module: webgpu.deviceCreateShaderModule( deviceContext.device, {
          label: 'logBarrier',
          code: getLogBarrierWGSL( pipelineLayout )
        } ),
        entryPoint: 'main'
      }
    } : null;

    if ( async ) {
      this.pipelinePromise = ( async () => {
        this.pipeline = await webgpu.deviceCreateComputePipelineAsync( deviceContext.device, pipelineDescriptor );
        if ( logBarrierPipelineDescriptor ) {
          this.logBarrierPipeline = await webgpu.deviceCreateComputePipelineAsync( deviceContext.device, logBarrierPipelineDescriptor );
        }

        return this.pipeline;
      } )();
    }
    else {
      this.pipeline = webgpu.deviceCreateComputePipeline( deviceContext.device, pipelineDescriptor );
      this.pipelinePromise = Promise.resolve( this.pipeline );

      if ( logBarrierPipelineDescriptor ) {
        this.logBarrierPipeline = webgpu.deviceCreateComputePipeline( deviceContext.device, logBarrierPipelineDescriptor );
      }
    }
  }

  // NOTE: Create the non-async version if we ever REALLY want it.
  public static async withContextAsync(
    deviceContext: DeviceContext,
    name: string,
    wgsl: string,
    pipelineLayout: PipelineLayout
  ): Promise<ComputePipeline> {
    const actualWGSL = partialWGSLBeautify( stripWGSLComments( wgsl, false ) );

    const computePipeline = new ComputePipeline( deviceContext, name, actualWGSL, pipelineLayout, true );
    await computePipeline.pipelinePromise;
    return computePipeline;
  }
}
alpenglow.register( 'ComputePipeline', ComputePipeline );