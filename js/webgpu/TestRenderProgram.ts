// Copyright 2023, University of Colorado Boulder

/**
 * Testing for render program execution
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType, BufferLogger, ByteEncoder, ComputeShader, DeviceContext, LinearEdge, RENDER_BLEND_CONSTANTS, RENDER_COMPOSE_CONSTANTS, RENDER_EXTEND_CONSTANTS, RENDER_GRADIENT_TYPE_CONSTANTS, RenderInstruction, RenderProgram, wgsl_test_render_program } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';
import Bounds2 from '../../../dot/js/Bounds2.js';
import merge from '../../../phet-core/js/merge.js';

const shaderMap = new WeakMap<DeviceContext, ComputeShader>();

export default class TestRenderProgram {

  public static evaluate(
    deviceContext: DeviceContext,
    renderProgram: RenderProgram,
    edgesOffset: number,
    numEdges: number,
    edges: LinearEdge[],
    isFullArea: boolean,
    needsFace: boolean,
    area: number,
    bounds: Bounds2,
    minXCount: number,
    minYCount: number,
    maxXCount: number,
    maxYCount: number
  ): Promise<Vector4> {
    const device = deviceContext.device;

    if ( !shaderMap.has( deviceContext ) ) {
      const shader = ComputeShader.fromSource( device, 'test_render_program', wgsl_test_render_program, [
        BindingType.UNIFORM_BUFFER,
        BindingType.READ_ONLY_STORAGE_BUFFER,
        BindingType.READ_ONLY_STORAGE_BUFFER,
        BindingType.STORAGE_BUFFER
      ], merge( merge( {
        // TODO: good sizes? Can get values of these from a RenderProgram
        stackSize: 10,
        instructionStackSize: 8
      }, RenderInstruction.CODE_NAME_CONSTANTS, RENDER_BLEND_CONSTANTS, RENDER_COMPOSE_CONSTANTS, RENDER_EXTEND_CONSTANTS ), RENDER_GRADIENT_TYPE_CONSTANTS ) );
      shaderMap.set( deviceContext, shader );
    }
    const shader = shaderMap.get( deviceContext )!;

    const instructions: RenderInstruction[] = [];
    renderProgram.writeInstructions( instructions );

    const instructionEncoder = new ByteEncoder();
    RenderInstruction.instructionsToBinary( instructionEncoder, instructions );

    console.groupCollapsed( 'Instructions' );
    console.log( instructions.map( instruction => instruction.toString() ).join( '\n' ) );
    console.log( instructionEncoder.getDebug32String() );
    console.groupEnd();

    const configEncoder = new ByteEncoder();
    // TODO: test offsets?
    configEncoder.pushU32( 0 ); // render_program_index: u32,
    configEncoder.pushU32( edgesOffset ); // edgesOffset: u32,
    configEncoder.pushU32( numEdges ); // numEdges: u32,
    configEncoder.pushU32( isFullArea ? 1 : 0 ); // isFullArea: u32, // 1 or 0
    configEncoder.pushU32( needsFace ? 1 : 0 ); // needsFace: u32, // 1 or 0
    configEncoder.pushF32( area ); // area: f32,
    configEncoder.pushF32( bounds.minX ); // minX: f32,
    configEncoder.pushF32( bounds.minY ); // minY: f32,
    configEncoder.pushF32( bounds.maxX ); // maxX: f32,
    configEncoder.pushF32( bounds.maxY ); // maxY: f32,
    configEncoder.pushI32( minXCount ); // minXCount: i32,
    configEncoder.pushI32( minYCount ); // minYCount: i32,
    configEncoder.pushI32( maxXCount ); // maxXCount: i32,
    configEncoder.pushI32( maxYCount ); // maxYCount: i32

    const configBuffer = device.createBuffer( {
      label: 'config buffer',
      size: configEncoder.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    } );
    device.queue.writeBuffer( configBuffer, 0, configEncoder.arrayBuffer );

    const instructionsBuffer = deviceContext.createBuffer( instructionEncoder.byteLength );
    device.queue.writeBuffer( instructionsBuffer, 0, instructionEncoder.arrayBuffer );

    const edgesBuffer = deviceContext.createBuffer( 4 * edges.length );
    device.queue.writeBuffer( edgesBuffer, 0, new Float32Array( edges.flatMap( edge => [
      edge.startPoint.x, edge.startPoint.y, edge.endPoint.x, edge.endPoint.y
    ] ) ).buffer );

    const outputBuffer = deviceContext.createBuffer( 4 * 4 );

    return new Promise<Vector4>( ( resolve, reject ) => {
      const encoder = device.createCommandEncoder( {
        label: 'the encoder'
      } );

      shader.dispatch( encoder, [
        configBuffer, instructionsBuffer, edgesBuffer, outputBuffer
      ] );

      const logger = new BufferLogger( deviceContext );
      logger.withBuffer( encoder, outputBuffer, async arrayBuffer => {
        const result = new Float32Array( arrayBuffer );
        resolve( new Vector4( result[ 0 ], result[ 1 ], result[ 2 ], result[ 3 ] ) );
      } );

      const commandBuffer = encoder.finish();
      device.queue.submit( [ commandBuffer ] );

      device.queue.onSubmittedWorkDone().then( async () => {
        await logger.complete();
      } ).catch( err => {
        reject( err );
      } );

      configBuffer.destroy();
      instructionsBuffer.destroy();
      edgesBuffer.destroy();
      outputBuffer.destroy();
    } );
  }
}

alpenglow.register( 'TestRenderProgram', TestRenderProgram );
