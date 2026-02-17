// Copyright 2023-2025, University of Colorado Boulder

/**
 * Shader for blitting things to a Canvas if needed
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../alpenglow.js';
import { webgpu } from './WebGPUAPI.js';

export class BlitShader {

  public readonly module: GPUShaderModule;
  public readonly bindGroupLayout: GPUBindGroupLayout;
  public readonly pipeline: GPURenderPipeline;

  public constructor( public readonly device: GPUDevice, format: GPUTextureFormat ) {
    this.module = device.createShaderModule( {
      label: 'blitShaderModule',
      code: `@vertex
fn vs_main(@builtin(vertex_index) ix: u32) -> @builtin(position) vec4<f32> {
    // Generate a full screen quad in NDCs
    var vertex = vec2(-1.0, 1.0);
    switch ix {
        case 1u: {
            vertex = vec2(-1.0, -1.0);
        }
        case 2u, 4u: {
            vertex = vec2(1.0, -1.0);
        }
        case 5u: {
            vertex = vec2(1.0, 1.0);
        }
        default: {}
    }
    return vec4(vertex, 0.0, 1.0);
}

@group(0) @binding(0)
var fine_output: texture_2d<f32>;

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
    return textureLoad(fine_output, vec2<i32>(pos.xy), 0);
}
      `
    } );

    this.bindGroupLayout = device.createBindGroupLayout( {
      label: 'blitShaderBindGroupLayout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {
            sampleType: 'float',
            viewDimension: '2d',
            multisampled: false
          }
        }
      ]
    } );

    this.pipeline = device.createRenderPipeline( {
      label: 'blitShaderPipeline',
      layout: device.createPipelineLayout( {
        label: 'blitShaderPipelineLayout',
        bindGroupLayouts: [ this.bindGroupLayout ]
      } ),
      vertex: {
        module: this.module,
        entryPoint: 'vs_main'
      },
      fragment: {
        module: this.module,
        entryPoint: 'fs_main',
        targets: [
          {
            format: format
          }
        ]
      }
    } );
  }

  public dispatch( encoder: GPUCommandEncoder, outTextureView: GPUTextureView, sourceTextureView: GPUTextureView ): void {
    const pass = webgpu.encoderBeginRenderPass( encoder, {
      label: 'blit render pass',
      colorAttachments: [
        {
          view: outTextureView,
          clearValue: [ 0, 0, 0, 0 ],
          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    } );

    // TODO: store the bind group(!)
    const bindGroup = webgpu.deviceCreateBindGroup( this.device, {
      label: 'blit bind group',
      layout: this.bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: sourceTextureView
        }
      ]
    } );

    // TODO: get these commands recorded?
    pass.setPipeline( this.pipeline );
    pass.setBindGroup( 0, bindGroup );
    pass.draw( 6 );
    pass.end();
  }
}

alpenglow.register( 'BlitShader', BlitShader );