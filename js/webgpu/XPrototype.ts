// Copyright 2023, University of Colorado Boulder

/**
 * Isolated prototype for replacement of the other utilities.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { addLineNumbers, alpenglow, BindingLocation, BufferLogger, BufferSlot, ConcreteType, ConsoleLogger, DeviceContext, getArrayType, mainLogBarrier, mainReduceWGSL, partialWGSLBeautify, stripWGSLComments, TypedBuffer, u32, U32Add, WGSLContext, WGSLModuleDeclarations } from '../imports.js';
import Utils from '../../../dot/js/Utils.js';
import { optionize3 } from '../../../phet-core/js/optionize.js';

/*
We are creating a framework around WebGPU's compute shader APIs so that we can easily vary the bind group and buffer
sharing (for profiling or optimization), while providing a convenient interface for writing shaders.

TODO: describe the API we're working with

TODO: flesh out this description and current work
 */

export default class XPrototype {
  public static async test(): Promise<string | null> {
    const device = ( await DeviceContext.getDevice() )!;
    assert && assert( device );

    const deviceContext = new DeviceContext( device );

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

    // TODO: inspect all usages of everything, look for simplification opportunities

    const firstPipelineBlueprint = new XPipelineBlueprint(
      'first',
      [
        // TODO: deduplications with this?
        new XBufferUsage( inputSlot, XBufferBindingType.READ_ONLY_STORAGE ),
        new XBufferUsage( middleSlot, XBufferBindingType.STORAGE )
      ],
      async ( deviceContext, name, pipelineLayout ) => {
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
      }
    );

    const secondPipelineBlueprint = new XPipelineBlueprint(
      'second',
      [
        new XBufferUsage( middleSlot, XBufferBindingType.READ_ONLY_STORAGE ),
        new XBufferUsage( outputSlot, XBufferBindingType.STORAGE )
      ],
      async ( deviceContext, name, pipelineLayout ) => {
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
      }
    );

        // const firstDispatchSize = Math.ceil( inputValues.length / ( workgroupSize * grainSize ) );
    // const secondDispatchSize = Math.ceil( firstDispatchSize / ( workgroupSize * grainSize * workgroupSize * grainSize ) );

    const firstRoutineBlueprint = new XRoutineBlueprint( [ firstPipelineBlueprint ], ( context, stageInputSize: number ) => {
      context.dispatch( firstPipelineBlueprint, Math.ceil( stageInputSize / ( workgroupSize * grainSize ) ) );
    } );

    const secondRoutineBlueprint = new XRoutineBlueprint( [ secondPipelineBlueprint ], ( context, stageInputSize: number ) => {
      context.dispatch( secondPipelineBlueprint, Math.ceil( stageInputSize / ( workgroupSize * grainSize ) ) );
    } );

    // TODO: really refine all of the types here

    const combinedBlueprint = new XRoutineBlueprint( [
      ...firstRoutineBlueprint.pipelineBlueprints,
      ...secondRoutineBlueprint.pipelineBlueprints
    ], ( context, inputSize: number ) => {
      // TODO: Is there a way we can set up these combinations so that we specify a list of child blueprints AND the inputs?
      firstRoutineBlueprint.execute( context, inputSize );
      secondRoutineBlueprint.execute( context, Math.ceil( inputSize / ( workgroupSize * grainSize ) ) );
    } );

    // TODO: better combinations
    // TODO: ... should we parameterize the output type?
    let promise: Promise<number[]>;
    const testBlueprint = new XRoutineBlueprint( combinedBlueprint.pipelineBlueprints, ( context, input: number[] ) => {

      // TODO: slice it?
      context.setTypedBufferValue( inputSlot, input );

      combinedBlueprint.execute( context, input.length );

      promise = context.getTypedBufferValue( outputSlot );

      // context.getTypedBufferValue( outputSlot ).then( output => console.log( output ) ).catch( err => console.error( err ) );
    } );

    const routine = await XRoutine.create(
      deviceContext,
      testBlueprint,
      [],
      XRoutine.INDIVIDUAL_LAYOUT_STRATEGY
    );

    const procedure = new XProcedure( routine );

    procedure.bindAllBuffers();

    const inputValues = _.range( 0, inputSize ).map( () => binaryOp.type.generateRandom( false ) );
    const expectedValues = [ inputValues.reduce( ( a, b ) => binaryOp.apply( a, b ), binaryOp.identity ) ];

    const actualValues = await XExecutor.execute( deviceContext, log, async executor => {
      const separateComputePasses = false;

      // TODO: parameterize things?
      procedure.execute( executor, inputValues, {
        separateComputePasses: separateComputePasses
      } );

      return promise;
    } );

    procedure.dispose();

    console.log( 'inputValues', inputValues );
    console.log( 'expectedValues', expectedValues );
    console.log( 'actualValues', actualValues );

    return null;
  }
}
alpenglow.register( 'XPrototype', XPrototype );

