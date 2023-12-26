// Copyright 2023, University of Colorado Boulder

/**
 * Represents a collection of BlueprintStages.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindGroup, BindGroupLayout, BindingLocation, BindingType, ComputePipeline, ConcreteType, DeviceContext, getArrayType, mainReduceWGSL, PipelineLayout, SingleReduceShaderOptions, TypedBuffer, u32, WGSLContext } from '../../imports.js';
import WithRequired from '../../../../phet-core/js/types/WithRequired.js';
import StrictOmit from '../../../../phet-core/js/types/StrictOmit.js';
import IntentionalAny from '../../../../phet-core/js/types/IntentionalAny.js';
import { combineOptions } from '../../../../phet-core/js/optionize.js';

export type BufferSlotMapType = Record<string, BufferSlot>;
export type TypedBindingTypeMapType = Record<string, TypedBindingType>;

// TODO: use BoundResource and improve it

// TODO: better name
export class TypedBindingType<T = unknown> {
  public constructor(
    public readonly bindingType: BindingType,
    public readonly type: ConcreteType<T>
  ) {}
}
alpenglow.register( 'TypedBindingType', TypedBindingType );

export class BindingBlueprint<T = unknown> {
  public constructor(
    public readonly pipelineBlueprint: PipelineBlueprint<IntentionalAny>,
    public readonly layoutName: string,
    public readonly typedBindingType: TypedBindingType<T>
  ) {}
}
alpenglow.register( 'BindingBlueprint', BindingBlueprint );

export class BufferSlot<T = unknown> {
  public constructor(
    public readonly bindingBlueprints: BindingBlueprint<T>[]
  ) {}

  public static from<T>( bufferSlots: BufferSlot<T>[] ): BufferSlot<T> {
    return new BufferSlot( bufferSlots.map( bufferSlot => bufferSlot.bindingBlueprints ).flat() );
  }
}
alpenglow.register( 'BufferSlot', BufferSlot );

export class Binding<T> {
  public constructor(
    public readonly bufferSlot: BufferSlot<T>,
    public readonly bindingType: BindingType,
    public readonly location: BindingLocation
  ) {}

  public getBindGroupLayoutEntry(): GPUBindGroupLayoutEntry {
    return this.bindingType.getBindGroupLayoutEntry( this.location.bindingIndex );
  }

  public getBindGroupEntry( resource: GPUBuffer | GPUTextureView ): GPUBindGroupEntry {
    return this.bindingType.getBindGroupEntry( this.location.bindingIndex, resource );
  }

  public getStorageAccess(): 'read' | 'read_write' {
    assert && assert( this.bindingType === BindingType.STORAGE_BUFFER || this.bindingType === BindingType.READ_ONLY_STORAGE_BUFFER );

    return this.bindingType === BindingType.READ_ONLY_STORAGE_BUFFER ? 'read' : 'read_write';
  }
}
alpenglow.register( 'Binding', Binding );

// TODO: proper typing for everything(!)

export class PipelineBlueprint<TypedBindingTypeMap extends TypedBindingTypeMapType> {
  public constructor(
    public readonly name: string,
    public readonly bindingMap: TypedBindingTypeMap, // TODO: do we need these?
    public readonly toComputePipeline: (
      context: DeviceContext, pipelineLayout: PipelineLayout
    ) => Promise<ComputePipeline>
  ) {}
}
alpenglow.register( 'PipelineBlueprint', PipelineBlueprint );


export class RoutineBlueprint {

  public readonly bufferSlots: BufferSlot<IntentionalAny>[] = [];
  public readonly logBufferSlot: BufferSlot<number[]> | null;

  public constructor(
    public readonly pipelineBlueprints: PipelineBlueprint<IntentionalAny>[],
    public readonly bufferSlotMap: BufferSlotMapType,
    public readonly internalBufferSlots: BufferSlot[],
    public readonly log: boolean
  ) {
    for ( const bufferSlot of this.internalBufferSlots ) {
      this.bufferSlots.push( bufferSlot );
    }
    Object.keys( bufferSlotMap ).forEach( name => {
      this.bufferSlots.push( bufferSlotMap[ name ] );
    } );
    if ( log ) {
      this.logBufferSlot = new BufferSlot<number[]>( pipelineBlueprints.map( pipelineBlueprint => {
        return new BindingBlueprint<number[]>(
          pipelineBlueprint,
          'log',
          WGSLContext.getLogTypedBindingType()
        );
      } ) );
      this.bufferSlots.push( this.logBufferSlot );
    }
    else {
      this.logBufferSlot = null;
    }
  }

  public static create<TypedBindingTypeMap extends Record<string, TypedBindingType<IntentionalAny>>>(
    name: string,
    typedBindingMap: TypedBindingTypeMap,
    log: boolean,
    toComputePipeline: ( context: DeviceContext, pipelineLayout: PipelineLayout ) => Promise<ComputePipeline>
  ): RoutineBlueprint {

    const pipelineBlueprint = new PipelineBlueprint( name, typedBindingMap, toComputePipeline );

    const bufferSlotMap: BufferSlotMapType = {};
    Object.keys( typedBindingMap ).forEach( name => {
      bufferSlotMap[ name ] = new BufferSlot( [
        new BindingBlueprint( pipelineBlueprint, name, typedBindingMap[ name ] )
      ] );
    } );

    return new RoutineBlueprint(
      [ pipelineBlueprint ],
      bufferSlotMap,
      [],
      log
    );
  }
}
alpenglow.register( 'RoutineBlueprint', RoutineBlueprint );

// TODO: Can we replace this usage with just ComputePipeline?
export class UnboundPipeline {
  public constructor(
    public readonly computePipeline: ComputePipeline
  ) {}
}
alpenglow.register( 'UnboundPipeline', UnboundPipeline );

export class UnboundRoutine {

  public readonly bindGroupLayouts: BindGroupLayout[] = [];

  public constructor(
    public readonly routineBlueprint: RoutineBlueprint,
    public readonly unboundPipelines: UnboundPipeline[]
  ) {
    const bindGroupLayouts: BindGroupLayout[] = [];
    for ( const unboundPipeline of unboundPipelines ) {
      for ( const bindGroupLayout of unboundPipeline.computePipeline.pipelineLayout.bindGroupLayouts ) {
        bindGroupLayouts.push( bindGroupLayout );
      }
    }

    this.bindGroupLayouts.push( ..._.uniq( bindGroupLayouts ) );
  }

  public static separateGroupsStrategy(
    deviceContext: DeviceContext,
    routineBlueprint: RoutineBlueprint
  ): PipelineLayout[] {
    return routineBlueprint.pipelineBlueprints.map( pipelineBlueprint => {
      const usedBufferSlots = routineBlueprint.bufferSlots.filter( bufferSlot => {
        return bufferSlot.bindingBlueprints.some( bindingBlueprint => bindingBlueprint.pipelineBlueprint === pipelineBlueprint );
      } );

      const bindingMap: Record<string, Binding<IntentionalAny>> = {};
      usedBufferSlots.forEach( ( bufferSlot, i ) => {
        const bindingBlueprint = bufferSlot.bindingBlueprints.find( bindingBlueprint => bindingBlueprint.pipelineBlueprint === pipelineBlueprint )!;

        // We'll handle log below
        if ( bindingBlueprint.layoutName === 'log' ) {
          return;
        }

        const binding = new Binding(
          bufferSlot,
          bindingBlueprint.typedBindingType.bindingType,
          new BindingLocation( 0, i )
        );

        bindingMap[ bindingBlueprint.layoutName ] = binding;
      } );

      if ( routineBlueprint.log ) {
        assert && assert( routineBlueprint.logBufferSlot );

        bindingMap.log = new Binding(
          routineBlueprint.logBufferSlot!,
          BindingType.STORAGE_BUFFER,
          WGSLContext.getLogBindingLocation()
        );
      }

      return new PipelineLayout( deviceContext, [
        new BindGroupLayout( deviceContext, `${pipelineBlueprint.name} bind group layout`, 0, bindingMap )
      ] );
    } );
  }

  public static async toUnbound(
    deviceContext: DeviceContext,
    routineBlueprint: RoutineBlueprint,
    strategy: ( deviceContext: DeviceContext, routineBlueprint: RoutineBlueprint ) => PipelineLayout[]
  ): Promise<UnboundRoutine> {
    const pipelineLayouts = strategy( deviceContext, routineBlueprint );

    const unboundPipelines: UnboundPipeline[] = [];
    for ( let i = 0; i < routineBlueprint.pipelineBlueprints.length; i++ ) {
      const pipelineBlueprint = routineBlueprint.pipelineBlueprints[ i ];
      const pipelineLayout = pipelineLayouts[ i ];

      unboundPipelines.push( new UnboundPipeline( await pipelineBlueprint.toComputePipeline( deviceContext, pipelineLayout ) ) );
    }

    return new UnboundRoutine( routineBlueprint, unboundPipelines );
  }
}
alpenglow.register( 'UnboundRoutine', UnboundRoutine );

export class BoundPipeline {
  public constructor(
    public readonly computePipeline: ComputePipeline,
    public readonly bindGroups: ( BindGroup | null )[] // null means it was deferred
  ) {}
}
alpenglow.register( 'BoundPipeline', BoundPipeline );

export class BoundRoutine {
  // TODO
  // public constructor(
  //
  // ) {}

  public static toBound(
    deviceContext: DeviceContext,
    unboundRoutine: UnboundRoutine,
    bindSettings: Record<string, 'defer' | TypedBuffer<IntentionalAny> | GPUTextureView | undefined>
  ): BoundRoutine {
    // @ts-expect-error
    return null; // TPDP
  }
}
alpenglow.register( 'BoundRoutine', BoundRoutine );

type TestOptions<T> = StrictOmit<WithRequired<SingleReduceShaderOptions<T>, 'binaryOp'>, 'workgroupSize' | 'grainSize' | 'log' | 'bindings'>;
export class BlueprintTests {
  public static async test<T>(
    deviceContext: DeviceContext,
    name: string,
    options: TestOptions<T>
  ): Promise<string | null> {
    const binaryOp = options.binaryOp;

    const workgroupSize = 256;
    const grainSize = 8;
    const inputSize = workgroupSize * grainSize * 5 - 27;

    // TODO: make sure we're including testing WITH logging(!)
    const log = false;
    const maxItemCount = workgroupSize * grainSize * 10; // pretend

    const inputType = getArrayType( binaryOp.type, maxItemCount, binaryOp.identity );
    const middleType = getArrayType( binaryOp.type, Math.ceil( maxItemCount / ( workgroupSize * grainSize ) ), binaryOp.identity );
    const outputType = binaryOp.type;

    const firstBlueprint = RoutineBlueprint.create( `${name} first`, {
      input: new TypedBindingType( BindingType.READ_ONLY_STORAGE_BUFFER, inputType ),
      output: new TypedBindingType( BindingType.STORAGE_BUFFER, middleType )
    }, log, async ( deviceContext, pipelineLayout ) => {
      return ComputePipeline.withContextAsync(
        deviceContext,
        `${name} first`,
        context => mainReduceWGSL( context, combineOptions<SingleReduceShaderOptions<T>>( {
          workgroupSize: workgroupSize,
          grainSize: grainSize,
          loadReducedOptions: combineOptions<Required<SingleReduceShaderOptions<T>>[ 'loadReducedOptions' ]>( {
            lengthExpression: u32( inputSize )
          }, options.loadReducedOptions ),
          log: log,
          // TODO: naming mismatch
          bindings: pipelineLayout.bindingMap as IntentionalAny // TODO! Can we get back typing?
        }, options ) ),
        pipelineLayout,
        log
      );
    } );

    const secondBlueprint = RoutineBlueprint.create( `${name} second`, {
      input: new TypedBindingType( BindingType.READ_ONLY_STORAGE_BUFFER, middleType ),
      output: new TypedBindingType( BindingType.STORAGE_BUFFER, outputType )
    }, log, async ( deviceContext, pipelineLayout ) => {
      return ComputePipeline.withContextAsync(
        deviceContext,
        `${name} second`,
        context => mainReduceWGSL( context, combineOptions<SingleReduceShaderOptions<T>>( {
          workgroupSize: workgroupSize,
          grainSize: grainSize,
          loadReducedOptions: combineOptions<Required<SingleReduceShaderOptions<T>>[ 'loadReducedOptions' ]>( {
            lengthExpression: u32( Math.ceil( inputSize / ( workgroupSize * grainSize ) ) )
          }, options.loadReducedOptions ),
          log: log,
          bindings: pipelineLayout.bindingMap as IntentionalAny // TODO! Can we get back typing?
        }, options ) ),
        pipelineLayout,
        log
      );
    } );

    const combinedBlueprint = new RoutineBlueprint(
      [
        ...firstBlueprint.pipelineBlueprints,
        ...secondBlueprint.pipelineBlueprints
      ],
      {
        input: firstBlueprint.bufferSlotMap.input,
        output: secondBlueprint.bufferSlotMap.output
      },
      [
        BufferSlot.from( [
          firstBlueprint.bufferSlotMap.output,
          secondBlueprint.bufferSlotMap.input
        ] )
      ],
      firstBlueprint.log || secondBlueprint.log // TODO: factor out(!)
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const unboundRoutine = await UnboundRoutine.toUnbound( deviceContext, combinedBlueprint, UnboundRoutine.separateGroupsStrategy );

    // TODO: oh no, we need to handle dispatch sizes
    // TODO: presumably... the RoutineBlueprint could have a function to get the dispatch size?

    // TODO: we either "bind" each "named" resource, we "default" it (have it created), or "defer" it (will be swapped later).

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
