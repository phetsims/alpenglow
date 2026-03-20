// Copyright 2023-2026, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import arrayRemove from '../../../../phet-core/js/arrayRemove.js';
import { optionize3 } from '../../../../phet-core/js/optionize.js';
import { alpenglow } from '../../alpenglow.js';
import { ResourceUsage } from './ResourceUsage.js';
import type { PipelineLayout } from './PipelineLayout.js';
import { WGSLModuleDeclarations } from '../wgsl/WGSLString.js';
import type { ResourceSlot } from './ResourceSlot.js';
import type { BindingType } from './BindingType.js';

export type PipelineBlueprintOptions = {
  name: string;

  // TODO: NOTE that this is not really... needed? Can we remove it? (log should only be for the WGSL generation)
  log?: boolean;
};

export const PIPELINE_BLUEPRINT_DEFAULTS = {
  log: false
} as const;

export class PipelineBlueprint {

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