// Copyright 2023, University of Colorado Boulder

/**
 * Isolated prototype for replacement of the other utilities.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { addLineNumbers, alpenglow, BindingLocation, BufferSlot, ConcreteType, DeviceContext, getArrayType, mainLogBarrier, mainReduceWGSL, partialWGSLBeautify, stripWGSLComments, u32, U32Add, WGSLContext, WGSLModuleDeclarations } from '../imports.js';

export default class XPrototype {
  public test(): string | null {
    const binaryOp = U32Add;

    const workgroupSize = 256;
    const grainSize = 8;
    const inputSize = workgroupSize * grainSize * 5 - 27;

    // TODO: make sure we're including testing WITH logging(!)
    const log = false;
    const maxItemCount = workgroupSize * grainSize * 10; // pretend

    const inputType = getArrayType( binaryOp.type, maxItemCount, binaryOp.identity );
    const middleType = getArrayType( binaryOp.type, Math.ceil( maxItemCount / ( workgroupSize * grainSize ) ), binaryOp.identity );
    const outputType = getArrayType( binaryOp.type, 1 ); // TODO

    const inputSlot = new XConcreteBufferSlot( inputType );
    const middleSlot = new XConcreteBufferSlot( middleType );
    const outputSlot = new XConcreteBufferSlot( outputType );

    const firstPipelineBlueprint = new XPipelineBlueprint( 'first', async ( deviceContext, name, pipelineLayout ) => {
      return XComputePipeline.withContextAsync(
        deviceContext,
        name,
        context => mainReduceWGSL<number>( context, {
          binaryOp: binaryOp,
          workgroupSize: workgroupSize,
          grainSize: grainSize,
          loadReducedOptions: {
            lengthExpression: u32( inputSize )
          },
          bindings: {
            input: pipelineLayout.getConcreteBindingFromSlot( inputSlot ),
            output: pipelineLayout.getConcreteBindingFromSlot( middleSlot )
          }
        } ),
        pipelineLayout,
        log
      );
    } );


    const secondPipelineBlueprint = new XPipelineBlueprint( 'second', async ( deviceContext, name, pipelineLayout ) => {
      return XComputePipeline.withContextAsync(
        deviceContext,
        name,
        context => mainReduceWGSL<number>( context, {
          binaryOp: binaryOp,
          workgroupSize: workgroupSize,
          grainSize: grainSize,
          loadReducedOptions: {
            lengthExpression: u32( Math.ceil( inputSize / ( workgroupSize * grainSize ) ) )
          },
          bindings: {
            input: pipelineLayout.getConcreteBindingFromSlot( middleSlot ),
            output: pipelineLayout.getConcreteBindingFromSlot( outputSlot )
          }
        } ),
        pipelineLayout,
        log
      );
    } );

        // const firstDispatchSize = Math.ceil( inputValues.length / ( workgroupSize * grainSize ) );
    // const secondDispatchSize = Math.ceil( firstDispatchSize / ( workgroupSize * grainSize * workgroupSize * grainSize ) );

    const firstRoutineBlueprint = new XRoutineBlueprint( [ firstPipelineBlueprint ], ( context, stageInputSize: number ) => {
      context.dispatch( firstPipelineBlueprint, Math.ceil( stageInputSize / ( workgroupSize * grainSize ) ) );
    } );

    const secondRoutineBlueprint = new XRoutineBlueprint( [ secondPipelineBlueprint ], ( context, stageInputSize: number ) => {
      context.dispatch( secondPipelineBlueprint, Math.ceil( stageInputSize / ( workgroupSize * grainSize ) ) );
    } );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const combinedBlueprint = new XRoutineBlueprint( [
      ...firstRoutineBlueprint.pipelineBlueprints,
      ...secondRoutineBlueprint.pipelineBlueprints
    ], ( context, inputSize: number ) => {
      firstRoutineBlueprint.execute( context, inputSize );
      secondRoutineBlueprint.execute( context, Math.ceil( inputSize / ( workgroupSize * grainSize ) ) );
    } );

    // debugger;
    //
    // const bindGroupLayout = BindGroupLayout.createZero(
    //   deviceContext,
    //   name,
    //   log,
    //   {
    //     input: BindingType.READ_ONLY_STORAGE_BUFFER,
    //     middle: BindingType.STORAGE_BUFFER,
    //     output: BindingType.STORAGE_BUFFER
    //   }
    // );
    //
    // const pipelineLayout = PipelineLayout.create( deviceContext, bindGroupLayout );
    //
    // const firstPipeline = await ComputePipeline.withContextAsync(
    //   deviceContext,
    //   `${name} first`,
    //   context => mainReduceWGSL( context, combineOptions<SingleReduceShaderOptions<T>>( {
    //     workgroupSize: workgroupSize,
    //     grainSize: grainSize,
    //     loadReducedOptions: combineOptions<Required<SingleReduceShaderOptions<T>>[ 'loadReducedOptions' ]>( {
    //       lengthExpression: u32( inputSize )
    //     }, options.loadReducedOptions ),
    //     log: log,
    //     bindings: {
    //       input: pipelineLayout.bindingMap.input,
    //       output: pipelineLayout.bindingMap.middle
    //     }
    //   }, options ) ),
    //   pipelineLayout,
    //   log
    // );
    //
    // const secondPipeline = await ComputePipeline.withContextAsync(
    //   deviceContext,
    //   `${name} second`,
    //   context => mainReduceWGSL( context, combineOptions<SingleReduceShaderOptions<T>>( {
    //     workgroupSize: workgroupSize,
    //     grainSize: grainSize,
    //     loadReducedOptions: combineOptions<Required<SingleReduceShaderOptions<T>>[ 'loadReducedOptions' ]>( {
    //       lengthExpression: u32( Math.ceil( inputSize / ( workgroupSize * grainSize ) ) )
    //     }, options.loadReducedOptions ),
    //     log: log,
    //     bindings: {
    //       input: pipelineLayout.bindingMap.middle,
    //       output: pipelineLayout.bindingMap.output
    //     }
    //   }, options ) ),
    //   pipelineLayout,
    //   log
    // );
    //
    // //////////////////////////////////
    //
    // const inputTypedBuffer = TypedBuffer.createArray( deviceContext, binaryOp.type, maxItemCount, binaryOp.identity );
    // const middleTypedBuffer = TypedBuffer.createArray( deviceContext, binaryOp.type, Math.ceil( maxItemCount / ( workgroupSize * grainSize ) ), binaryOp.identity );
    // const outputTypedBuffer = TypedBuffer.createArray( deviceContext, binaryOp.type, Math.ceil( maxItemCount / ( workgroupSize * grainSize * workgroupSize * grainSize ) ), binaryOp.identity );
    //
    // const bindGroup = BindGroup.createZero(
    //   deviceContext,
    //   name,
    //   bindGroupLayout,
    //   log,
    //   {
    //     input: inputTypedBuffer,
    //     middle: middleTypedBuffer,
    //     output: outputTypedBuffer
    //   }
    // );
    //
    // //////////////////////////////////
    //
    // const inputValues = _.range( 0, inputSize ).map( () => binaryOp.type.generateRandom( false ) );
    // const expectedValues = [ inputValues.reduce( ( a, b ) => binaryOp.apply( a, b ), binaryOp.identity ) ];
    //
    // const firstDispatchSize = Math.ceil( inputValues.length / ( workgroupSize * grainSize ) );
    // const secondDispatchSize = Math.ceil( firstDispatchSize / ( workgroupSize * grainSize * workgroupSize * grainSize ) );
    //
    // const actualValues = await Executor.execute(
    //   deviceContext,
    //   log, // TODO: in whatever we create, store the log:boolean (duh)
    //   async executor => {
    //     executor.setTypedBufferValue( inputTypedBuffer, inputValues );
    //
    //     executor.getComputePass( 'main' )
    //       .dispatchPipeline( firstPipeline, [ bindGroup ], firstDispatchSize )
    //       .dispatchPipeline( secondPipeline, [ bindGroup ], secondDispatchSize )
    //       .end();
    //
    //     return executor.getTypedBufferValue( outputTypedBuffer );
    //   }
    // );
    //
    // inputTypedBuffer.dispose();
    // middleTypedBuffer.dispose();
    // outputTypedBuffer.dispose();

    return null;
  }
}
alpenglow.register( 'XPrototype', XPrototype );

export abstract class XBindingType {

  protected abstract mutateBindGroupLayoutEntry( entry: GPUBindGroupLayoutEntry ): void;

  public abstract toString(): string;

  public getBindGroupLayoutEntry( index: number ): GPUBindGroupLayoutEntry {
    const entry: GPUBindGroupLayoutEntry = {
      binding: index,
      visibility: GPUShaderStage.COMPUTE
    };

    this.mutateBindGroupLayoutEntry( entry );

    return entry;
  }
}
alpenglow.register( 'XBindingType', XBindingType );

export class XBufferBindingType extends XBindingType {
  public constructor(
    public readonly type: GPUBufferBindingType,
    public readonly hasDynamicOffset: boolean = false,
    public readonly minBindingSize = 0
  ) {
    super();
  }

  public toString(): string {
    return `XBufferBindingType(${this.type}, ${this.hasDynamicOffset}, ${this.minBindingSize})`;
  }

  protected override mutateBindGroupLayoutEntry( entry: GPUBindGroupLayoutEntry ): void {
    entry.buffer = {
      type: this.type,
      hasDynamicOffset: this.hasDynamicOffset,
      minBindingSize: this.minBindingSize
    };
  }
}
alpenglow.register( 'XBufferBindingType', XBufferBindingType );

export class XStorageTextureBindingType extends XBindingType {
  public constructor(
    public readonly access: GPUStorageTextureAccess,
    public readonly format: GPUTextureFormat,
    public readonly viewDimension: GPUTextureViewDimension = '2d'
  ) {
    super();
  }

  public toString(): string {
    return `XStorageTextureBindingType(${this.access}, ${this.format}, ${this.viewDimension})`;
  }

  protected override mutateBindGroupLayoutEntry( entry: GPUBindGroupLayoutEntry ): void {
    entry.storageTexture = {
      access: this.access,
      format: this.format,
      viewDimension: this.viewDimension
    };
  }
}
alpenglow.register( 'XStorageTextureBindingType', XStorageTextureBindingType );

export class XTextureBindingType extends XBindingType {
  public constructor(
    public readonly sampleType: GPUTextureSampleType,
    public readonly viewDimension: GPUTextureViewDimension = '2d',
    public readonly multisampled: boolean = false
  ) {
    super();
  }

  public toString(): string {
    return `XTextureBindingType(${this.sampleType}, ${this.viewDimension}, ${this.multisampled})`;
  }

  protected override mutateBindGroupLayoutEntry( entry: GPUBindGroupLayoutEntry ): void {
    entry.texture = {
      sampleType: this.sampleType,
      viewDimension: this.viewDimension,
      multisampled: this.multisampled
    };
  }
}
alpenglow.register( 'XTextureBindingType', XTextureBindingType );

export class XConcreteBindingType<T = unknown> {
  public constructor(
    public readonly bindingType: XBindingType,
    public readonly concreteType: ConcreteType<T>
  ) {}
}
alpenglow.register( 'XConcreteBindingType', XConcreteBindingType );

export abstract class XResourceSlot {
  public abstract toString(): string;
}
alpenglow.register( 'XResourceSlot', XResourceSlot );

export class XBufferSlotSlice {
  public constructor(
    public readonly bufferSlot: XBufferSlot,
    public readonly offset: number
  ) {}
}

export class XBufferSlot extends XResourceSlot {
  public readonly bufferSlotSlices: XBufferSlotSlice[] = [];

  public constructor(
    public readonly size: number // bytes
  ) {
    super();
  }

  public toString(): string {
    return `XBufferSlot(${this.size})`;
  }
}
alpenglow.register( 'XBufferSlot', XBufferSlot );

export class XTextureViewSlot extends XResourceSlot {
  public toString(): string {
    return 'XTextureViewSlot()';
  }
}
alpenglow.register( 'XTextureViewSlot', XTextureViewSlot );

export class XConcreteBufferSlot<T> extends XBufferSlot {
  public constructor(
    public readonly concreteType: ConcreteType<T>
  ) {
    super( concreteType.bytesPerElement );
  }
}
alpenglow.register( 'XConcreteBufferSlot', XConcreteBufferSlot );

export abstract class XResource {
  public constructor(
    public readonly resource: GPUBuffer | GPUTextureView
  ) {}

  // TODO: consider modifying to just BufferLocation or bindingIndex
  public abstract getBindGroupEntry( binding: XBinding ): GPUBindGroupEntry;
}
alpenglow.register( 'XResource', XResource );

export class XBufferResource extends XResource {
  public constructor(
    public readonly buffer: GPUBuffer,
    public readonly offset = 0,
    public readonly size = 0
  ) {
    super( buffer );
  }

  public getBindGroupEntry( binding: XBinding ): GPUBindGroupEntry {
    const bufferBinding: GPUBufferBinding = {
      buffer: this.buffer
    };
    if ( this.offset !== 0 ) {
      bufferBinding.offset = this.offset;
    }
    if ( this.size !== 0 ) {
      bufferBinding.size = this.size;
    }
    return {
      binding: binding.location.bindingIndex,
      resource: bufferBinding
    };
  }
}
alpenglow.register( 'XBufferResource', XBufferResource );

export class XTextureViewResource extends XResource {
  public constructor(
    public readonly textureView: GPUTextureView
  ) {
    super( textureView );
  }

  public getBindGroupEntry( binding: XBinding ): GPUBindGroupEntry {
    return {
      binding: binding.location.bindingIndex,
      resource: this.textureView
    };
  }
}
alpenglow.register( 'XTextureViewResource', XTextureViewResource );

export abstract class XResourceUsage {
  public constructor(
    public readonly resourceSlot: XResourceSlot
  ) {}
}
alpenglow.register( 'XResourceUsage', XResourceUsage );

export class XBufferUsage<T> extends XResourceUsage {
  public constructor(
    public readonly bufferSlot: XBufferSlot,
    public readonly concreteBindingType: XConcreteBindingType<T>
  ) {
    super( bufferSlot );
  }
}
alpenglow.register( 'XBufferUsage', XBufferUsage );

export class XTextureViewUsage extends XResourceUsage {
  public constructor(
    public readonly textureViewSlot: XTextureViewSlot,
    public readonly bindingType: XBindingType
  ) {
    super( textureViewSlot );
  }
}
alpenglow.register( 'XTextureViewUsage', XTextureViewUsage );

export class XBindingDescriptor {
  public constructor(
    public readonly bindingIndex: number,
    public readonly concreteBindingType: XConcreteBindingType,
    public readonly slot: XResourceSlot
  ) {}

  public getBindGroupLayoutEntry(): GPUBindGroupLayoutEntry {
    return this.concreteBindingType.bindingType.getBindGroupLayoutEntry( this.bindingIndex );
  }
}
alpenglow.register( 'XBindingDescriptor', XBindingDescriptor );

export class XBinding<T = unknown> {
  public constructor(
    public readonly location: BindingLocation,
    public readonly concreteBindingType: XConcreteBindingType<T>,
    public readonly slot: XResourceSlot
  ) {}

  // @deprecated - from the old version TODO remove
  public getStorageAccess(): 'read' | 'read_write' {
    if ( this.concreteBindingType instanceof XBufferBindingType ) {
      return this.concreteBindingType.type === 'read-only-storage' ? 'read' : 'read_write';
    }
    else {
      throw new Error( 'bad binding type' );
    }
  }
}
alpenglow.register( 'XBinding', XBinding );

export type BindingCompatibilityType<T> = {
  location: BindingLocation;
  getStorageAccess: () => 'read' | 'read_write';
  concreteBindingType?: XConcreteBindingType<T>; // our style
  bufferSlot?: BufferSlot<T>; // their style
};

export class XBindGroupLayout {
  public readonly layout: GPUBindGroupLayout;
  public readonly bindings: XBinding[];

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly groupIndex: number,
    public readonly bindingDescriptors: XBindingDescriptor[]
  ) {
    this.layout = deviceContext.device.createBindGroupLayout( {
      label: `${name} bind group layout`,
      entries: bindingDescriptors.map( binding => binding.getBindGroupLayoutEntry() )
    } );

    this.bindings = bindingDescriptors.map( binding => new XBinding(
      new BindingLocation( groupIndex, binding.bindingIndex ), binding.concreteBindingType, binding.slot
    ) );
  }

  public getBindingFromSlot( slot: XResourceSlot ): XBinding | null {
    return this.bindings.find( binding => binding.slot === slot ) || null;
  }

  public getConcreteBindingFromSlot<T>( slot: XConcreteBufferSlot<T> ): XBinding<T> | null {
    // TODO: better typing?
    return this.getBindingFromSlot( slot ) as ( XBinding<T> | null );
  }
}
alpenglow.register( 'XBindGroupLayout', XBindGroupLayout );

export class XPipelineLayout {
  public readonly layout: GPUPipelineLayout;

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly bindGroupLayouts: XBindGroupLayout[]
  ) {
    this.layout = deviceContext.device.createPipelineLayout( {
      bindGroupLayouts: bindGroupLayouts.map( bindGroupLayout => bindGroupLayout.layout )
    } );
  }

  public getBindingFromSlot( slot: XResourceSlot ): XBinding {
    let binding: XBinding | null = null;
    for ( let i = 0; i < this.bindGroupLayouts.length; i++ ) {
      binding = this.bindGroupLayouts[ i ].getBindingFromSlot( slot );
      if ( binding ) {
        break;
      }
    }

    assert && assert( binding );
    return binding!;
  }

  public getConcreteBindingFromSlot<T>( slot: XConcreteBufferSlot<T> ): XBinding<T> {
    // TODO: better typing?
    return this.getBindingFromSlot( slot ) as ( XBinding<T> );
  }
}
alpenglow.register( 'XPipelineLayout', XPipelineLayout );

export class XPipelineBlueprint {
  public constructor(
    public readonly name: string,
    public readonly toComputePipeline: (
      context: DeviceContext, name: string, pipelineLayout: XPipelineLayout
    ) => Promise<XComputePipeline>
  ) {}
}
alpenglow.register( 'XPipelineBlueprint', XPipelineBlueprint );

export class XRoutineBlueprint<T> {
  public constructor(
    public readonly pipelineBlueprints: XPipelineBlueprint[],
    public readonly execute: ( context: XExecutionContext, data: T ) => void
  ) {}
}
alpenglow.register( 'XRoutineBlueprint', XRoutineBlueprint );

export class XBindGroup {

  public readonly bindGroup: GPUBindGroup;

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly layout: XBindGroupLayout,
    resourceMap: Map<XResourceSlot, XResource>
  ) {
    this.bindGroup = deviceContext.device.createBindGroup( {
      label: `${this.name} bind group`,
      layout: layout.layout,
      entries: Object.keys( resourceMap ).map( slot => {
        const binding = layout.getBindingFromSlot( slot )!;
        assert && assert( binding, 'Missing binding when creating BindGroup' );

        const resource = resourceMap.get( slot )!;

        return resource.getBindGroupEntry( binding );
      } )
    } );
  }
}
alpenglow.register( 'XBindGroup', XBindGroup );

export class XExecutionContext {
  // TODO: We might use one compute pass, we might split each into one
  public constructor(
    public readonly computePass: XComputePass
  ) {}

  public dispatch(
    pipelineBlueprint: XPipelineBlueprint,
    dispatchX = 1,
    dispatchY = 1,
    dispatchZ = 1
    ): void {
    // TODO
  }

  public dispatchIndirect(
    pipelineBlueprint: XPipelineBlueprint,
    indirectBuffer: GPUBuffer,
    indirectOffset: number
  ): void {
    // TODO
  }
}
alpenglow.register( 'XExecutionContext', XExecutionContext );

export class XComputePipeline {
  // This will be available by the time it can be accessed publicly
  public pipeline!: GPUComputePipeline;
  public logBarrierPipeline: GPUComputePipeline | null = null;

  private readonly pipelinePromise: Promise<GPUComputePipeline>;

  private constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly wgsl: string,
    public readonly pipelineLayout: XPipelineLayout,
    public readonly log: boolean,
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

    const logBarrierPipelineDescriptor = log ? {
      label: 'logBarrier pipeline',
      layout: pipelineLayout.layout, // we share the layout
      compute: {
        module: deviceContext.device.createShaderModule( {
          label: 'logBarrier',
          code: XComputePipeline.getLogBarrierWGSL()
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

  public static withContext(
    deviceContext: DeviceContext,
    name: string,
    toWGSL: ( context: WGSLContext ) => WGSLModuleDeclarations,
    pipelineLayout: XPipelineLayout,
    log: boolean
  ): XComputePipeline {
    const wgslContext = new WGSLContext( name, log ).with( toWGSL );

    const wgsl = partialWGSLBeautify( stripWGSLComments( wgslContext.toString(), false ) );

    return new XComputePipeline( deviceContext, name, wgsl, pipelineLayout, log, false );
  }

  public static async withContextAsync(
    deviceContext: DeviceContext,
    name: string,
    toWGSL: ( context: WGSLContext ) => WGSLModuleDeclarations,
    pipelineLayout: XPipelineLayout,
    log: boolean
  ): Promise<XComputePipeline> {
    const wgslContext = new WGSLContext( name, log ).with( toWGSL );

    const wgsl = partialWGSLBeautify( stripWGSLComments( wgslContext.toString(), false ) );

    const computePipeline = new XComputePipeline( deviceContext, name, wgsl, pipelineLayout, log, true );
    await computePipeline.pipelinePromise;
    return computePipeline;
  }
}
alpenglow.register( 'XComputePipeline', XComputePipeline );

export class XComputePass {

  public readonly computePassEncoder: GPUComputePassEncoder;

  private currentPipeline: XComputePipeline | null = null;
  private currentBindGroups = new Map<number, XBindGroup>();

  public constructor(
    encoder: GPUCommandEncoder,
    computePassDescriptor: GPUComputePassDescriptor
  ) {
    this.computePassEncoder = encoder.beginComputePass( computePassDescriptor );
  }

  private prepare(
    computePipeline: XComputePipeline,
    bindGroups: XBindGroup[]
  ): void {
    if ( this.currentPipeline !== computePipeline ) {
      this.computePassEncoder.setPipeline( computePipeline.pipeline );
      this.currentPipeline = computePipeline;
    }

    for ( let i = 0; i < bindGroups.length; i++ ) {
      const bindGroup = bindGroups[ i ];
      const currentBindGroup = this.currentBindGroups.get( i );

      if ( currentBindGroup !== bindGroup ) {
        this.computePassEncoder.setBindGroup( i, bindGroup.bindGroup );
        this.currentBindGroups.set( i, bindGroup );
      }
    }
  }

  private attemptLogBarrier(
    computePipeline: XComputePipeline
  ): void {
    if ( computePipeline.logBarrierPipeline ) {
      this.currentPipeline = null;
      this.computePassEncoder.setPipeline( computePipeline.logBarrierPipeline );
      this.computePassEncoder.dispatchWorkgroups( 1, 1, 1 );
    }
  }

  public dispatchPipeline(
    computePipeline: XComputePipeline,
    bindGroups: XBindGroup[],
    dispatchX = 1,
    dispatchY = 1,
    dispatchZ = 1
  ): this {
    this.prepare( computePipeline, bindGroups );

    this.computePassEncoder.dispatchWorkgroups( dispatchX, dispatchY, dispatchZ );

    this.attemptLogBarrier( computePipeline );

    // allow chaining
    return this;
  }

  public dispatchPipelineIndirect(
    computePipeline: XComputePipeline,
    bindGroups: XBindGroup[],
    indirectBuffer: GPUBuffer,
    indirectOffset: number
  ): this {
    this.prepare( computePipeline, bindGroups );

    this.computePassEncoder.dispatchWorkgroupsIndirect( indirectBuffer, indirectOffset );

    this.attemptLogBarrier( computePipeline );

    // allow chaining
    return this;
  }

  public end(): void {
    this.computePassEncoder.end();
  }
}
alpenglow.register( 'XComputePass', XComputePass );