export abstract class XBindingType {

  protected abstract mutateBindGroupLayoutEntry( entry: GPUBindGroupLayoutEntry ): void;

  // null if they can't be combined
  public abstract combined( other: XBindingType ): XBindingType | null;

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
    public readonly type: GPUBufferBindingType
    // public readonly hasDynamicOffset: boolean = false,
    // public readonly minBindingSize = 0
  ) {
    super();
  }

  public combined( other: XBindingType ): XBindingType | null {
    if ( other instanceof XBufferBindingType ) {
      if ( this.type === other.type ) {
        return this;
      }
      else if ( this.type !== 'uniform' && other.type !== 'uniform' ) {
        // e.g. read-write and write
        return XBufferBindingType.STORAGE;
      }
      else {
        return null;
      }
    }
    else {
      return null;
    }
  }

  public toString(): string {
    return `XBufferBindingType(${this.type})`;
    // return `XBufferBindingType(${this.type}, ${this.hasDynamicOffset}, ${this.minBindingSize})`;
  }

  protected override mutateBindGroupLayoutEntry( entry: GPUBindGroupLayoutEntry ): void {
    entry.buffer = {
      type: this.type
      // hasDynamicOffset: this.hasDynamicOffset,
      // minBindingSize: this.minBindingSize // TODO: see if we get better performance by skipping validation?
    };
  }

  public static readonly UNIFORM = new XBufferBindingType( 'uniform' );
  public static readonly READ_ONLY_STORAGE = new XBufferBindingType( 'read-only-storage' );
  public static readonly STORAGE = new XBufferBindingType( 'storage' );
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

  public combined( other: XBindingType ): XBindingType | null {
    if (
      other instanceof XStorageTextureBindingType &&
      this.access === other.access &&
      this.format === other.format &&
      this.viewDimension === other.viewDimension ) {
      return this;
    }
    else {
      return null;
    }
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

  public combined( other: XBindingType ): XBindingType | null {
    if (
      other instanceof XTextureBindingType &&
      this.sampleType === other.sampleType &&
      this.viewDimension === other.viewDimension &&
      this.multisampled === other.multisampled ) {
      return this;
    }
    else {
      return null;
    }
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

// TODO: Is XBufferSlot worth the separation? Just have XConcreteBufferSlot?
export class XBufferSlot extends XResourceSlot {
  public readonly bufferSlotSlices: XBufferSlotSlice[] = [];

  public constructor(
    public readonly size: number // bytes
  ) {
    super();
  }

  public hasChildSlot( slot: XBufferSlot ): boolean {
    return this.bufferSlotSlices.some( slice => slice.bufferSlot === slot );
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
    public readonly offset = 0, // TODO: remove offset, since our BufferSlotSlices should handle it
    public readonly size = 0 // TODO: remove size, since our buffer already has a size
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
    public readonly resourceSlot: XResourceSlot,
    public readonly bindingType: XBindingType
  ) {}
}
alpenglow.register( 'XResourceUsage', XResourceUsage );

export class XBufferUsage<T> extends XResourceUsage {
  public constructor(
    public readonly bufferSlot: XConcreteBufferSlot<T>,
    bindingType: XBindingType
  ) {
    super( bufferSlot, bindingType );
  }
}
alpenglow.register( 'XBufferUsage', XBufferUsage );

export class XTextureViewUsage extends XResourceUsage {
  public constructor(
    public readonly textureViewSlot: XTextureViewSlot,
    bindingType: XBindingType
  ) {
    super( textureViewSlot, bindingType );
  }
}
alpenglow.register( 'XTextureViewUsage', XTextureViewUsage );

export class XBindingDescriptor {
  public constructor(
    public readonly bindingIndex: number,
    public readonly bindingType: XBindingType,
    public readonly slot: XResourceSlot
  ) {}

  public getBindGroupLayoutEntry(): GPUBindGroupLayoutEntry {
    return this.bindingType.getBindGroupLayoutEntry( this.bindingIndex );
  }
}
alpenglow.register( 'XBindingDescriptor', XBindingDescriptor );

export class XBinding {
  public constructor(
    public readonly location: BindingLocation,
    public readonly bindingType: XBindingType,
    public readonly slot: XResourceSlot
  ) {}

  // @deprecated - from the old version TODO remove
  public getStorageAccess(): 'read' | 'read_write' {
    if ( this.bindingType instanceof XBufferBindingType ) {
      return this.bindingType.type === 'read-only-storage' ? 'read' : 'read_write';
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
      new BindingLocation( groupIndex, binding.bindingIndex ), binding.bindingType, binding.slot
    ) );
  }

  public getBindingFromSlot( slot: XResourceSlot ): XBinding | null {
    return this.bindings.find( binding => binding.slot === slot ) || null;
  }

  public getConcreteBindingFromSlot<T>( slot: XConcreteBufferSlot<T> ): XBinding | null {
    return this.getBindingFromSlot( slot );
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

  public getConcreteBindingFromSlot<T>( slot: XConcreteBufferSlot<T> ): XBinding {
    return this.getBindingFromSlot( slot );
  }
}
alpenglow.register( 'XPipelineLayout', XPipelineLayout );

export class XPipelineBlueprint {
  public constructor(
    public readonly name: string,
    public readonly usages: XResourceUsage[],
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

  public getResourceSlots(): XResourceSlot[] {
    const resourceSlots = new Set<XResourceSlot>();
    for ( const pipelineBlueprint of this.pipelineBlueprints ) {
      for ( const usage of pipelineBlueprint.usages ) {
        resourceSlots.add( usage.resourceSlot );
      }
    }
    return Array.from( resourceSlots );
  }

  public getTopLevelResourceSlots( sharedBufferSlots: XBufferSlot[] ): XResourceSlot[] {
    const slots = _.uniq( [
      ...this.getResourceSlots(),
      ...sharedBufferSlots
    ] );

    const nonBufferSlots = slots.filter( slot => !( slot instanceof XBufferSlot ) );
    const bufferSlots = slots.filter( slot => slot instanceof XBufferSlot ) as XBufferSlot[];

    return [
      ...nonBufferSlots,
      ...bufferSlots.filter( slot => {
        return !bufferSlots.some( otherSlot => otherSlot.hasChildSlot( slot ) );
      } )
    ];
  }
}
alpenglow.register( 'XRoutineBlueprint', XRoutineBlueprint );

export class XRoutine<T> {

  public readonly pipelineBlueprints: XPipelineBlueprint[];
  public readonly rootResourceSlots: XResourceSlot[];
  public readonly bindGroupLayouts: XBindGroupLayout[];

  private constructor(
    public readonly deviceContext: DeviceContext,
    public readonly routineBlueprint: XRoutineBlueprint<T>,
    public readonly nonBufferSlots: XResourceSlot[],
    public readonly rootBufferSlots: XBufferSlot[],
    public readonly bufferSliceMap: Map<XBufferSlot, XBufferSlotSlice>,
    public readonly pipelineLayoutMap: Map<XPipelineBlueprint, XPipelineLayout>,
    public readonly computePipelineMap: Map<XPipelineBlueprint, XComputePipeline>
  ) {
    this.pipelineBlueprints = routineBlueprint.pipelineBlueprints;
    this.rootResourceSlots = [ ...nonBufferSlots, ...rootBufferSlots ];
    this.bindGroupLayouts = _.uniq( [ ...this.pipelineLayoutMap.values() ].flatMap( layout => layout.bindGroupLayouts ) );
  }

  public static async create<T>(
    deviceContext: DeviceContext,
    routineBlueprint: XRoutineBlueprint<T>,
    sharedBufferSlots: XBufferSlot[],
    layoutStrategy: ( deviceContext: DeviceContext, pipelineBlueprints: XPipelineBlueprint[] ) => Map<XPipelineBlueprint, XPipelineLayout>
  ): Promise<XRoutine<T>> {
    const slots = _.uniq( [
      ...sharedBufferSlots,
      ...routineBlueprint.getResourceSlots()
    ] );

    const nonBufferSlots = slots.filter( slot => !( slot instanceof XBufferSlot ) );
    const bufferSlots = slots.filter( slot => slot instanceof XBufferSlot ) as XBufferSlot[];
    const rootBufferSlots = bufferSlots.filter( slot => {
      return !bufferSlots.some( otherSlot => otherSlot.hasChildSlot( slot ) );
    } );

    const bufferSliceMap = new Map<XBufferSlot, XBufferSlotSlice>();
    const recur = ( rootSlot: XBufferSlot, slot: XBufferSlot, offset: number ) => {
      bufferSliceMap.set( slot, new XBufferSlotSlice( rootSlot, offset ) );
      for ( const slice of slot.bufferSlotSlices ) {
        recur( rootSlot, slice.bufferSlot, offset + slice.offset );
      }
    };
    for ( const slot of rootBufferSlots ) {
      recur( slot, slot, 0 );
    }

    // NOTE: Do bind group/pipeline layouts AFTER we figure out buffer slices recursively, since if we add dynamic
    // offsets, we'll need to know that before computing the layouts.

    const pipelineLayoutMap = layoutStrategy( deviceContext, routineBlueprint.pipelineBlueprints );

    const computePipelineMap = new Map<XPipelineBlueprint, XComputePipeline>();
    for ( const pipelineBlueprint of routineBlueprint.pipelineBlueprints ) {
      const pipelineLayout = pipelineLayoutMap.get( pipelineBlueprint )!;
      assert && assert( pipelineLayout, 'Missing pipeline layout' );

      computePipelineMap.set( pipelineBlueprint, await pipelineBlueprint.toComputePipeline(
        deviceContext, pipelineBlueprint.name, pipelineLayout
      ) );
    }

    return new XRoutine(
      deviceContext,
      routineBlueprint,
      nonBufferSlots,
      rootBufferSlots,
      bufferSliceMap,
      pipelineLayoutMap,
      computePipelineMap
    );
  }

  public static readonly INDIVIDUAL_LAYOUT_STRATEGY = (
    deviceContext: DeviceContext,
    pipelineBlueprints: XPipelineBlueprint[]
  ): Map<XPipelineBlueprint, XPipelineLayout> => {
    const map = new Map<XPipelineBlueprint, XPipelineLayout>();
    pipelineBlueprints.forEach( pipelineBlueprint => {
      const bindGroupLayout = new XBindGroupLayout(
        deviceContext,
        pipelineBlueprint.name,
        0,
        pipelineBlueprint.usages.map( ( usage, index ) => {
          return new XBindingDescriptor( index, usage.bindingType, usage.resourceSlot );
        } )
      );
      const pipelineLayout = new XPipelineLayout( deviceContext, [ bindGroupLayout ] );
      map.set( pipelineBlueprint, pipelineLayout );
    } );
    return map;
  };
}
alpenglow.register( 'XRoutine', XRoutine );

export type XProcedureExecuteOptions = {
  separateComputePasses?: boolean;
};

export class XProcedure<T> {

  private readonly selfBuffers: GPUBuffer[] = [];

  public constructor(
    public readonly routine: XRoutine<T>,
    public readonly resourceMap: Map<XResourceSlot, XResource> = new Map<XResourceSlot, XResource>(),
    public readonly bindGroupMap: Map<XBindGroupLayout, XBindGroup> = new Map<XBindGroupLayout, XBindGroup>()
  ) {}

  public bind( slot: XResourceSlot, resource: XResource ): void {
    assert && assert( !this.resourceMap.has( slot ), 'Already bound' );
    assert && assert( this.routine.rootResourceSlots.includes( slot ), 'Not a root resource slot' );

    this.resourceMap.set( slot, resource );

    this.routine.bindGroupLayouts.forEach( bindGroupLayout => {
      if ( !this.bindGroupMap.has( bindGroupLayout ) ) {
        if ( bindGroupLayout.bindings.every( binding => this.resourceMap.has( binding.slot ) ) ) {
          this.bindGroupMap.set( bindGroupLayout, new XBindGroup(
            this.routine.deviceContext,
            bindGroupLayout.name,
            bindGroupLayout,
            this.resourceMap
          ) );
        }
      }
    } );
  }

  public bindAllBuffers(): void {
    for ( const slot of this.routine.rootBufferSlots ) {
      let storageUsage = false;
      let uniformUsage = false;
      this.routine.pipelineBlueprints.forEach( pipelineBlueprint => {
        const usage = pipelineBlueprint.usages.find( usage => usage.resourceSlot === slot );

        if ( usage && usage.bindingType instanceof XBufferBindingType ) {
          if ( usage.bindingType.type === 'uniform' ) {
            uniformUsage = true;
          }
          else {
            storageUsage = true;
          }
        }
      } );

      const buffer = this.routine.deviceContext.device.createBuffer( {
        // TODO: a label!
        // label: `${this.routine.routineBlueprint.name} ${slot}`,
        size: slot.size,
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | ( storageUsage ? GPUBufferUsage.STORAGE : 0 ) | ( uniformUsage ? GPUBufferUsage.UNIFORM : 0 )
      } );
      this.selfBuffers.push( buffer );
      this.bind( slot, new XBufferResource( buffer ) );
    }
  }

  public createChild(): XProcedure<T> {
    return new XProcedure(
      this.routine,
      new Map( this.resourceMap ),
      new Map( this.bindGroupMap )
    );
  }

  public execute( executor: XExecutor, data: T, options?: XProcedureExecuteOptions ): void {
    const separateComputePasses = ( options && options.separateComputePasses ) || false;

    const context = new XExecutionContext( executor, this.routine.computePipelineMap, this.bindGroupMap, this.resourceMap, separateComputePasses );

    this.routine.routineBlueprint.execute( context, data );

    context.finish();
  }

  public dispose(): void {
    this.selfBuffers.forEach( buffer => buffer.destroy() );
  }
}
alpenglow.register( 'XProcedure', XProcedure );

export class XBindGroup {

  public readonly bindGroup: GPUBindGroup;

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly layout: XBindGroupLayout,
    resourceMap: Map<XResourceSlot, XResource>
  ) {
    const entries = layout.bindings.map( binding => {
      const resource = resourceMap.get( binding.slot )!;

      return resource.getBindGroupEntry( binding );
    } );

    this.bindGroup = deviceContext.device.createBindGroup( {
      label: `${this.name} bind group`,
      layout: layout.layout,
      entries: entries
    } );
  }
}
alpenglow.register( 'XBindGroup', XBindGroup );

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
    console.log( 'begin compute pass' );
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
    console.log( 'end compute pass' );
    this.computePassEncoder.end();
  }
}
alpenglow.register( 'XComputePass', XComputePass );

