// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType, BufferSlot, ComputePipeline, DeviceContext, getArrayType, getCastedType, PipelineLayout, ResourceSlot, ResourceUsage, U32Type, WGSLModuleDeclarations, WGSLVariableName } from '../../imports.js';

export default class PipelineBlueprint {

  public readonly usages: ResourceUsage[];

  private readonly declarations: WGSLInternalDeclaration[] = [];
  private readonly usageMap: Map<WGSLVariableName, ResourceUsage> = new Map<WGSLVariableName, ResourceUsage>();

  public constructor(
    public readonly name: string,
    public readonly withBlueprint: ( blueprint: PipelineBlueprint ) => void, // TODO: combine this into the type(!)
    public readonly log = false
  ) {
    withBlueprint( this );

    this.usages = Array.from( this.usageMap.values() ); // TODO: get rid of this forwarding
  }

  public async toComputePipeline(
    deviceContext: DeviceContext,
    pipelineLayout: PipelineLayout
  ): Promise<ComputePipeline> {
    return ComputePipeline.withContextAsync(
      deviceContext,
      this.name,
      this.toString( pipelineLayout ),
      pipelineLayout,
      this.log
    );
  }

  // TODO: oh no, we need to put the atomic in here(!)
  // TODO: Or actually, just an ability to put structs of arbitrary types in ConcreteTypes
  public static readonly LOG_BUFFER_SLOT = new BufferSlot( getCastedType( getArrayType( U32Type, 2 << 22, 0 ), context => {
    context.add( '_Log', `
      struct _Log {
        next_space: atomic<u32>,
        data: array<u32>
      };
    ` );

    return '_Log';
  } ) );

  public add(
    name: string,
    declarations: WGSLModuleDeclarations
  ): void {
    if ( !this.declarations.some( declaration => declaration.name === name ) ) {
      this.declarations.push( new WGSLInternalDeclaration( name, declarations ) );
    }
  }

  public addSlot( name: WGSLVariableName, slot: ResourceSlot, bindingType: BindingType ): void {
    // If it already exists, we'll do some checks and "combine" types (might switch read-only to read-write, etc.)
    if ( this.usageMap.has( name ) ) {
      const usage = this.usageMap.get( name )!;
      assert && assert( usage.resourceSlot === slot );

      const combinedType = bindingType.combined( usage.bindingType )!;
      assert && assert( combinedType );

      this.usageMap.set( name, new ResourceUsage( slot, combinedType ) );
    }
    else {
      this.usageMap.set( name, new ResourceUsage( slot, bindingType ) );
    }
  }

  public toString( pipelineLayout: PipelineLayout ): string {
    return [
      ...Array.from( this.usageMap.keys() ).map( name => {
        const usage = this.usageMap.get( name )!;
        const binding = pipelineLayout.getBindingFromSlot( usage.resourceSlot );

        // NOTE: type declaration should NOT create another usage. We will already have created bind group layouts
        // based on the usages at this point, so referencing ANOTHER slot would cause major issues.
        return binding.getWGSLDeclaration( this, name );
      } ),
      ...this.declarations.map( declaration => declaration.declarations )
    ].join( '\n' );
  }
}
alpenglow.register( 'PipelineBlueprint', PipelineBlueprint );

class WGSLInternalDeclaration {
  public constructor(
    public readonly name: string,
    public readonly declarations: WGSLModuleDeclarations
  ) {}
}
