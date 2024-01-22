// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType, BufferSlot, ComputePipeline, DeviceContext, getArrayType, getCastedType, PipelineLayout, ResourceSlot, ResourceUsage, U32Type, wgsl, WGSLModuleDeclarations, wgslWith } from '../../imports.js';
import { optionize3 } from '../../../../phet-core/js/optionize.js';
import arrayRemove from '../../../../phet-core/js/arrayRemove.js';

export type PipelineBlueprintOptions = {
  name: string;

  // TODO: NOTE that this is not really... needed? Can we remove it? (log should only be for the WGSL generation)
  log?: boolean;
};

export const PIPELINE_BLUEPRINT_DEFAULTS = {
  log: false
} as const;

export default class PipelineBlueprint {

  public readonly usages: ResourceUsage[] = [];
  public readonly name: string;
  public readonly log: boolean;

  private readonly declarations: WGSLInternalDeclaration[] = [];
  private readonly usageMap: Map<string, ResourceUsage> = new Map<string, ResourceUsage>();

  public constructor(
    providedOptions: PipelineBlueprintOptions
  ) {
    const options = optionize3<PipelineBlueprintOptions>()( {}, PIPELINE_BLUEPRINT_DEFAULTS, providedOptions );

    this.name = options.name;
    this.log = options.log;
  }

  public async toComputePipeline(
    deviceContext: DeviceContext,
    pipelineLayout: PipelineLayout
  ): Promise<ComputePipeline> {
    return ComputePipeline.withContextAsync(
      deviceContext,
      this.name,
      this.toString( pipelineLayout ),
      pipelineLayout
    );
  }

  // TODO: oh no, we need to put the atomic in here(!)
  // TODO: Or actually, just an ability to put structs of arbitrary types in ConcreteTypes
  public static readonly LOG_BUFFER_SLOT = new BufferSlot( getCastedType( getArrayType( U32Type, 2 << 22, 0 ), wgslWith(
    wgsl`_Log`, '_Log', wgsl`
    struct _Log {
      next_space: atomic<u32>,
      data: array<u32>
    };
  ` ) ) );

  public add(
    name: string,
    declarations: WGSLModuleDeclarations
  ): void {
    if ( !this.declarations.some( declaration => declaration.name === name ) ) {
      this.declarations.push( new WGSLInternalDeclaration( name, declarations.withBlueprint( this ) ) );
    }
  }

  public addSlot( name: string, slot: ResourceSlot, bindingType: BindingType ): void {
    let usage: ResourceUsage;
    // If it already exists, we'll do some checks and "combine" types (might switch read-only to read-write, etc.)
    if ( this.usageMap.has( name ) ) {
      const oldUsage = this.usageMap.get( name )!;
      assert && assert( oldUsage.resourceSlot === slot );

      const combinedType = bindingType.combined( oldUsage.bindingType )!;
      assert && assert( combinedType );

      arrayRemove( this.usages, oldUsage );

      usage = new ResourceUsage( slot, combinedType );
    }
    else {
      usage = new ResourceUsage( slot, bindingType );
    }

    this.usageMap.set( name, usage );
    this.usages.push( usage );
  }

  public toString( pipelineLayout: PipelineLayout ): string {
    return [
      ...Array.from( this.usageMap.keys() ).map( name => {
        const usage = this.usageMap.get( name )!;
        const binding = pipelineLayout.getBindingFromSlot( usage.resourceSlot );

        // NOTE: type declaration should NOT create another usage. We will already have created bind group layouts
        // based on the usages at this point, so referencing ANOTHER slot would cause major issues.
        return binding.getWGSLDeclaration( name ).withBlueprint( this );
      } ),
      ...this.declarations.map( declaration => declaration.declarations )
    ].join( '\n' );
  }

  public toDebugString(): string {
    return `PipelineBlueprint["${this.name}" log:${this.log}]\n${Array.from( this.usageMap.keys() ).map( name => {
      const usage = this.usageMap.get( name )!;
      return `  ${name}: ${usage.toDebugString()}`;
    } ).join( '\n' )}`;
  }
}
alpenglow.register( 'PipelineBlueprint', PipelineBlueprint );

class WGSLInternalDeclaration {
  public constructor(
    public readonly name: string,
    public readonly declarations: string
  ) {}
}