export class XExecutionContext {

  private computePass: XComputePass | null = null;

  // TODO: We might use one compute pass, we might split each into one
  public constructor(
    public readonly executor: XExecutor,

    // TODO: consider just referencing the Procedure
    public readonly computePipelineMap: Map<XPipelineBlueprint, XComputePipeline>,
    public readonly bindGroupMap: Map<XBindGroupLayout, XBindGroup>,
    public readonly resourceMap: Map<XResourceSlot, XResource>,
    public readonly separateComputePasses: boolean
  ) {}

  public dispatch(
    pipelineBlueprint: XPipelineBlueprint,
    dispatchX = 1,
    dispatchY = 1,
    dispatchZ = 1
  ): void {
    this.ensureComputePass( pipelineBlueprint.name );

    const computePipeline = this.computePipelineMap.get( pipelineBlueprint )!;
    assert && assert( computePipeline, 'Missing compute pipeline' );

    this.computePass!.dispatchPipeline( computePipeline, this.getBindGroups( computePipeline ), dispatchX, dispatchY, dispatchZ );

    if ( this.separateComputePasses ) {
      this.releaseComputePass();
    }
  }

  public dispatchIndirect(
    pipelineBlueprint: XPipelineBlueprint,
    indirectBuffer: GPUBuffer,
    indirectOffset: number
  ): void {
    this.ensureComputePass( pipelineBlueprint.name );

    const computePipeline = this.computePipelineMap.get( pipelineBlueprint )!;
    assert && assert( computePipeline, 'Missing compute pipeline' );

    this.computePass!.dispatchPipelineIndirect( computePipeline, this.getBindGroups( computePipeline ), indirectBuffer, indirectOffset );

    if ( this.separateComputePasses ) {
      this.releaseComputePass();
    }
  }

  public setTypedBufferValue<T>( concreteBufferSlot: XConcreteBufferSlot<T>, value: T ): void {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    this.executor.setTypedBufferValue( this.getTypedBuffer( concreteBufferSlot ), value );
  }

  public async getTypedBufferValue<T>( concreteBufferSlot: XConcreteBufferSlot<T> ): Promise<T> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.getTypedBufferValue( this.getTypedBuffer( concreteBufferSlot ) );
  }

  public async arrayBuffer(
    bufferSlot: XBufferSlot
  ): Promise<ArrayBuffer> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.arrayBuffer( this.getBuffer( bufferSlot ) );
  }

  public async u32(
    bufferSlot: XBufferSlot
  ): Promise<Uint32Array> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.u32( this.getBuffer( bufferSlot ) );
  }

  public async i32(
    bufferSlot: XBufferSlot
  ): Promise<Int32Array> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.i32( this.getBuffer( bufferSlot ) );
  }

  public async f32(
    bufferSlot: XBufferSlot
  ): Promise<Float32Array> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.f32( this.getBuffer( bufferSlot ) );
  }

  public async u32Numbers(
    bufferSlot: XBufferSlot
  ): Promise<number[]> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.u32Numbers( this.getBuffer( bufferSlot ) );
  }

  public async i32Numbers(
    bufferSlot: XBufferSlot
  ): Promise<number[]> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.i32Numbers( this.getBuffer( bufferSlot ) );
  }

  public async f32Numbers(
    bufferSlot: XBufferSlot
  ): Promise<number[]> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.f32Numbers( this.getBuffer( bufferSlot ) );
  }

  public finish(): void {
    if ( this.computePass ) {
      this.releaseComputePass();
    }
  }

  private getBuffer( bufferSlot: XBufferSlot ): GPUBuffer {
    const resource = this.resourceMap.get( bufferSlot )!;
    assert && assert( resource, 'Missing resource' );

    return resource.resource as GPUBuffer;
  }

  private getTypedBuffer<T>( concreteBufferSlot: XConcreteBufferSlot<T> ): TypedBuffer<T> {
    const buffer = this.getBuffer( concreteBufferSlot );

    return new TypedBuffer<T>( buffer, concreteBufferSlot.concreteType );
  }

  private getBindGroups( computePipeline: XComputePipeline ): XBindGroup[] {
    const bindGroups: XBindGroup[] = [];
    for ( const bindGroupLayout of computePipeline.pipelineLayout.bindGroupLayouts ) {
      const bindGroup = this.bindGroupMap.get( bindGroupLayout )!;
      assert && assert( bindGroup, 'Missing bind group' );

      bindGroups.push( bindGroup );
    }
    return bindGroups;
  }

  private ensureComputePass( name: string ): XComputePass {
    if ( this.computePass === null ) {
      this.computePass = this.executor.getComputePass( this.separateComputePasses ? name : 'primary' );
    }
    return this.computePass;
  }

  private releaseComputePass(): void {
    this.computePass?.end();
    this.computePass = null;
  }
}
alpenglow.register( 'XExecutionContext', XExecutionContext );

export type ExecutorOptions = {
  getTimestampWrites?: ( name: string ) => GPUComputePassTimestampWrites | null;
};

const EXECUTOR_DEFAULT_OPTIONS = {
  getTimestampWrites: _.constant( null )
} as const;

export class XExecutor {

  private getTimestampWrites: ( name: string ) => GPUComputePassTimestampWrites | null;

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly encoder: GPUCommandEncoder,
    public readonly bufferLogger: BufferLogger,
    providedOptions?: ExecutorOptions
  ) {
    const options = optionize3<ExecutorOptions>()( {}, EXECUTOR_DEFAULT_OPTIONS, providedOptions );

    this.getTimestampWrites = options.getTimestampWrites;
  }

  public getComputePass( name: string ): XComputePass {
    const computePassDescriptor: GPUComputePassDescriptor = {
      label: `${name} compute pass`
    };

    const timestampWrites = this.getTimestampWrites( name );
    if ( timestampWrites !== null ) {
      computePassDescriptor.timestampWrites = timestampWrites;
    }

    return new XComputePass( this.encoder, computePassDescriptor );
  }

  public setTypedBufferValue<T>( typedBuffer: TypedBuffer<T>, value: T ): void {
    typedBuffer.setValue( this.deviceContext.device, value );
  }

  public async getTypedBufferValue<T>( typedBuffer: TypedBuffer<T> ): Promise<T> {
    return typedBuffer.getValue( this.encoder, this.bufferLogger );
  }

  public async arrayBuffer(
    buffer: GPUBuffer
  ): Promise<ArrayBuffer> {
    return this.bufferLogger.arrayBuffer( this.encoder, buffer );
  }

  public async u32(
    buffer: GPUBuffer
  ): Promise<Uint32Array> {
    return this.bufferLogger.u32( this.encoder, buffer );
  }

  public async i32(
    buffer: GPUBuffer
  ): Promise<Int32Array> {
    return this.bufferLogger.i32( this.encoder, buffer );
  }

  public async f32(
    buffer: GPUBuffer
  ): Promise<Float32Array> {
    return this.bufferLogger.f32( this.encoder, buffer );
  }

  public async u32Numbers(
    buffer: GPUBuffer
  ): Promise<number[]> {
    return this.bufferLogger.u32Numbers( this.encoder, buffer );
  }

  public async i32Numbers(
    buffer: GPUBuffer
  ): Promise<number[]> {
    return this.bufferLogger.i32Numbers( this.encoder, buffer );
  }

  public async f32Numbers(
    buffer: GPUBuffer
  ): Promise<number[]> {
    return this.bufferLogger.f32Numbers( this.encoder, buffer );
  }

  public static async execute<T>(
    deviceContext: DeviceContext,
    log: boolean,
    task: ( executor: XExecutor ) => Promise<T>,
    options?: ExecutorOptions
  ): Promise<T> {

    const encoder = deviceContext.device.createCommandEncoder( { label: 'the encoder' } );
    const bufferLogger = new BufferLogger( deviceContext );

    const executor = new XExecutor(
      deviceContext,
      encoder,
      bufferLogger,
      options
    );

    // TODO: staging ring for our "out" buffers?
    const outputPromise = task( executor );

    const logPromise = log ? executor.arrayBuffer( deviceContext.getLogTypedBuffer().buffer ) : Promise.resolve( null );

    console.log( 'finish' );
    const commandBuffer = encoder.finish();
    deviceContext.device.queue.submit( [ commandBuffer ] );

    await bufferLogger.complete();

    const logResult = await logPromise;

    if ( logResult ) {
      const data = new Uint32Array( logResult );
      const length = data[ 0 ];
      const usedMessage = `logging used ${length} of ${data.length - 1} u32s (${Utils.roundSymmetric( 100 * length / ( data.length - 1 ) )}%)`;
      console.log( usedMessage );

      const logData = ConsoleLogger.analyze( logResult );

      logData.forEach( shaderData => {
        shaderData.logLines.forEach( lineData => {
          console.log(
            shaderData.shaderName,
            `>>> ${lineData.info.logName}${lineData.additionalIndex !== null ? ` (${lineData.additionalIndex})` : ''}`,
            lineData.info.lineToLog( lineData )
          );
        } );
      } );

      console.log( usedMessage );
    }

    return outputPromise;
  }
}
alpenglow.register( 'XExecutor', XExecutor );
